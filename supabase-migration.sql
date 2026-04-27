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
