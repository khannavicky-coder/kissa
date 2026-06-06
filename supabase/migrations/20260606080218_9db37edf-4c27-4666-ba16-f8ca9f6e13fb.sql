
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all children" ON public.children;
CREATE POLICY "Admins can view all children" ON public.children
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all stories" ON public.stories;
CREATE POLICY "Admins can view all stories" ON public.stories
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all voice profiles" ON public.voice_profiles;
CREATE POLICY "Admins can view all voice profiles" ON public.voice_profiles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
