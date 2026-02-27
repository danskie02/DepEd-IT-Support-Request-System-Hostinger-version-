#!/usr/bin/env node
import express from "express";
import { exec } from "node:child_process";

const app = express();
app.use(express.json());

// Optional auth token to avoid unauthenticated requests from the network.
const AUTH_TOKEN = process.env.LOCAL_SMS_TOKEN || process.env.SMS_GATEWAY_TOKEN || "";

function checkAuth(req, res, next) {
  if (!AUTH_TOKEN) return next();
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${AUTH_TOKEN}`) return res.status(401).send("unauthorized");
  next();
}

app.post("/sms/send", checkAuth, (req, res) => {
  const { to, message } = req.body || {};
  if (!to || !message) return res.status(400).json({ error: "to and message required" });

  // By default this will call a Python script at /home/pi/send_sms.py.
  // Override with env `SMS_SEND_CMD` to point to your actual send command.
  const sendCmd = process.env.SMS_SEND_CMD || "python3 /home/pi/send_sms.py";

  exec(
    sendCmd,
    { env: { ...process.env, SMS_TO: String(to), SMS_MESSAGE: String(message) }, timeout: 30000 },
    (err, stdout, stderr) => {
      if (err) {
        console.error("[PI SMS] send error", err.message || stderr);
        return res.status(500).send(stderr || err.message);
      }
      return res.send("ok");
    },
  );
});

const port = Number(process.env.PORT || 8080);
app.listen(port, "0.0.0.0", () => console.log(`Pi SMS receiver listening on ${port}`));
