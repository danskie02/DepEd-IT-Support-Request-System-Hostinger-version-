-- Database Migration: Add Telegram Chat ID Support
-- This migration adds support for storing Telegram chat IDs for users
-- Created: January 22, 2026

-- Add telegram_chat_id column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(255);

-- Add an index for faster lookups by telegram_chat_id (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_users_telegram_chat_id ON users(telegram_chat_id);

-- Verify the migration
-- Run this query to see the new column:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users';
