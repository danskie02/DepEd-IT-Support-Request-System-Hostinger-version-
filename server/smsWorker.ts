import { db } from "./db";
import { smsJobs } from "@shared/schema";
import { sendSms } from "./sms";
import { eq, and, or, lt } from "drizzle-orm";

// process all pending SMS jobs in the database
async function processPendingJobs() {
  // pick up either truly pending jobs or ones that appear to be stuck in
  // the "sending" state for a while.  the latter can happen if the worker
  // crashes or the host loses connectivity mid‑send; without this logic a
  // message would remain forever in the queue.
  const thirtySecondsAgo = new Date(Date.now() - 30_000);

  const pendingJobs = await db.select().from(smsJobs).where(eq(smsJobs.status, "pending"));
  const staleSending = await db
    .select()
    .from(smsJobs)
    .where(
      and(
        eq(smsJobs.status, "sending"),
        lt(smsJobs.updatedAt, thirtySecondsAgo),
      )
    );

  const jobs = [...pendingJobs, ...staleSending];
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

export async function startSmsWorker(pollInterval = 5000) {
  console.log("[SMS WORKER] started");
  while (true) {
    try {
      await processPendingJobs();
    } catch (e) {
      console.error("[SMS WORKER] unexpected error", e);
    }
    await new Promise((r) => setTimeout(r, pollInterval));
  }
}

// When run directly from the command line we still want the old behavior
// so `npm run worker` continues to work.
//
// Note: we avoid `import.meta.url` because this file is bundled to CJS
// (`*.cjs`) for production, and `import.meta` isn't available there.
const argv1 = (process.argv[1] || "").toLowerCase();
if (argv1.includes("smsworker")) {
  startSmsWorker().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
