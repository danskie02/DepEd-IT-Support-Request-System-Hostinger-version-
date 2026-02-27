import { db } from "./db";
import { smsJobs } from "@shared/schema";
import { sendSms } from "./sms";
import { eq } from "drizzle-orm";

// process all pending SMS jobs in the database
async function processPendingJobs() {
  const jobs = await db.select().from(smsJobs).where(eq(smsJobs.status, "pending"));
  for (const job of jobs) {
    try {
      await db
        .update(smsJobs)
        .set({ status: "sending", updatedAt: new Date() })
        .where(eq(smsJobs.id, job.id));

      const res = await sendSms(job.to, job.message, {
        kind: job.kind as any,
        userId: job.userId as number | undefined,
        requestId: job.requestId as number | undefined,
      });

      if (res.success) {
        await db
          .update(smsJobs)
          .set({ status: "sent", updatedAt: new Date() })
          .where(eq(smsJobs.id, job.id));
        console.log(`[SMS WORKER] job ${job.id} sent`);
      } else {
        await db
          .update(smsJobs)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(smsJobs.id, job.id));
        console.error(`[SMS WORKER] job ${job.id} failed: ${res.message}`);
      }
    } catch (err) {
      console.error(`[SMS WORKER] error processing job ${job.id}`, err);
    }
  }
}

async function main() {
  console.log("[SMS WORKER] started");
  while (true) {
    try {
      await processPendingJobs();
    } catch (e) {
      console.error("[SMS WORKER] unexpected error", e);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
