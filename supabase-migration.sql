-- Run this in your Supabase SQL editor
-- Migration goal: align rooms/players schema and add product event tracking.
-- Safe to re-run (idempotent).

-- 1) Core tables
CREATE TABLE IF NOT EXISTS public.rooms (
  code TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'lobby',
  pack JSONB NOT NULL,
  created_at BIGINT NOT NULL,
  started_at BIGINT,
  ends_at BIGINT,
  question_time INTEGER NOT NULL DEFAULT 20,
  room_hash TEXT NOT NULL,
  host_token TEXT NOT NULL DEFAULT '',
  closed_at BIGINT,
  closed_by UUID
);

CREATE TABLE IF NOT EXISTS public.players (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL REFERENCES public.rooms(code) ON DELETE CASCADE,
  user_id UUID,
  name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  total_answered INTEGER NOT NULL DEFAULT 0,
  finished BOOLEAN NOT NULL DEFAULT FALSE,
  abandoned BOOLEAN NOT NULL DEFAULT FALSE,
  left_at BIGINT,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  weak_concepts JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- 2) Defensive ALTERs for pre-existing tables
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS room_hash TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS host_token TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS closed_at BIGINT,
  ADD COLUMN IF NOT EXISTS closed_by UUID;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS abandoned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS left_at BIGINT;

-- 3) Indexes
CREATE INDEX IF NOT EXISTS idx_players_room_code ON public.players(room_code);
CREATE INDEX IF NOT EXISTS idx_players_user_id ON public.players(user_id);

-- 4) Product analytics events
CREATE TABLE IF NOT EXISTS public.product_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'web',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_events_name_created_at
  ON public.product_events(name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_events_created_at
  ON public.product_events(created_at DESC);

-- 5) Admin access control
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Bootstrap initial admin (safe to re-run)
UPDATE public.profiles p
SET is_admin = TRUE
FROM auth.users u
WHERE p.id = u.id
  AND lower(u.email) = 'dariusdavid26@yahoo.com';

-- 6) Admin audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action TEXT NOT NULL,
  actor_id UUID NOT NULL,
  target_email TEXT NOT NULL,
  target_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON public.admin_audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor_id
  ON public.admin_audit_logs(actor_id);

-- 7) User progress tracking & streaks
CREATE TABLE IF NOT EXISTS public.user_progress (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  quizzes_completed INTEGER NOT NULL DEFAULT 0,
  lessons_completed INTEGER NOT NULL DEFAULT 0,
  total_questions_answered INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  time_spent_minutes INTEGER NOT NULL DEFAULT 0,
  concepts_learned JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_user_progress_user_date
  ON public.user_progress(user_id, date DESC);

-- Add streak fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_streak INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_activity_date DATE,
  ADD COLUMN IF NOT EXISTS total_quizzes_completed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_questions_answered INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_correct_answers INTEGER NOT NULL DEFAULT 0;

-- 8) Concept mastery tracking
CREATE TABLE IF NOT EXISTS public.concept_mastery (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  concept TEXT NOT NULL,
  times_seen INTEGER NOT NULL DEFAULT 0,
  times_correct INTEGER NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_review_at TIMESTAMPTZ,
  mastery_level INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, concept)
);

CREATE INDEX IF NOT EXISTS idx_concept_mastery_user_concept
  ON public.concept_mastery(user_id, concept);

CREATE INDEX IF NOT EXISTS idx_concept_mastery_next_review
  ON public.concept_mastery(user_id, next_review_at)
  WHERE next_review_at IS NOT NULL;

-- 9) Learning units (chunks of material)
CREATE TABLE IF NOT EXISTS public.learning_units (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'document', 'topic', 'custom'
  source_name TEXT,
  content TEXT NOT NULL,
  concepts JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of concept names
  difficulty_level INTEGER NOT NULL DEFAULT 1, -- 1-5 scale
  estimated_time_minutes INTEGER NOT NULL DEFAULT 15,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  parent_unit_id BIGINT REFERENCES public.learning_units(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_units_user
  ON public.learning_units(user_id, sequence_order);

CREATE INDEX IF NOT EXISTS idx_learning_units_parent
  ON public.learning_units(parent_unit_id);

-- 10) Concepts (extracted from materials)
CREATE TABLE IF NOT EXISTS public.concepts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  difficulty_level INTEGER NOT NULL DEFAULT 1, -- 1-5 scale
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name)
);

CREATE INDEX IF NOT EXISTS idx_concepts_name
  ON public.concepts(name);

-- 11) Concept dependencies (prerequisite relationships)
CREATE TABLE IF NOT EXISTS public.concept_dependencies (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  concept_id BIGINT NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
  prerequisite_id BIGINT NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
  strength INTEGER NOT NULL DEFAULT 1, -- 1-3: weak, medium, strong dependency
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(concept_id, prerequisite_id),
  CHECK (concept_id != prerequisite_id)
);

CREATE INDEX IF NOT EXISTS idx_concept_dependencies_concept
  ON public.concept_dependencies(concept_id);

CREATE INDEX IF NOT EXISTS idx_concept_dependencies_prerequisite
  ON public.concept_dependencies(prerequisite_id);

-- 12) User learning paths
CREATE TABLE IF NOT EXISTS public.user_learning_paths (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  learning_unit_id BIGINT NOT NULL REFERENCES public.learning_units(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'locked', -- 'locked', 'available', 'in_progress', 'completed'
  progress_percentage INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, learning_unit_id)
);

CREATE INDEX IF NOT EXISTS idx_user_learning_paths_user
  ON public.user_learning_paths(user_id, status);

CREATE INDEX IF NOT EXISTS idx_user_learning_paths_unit
  ON public.user_learning_paths(learning_unit_id);
