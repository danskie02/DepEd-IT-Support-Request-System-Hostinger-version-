# Render Deployment Guide

## Prerequisites
- ✅ GitHub repository uploaded
- ✅ Supabase project created
- ✅ Render account created

---

## Step 1: Create Session Table in Supabase

Before deploying, create the session table for `connect-pg-simple`:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor** → Create a new query
4. Paste this SQL:

```sql
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX "IDX_session_expire" ON "session" ("expire");
```

5. Click **Run**

---

## Step 2: Set Up Render Web Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New +** → **Web Service**
3. Select your GitHub repository
4. Fill in the following:

### Basic Settings
- **Name**: `deped-it-support` (or your preferred name)
- **Environment**: `Node`
- **Region**: Select closest to you
- **Branch**: `main`
- **Build Command**: `npm run build`
- **Start Command**: `npm start`

### Environment Variables
Click **Advanced** and add:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `postgresql://postgres:YOUR_PASSWORD@db.nzuzwvyojtzquhyddvin.supabase.co:5432/postgres` |
| `SESSION_SECRET` | Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `PORT` | `10000` |

⚠️ **Replace `YOUR_PASSWORD`** with your actual Supabase password

### Plan Selection
- **Free Plan** available for testing
- Recommended: **Starter** ($7/month) for production to avoid cold starts

---

## Step 3: Deploy Migrations

After the first deployment, run the database migrations:

1. In Render dashboard, go to your service
2. Click **Shell** tab
3. Run: `npm run db:push`
4. This will create all tables (users, requests, otps, session)

---

## Step 4: Verify Deployment

1. Go to your service URL (e.g., `https://deped-it-support.onrender.com`)
2. Check if the app loads
3. Test login functionality
4. Sessions should persist after app restarts

---

## Constraints & Considerations

### 🟠 Free Tier Limitations
| Constraint | Impact | Mitigation |
|-----------|--------|-----------|
| **Cold starts** (15+ sec after 15 min inactivity) | Users wait for app to boot | Upgrade to Starter plan |
| **Single instance** | No redundancy | Use Starter+ for HA |
| **Limited memory** | May crash under heavy load | Monitor logs, upgrade if needed |
| **Spins down** after inactivity | App is down overnight | Setup monitoring/uptime checks |

### 🟢 Supabase Constraints
- **Free tier**: 500 MB database, 1 GB egress/month
- **No connection pooling** on free tier (Render handles this)
- **Auto-pause** may affect performance

### 🔴 Critical Issues Fixed
✅ **Sessions now persist** - Switched from MemoryStore to PostgreSQL  
✅ **Secure cookies** - Set to `httpOnly` and `secure`  
✅ **Environment variables** - Properly configured for production

---

## Troubleshooting

### Build Fails
```bash
Check Render logs:
- npm dependencies missing
- TypeScript compilation errors
- Missing environment variables
```

### Sessions Lost After Restart
```bash
Ensure SESSION_SECRET is set and session table exists
Run: npm run db:push
```

### Database Connection Error
```bash
1. Check DATABASE_URL is correct (with your actual password)
2. Verify Supabase credentials
3. Ensure IP whitelist allows Render (usually already done)
```

### Cold Start Performance
```bash
Free tier: Expected 15-30 seconds
Upgrade to Starter plan to avoid cold starts
```

---

## Next Steps (Production Ready)

1. **Enable HTTPS** - Automatically enabled on Render
2. **Set up monitoring** - Configure error tracking (e.g., Sentry)
3. **Upgrade plan** - Move to Starter ($7/month) for production
4. **Backup database** - Configure Supabase automated backups
5. **Set custom domain** - Add your own domain in Render settings
6. **Email integration** - Currently OTP logs to console, set up SMTP for SMS/Email

---

## Git Deployment Workflow

```bash
# Make changes locally
git add .
git commit -m "Fix session storage for production"
git push origin main

# Render auto-deploys on push to main branch
```

Visit your Render dashboard to monitor deployment progress.
