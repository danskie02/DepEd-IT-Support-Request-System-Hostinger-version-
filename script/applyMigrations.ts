import { config } from "dotenv";
import { Pool } from "pg";
import { readdirSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// load .env into process.env (override existing values)
config({ override: true });

// __dirname polyfill for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL not set");
  }

  const pool = new Pool({ connectionString: url });
  try {
    const dir = path.resolve(__dirname, "../migrations");
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const sql = readFileSync(path.join(dir, file), "utf-8");
      console.log(`running migration ${file}`);
      try {
        await pool.query(sql);
      } catch (err: any) {
        // ignore errors about existing objects / primary keys from repeated runs
        if (err.code === '42P16' || err.code === '42P07' || err.code === '42710') {
          console.warn(`warning: migration ${file} produced error but will continue: ${err.message}`);
        } else {
          throw err;
        }
      }
    }

    console.log("migrations applied");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});