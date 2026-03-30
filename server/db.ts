import { config } from "dotenv";
import path from "path";

// Load .env from the workspace root (up from dist/)
const envPath = path.resolve(process.cwd(), ".env");

config({ path: envPath, override: true }); // Ensure .env is loaded before creating connection

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error(`[DB ERROR] DATABASE_URL not found!`);
  console.error(`[DB ERROR] Looked in: ${envPath}`);
  console.error(`[DB ERROR] CWD: ${process.cwd()}`);
  throw new Error(
    "DATABASE_URL must be set in .env file. Did you forget to provision a database?",
  );
}

// Trim whitespace and log the connection string (without password) for debugging
const rawUrl = process.env.DATABASE_URL.trim();

/**
 * Supabase transaction pooler (PgBouncer) cannot use prepared statements across
 * transactions. node-postgres must use simple-query mode: add `pgbouncer=true`
 * to the connection string (see Supabase "Connect to Postgres" docs).
 */
function normalizeDatabaseUrl(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  const host = u.hostname.toLowerCase();
  const port = u.port || (u.protocol === "postgresql:" || u.protocol === "postgres:" ? "5432" : "");
  const isSupabasePooler =
    host.includes("pooler.supabase.com") || host.includes("pooler.supabase.co");
  const isTransactionPooler = port === "6543";
  if ((isSupabasePooler && isTransactionPooler) || process.env.PG_USE_POOLER === "true") {
    if (!u.searchParams.has("pgbouncer")) {
      u.searchParams.set("pgbouncer", "true");
    }
  }
  return u.toString();
}

const dbUrl = normalizeDatabaseUrl(rawUrl);
const maskedUrl = dbUrl.replace(/:[^:@]+@/, ":****@");
console.log(`[DB] Connecting to: ${maskedUrl}`);

// Validate URL format
try {
  const testUrl = new URL(dbUrl);
  if (testUrl.protocol !== "postgresql:" && testUrl.protocol !== "postgres:") {
    throw new Error(`Invalid database protocol: ${testUrl.protocol}. Expected postgresql: or postgres:`);
  }
} catch (err: any) {
  throw new Error(`Invalid DATABASE_URL format: ${err.message}`);
}

const poolMax =
  Number(process.env.PG_POOL_MAX) ||
  (process.env.NODE_ENV === "production" ? 5 : 1);

export const pool = new Pool({
  connectionString: dbUrl,
  max: poolMax,
});
export const db = drizzle(pool, { schema });
