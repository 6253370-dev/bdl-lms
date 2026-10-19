ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_exam_blocked boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS exam_blocked_reason text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS exam_blocked_at timestamptz;

CREATE OR REPLACE FUNCTION public.block_me_from_exam(_reason text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles SET is_exam_blocked = true, exam_blocked_reason = left(_reason, 200), exam_blocked_at = now()
  WHERE id = auth.uid() AND NOT public.is_admin_or_super(auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.block_me_from_exam(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_profile_exam_block()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.is_exam_blocked IS DISTINCT FROM OLD.is_exam_blocked
      OR NEW.exam_blocked_reason IS DISTINCT FROM OLD.exam_blocked_reason
      OR NEW.exam_blocked_at IS DISTINCT FROM OLD.exam_blocked_at)
     AND auth.uid() IS NOT NULL
     AND current_user NOT IN ('postgres','service_role','supabase_admin')
     AND NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can change exam block status';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_protect_profile_exam_block ON public.profiles;
CREATE TRIGGER trg_protect_profile_exam_block BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_exam_block();