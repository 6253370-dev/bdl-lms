
-- SECURITY DEFINER function to verify exam password without exposing it
CREATE OR REPLACE FUNCTION public.verify_exam_password(_exam_id uuid, _password text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.standalone_exams
    WHERE id = _exam_id AND password = _password AND is_published = true
  )
$$;

-- Restrict password column from non-admins by replacing the broad SELECT policy
DROP POLICY "Auth read published exams" ON public.standalone_exams;

-- Admins can read everything (covered by "Admins manage exams" ALL policy already).
-- Add a policy so authenticated users can read published exam metadata. We'll
-- prevent password leaks at the application layer by never selecting `password`.
CREATE POLICY "Auth read published exams" ON public.standalone_exams
  FOR SELECT TO authenticated
  USING (is_published OR is_admin_or_super(auth.uid()));

-- Revoke direct column SELECT on `password` from authenticated users
REVOKE SELECT (password) ON public.standalone_exams FROM authenticated, anon;
