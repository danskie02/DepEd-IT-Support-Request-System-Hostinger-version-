-- Add office column to requests table
ALTER TABLE "requests" ADD COLUMN "office" text NOT NULL DEFAULT 'HR';
