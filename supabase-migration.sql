-- Run this in your Supabase SQL editor

-- 1. Subscription & usage tracking columns on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weekly_lessons_count INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weekly_quizzes_count INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weekly_reset_date DATE;

-- 2. User lessons table (replaces localStorage)
CREATE TABLE IF NOT EXISTS user_lessons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'Lesson',
  language      TEXT DEFAULT 'Unknown',
  lesson        JSONB NOT NULL,
  document_text TEXT DEFAULT '',
  last_quiz_score INT,
  last_quiz_date  TIMESTAMPTZ,
  review_topics   TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own lessons" ON user_lessons
  FOR ALL USING (auth.uid() = user_id);
