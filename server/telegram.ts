/**
 * Telegram OTP Service
 * Sends OTP codes via Telegram Bot API
 */

import TelegramBot from 'node-telegram-bot-api';
import { storage } from './storage';
import { sendEmail, createOtpEmailTemplate } from './email';
import { sendOtpViaSms, sendRequestStatusSms } from './sms';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = TELEGRAM_BOT_TOKEN
  ? `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`
  : null;

let bot: TelegramBot | null = null;

interface SendOtpResult {
  success: boolean;
  message: string;
  channel?: 'email' | 'telegram' | 'sms';
}

/**
 * Send message to Telegram API directly
 * Useful for OTP and other notifications
 */
export async function sendTelegramMessage(
  chatId: string | number,
  message: string
): Promise<boolean> {
  try {
    if (!TELEGRAM_API_URL) {
      console.log('[TELEGRAM] TELEGRAM_BOT_TOKEN not set; skipping send');
      return false;
    }

    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });

    const data = await response.json() as any;
    
    if (!response.ok) {
      console.error('[TELEGRAM API ERROR]', data);
      return false;
    }

    console.log('[TELEGRAM MESSAGE SENT] Message ID:', data.result?.message_id);
    return true;
  } catch (error) {
    console.error('[TELEGRAM SEND ERROR]', error);
    return false;
  }
}

/**
 * Send OTP via Telegram using stored chat ID
 */
export async function sendOtpViaTelegram(
  phoneNumber: string,
  otpCode: string,
  telegramChatId?: string
): Promise<SendOtpResult> {
  try {
    if (!TELEGRAM_API_URL) {
      return {
        success: false,
        message: 'Telegram bot token not configured (TELEGRAM_BOT_TOKEN missing)',
        channel: 'telegram'
      };
    }

    if (!telegramChatId) {
      console.log(`[TELEGRAM OTP - NOT LINKED] Phone: ${phoneNumber}, Code: ${otpCode}`);
      return {
        success: false,
        message: `User Telegram not linked. Start the bot and use /link <email> to link your account.`,
        channel: 'telegram'
      };
    }

    const message = `🔐 <b>Your DepEd IT Services OTP Code</b>\n\n<code>${otpCode}</code>\n\nValid for 10 minutes.\n\n⚠️ Do not share this code with anyone!`;
    const success = await sendTelegramMessage(telegramChatId, message);
    
    return {
      success,
      message: success 
        ? `OTP code sent via Telegram to chat ${telegramChatId}` 
        : 'Failed to send OTP via Telegram',
      channel: 'telegram'
    };
  } catch (error) {
    console.error('[TELEGRAM ERROR]', error);
    return {
      success: false,
      message: 'Failed to send OTP via Telegram'
    };
  }
}

/**
 * Send OTP via Email
 * Uses Gmail SMTP configured in .env
 */
export async function sendOtpViaEmail(
  email: string,
  otpCode: string,
  userName?: string
): Promise<SendOtpResult> {
  try {
    const htmlContent = createOtpEmailTemplate(userName || 'User', otpCode, 10);
    
    const result = await sendEmail({
      to: email,
      subject: '🔐 DepEd IT Services - OTP Verification Code',
      htmlContent,
    });

    return {
      success: result.success,
      message: result.success 
        ? `OTP code sent via Email to ${email}` 
        : `Failed to send OTP via Email: ${result.message}`,
      channel: 'email'
    };
  } catch (error) {
    console.error('[EMAIL ERROR]', error);
    return {
      success: false,
      message: 'Failed to send OTP via Email'
    };
  }
}

/**
 * Send OTP via multiple channels (Email + Telegram + SMS) for redundancy
 */
