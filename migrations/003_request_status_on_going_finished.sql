-- Add new workflow statuses.
-- Safe to run multiple times.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'request_status' AND e.enumlabel = 'on_going'
  ) THEN
    ALTER TYPE request_status ADD VALUE 'on_going';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'request_status' AND e.enumlabel = 'finished'
  ) THEN
    ALTER TYPE request_status ADD VALUE 'finished';
  END IF;
END $$;

