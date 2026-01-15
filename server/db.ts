import { config } from "dotenv";
config({ override: true }); // Ensure .env is loaded before creating connection

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Trim whitespace and log the connection string (without password) for debugging
const dbUrl = process.env.DATABASE_URL.trim();
const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
console.log(`[DB] Connecting to: ${maskedUrl}`);

// Validate URL format
try {
  const testUrl = new URL(dbUrl);
  if (testUrl.protocol !== 'postgresql:' && testUrl.protocol !== 'postgres:') {
    throw new Error(`Invalid database protocol: ${testUrl.protocol}. Expected postgresql: or postgres:`);
  }
} catch (err: any) {
  throw new Error(`Invalid DATABASE_URL format: ${err.message}`);
}

export const pool = new Pool({ connectionString: dbUrl });
export const db = drizzle(pool, { schema });
