-- =========================================================
-- VOICE PROFILES
-- =========================================================
CREATE TABLE public.voice_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_user_id UUID NOT NULL UNIQUE,
  elevenlabs_voice_id TEXT,
  sample_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view their voice profile"
  ON public.voice_profiles FOR SELECT
  USING (auth.uid() = parent_user_id);

CREATE POLICY "Parents can insert their voice profile"
  ON public.voice_profiles FOR INSERT
  WITH CHECK (auth.uid() = parent_user_id);

CREATE POLICY "Parents can update their voice profile"
  ON public.voice_profiles FOR UPDATE
  USING (auth.uid() = parent_user_id);

CREATE POLICY "Parents can delete their voice profile"
  ON public.voice_profiles FOR DELETE
  USING (auth.uid() = parent_user_id);

CREATE TRIGGER trg_voice_profiles_updated_at
  BEFORE UPDATE ON public.voice_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- STORIES
-- =========================================================
CREATE TABLE public.stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_user_id UUID NOT NULL,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  title TEXT,
  theme TEXT,
  lesson TEXT,
  characters TEXT,
  setting TEXT,
  length TEXT NOT NULL DEFAULT 'medium' CHECK (length IN ('short','medium','long')),
  original_text TEXT,
  edited_text TEXT,
  audio_url TEXT,
  voice_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','generating','ready','archived','failed')),
  played_count INTEGER NOT NULL DEFAULT 0,
  last_played_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stories_parent ON public.stories(parent_user_id);
CREATE INDEX idx_stories_child ON public.stories(child_id);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view their stories"
  ON public.stories FOR SELECT
  USING (auth.uid() = parent_user_id);

CREATE POLICY "Parents can insert their stories"
  ON public.stories FOR INSERT
  WITH CHECK (auth.uid() = parent_user_id);

CREATE POLICY "Parents can update their stories"
  ON public.stories FOR UPDATE
  USING (auth.uid() = parent_user_id);

CREATE POLICY "Parents can delete their stories"
  ON public.stories FOR DELETE
  USING (auth.uid() = parent_user_id);

CREATE TRIGGER trg_stories_updated_at
  BEFORE UPDATE ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- STORY EDITS (data flywheel)
-- =========================================================
CREATE TABLE public.story_edits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  parent_user_id UUID NOT NULL,
  original_text TEXT NOT NULL,
  edited_text TEXT NOT NULL,
  edit_distance INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_story_edits_story ON public.story_edits(story_id);

ALTER TABLE public.story_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view their story edits"
  ON public.story_edits FOR SELECT
  USING (auth.uid() = parent_user_id);

CREATE POLICY "Parents can insert their story edits"
  ON public.story_edits FOR INSERT
  WITH CHECK (auth.uid() = parent_user_id);

-- =========================================================
-- STORAGE: voice-samples (private)
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-samples', 'voice-samples', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Parents can view their own voice samples"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'voice-samples'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Parents can upload their own voice samples"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'voice-samples'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Parents can update their own voice samples"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'voice-samples'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Parents can delete their own voice samples"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'voice-samples'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );