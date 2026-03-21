-- Add office column to requests table (idempotent for Render / drizzle-push / re-deploys)
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "office" text NOT NULL DEFAULT 'HR';
