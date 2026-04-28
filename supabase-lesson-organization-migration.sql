-- ═══════════════════════════════════════════════════════════════════════════
-- LESSON ORGANIZATION MIGRATION
-- Add categories, auto-naming, and smart organization
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Create Categories Table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lesson_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#4f46e5',
  icon TEXT DEFAULT '📚',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_category_per_user UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_lesson_categories_user ON lesson_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_categories_sort ON lesson_categories(user_id, sort_order);

-- ─── 2. Extend user_lessons table ──────────────────────────────────────────────

ALTER TABLE user_lessons 
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES lesson_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS custom_title TEXT,
  ADD COLUMN IF NOT EXISTS auto_title TEXT;

CREATE INDEX IF NOT EXISTS idx_user_lessons_category ON user_lessons(category_id);
CREATE INDEX IF NOT EXISTS idx_user_lessons_user_category ON user_lessons(user_id, category_id);

-- ─── 3. RLS Policies for Categories ────────────────────────────────────────────

ALTER TABLE lesson_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own categories" ON lesson_categories;
CREATE POLICY "Users can view own categories"
  ON lesson_categories FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own categories" ON lesson_categories;
CREATE POLICY "Users can create own categories"
  ON lesson_categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own categories" ON lesson_categories;
CREATE POLICY "Users can update own categories"
  ON lesson_categories FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own categories" ON lesson_categories;
CREATE POLICY "Users can delete own categories"
  ON lesson_categories FOR DELETE
  USING (auth.uid() = user_id);

-- ─── 4. Function to auto-create default categories ─────────────────────────────

CREATE OR REPLACE FUNCTION create_default_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO lesson_categories (user_id, name, color, icon, sort_order)
  VALUES
    (NEW.id, 'Mathematics', '#3b82f6', '🔢', 1),
    (NEW.id, 'Science', '#10b981', '🧪', 2),
    (NEW.id, 'History', '#f59e0b', '📜', 3),
    (NEW.id, 'Languages', '#8b5cf6', '🌍', 4),
    (NEW.id, 'Other', '#6b7280', '📚', 5)
  ON CONFLICT (user_id, name) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on user creation (if auth.users is accessible)
-- DROP TRIGGER IF EXISTS trigger_create_default_categories ON auth.users;
-- CREATE TRIGGER trigger_create_default_categories
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION create_default_categories();

-- Alternative: Create default categories on first lesson save
-- This can be done in the API instead

COMMENT ON TABLE lesson_categories IS 'User-defined categories for organizing lessons (like ChatGPT projects)';
COMMENT ON COLUMN user_lessons.category_id IS 'Category this lesson belongs to';
COMMENT ON COLUMN user_lessons.custom_title IS 'User-provided title (editable)';
COMMENT ON COLUMN user_lessons.auto_title IS 'AI-generated descriptive title';
