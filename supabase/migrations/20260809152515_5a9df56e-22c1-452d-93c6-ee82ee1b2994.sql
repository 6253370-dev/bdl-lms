ALTER TABLE public.standalone_exams ALTER COLUMN password SET DEFAULT '';
UPDATE public.standalone_exams SET password = '' WHERE password IS NULL;
ALTER TABLE public.standalone_exams ADD COLUMN IF NOT EXISTS has_password boolean GENERATED ALWAYS AS (password <> '') STORED;

CREATE OR REPLACE FUNCTION public.verify_exam_password(_exam_id uuid, _password text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.standalone_exams
    WHERE id = _exam_id
      AND is_published = true
      AND (password = '' OR password = _password)
  )
$function$;