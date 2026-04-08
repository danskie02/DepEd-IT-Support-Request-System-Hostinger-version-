import { storage } from "./storage";
import { sendSms } from "./sms";

/** Track last time admin summary was sent to prevent spam */
let lastAdminSummarySentTime: number = 0;
const ADMIN_SUMMARY_MIN_INTERVAL_MS = 60 * 60 * 1000; // Minimum 1 hour between summaries

/** GSM-friendly labels — Unicode emojis often appear as "@@@@" or "?" on SIM800-class modules. */
function priorityTag(priority: string): string {
  switch (priority) {
    case "urgent":
      return "[URGENT]";
    case "high":
      return "[HIGH]";
    case "medium":
      return "[MED]";
    case "low":
      return "[LOW]";
    default:
      return "[REQ]";
  }
}

function oneLine(text: string, maxLen: number): string {
  const s = text.replace(/\s+/g, " ").trim();
  if (s.length <= maxLen) return s;
  return s.slice(0, Math.max(0, maxLen - 3)) + "...";
}

/**
 * Send a simple SMS to each admin containing the given text.
 */
async function sendToAdmins(message: string) {
  if (process.env.ADMIN_SMS_ENABLED === "false") {
    console.log("[ADMIN SMS] disabled via ADMIN_SMS_ENABLED=false");
    return;
  }

  try {
    const users = await storage.getAllUsers();
    const admins = users.filter((u) => u.role === "admin");
    
    // Log admin notification attempt
    console.log(`[ADMIN SMS] Sending to ${admins.length} admin(s): ${message.substring(0, 50)}...`);
    
    for (const admin of admins) {
      if (admin.phone) {
        await sendSms(admin.phone, message, { kind: "other" });
      }
    }
  } catch (err) {
    console.error("[ADMIN SMS] failed to send to admins", err);
  }
}

/**
 * Notify admins immediately when a new request is created.
 */
export async function notifyAdminsOfNewRequest(
  request: { id: number; title: string; description: string; priority: string; userId: number },
  userName?: string,
  options?: { pendingOtp?: boolean },
) {
  const tag = priorityTag(request.priority);
  const nameText = userName ? ` by ${userName}` : "";
  const desc = oneLine(request.description, 100);
  const otpNote = options?.pendingOtp ? " [awaiting user OTP]" : "";
  let msg = `${tag} New Request #${request.id}${nameText}: ${request.title}. ${desc}${otpNote}`;
  if (msg.length > 320) {
    msg = oneLine(msg, 317) + "...";
  }
  await sendToAdmins(msg);
}

/**
 * Send an SMS summary of all pending requests, including age with alerts near 48h.
 * Rate-limited to prevent spam (minimum 1 hour between sends).
 */
export async function sendAdminSummary() {
  const now = Date.now();
  
  // Rate limit: don't send more than once per hour
  if (now - lastAdminSummarySentTime < ADMIN_SUMMARY_MIN_INTERVAL_MS) {
    const minsSinceLastSend = Math.floor((now - lastAdminSummarySentTime) / 1000 / 60);
    console.log(`[ADMIN SMS] Skipping summary - last sent ${minsSinceLastSend} min ago (rate limit: 1/hour)`);
    return;
  }

  try {
    const all = await storage.getRequests();
    const pending = all.filter((r) => r.status === "pending");
    if (pending.length === 0) {
      console.log('[ADMIN SMS] No pending requests - skipping summary');
      return;
    }

    const now = new Date();

    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    const sorted = pending.sort((a, b) => {
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 999;
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 999;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    let msg = `Pending ${pending.length}: `;
    const lines: string[] = [];
    for (const r of sorted) {
      const ageHours = Math.floor((now.getTime() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60));
      const ageDays = Math.floor(ageHours / 24);
      const alert =
        ageHours >= 42 ? " *48H*" : ageHours >= 36 ? " *ALERT*" : ageHours >= 24 ? " *" : "";
      const ageText = ageDays > 0 ? `${ageDays}d${ageHours % 24}h` : `${ageHours}h`;
      lines.push(`#${r.id}(${ageText})${alert}`);
    }
    msg += lines.join(" ");

    if (msg.length > 420) {
      msg = msg.slice(0, 417) + "...";
    }

    await sendToAdmins(msg);
    lastAdminSummarySentTime = now.getTime();
    console.log('[ADMIN SMS] Summary sent successfully');
  } catch (err) {
    console.error("[ADMIN SMS] failed to send summary", err);
  }
}

function isWeekday(d: Date): boolean {
  const day = d.getDay();
  return day >= 1 && day <= 5;
}

/**
 * Milliseconds from `now` until the next occurrence of `hour`:`minute` on a Mon–Fri.
 */
function msUntilNextWeekdayAt(hour: number, minute: number, now: Date): number {
  const target = new Date(now);
  target.setSeconds(0, 0);
  target.setMilliseconds(0);
  target.setHours(hour, minute, 0, 0);

  for (let i = 0; i < 14; i++) {
    if (isWeekday(target) && target.getTime() > now.getTime()) {
      return target.getTime() - now.getTime();
    }
    target.setDate(target.getDate() + 1);
    target.setHours(hour, minute, 0, 0);
  }
  return 24 * 60 * 60 * 1000;
}

function scheduleWeekdayAt(hour: number, minute: number, fn: () => Promise<void>) {
  const tick = () => {
    const delay = msUntilNextWeekdayAt(hour, minute, new Date());
    setTimeout(async () => {
      try {
        await fn();
      } catch (e) {
        console.error("[ADMIN SCHEDULER] task error", e);
      }
      tick();
    }, delay);
  };
  tick();
}

/**
 * Weekday summaries at 11 PM and 4 PM (local server time). Override with
 * ADMIN_SUMMARY_PM_HOUR / ADMIN_SUMMARY_NIGHT_HOUR if needed (24h clock).
 */
export function startAdminSchedulers() {
  const nightHour = Number(process.env.ADMIN_SUMMARY_NIGHT_HOUR ?? process.env.ADMIN_SUMMARY_AM ?? "23");
  const afternoonHour = Number(process.env.ADMIN_SUMMARY_PM_HOUR ?? process.env.ADMIN_SUMMARY_PM ?? "16");
  scheduleWeekdayAt(nightHour, 0, sendAdminSummary);
  scheduleWeekdayAt(afternoonHour, 0, sendAdminSummary);
}
