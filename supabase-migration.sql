-- Run this in your Supabase SQL editor to add subscription & usage tracking columns

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weekly_lessons_count INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weekly_quizzes_count INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weekly_reset_date DATE;
