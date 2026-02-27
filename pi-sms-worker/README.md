# Raspberry Pi SMS Worker (Pull Model)

This worker runs on your Raspberry Pi (SIM800L) and **pulls SMS jobs** from your Supabase Postgres DB, then sends them using your existing SIM800L setup.

## Why pull model?
- Your Pi stays inside the local network (no inbound port forwarding).
- Your web app (Render) only writes rows to `sms_jobs`.
- The Pi reads those rows and sends SMS locally.

## 1) Deploy DB schema
In your web app repo, after you update env vars and connect to Supabase:

```bash
npm run db:push
```

This will create the `sms_jobs` table.

## 2) Configure the web app (Render)
Set these environment variables in Render:

- `SMS_MODE=pull`
- `DATABASE_URL=<your Supabase connection string>`
- `SESSION_SECRET=<random>`
- `TELEGRAM_BOT_TOKEN=<your telegram token>` (optional)
- Email env vars as needed

## 3) Run the worker on Raspberry Pi

### Install
Copy the `pi-sms-worker/` folder to your Pi, then:

```bash
cd pi-sms-worker
npm install
cp .env.example .env
```

Edit `.env`:
- Set `DATABASE_URL` (Supabase)
- Set `PGSSL=true`
- Configure one sender:
  - `SMS_SEND_CMD=python3 /path/to/your/send_sms.py`
  - OR `LOCAL_SMS_SEND_URL=http://127.0.0.1:8080/sms/send`

### Start
```bash
npm start
```

## 4) Plug in your existing SIM800L sender

### Option A: call your script (recommended)
Set:
```
SMS_SEND_CMD=python3 /home/pi/sim800l/send_sms.py
```

Your script should read:
- `SMS_TO` (recipient phone)
- `SMS_MESSAGE` (text)

Example Python skeleton:

```python
import os

to = os.environ["SMS_TO"]
msg = os.environ["SMS_MESSAGE"]

# Call your SIM800L send logic here...
# If sending succeeds, exit 0
# If it fails, exit non-zero
```

### Option B: local HTTP service
If you already have a local service on the Pi, set:
```
LOCAL_SMS_SEND_URL=http://127.0.0.1:8080/sms/send
```
The worker will POST JSON: `{ "to": "...", "message": "..." }`.

## Notes
- The worker uses row-locking (`FOR UPDATE SKIP LOCKED`) so multiple Pis can run safely.
- Failed jobs will retry up to `MAX_ATTEMPTS` times, then become `failed`.