export async function sendOtpViaMultipleChannels(
  email: string,
  phoneNumber: string,
  otpCode: string,
  userName?: string,
  telegramChatId?: string,
  userId?: number
): Promise<{ email: SendOtpResult; telegram: SendOtpResult; sms: SendOtpResult }> {
  try {
    const [emailResult, telegramResult, smsResult] = await Promise.all([
      sendOtpViaEmail(email, otpCode, userName),
      sendOtpViaTelegram(phoneNumber, otpCode, telegramChatId),
      (async () => {
        const r = await sendOtpViaSms(phoneNumber, otpCode);
        return { ...r, channel: 'sms' as const };
      })(),
    ]);

    return { email: emailResult, telegram: telegramResult, sms: smsResult };
  } catch (error) {
    console.error('[MULTI-CHANNEL OTP ERROR]', error);
    return {
      email: { success: false, message: 'Failed to send OTP via Email' },
      telegram: { success: false, message: 'Failed to send OTP via Telegram' },
      sms: { success: false, message: 'Failed to send OTP via SMS' },
    };
  }
}

/**
 * Notify user about request status update (approved, denied, or updated)
 * Sends via Telegram if user has linked their account
 */
export async function notifyUserRequestUpdate(
  telegramChatId: string | number | undefined,
  requestId: number,
  requestTitle: string,
  newStatus: 'pending' | 'on_going' | 'finished',
  adminResponse?: string,
  userName?: string
): Promise<boolean> {
  try {
    if (!TELEGRAM_API_URL) {
      console.log(`[REQUEST UPDATE] Telegram not configured; skipping Telegram send for request #${requestId}`);
      return false;
    }

    if (!telegramChatId) {
      console.log(`[REQUEST UPDATE - TELEGRAM NOT LINKED] Request #${requestId}, Status: ${newStatus}, User: ${userName}`);
      return false;
    }

    let statusEmoji = '⏳';
    let statusText = 'Pending';
    let statusColor = 'yellow';

    if (newStatus === 'finished') {
      statusEmoji = '✅';
      statusText = 'Finished';
      statusColor = 'green';
    } else if (newStatus === 'on_going') {
      statusEmoji = '🛠️';
      statusText = 'On-Going';
      statusColor = 'blue';
    }

    // Build the notification message
    let message = `${statusEmoji} <b>Your Request ${statusText}</b>\n\n`;
    message += `<b>Request ID:</b> #${requestId}\n`;
    message += `<b>Title:</b> ${requestTitle}\n`;
    message += `<b>Status:</b> <code>${statusText}</code>\n`;

    if (adminResponse) {
      message += `\n<b>Admin Response:</b>\n${adminResponse}\n`;
    }

    message += `\n📱 <b>Visit the website for more details:</b>\n`;
    message += `<a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/requests/${requestId}">View Request Details</a>\n\n`;
    message += `Thanks for using DepEd IT Support System! 🎓`;

    const success = await sendTelegramMessage(telegramChatId, message);

    if (success) {
      console.log(`[REQUEST UPDATE - TELEGRAM SENT] Request #${requestId}, Status: ${statusText}, User: ${userName}, ChatID: ${telegramChatId}`);
    } else {
      console.log(`[REQUEST UPDATE - TELEGRAM FAILED] Request #${requestId}, Status: ${statusText}, User: ${userName}, ChatID: ${telegramChatId}`);
    }

    return success;
  } catch (error) {
    console.error('[REQUEST UPDATE TELEGRAM ERROR]', error);
    return false;
  }
}

/**
 * Notify user about request status update via SMS (SIM800L/RPi gateway)
 */
export async function notifyUserRequestUpdateSms(
  phoneNumber: string | undefined,
  userId: number | undefined,
  requestId: number,
  requestTitle: string,
  newStatus: 'pending' | 'on_going' | 'finished',
  adminResponse?: string,
): Promise<boolean> {
  const phone = (phoneNumber || "").trim();
  if (!phone) return false;

  // sendRequestStatusSms will queue if SMS_MODE=pull
  const result = await sendRequestStatusSms(phone, requestId, requestTitle, newStatus, adminResponse);
  return result.success;
}

