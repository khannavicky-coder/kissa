-- Children profiles table
CREATE TABLE public.children (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  avatar TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT children_age_range CHECK (age >= 3 AND age <= 9),
  CONSTRAINT children_name_length CHECK (char_length(name) BETWEEN 1 AND 60)
);

CREATE INDEX idx_children_parent ON public.children(parent_user_id);

-- Enforce max 2 children per parent
CREATE OR REPLACE FUNCTION public.enforce_child_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.children WHERE parent_user_id = NEW.parent_user_id) >= 2 THEN
    RAISE EXCEPTION 'You can only have up to 2 child profiles.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_child_limit_trigger
BEFORE INSERT ON public.children
FOR EACH ROW
EXECUTE FUNCTION public.enforce_child_limit();

CREATE TRIGGER children_set_updated_at
BEFORE UPDATE ON public.children
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Row Level Security
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view their own children"
ON public.children FOR SELECT
USING (auth.uid() = parent_user_id);

CREATE POLICY "Parents can insert their own children"
ON public.children FOR INSERT
WITH CHECK (auth.uid() = parent_user_id);

CREATE POLICY "Parents can update their own children"
ON public.children FOR UPDATE
USING (auth.uid() = parent_user_id);

CREATE POLICY "Parents can delete their own children"
ON public.children FOR DELETE
USING (auth.uid() = parent_user_id);