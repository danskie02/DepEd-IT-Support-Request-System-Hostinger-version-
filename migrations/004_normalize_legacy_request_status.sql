-- Normalize legacy status values after enum values already exist.
-- This must run in a separate migration from enum ADD VALUE.

UPDATE requests
SET status = 'finished'
WHERE status IN ('approved', 'denied');

