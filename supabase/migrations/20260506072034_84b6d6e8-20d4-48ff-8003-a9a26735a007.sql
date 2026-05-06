
CREATE TABLE public.voice_waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own waitlist entry"
ON public.voice_waitlist
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own waitlist entry"
ON public.voice_waitlist
FOR SELECT
USING (auth.uid() = user_id);
