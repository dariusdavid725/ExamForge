-- Players: join order for host detection + lobby list
-- Run in Supabase SQL editor (safe to re-run)

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS created_at BIGINT;

-- Backfill existing rows (same timestamp fallback; new inserts use DEFAULT)
UPDATE public.players
SET created_at = (floor(extract(epoch from now()) * 1000))::bigint
WHERE created_at IS NULL;

ALTER TABLE public.players
  ALTER COLUMN created_at SET DEFAULT ((floor(extract(epoch from now()) * 1000))::bigint);

COMMENT ON COLUMN public.players.created_at IS 'Milliseconds since epoch when the player row was created (join order).';
