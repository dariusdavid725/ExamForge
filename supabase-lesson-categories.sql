-- ═══════════════════════════════════════════════════════════════════════════
-- LESSON CATEGORIES & ORGANIZATION
-- Smart naming + folder organization like ChatGPT
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Categories (Subjects/Projects) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lesson_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#4f46e5',
  icon TEXT DEFAULT '📚',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_category_per_user UNIQUE(user_id, name)
);

CREATE INDEX idx_lesson_categories_user ON lesson_categories(user_id);

-- ─── Add category and title columns to existing lessons ───────────────────────

-- For local storage lessons (if we migrate them to DB later)
-- For now, we'll extend the localStorage schema

-- If you have a lessons table in Supabase:
-- ALTER TABLE lessons ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES lesson_categories(id) ON DELETE SET NULL;
-- ALTER TABLE lessons ADD COLUMN IF NOT EXISTS custom_title TEXT;
-- ALTER TABLE lessons ADD COLUMN IF NOT EXISTS auto_title TEXT;

-- ─── RLS Policies ──────────────────────────────────────────────────────────────

ALTER TABLE lesson_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own categories"
  ON lesson_categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own categories"
  ON lesson_categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
  ON lesson_categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
  ON lesson_categories FOR DELETE
  USING (auth.uid() = user_id);

-- ─── Default categories (optional) ─────────────────────────────────────────────
-- Auto-create some default categories for new users via trigger if needed

-- ═══════════════════════════════════════════════════════════════════════════
-- NOTES:
-- - custom_title: user-provided name (editable)
-- - auto_title: AI-generated descriptive name
-- - If custom_title is null, display auto_title
-- - Categories are user-specific (like ChatGPT projects)
-- ═══════════════════════════════════════════════════════════════════════════
