/**
 * Email Service Module
 * Handles sending emails to users and admin
 * Supports multiple email providers (SendGrid, Nodemailer, AWS SES)
 */

import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
  replyTo?: string;
}

interface EmailResult {
  success: boolean;
  message: string;
  messageId?: string;
}

/**
 * Send email using the configured email service
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  try {
    const emailService = process.env.EMAIL_SERVICE || 'gmail'; // Default to gmail (nodemailer)
    const senderEmail = process.env.EMAIL_FROM || process.env.SENDER_EMAIL || 'noreply@deped.gov.ph';

    console.log(`[EMAIL SERVICE] Using: ${emailService}`);

    switch (emailService) {
      case 'sendgrid':
        return await sendViaSendGrid(options, senderEmail);

      case 'gmail':
      case 'nodemailer':
        return await sendViaNodemailer(options, senderEmail);

      case 'aws-ses':
        return await sendViaAwsSES(options, senderEmail);

      case 'console':
      default:
        // Development mode: log to console
        return logEmailToConsole(options, senderEmail);
    }
  } catch (error) {
    console.error('[EMAIL ERROR]', error);
    return {
      success: false,
      message: `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Send email via SendGrid API
 */
async function sendViaSendGrid(options: EmailOptions, fromEmail: string): Promise<EmailResult> {
  try {
    const sgMail = await import('@sendgrid/mail');
    const apiKey = process.env.SENDGRID_API_KEY;

    if (!apiKey) {
      throw new Error('SENDGRID_API_KEY not set in environment variables');
    }

    sgMail.default.setApiKey(apiKey);

    const msg = {
      to: options.to,
      from: fromEmail,
      subject: options.subject,
      html: options.htmlContent,
      replyTo: options.replyTo || fromEmail,
    };

    const response = await sgMail.default.send(msg);

    console.log(`[SENDGRID EMAIL SENT] To: ${options.to}, Message ID: ${response[0].headers['x-message-id']}`);

    return {
      success: true,
      message: `Email sent to ${options.to}`,
      messageId: response[0].headers['x-message-id'],
    };
  } catch (error) {
    console.error('[SENDGRID EMAIL ERROR]', error);
    return {
      success: false,
      message: `Failed to send email via SendGrid: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Send email via Nodemailer (SMTP) - Using Gmail
 */
async function sendViaNodemailer(options: EmailOptions, fromEmail: string): Promise<EmailResult> {
  try {
    // Validate credentials
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.error('[GMAIL EMAIL ERROR] Missing EMAIL_USER or EMAIL_PASSWORD in .env');
      return {
        success: false,
        message: 'Email credentials not configured. Please set EMAIL_USER and EMAIL_PASSWORD in .env',
      };
    }

    // Use Gmail SMTP with app password from .env
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, // Gmail address
        pass: process.env.EMAIL_PASSWORD, // Gmail app password
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM || fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.htmlContent,
      replyTo: options.replyTo || process.env.EMAIL_FROM || fromEmail,
    };

    console.log(`[GMAIL] Attempting to send email to ${options.to} from ${mailOptions.from}`);
    const info = await transporter.sendMail(mailOptions);

    console.log(`[GMAIL EMAIL SENT] To: ${options.to}, Message ID: ${info.messageId}`);

    return {
      success: true,
      message: `Email sent to ${options.to}`,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('[GMAIL EMAIL ERROR]', error);
    return {
      success: false,
      message: `Failed to send email via Gmail: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Send email via AWS SES
 */
async function sendViaAwsSES(options: EmailOptions, fromEmail: string): Promise<EmailResult> {
  try {
    const AWS = await import('aws-sdk');

    const ses = new AWS.default.SES({
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    const params = {
      Source: fromEmail,
      Destination: {
        ToAddresses: [options.to],
      },
      Message: {
        Subject: {
          Data: options.subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: options.htmlContent,
            Charset: 'UTF-8',
          },
        },
      },
      ReplyToAddresses: [options.replyTo || fromEmail],
    };

    const result = await ses.sendEmail(params).promise();

    console.log(`[AWS SES EMAIL SENT] To: ${options.to}, Message ID: ${result.MessageId}`);

    return {
      success: true,
      message: `Email sent to ${options.to}`,
      messageId: result.MessageId,
    };
  } catch (error) {
    console.error('[AWS SES EMAIL ERROR]', error);
    return {
      success: false,
      message: `Failed to send email via AWS SES: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Development mode: Log email to console instead of sending
 */
function logEmailToConsole(options: EmailOptions, fromEmail: string): EmailResult {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                    EMAIL (Development Mode)               ║
╠════════════════════════════════════════════════════════════╣
║ From:    ${fromEmail.padEnd(54)}║
║ To:      ${options.to.padEnd(54)}║
║ Subject: ${options.subject.padEnd(54)}║
║ Reply-To: ${(options.replyTo || fromEmail).padEnd(53)}║
╠════════════════════════════════════════════════════════════╣
║ Content:                                                   ║
╠════════════════════════════════════════════════════════════╣
${options.htmlContent.split('\n').map((line, i) => `║ ${line.substring(0, 56).padEnd(56)}║`).join('\n')}
╚════════════════════════════════════════════════════════════╝
  `);

  return {
    success: true,
    message: `[DEV MODE] Email logged to console for ${options.to}`,
    messageId: `dev-${Date.now()}`,
  };
}

/**
 * Send an email to the admin user
 */
export async function sendEmailToAdmin(
  subject: string,
  htmlContent: string,
  adminEmail: string = 'admin@deped.gov.ph'
): Promise<EmailResult> {
  return sendEmail({
    to: adminEmail,
    subject,
    htmlContent,
  });
}

/**
 * Email template builders
 */

export function createOtpEmailTemplate(
  userName: string,
  otpCode: string,
  expirationMinutes: number = 10
): string {
  return `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: 'Arial', sans-serif; 
            color: #333; 
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container { 
            max-width: 600px; 
            margin: 20px auto; 
            padding: 0;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header { 
            background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
          }
          .header p {
            margin: 5px 0 0 0;
            font-size: 14px;
            opacity: 0.9;
          }
          .content { 
            padding: 30px 20px; 
          }
          .greeting {
            margin-bottom: 20px;
            font-size: 16px;
          }
          .otp-box { 
            background: linear-gradient(135deg, #e0e7ff 0%, #dbeafe 100%);
            border-left: 4px solid #1e3a8a;
            padding: 25px; 
            border-radius: 5px; 
            text-align: center; 
            margin: 25px 0;
          }
          .otp-code { 
            font-size: 48px; 
            font-weight: bold; 
            letter-spacing: 8px; 
            color: #1e3a8a;
            font-family: 'Courier New', monospace;
            margin: 0;
          }
          .otp-expiry {
            color: #666;
            font-size: 14px;
            margin-top: 10px;
          }
          .instructions {
            background-color: #f9fafb;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .instructions ol {
            margin: 10px 0;
            padding-left: 20px;
          }
          .instructions li {
            margin: 8px 0;
            color: #333;
          }
          .warning { 
            color: #dc2626; 
            background-color: #fee2e2;
            border-left: 4px solid #dc2626;
            padding: 15px; 
            border-radius: 5px;
            margin: 20px 0;
            font-size: 14px;
          }
          .footer { 
            color: #888; 
            font-size: 12px; 
            margin-top: 30px; 
            border-top: 1px solid #e5e7eb; 
            padding-top: 20px;
            text-align: center;
          }
          .footer p {
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎓 DepEd IT Services</h1>
            <p>Department of Education</p>
          </div>
          <div class="content">
            <div class="greeting">
              <p>Hello <strong>${userName}</strong>,</p>
              <p>Your One-Time Password (OTP) for account verification is below:</p>
            </div>
            
            <div class="otp-box">
              <div class="otp-code">${otpCode}</div>
              <div class="otp-expiry">⏱️ Valid for ${expirationMinutes} minutes</div>
            </div>
            
            <div class="instructions">
              <strong>How to use:</strong>
              <ol>
                <li>Copy the code above</li>
                <li>Return to the DepEd IT Services portal</li>
                <li>Enter the code in the verification field</li>
              </ol>
            </div>
            
            <div class="warning">
              ⚠️ <strong>Security Notice:</strong> Do not share this code with anyone. Our support team will never ask for your OTP. If you didn't request this code, please ignore this email.
            </div>
            
            <div class="footer">
              <p>© 2026 Department of Education (DepEd). All rights reserved.</p>
              <p>This is an automated email. Please do not reply to this email.</p>
              <p>For support, contact: <a href="mailto:support@deped.gov.ph" style="color: #1e3a8a;">support@deped.gov.ph</a></p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function createAdminNotificationTemplate(
  subject: string,
  message: string,
  details?: Record<string, string>
): string {
  let detailsHtml = '';
  if (details) {
    detailsHtml = `
      <table style="width: 100%; border-collapse: collapse;">
        <tbody>
          ${Object.entries(details)
            .map(
              ([key, value]) => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px; font-weight: bold; width: 30%;">${key}:</td>
              <td style="padding: 10px;">${value}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  return `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1e40af; color: white; padding: 20px; border-radius: 5px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; border: 1px solid #e5e7eb; margin-top: 10px; }
          .footer { color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>System Notification</h1>
          </div>
          <div class="content">
            <h2>${subject}</h2>
            <p>${message}</p>
            ${detailsHtml}
            <div class="footer">
              <p>© 2024 Department of Education. All rights reserved.</p>
              <p>This is an automated email from the DepEd Request System.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Helper function to send admin notification for new requests
 */
export async function notifyAdminNewRequest(
  requesterName: string,
  requestTitle: string,
  requestDescription: string,
  adminEmail: string
): Promise<EmailResult> {
  const htmlContent = createAdminNotificationTemplate(
    'New Request Submitted',
    `A new request has been submitted by ${requesterName}.`,
    {
      'Requester': requesterName,
      'Title': requestTitle,
      'Description': requestDescription.substring(0, 100) + '...',
      'Timestamp': new Date().toLocaleString(),
    }
  );

  return sendEmailToAdmin('New Request Submitted', htmlContent, adminEmail);
}

/**
 * Helper function to send admin notification for verification needed
 */
export async function notifyAdminHighPriorityRequest(
  requesterName: string,
  requestId: string,
  reason: string,
  adminEmail: string
): Promise<EmailResult> {
  const htmlContent = createAdminNotificationTemplate(
    '⚠️ High Priority Request Needs Review',
    `A high-priority request requires immediate attention.`,
    {
      'Requester': requesterName,
      'Request ID': requestId,
      'Reason': reason,
      'Action': 'Please log in to review',
      'Timestamp': new Date().toLocaleString(),
    }
  );

  return sendEmailToAdmin('⚠️ High Priority Request Needs Review', htmlContent, adminEmail);
}