export async function sendFinishedSurveyEmail(
  email: string | undefined,
  userName: string | undefined,
  requestId: number,
  requestTitle: string,
): Promise<boolean> {
  const to = (email || "").trim();
  if (!to) return false;

  const surveyUrl =
    "https://forms.office.com/Pages/ResponsePage.aspx?id=gKvjQCQgo0W_dnoHYaJNKfX6mizlSOtEuBUUaobYm6pUM1hLWk9HU01EQzQ4MFQxTkxaNVYxSjdGSy4u&fbclid=IwY2xjawQuj8ZleHRuA2FlbQIxMQBzcnRjBmFwcF9pZAEwAAEe_BtbxRkZWDu6m7lyEBqJFigZAQZIALRhXTB8eVLTcf62UPT63EhrjYDT4zE_aem_JKSqla9L3RAz5d1NmMao_A";

  const htmlContent = `
    <html>
      <body style="font-family: Arial, sans-serif; color:#1f2937; line-height:1.55;">
        <h2 style="color:#1d4ed8; margin-bottom:8px;">DepEd Marinduque IT Services</h2>
        <p>Hello ${userName || "Client"},</p>
        <p>
          Thank you for using our IT Service Request System.
          Your request <strong>#${requestId} - ${requestTitle}</strong> has been marked as <strong>Finished</strong>.
        </p>
        <p>
          To help us improve the quality of our service, may we kindly ask you to answer our client satisfaction survey:
        </p>
        <p>
          <a href="${surveyUrl}" target="_blank" rel="noopener noreferrer">Open Client Satisfaction Survey</a>
        </p>
        <p>Thank you and have a great day.</p>
      </body>
    </html>
  `;

  const result = await sendEmail({
    to,
    subject: "DepEd IT Services - Thank You and Client Satisfaction Survey",
    htmlContent,
  });
  return result.success;
}

/**
 * Notify user when their request receives a new update/comment from admin
 */
export async function notifyUserRequestComment(
  telegramChatId: string | number | undefined,
  requestId: number,
  requestTitle: string,
  adminComment: string,
  userName?: string
): Promise<boolean> {
  try {
    if (!telegramChatId) {
      console.log(`[REQUEST COMMENT - TELEGRAM NOT LINKED] Request #${requestId}, User: ${userName}`);
      return false;
    }

    let message = `💬 <b>Update on Your Request</b>\n\n`;
    message += `<b>Request ID:</b> #${requestId}\n`;
    message += `<b>Title:</b> ${requestTitle}\n`;
    message += `\n<b>Admin Update:</b>\n${adminComment}\n`;
    message += `\n📱 <b>View the full conversation:</b>\n`;
    message += `<a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/requests/${requestId}">View Request Details</a>\n\n`;
    message += `DepEd IT Support System 🎓`;

    const success = await sendTelegramMessage(telegramChatId, message);

    if (success) {
      console.log(`[REQUEST COMMENT - TELEGRAM SENT] Request #${requestId}, User: ${userName}, ChatID: ${telegramChatId}`);
    }

    return success;
  } catch (error) {
    console.error('[REQUEST COMMENT TELEGRAM ERROR]', error);
    return false;
  }
}

/**
 * Initialize Telegram bot in polling mode
 * This mode continuously checks for new messages (no webhook required)
 * Better for local network or development environments
 */
