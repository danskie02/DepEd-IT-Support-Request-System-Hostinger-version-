import { db } from "./db";
import { smsJobs } from "@shared/schema";

async function clearQueue() {
  try {
    const result = await db.delete(smsJobs);
    console.log("[SMS QUEUE] Cleared all SMS jobs from queue");
    process.exit(0);
  } catch (err) {
    console.error("[SMS QUEUE] Error clearing queue:", err);
    process.exit(1);
  }
}

clearQueue();
