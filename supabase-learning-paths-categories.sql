-- ═══════════════════════════════════════════════════════════════════════════
-- LEARNING PATHS - Add Categories & Auto-naming
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Add category and title columns to learning_units ──────────────────────────

-- Category support
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'learning_units' 
    AND column_name = 'category_id'
  ) THEN
    ALTER TABLE learning_units ADD COLUMN category_id UUID REFERENCES lesson_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Custom title (user-renamed)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'learning_units' 
    AND column_name = 'custom_title'
  ) THEN
    ALTER TABLE learning_units ADD COLUMN custom_title TEXT;
  END IF;
END $$;

-- Auto-generated title (AI)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'learning_units' 
    AND column_name = 'auto_title'
  ) THEN
    ALTER TABLE learning_units ADD COLUMN auto_title TEXT;
  END IF;
END $$;

-- Add index for category lookups
CREATE INDEX IF NOT EXISTS idx_learning_units_category ON learning_units(category_id);
CREATE INDEX IF NOT EXISTS idx_learning_units_user_category ON learning_units(user_id, category_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- NOTES:
-- - Learning paths now support same organization as regular lessons
-- - custom_title: user can rename the learning path
-- - auto_title: AI generates descriptive name
-- - category_id: links to lesson_categories table
-- ═══════════════════════════════════════════════════════════════════════════
