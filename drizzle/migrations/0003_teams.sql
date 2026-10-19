CREATE TABLE public.teams (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams read" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "teams admin manage" ON public.teams FOR ALL TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
INSERT INTO public.teams(name) SELECT DISTINCT trim(team) FROM public.profiles WHERE team IS NOT NULL AND trim(team) <> '' ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.protect_profile_team() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.team IS DISTINCT FROM OLD.team AND auth.uid() IS NOT NULL AND NOT public.is_admin_or_super(auth.uid()) THEN
    NEW.team := OLD.team;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_profile_team BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_team();