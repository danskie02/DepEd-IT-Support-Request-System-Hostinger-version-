import { storage } from "./storage";
import { sendSms } from "./sms";

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
  request: { id: number; title: string; userId: number },
  userName?: string,
) {
  const nameText = userName ? `by ${userName}` : "";
  const msg = `🆕 New request #${request.id} ${nameText}: ${request.title}`;
  await sendToAdmins(msg);
}

/**
 * Send an SMS summary of all pending requests, including "age" in days.
 */
export async function sendAdminSummary() {
  try {
    const all = await storage.getRequests();
    const pending = all.filter((r) => r.status === "pending");
    if (pending.length === 0) {
      // optionally still notify about zero pending? skip for now
      return;
    }

    const now = new Date();
    let msg = "📋 Pending requests:\n";
    for (const r of pending) {
      const ageDays = Math.floor((now.getTime() - new Date(r.createdAt).getTime()) / 86400000);
      const flag = ageDays >= 2 ? ' ⚠️' : '';
      msg += `#${r.id} ${r.title} (${ageDays}d)${flag}\n`;
    }

    // SMS have length limits; truncate if necessary
    if (msg.length > 420) {
      msg = msg.slice(0, 417) + "...";
    }

    await sendToAdmins(msg);
  } catch (err) {
    console.error("[ADMIN SMS] failed to send summary", err);
  }
}

// scheduling helpers --------------------------------------------------------

function scheduleDailyAt(hour: number, minute: number, fn: () => Promise<void>) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  const delay = next.getTime() - now.getTime();
  setTimeout(async () => {
    try {
      await fn();
    } catch (e) {
      console.error("[ADMIN SCHEDULER] task error", e);
    }
    scheduleDailyAt(hour, minute, fn);
  }, delay);
}

/**
 * Start both summary schedules (11:00 and 15:00) and return a
 * promise that resolves immediately once scheduling is in place.
 */
export function startAdminSchedulers() {
  // allow override via env if somebody wants different times
  const morning = process.env.ADMIN_SUMMARY_AM || "11";
  const afternoon = process.env.ADMIN_SUMMARY_PM || "15";
  scheduleDailyAt(Number(morning), 0, sendAdminSummary);
  scheduleDailyAt(Number(afternoon), 0, sendAdminSummary);
}
