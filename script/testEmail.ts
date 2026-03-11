import { config } from "dotenv";
import fs from "fs";
import path from "path";

// load .env first, then attempt to load sendgrid.env (gitignored) to pick up
// the API key during local testing.  `override: true` ensures it replaces any
// existing values from the first file.
config({ override: true });
config({ path: "sendgrid.env", override: true });

// if sendgrid.env uses "export SENDGRID_API_KEY='...'" syntax, dotenv won't
// parse it. patch process.env manually by reading the file and stripping
// export/quotes.
try {
  const sgPath = path.resolve(__dirname, "../sendgrid.env");
  if (fs.existsSync(sgPath)) {
    const content = fs.readFileSync(sgPath, "utf-8");
    const m = content.match(/SENDGRID_API_KEY=['\"]?([^'\"\n]+)['\"]?/);
    if (m && m[1]) {
      process.env.SENDGRID_API_KEY = m[1];
    }
  }
} catch (e) {
  // ignore
}

import { sendEmail } from "../server/email";

async function main() {
  const result = await sendEmail({
    to: process.env.EMAIL_USER || "example@example.com",
    subject: "Test Email from DepEd Request System",
    htmlContent: "<p>This is a test message sent using the configured email service.</p>",
  });

  console.log("sendEmail result:", result);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});