export async function initializeTelegramPolling(): Promise<void> {
  try {
    if (!TELEGRAM_BOT_TOKEN) {
      console.log('[TELEGRAM POLLING] TELEGRAM_BOT_TOKEN not set; skipping bot polling init');
      return;
    }

    if (bot) {
      console.log('[TELEGRAM POLLING] Bot already initialized');
      return;
    }

    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
    console.log('[TELEGRAM POLLING] Bot started in polling mode');

    // Handle /start command
    bot.onText(/^\/start$/, async (msg: TelegramBot.Message) => {
      const chatId = msg.chat.id;
      const welcomeMsg = `👋 Welcome to <b>DepEd IT Services</b>!\n\nTo receive OTP codes here, link your account:\n\n/link <email>\n\nExample: <code>/link juan@deped.gov.ph</code>`;
      await sendTelegramMessage(chatId, welcomeMsg);
    });

    // Handle /link command
    bot.onText(/^\/link\s+(.+)$/, async (msg: TelegramBot.Message, match: RegExpExecArray | null) => {
      const chatId = msg.chat.id;
      const email = (match?.[1] || '').trim();

      if (!email || !email.includes('@')) {
        await sendTelegramMessage(chatId, '❌ Invalid format. Use: /link <email>\n\nExample: /link juan@deped.gov.ph');
        return;
      }

      try {
        const user = await storage.getUserByEmail(email);

        if (!user) {
          await sendTelegramMessage(chatId, `❌ No account found for ${email}. Please register first at the DepEd IT Services portal.`);
          return;
        }

        // Update user's telegram chat ID
        await storage.updateUserTelegramChatId(user.id, chatId.toString());

        const confirmMsg = `✅ <b>Account Linked!</b>\n\nYour account ${email} is now linked.\n\n🔐 You will receive OTP codes via Telegram during login.`;
        await sendTelegramMessage(chatId, confirmMsg);

        console.log(`[TELEGRAM POLLING - LINKED] User: ${email}, Chat ID: ${chatId}`);
      } catch (error) {
        console.error('[TELEGRAM POLLING - LINK ERROR]', error);
        await sendTelegramMessage(chatId, '❌ An error occurred while linking your account. Please try again.');
      }
    });

    // Handle /unlink command
    bot.onText(/^\/unlink$/, async (msg: TelegramBot.Message) => {
      const chatId = msg.chat.id;

      try {
        const user = await storage.getUserByTelegramChatId(chatId.toString());

        if (!user) {
          await sendTelegramMessage(chatId, '❌ This Telegram account is not linked to any user.');
          return;
        }

        await storage.updateUserTelegramChatId(user.id, '');

        const unlinkMsg = `✅ <b>Account Unlinked!</b>\n\nYour Telegram has been unlinked from your account.`;
        await sendTelegramMessage(chatId, unlinkMsg);

        console.log(`[TELEGRAM POLLING - UNLINKED] User: ${user.email}, Chat ID: ${chatId}`);
      } catch (error) {
        console.error('[TELEGRAM POLLING - UNLINK ERROR]', error);
        await sendTelegramMessage(chatId, '❌ An error occurred while unlinking your account. Please try again.');
      }
    });

    // Handle /help command
    bot.onText(/^\/help$/, async (msg: TelegramBot.Message) => {
      const chatId = msg.chat.id;
      const helpMsg = `📖 <b>Available Commands</b>\n\n/start - Welcome message\n/link &lt;email&gt; - Link your account\n/unlink - Unlink your account\n/help - Show this message`;
      await sendTelegramMessage(chatId, helpMsg);
    });

    // Handle all other messages
    bot.on('message', async (msg: TelegramBot.Message) => {
      const chatId = msg.chat.id;
      const text = msg.text || '';

      // Skip if it's a command (already handled above)
      if (text.startsWith('/')) {
        return;
      }

      // Default response for non-command messages
      const defaultMsg = `ℹ️ I didn't understand that command. Try /help for available commands.`;
      await sendTelegramMessage(chatId, defaultMsg);
    });

    // Handle errors
    bot.on('error', (error: Error) => {
      console.error('[TELEGRAM POLLING ERROR]', error);
    });

    // Handle polling timeout
    bot.on('polling_error', (error: Error) => {
      console.error('[TELEGRAM POLLING TIMEOUT ERROR]', error);
    });

  } catch (error) {
    console.error('[TELEGRAM POLLING INITIALIZATION ERROR]', error);
    throw error;
  }
}
