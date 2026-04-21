-- Create the story-audio bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('story-audio', 'story-audio', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read access for story audio files
CREATE POLICY "Story audio is publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'story-audio');
