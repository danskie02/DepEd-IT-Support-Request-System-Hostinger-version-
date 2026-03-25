import { db } from "./db";
import { smsJobs } from "@shared/schema";
import { inArray } from "drizzle-orm";

/**
 * Clear SMS jobs from the queue.
 *
 * Default: deletes only `pending` and `sending` (work not completed yet).
 * Pass `--all` to delete every row in `sms_jobs` (including sent/failed history).
 *
 * Usage:
 *   npm run clear-sms-queue
 *   npm run clear-sms-queue -- --all
 */
async function clearQueue() {
  const wipeAll = process.argv.includes("--all");

  try {
    if (wipeAll) {
      await db.delete(smsJobs);
      console.log("[SMS QUEUE] Cleared all SMS jobs (entire table).");
    } else {
      const deleted = await db
        .delete(smsJobs)
        .where(inArray(smsJobs.status, ["pending", "sending"]))
        .returning({ id: smsJobs.id });

      console.log(
        `[SMS QUEUE] Removed ${deleted.length} pending/sending job(s). (Use --all to delete every row including sent/failed.)`,
      );
    }
    process.exit(0);
  } catch (err) {
    console.error("[SMS QUEUE] Error clearing queue:", err);
    process.exit(1);
  }
}

clearQueue();
