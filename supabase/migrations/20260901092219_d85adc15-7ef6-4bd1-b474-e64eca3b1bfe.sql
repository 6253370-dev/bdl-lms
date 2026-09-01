-- 1. Realtime for quiz
ALTER TABLE public.quiz_rooms REPLICA IDENTITY FULL;
ALTER TABLE public.room_participants REPLICA IDENTITY FULL;
ALTER TABLE public.room_answers REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_answers;

-- 2. Sequential certificate serials
CREATE SEQUENCE IF NOT EXISTS public.certificate_serial_seq START WITH 1;
SELECT setval('public.certificate_serial_seq', GREATEST(1, (SELECT count(*) FROM public.certificates)));
ALTER TABLE public.certificates
  ALTER COLUMN serial SET DEFAULT lpad(nextval('public.certificate_serial_seq')::text, 6, '0');
GRANT USAGE, SELECT ON SEQUENCE public.certificate_serial_seq TO authenticated, service_role;
UPDATE public.certificates SET serial = lpad(nextval('public.certificate_serial_seq')::text, 6, '0')
  WHERE serial LIKE 'BE-%';

-- 3. Open-ended questions
ALTER TABLE public.standalone_exam_questions ADD COLUMN IF NOT EXISTS is_open_ended boolean NOT NULL DEFAULT false;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS is_open_ended boolean NOT NULL DEFAULT false;

ALTER TABLE public.standalone_exam_responses
  ADD COLUMN IF NOT EXISTS answer_text text,
  ADD COLUMN IF NOT EXISTS grade numeric,
  ADD COLUMN IF NOT EXISTS graded_by uuid,
  ADD COLUMN IF NOT EXISTS graded_at timestamptz;
ALTER TABLE public.attempt_responses
  ADD COLUMN IF NOT EXISTS answer_text text,
  ADD COLUMN IF NOT EXISTS grade numeric,
  ADD COLUMN IF NOT EXISTS graded_by uuid,
  ADD COLUMN IF NOT EXISTS graded_at timestamptz;

ALTER TABLE public.standalone_exam_attempts ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;
ALTER TABLE public.block_attempts ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

-- 4. Admin grading permissions
CREATE POLICY "Admins grade exam responses" ON public.standalone_exam_responses
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins grade block responses" ON public.attempt_responses
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins update exam attempts" ON public.standalone_exam_attempts
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins update block attempts" ON public.block_attempts
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));