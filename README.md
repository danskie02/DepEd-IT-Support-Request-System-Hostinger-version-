# DepEd IT Support Request System

This repository contains the full-stack application for tracking IT support
requests. It includes an Express/React server, SMS/Telegram notification
services, and optional Raspberry Pi integration for SMS sending.

## Running locally

1. Copy `.env` to `.env.local` and fill in your configuration (database URL,
   email credentials, SMS gateway/credentials, Telegram token, etc.).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build and start in development:
   ```bash
   npm run dev
   ```
   or build and run production:
   ```bash
   npm run build
   npm start
   ```

The server listens on `PORT` (default 5000). The React client is served from
the same process.

## SMS configuration

Two different providers are supported; the system uses the value of
`SMS_PROVIDER` to choose.

### 1. Generic gateway (default)

This is the original Raspberry Pi/HTTP endpoint model. Set the variables:

```ini
SMS_MODE=push          # or pull
SMS_PROVIDER=gateway    # implicit when not set
SMS_GATEWAY_URL=https://your-pi.example.com/sms/send
SMS_GATEWAY_TOKEN=<token>    # optional bearer token
SMS_GATEWAY_TIMEOUT_MS=30000
```

*When `SMS_MODE=push` the server will POST to the gateway for each message.*

### 2. Twilio (or any HTTP-based SMS API)

This is recommended for cloud deployments (Render, Vercel, etc.) because the
service is publicly reachable and does not depend on a local device.

```ini
SMS_MODE=push
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=your_token
TWILIO_FROM_NUMBER=+1XXXXXXXXX
```

No additional code is required; `sendSms` will use the Twilio REST API.

> **Note:** you can also combine `SMS_MODE=pull` with any provider. In that
> case the web server only queues jobs and a background worker sends them.

### Pull mode and worker

Setting `SMS_MODE=pull` writes each message to the `sms_jobs` database table.
A worker process (bundled as `dist/smsWorker.cjs`) can be run separately to
send pending messages. This is useful when your main web service cannot reach
your SMS provider directly (e.g. when the provider is on a private network).

Start the worker with:

```bash
npm run worker
```

The worker loops indefinitely, updating job statuses to `sending`, `sent`, or
`failed` and logging results to the console.

## Telegram notifications

If `TELEGRAM_BOT_TOKEN` is set, the application can send OTP codes and request
status updates via Telegram. Users may link their Telegram account through the
bot commands (`/link`, `/unlink`).

## Deployment on Render

To deploy on Render:

1. Create a **Web Service** with build command `npm ci && npm run build` and
   start command `npm start`.
2. Add a **Postgres** database and set `DATABASE_URL` accordingly.
3. Set required environment variables (see above). Use `SMS_PROVIDER=twilio`
   or expose your Raspberry Pi with a public URL if you prefer the gateway
   option.
4. (Optional) Create a **Background Worker** on Render with command
   `npm run worker` if using `SMS_MODE=pull`.

### Making a Raspberry Pi accessible

If you insist on using your own SIM800L-hosted gateway, you must make it
publicly reachable. Options include port-forwarding, DDNS, or a tunnel service
(e.g. ngrok or Cloudflare Tunnel). Provide the resulting HTTPS URL as
`SMS_GATEWAY_URL` and set `SMS_GATEWAY_TOKEN`.

Alternatively, switch to Twilio (or similar) and remove the need for the Pi
entirely.

## Other environment variables

Refer to `.env` for a full list of configurable values (database URL,
SESSION_SECRET, EMAIL_* settings, TELEGRAM_BOT_TOKEN, etc.).

## Database migrations

Use:
```bash
npm run db:push
```

Drizzle will apply schema changes to the configured database.

## Contributing

The codebase is written in TypeScript. Run `npm run check` to type-check and
`npm test` if you later add tests.

Happy coding!
