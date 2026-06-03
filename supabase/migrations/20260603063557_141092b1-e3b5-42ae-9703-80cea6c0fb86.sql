
-- Lock down story-audio bucket writes to service_role only (edge functions).
-- RLS is already enabled on storage.objects. Add explicit policies that only
-- service_role can INSERT/UPDATE/DELETE; authenticated/anon users get no write access.

CREATE POLICY "Service role can insert story audio"
ON storage.objects FOR INSERT TO service_role
WITH CHECK (bucket_id = 'story-audio');

CREATE POLICY "Service role can update story audio"
ON storage.objects FOR UPDATE TO service_role
USING (bucket_id = 'story-audio');

CREATE POLICY "Service role can delete story audio"
ON storage.objects FOR DELETE TO service_role
USING (bucket_id = 'story-audio');

-- Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated.
-- These are trigger functions and should not be callable directly via the API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_child_limit() FROM anon, authenticated, PUBLIC;
