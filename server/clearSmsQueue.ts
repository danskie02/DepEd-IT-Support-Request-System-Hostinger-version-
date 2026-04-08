import { db } from "./db";
import { smsJobs } from "@shared/schema";
import { inArray, eq, and, lt } from "drizzle-orm";

/**
 * Clear SMS jobs from the queue.
 *
 * Usage:
 *   npm run clear-sms-queue              # Clears pending/sending jobs
 *   npm run clear-sms-queue -- --all     # Deletes entire sms_jobs table (all statuses)
 *   npm run clear-sms-queue -- --failed  # Deletes only failed jobs
 *   npm run clear-sms-queue -- --old     # Deletes jobs older than 24 hours
 */
async function clearQueue() {
  const args = process.argv.slice(2);
  const wipeAll = args.includes("--all");
  const wipeFailed = args.includes("--failed");
  const wipeOld = args.includes("--old");

  try {
    if (wipeAll) {
      const count = await db.delete(smsJobs).returning({ id: smsJobs.id });
      console.log(`[SMS QUEUE] Cleared ALL ${count.length} SMS job(s) (entire table wiped).`);
    } else if (wipeFailed) {
      const deleted = await db
        .delete(smsJobs)
        .where(eq(smsJobs.status, "failed"))
        .returning({ id: smsJobs.id });
      console.log(`[SMS QUEUE] Cleared ${deleted.length} failed job(s).`);
    } else if (wipeOld) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const deleted = await db
        .delete(smsJobs)
        .where(
          and(
            lt(smsJobs.updatedAt, twentyFourHoursAgo),
            inArray(smsJobs.status, ["pending", "sending"])
          )
        )
        .returning({ id: smsJobs.id });
      console.log(`[SMS QUEUE] Cleared ${deleted.length} stale job(s) (pending/sending for 24+ hours).`);
    } else {
      const deleted = await db
        .delete(smsJobs)
        .where(inArray(smsJobs.status, ["pending", "sending"]))
        .returning({ id: smsJobs.id });

      console.log(
        `[SMS QUEUE] Removed ${deleted.length} pending/sending job(s).`,
      );
      console.log("Tip: Use --all to delete all jobs, --failed to delete only failed, or --old to delete 24+ hour old jobs.");
    }
    process.exit(0);
  } catch (err) {
    console.error("[SMS QUEUE] Error clearing queue:", err);
    process.exit(1);
  }
}

clearQueue();
