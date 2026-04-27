-- ══════════════════════════════════════════════════════════════════════════════
-- INTERACTIVE LEARNING FEATURES
-- Text highlights, error reports, user notes, learning sessions
-- ══════════════════════════════════════════════════════════════════════════════

-- User highlights in learning units
CREATE TABLE IF NOT EXISTS public.unit_highlights (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  unit_id BIGINT NOT NULL REFERENCES public.learning_units(id) ON DELETE CASCADE,
  text_content TEXT NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  color VARCHAR(20) DEFAULT 'yellow',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, unit_id, start_offset, end_offset)
);

CREATE INDEX IF NOT EXISTS idx_unit_highlights_user_unit 
  ON public.unit_highlights(user_id, unit_id);

-- User notes on learning units
CREATE TABLE IF NOT EXISTS public.unit_notes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  unit_id BIGINT NOT NULL REFERENCES public.learning_units(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  position_offset INTEGER, -- where in content the note is anchored
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unit_notes_user_unit 
  ON public.unit_notes(user_id, unit_id);

-- Error reports for AI-generated content
CREATE TABLE IF NOT EXISTS public.content_error_reports (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  unit_id BIGINT NOT NULL REFERENCES public.learning_units(id) ON DELETE CASCADE,
  error_type VARCHAR(50) NOT NULL, -- 'incorrect_info', 'typo', 'unclear', 'formula_error'
  error_description TEXT NOT NULL,
  text_snippet TEXT, -- the problematic text
  position_offset INTEGER,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'reviewed', 'fixed', 'dismissed'
  ai_review TEXT, -- AI's review of the error
  ai_suggested_fix TEXT, -- AI's suggested correction
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_reports_unit 
  ON public.content_error_reports(unit_id, status);
CREATE INDEX IF NOT EXISTS idx_error_reports_user 
  ON public.content_error_reports(user_id);

-- Learning sessions (for multiplayer/collaborative learning)
CREATE TABLE IF NOT EXISTS public.learning_sessions (
  id BIGSERIAL PRIMARY KEY,
  host_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  unit_id BIGINT NOT NULL REFERENCES public.learning_units(id) ON DELETE CASCADE,
  session_code VARCHAR(10) UNIQUE NOT NULL, -- short code for inviting others
  is_active BOOLEAN DEFAULT true,
  max_participants INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_learning_sessions_active 
  ON public.learning_sessions(is_active, expires_at) 
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_learning_sessions_code 
  ON public.learning_sessions(session_code) 
  WHERE is_active = true;

-- Session participants (who's in the study session)
CREATE TABLE IF NOT EXISTS public.session_participants (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES public.learning_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_online BOOLEAN DEFAULT true,
  UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_session_participants_session 
  ON public.session_participants(session_id, is_online);

-- Enable Row Level Security
ALTER TABLE public.unit_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_error_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Highlights: users can only manage their own highlights
CREATE POLICY "Users can view their own highlights" 
  ON public.unit_highlights FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own highlights" 
  ON public.unit_highlights FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own highlights" 
  ON public.unit_highlights FOR DELETE 
  USING (auth.uid() = user_id);

-- Notes: users can only manage their own notes
CREATE POLICY "Users can manage their own notes" 
  ON public.unit_notes FOR ALL 
  USING (auth.uid() = user_id);

-- Error reports: users can report, admins can review all
CREATE POLICY "Users can create error reports" 
  ON public.content_error_reports FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own reports" 
  ON public.content_error_reports FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all error reports" 
  ON public.content_error_reports FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can update error reports" 
  ON public.content_error_reports FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Learning sessions: host can manage, others can view
CREATE POLICY "Anyone can view active sessions by code" 
  ON public.learning_sessions FOR SELECT 
  USING (is_active = true);

CREATE POLICY "Users can create their own sessions" 
  ON public.learning_sessions FOR INSERT 
  WITH CHECK (auth.uid() = host_user_id);

CREATE POLICY "Hosts can update their own sessions" 
  ON public.learning_sessions FOR UPDATE 
  USING (auth.uid() = host_user_id);

-- Session participants: users can join and see others in same session
CREATE POLICY "Users can view participants in sessions they're in" 
  ON public.session_participants FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.session_participants sp 
      WHERE sp.session_id = session_participants.session_id 
      AND sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join sessions" 
  ON public.session_participants FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own participation" 
  ON public.session_participants FOR UPDATE 
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.unit_highlights TO authenticated;
GRANT ALL ON public.unit_notes TO authenticated;
GRANT ALL ON public.content_error_reports TO authenticated;
GRANT ALL ON public.learning_sessions TO authenticated;
GRANT ALL ON public.session_participants TO authenticated;
