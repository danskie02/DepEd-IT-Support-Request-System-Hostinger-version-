/**
 * SMS Gateway client (SIM800L/Raspberry Pi)
 *
 * This module sends SMS via an HTTP endpoint you host (typically on your Raspberry Pi).
 * Configure the gateway endpoint in environment variables:
 * - SMS_GATEWAY_URL: full URL to your send endpoint (e.g. https://<your-domain>/sms/send)
 * - SMS_GATEWAY_TOKEN: optional bearer token for auth
 * - SMS_GATEWAY_TIMEOUT_MS: optional timeout (default 8000ms)
 */
export type SmsSendResult = {
  success: boolean;
  message: string;
};

function maskPhone(phone: string) {
  const p = (phone || "").trim();
  if (p.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, p.length - 4))}${p.slice(-4)}`;
}

/**
 * Helper that sends an SMS using Twilio REST API. Requires the following
 * environment variables:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 */
async function sendViaTwilio(toPhone: string, message: string): Promise<SmsSendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM_NUMBER?.trim();

  if (!sid || !token || !from) {
    console.log('[SMS][TWILIO] missing credentials in environment');
    return { success: false, message: 'Twilio credentials not configured' };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const body = new URLSearchParams({
      To: toPhone,
      From: from,
      Body: message,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      console.error('[SMS][TWILIO] error', res.status, data);
      return { success: false, message: `Twilio error ${res.status}` };
    }

    console.log(`[SMS][TWILIO] Sent to ${maskPhone(toPhone)}`);
    return { success: true, message: 'SMS sent (twilio)' };
  } catch (err: any) {
    console.error('[SMS][TWILIO] send failed', err);
    return { success: false, message: `Twilio send failed: ${err?.message || err}` };
  }
}

type SmsMeta = {
  kind?: "otp" | "request_update" | "other";
  userId?: number;
  requestId?: number;
};

async function queueSmsJob(toPhone: string, message: string, meta: SmsMeta): Promise<SmsSendResult> {
  try {
    const { db } = await import("./db");
    const { smsJobs } = await import("@shared/schema");

    await db.insert(smsJobs).values({
      to: toPhone,
      message,
      kind: meta.kind || "other",
      userId: meta.userId,
      requestId: meta.requestId,
      status: "pending",
      updatedAt: new Date(),
    } as any);

    console.log(`[SMS][QUEUE] Queued to ${maskPhone(toPhone)} (${meta.kind || "other"})`);
    return { success: true, message: "SMS queued" };
  } catch (err: any) {
    console.error("[SMS][QUEUE] Failed to queue SMS job:", err?.message || err);
    return { success: false, message: "Failed to queue SMS job" };
  }
}

export async function sendSms(toPhone: string, message: string, meta: SmsMeta = {}): Promise<SmsSendResult> {
  const mode = (process.env.SMS_MODE || "push").toLowerCase().trim();
  if (mode === "pull") {
    return queueSmsJob(toPhone, message, meta);
  }

  // Support multiple providers; default fallback is a generic HTTP gateway.
  const provider = (process.env.SMS_PROVIDER || "gateway").toLowerCase().trim();

  if (provider === "twilio") {
    return sendViaTwilio(toPhone, message);
  }

  // generic gateway (e.g. Raspberry Pi endpoint)
  const url = process.env.SMS_GATEWAY_URL?.trim();
  const token = process.env.SMS_GATEWAY_TOKEN?.trim();
  const timeoutMs = Number(process.env.SMS_GATEWAY_TIMEOUT_MS || 8000);

  if (!url) {
    console.log(`[SMS] Gateway not configured. Would send to ${maskPhone(toPhone)}: ${message}`);
    return { success: false, message: "SMS gateway not configured (SMS_GATEWAY_URL missing)" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ to: toPhone, message }),
      signal: controller.signal,
    });

    const text = await res.text().catch(() => "");

    if (!res.ok) {
      console.error(`[SMS] Gateway error ${res.status} for ${maskPhone(toPhone)}: ${text}`);
      return { success: false, message: `SMS gateway error (${res.status})` };
    }

    console.log(`[SMS] Sent to ${maskPhone(toPhone)}`);
    return { success: true, message: "SMS sent" };
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? "Timeout" : (err?.message || "Unknown error");
    console.error(`[SMS] Send failed to ${maskPhone(toPhone)}: ${msg}`);
    return { success: false, message: `SMS send failed: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}

export async function sendOtpViaSms(phoneNumber: string, otpCode: string): Promise<SmsSendResult> {
  const phone = (phoneNumber || "").trim();
  if (!phone) {
    return { success: false, message: "User phone number missing" };
  }

  const brand = process.env.BRAND_NAME || "DepEd Marinduque IT Services";
  const msg = `${brand} OTP: ${otpCode}. Valid for 10 minutes. Do not share this code.`;
  return sendSms(phone, msg, { kind: "otp" });
}

export async function sendRequestStatusSms(
  phoneNumber: string,
  requestId: number,
  requestTitle: string,
  status: "pending" | "on_going" | "finished",
  adminResponse?: string,
): Promise<SmsSendResult> {
  const phone = (phoneNumber || "").trim();
  if (!phone) {
    return { success: false, message: "User phone number missing" };
  }

  const brand = process.env.BRAND_NAME || "DepEd Marinduque IT Services";
  const statusText =
    status === "finished" ? "FINISHED" : status === "on_going" ? "ON-GOING" : "PENDING";

  const parts = [
    `${brand} update: Request #${requestId} is ${statusText}.`,
    `Title: ${requestTitle}`,
    adminResponse ? `Admin: ${adminResponse}` : undefined,
  ].filter(Boolean);

  // Keep SMS reasonably short
  const msg = parts.join(" ");
  return sendSms(phone, msg.length > 420 ? `${msg.slice(0, 417)}...` : msg, {
    kind: "request_update",
    requestId,
  });
}

