import pg from "pg";
import os from "node:os";
import { exec } from "node:child_process";
import { config } from "dotenv";
import path from "path";

// Load .env file explicitly
config({ path: path.resolve(process.cwd(), ".env"), override: true });

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[PI WORKER] Missing DATABASE_URL in environment.");
  console.error("[PI WORKER] Checked for .env at:", path.resolve(process.cwd(), ".env"));
  process.exit(1);
}

const WORKER_ID = process.env.WORKER_ID || `${os.hostname()}-${process.pid}`;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 2000);
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 5);
const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS || 3);

// How to actually send SMS on the Pi:
// Option A (recommended): call your existing script via a command.
//   - Set SMS_SEND_CMD to something that sends SMS using env vars SMS_TO and SMS_MESSAGE.
//   - Example: SMS_SEND_CMD="python3 /home/pi/sim800l/send_sms.py"
//
// Option B: call a local HTTP service you host on the Pi (if you already have one).
//   - Set LOCAL_SMS_SEND_URL, optionally LOCAL_SMS_TOKEN.
const SMS_SEND_CMD = process.env.SMS_SEND_CMD;
const LOCAL_SMS_SEND_URL = process.env.LOCAL_SMS_SEND_URL;
const LOCAL_SMS_TOKEN = process.env.LOCAL_SMS_TOKEN;

const sslEnabled =
  (process.env.PGSSL || "").toLowerCase() === "true" ||
  (process.env.NODE_ENV || "").toLowerCase() === "production";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ...(sslEnabled ? { ssl: { rejectUnauthorized: false } } : {}),
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function sendViaCmd(to, message) {
  return new Promise((resolve, reject) => {
    if (!SMS_SEND_CMD) return reject(new Error("SMS_SEND_CMD not set"));
    exec(
      SMS_SEND_CMD,
      {
        env: { ...process.env, SMS_TO: String(to), SMS_MESSAGE: String(message) },
        timeout: 30000,
      },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        return resolve(stdout);
      }
    );
  });
}

async function sendViaHttp(to, message) {
  if (!LOCAL_SMS_SEND_URL) throw new Error("LOCAL_SMS_SEND_URL not set");
  const res = await fetch(LOCAL_SMS_SEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(LOCAL_SMS_TOKEN ? { Authorization: `Bearer ${LOCAL_SMS_TOKEN}` } : {}),
    },
    body: JSON.stringify({ to, message }),
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
}

async function sendSms(to, message) {
  if (SMS_SEND_CMD) {
    await sendViaCmd(to, message);
    return;
  }
  if (LOCAL_SMS_SEND_URL) {
    await sendViaHttp(to, message);
    return;
  }
  throw new Error("No sender configured. Set SMS_SEND_CMD or LOCAL_SMS_SEND_URL.");
}

async function claimJobs(client) {
  // Atomically claim up to BATCH_SIZE pending jobs.
  const q = `
    WITH cte AS (
      SELECT id
      FROM sms_jobs
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE sms_jobs
    SET status = 'sending',
        locked_at = NOW(),
        locked_by = $2,
        attempts = attempts + 1,
        updated_at = NOW()
    WHERE id IN (SELECT id FROM cte)
    RETURNING id, "to", message, kind, user_id, request_id, attempts;
  `;
  const { rows } = await client.query(q, [BATCH_SIZE, WORKER_ID]);
  return rows;
}

async function markSent(client, id) {
  await client.query(
    `UPDATE sms_jobs
     SET status='sent', sent_at=NOW(), last_error=NULL,
         locked_at=NULL, locked_by=NULL, updated_at=NOW()
     WHERE id=$1`,
    [id]
  );
}

async function markFailedOrRetry(client, id, attempts, errMsg) {
  const finalStatus = attempts >= MAX_ATTEMPTS ? "failed" : "pending";
  await client.query(
    `UPDATE sms_jobs
     SET status=$2, last_error=$3,
         locked_at=NULL, locked_by=NULL, updated_at=NOW()
     WHERE id=$1`,
    [id, finalStatus, errMsg?.slice(0, 500) || "Failed"]
  );
}

async function loop() {
  console.log(`[PI SMS WORKER] worker_id=${WORKER_ID}`);
  console.log(`[PI SMS WORKER] poll_interval_ms=${POLL_INTERVAL_MS} batch_size=${BATCH_SIZE} max_attempts=${MAX_ATTEMPTS}`);

  // Basic connectivity check
  await pool.query("SELECT 1");

  while (true) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const jobs = await claimJobs(client);
      await client.query("COMMIT");

      if (jobs.length === 0) {
        client.release();
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      client.release();

      for (const job of jobs) {
        try {
          await sendSms(job.to, job.message);
          const c2 = await pool.connect();
          try {
            await markSent(c2, job.id);
          } finally {
            c2.release();
          }
          console.log(`[PI SMS WORKER] sent job_id=${job.id} to=${job.to} kind=${job.kind}`);
        } catch (e) {
          const msg = e?.message || String(e);
          const c3 = await pool.connect();
          try {
            await markFailedOrRetry(c3, job.id, job.attempts, msg);
          } finally {
            c3.release();
          }
          console.error(`[PI SMS WORKER] failed job_id=${job.id} attempts=${job.attempts} err=${msg}`);
        }
      }
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      client.release();
      console.error("[PI SMS WORKER] loop error:", e?.message || e);
      await sleep(Math.min(10000, POLL_INTERVAL_MS));
    }
  }
}

process.on("SIGINT", async () => {
  console.log("Shutting down...");
  await pool.end().catch(() => {});
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down...");
  await pool.end().catch(() => {});
  process.exit(0);
});

loop().catch((e) => {
  console.error("Fatal:", e?.message || e);
  process.exit(1);
});

