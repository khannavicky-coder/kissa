DROP POLICY IF EXISTS "Story audio is publicly readable" ON storage.objects;

-- Allow public read of individual files only (no listing)
CREATE POLICY "Story audio files are publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'story-audio' AND name IS NOT NULL AND name <> '');
