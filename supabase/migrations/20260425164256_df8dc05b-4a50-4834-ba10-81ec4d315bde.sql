-- Lesson comments (private user-admin thread per lesson/block)
CREATE TABLE public.lesson_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  block_id uuid NOT NULL,
  course_id uuid NOT NULL,
  user_id uuid NOT NULL,
  author_id uuid NOT NULL,
  parent_id uuid REFERENCES public.lesson_comments(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_lesson_comments_block_user ON public.lesson_comments(block_id, user_id);
CREATE INDEX idx_lesson_comments_user ON public.lesson_comments(user_id);

ALTER TABLE public.lesson_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own thread"
ON public.lesson_comments FOR SELECT
USING (auth.uid() = user_id OR public.is_admin_or_super(auth.uid()));

CREATE POLICY "Users create in own thread"
ON public.lesson_comments FOR INSERT
WITH CHECK (
  auth.uid() = author_id
  AND (auth.uid() = user_id OR public.is_admin_or_super(auth.uid()))
);

CREATE POLICY "Authors delete own"
ON public.lesson_comments FOR DELETE
USING (auth.uid() = author_id OR public.is_admin_or_super(auth.uid()));

-- Certificates issued on course completion
CREATE TABLE public.certificates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  course_id uuid NOT NULL,
  full_name text NOT NULL,
  course_title text NOT NULL,
  score_percent numeric NOT NULL DEFAULT 0,
  issued_at timestamp with time zone NOT NULL DEFAULT now(),
  serial text NOT NULL UNIQUE DEFAULT ('BE-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  UNIQUE (user_id, course_id)
);

CREATE INDEX idx_certificates_user ON public.certificates(user_id);
CREATE INDEX idx_certificates_course ON public.certificates(course_id);

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own certificates"
ON public.certificates FOR SELECT
USING (auth.uid() = user_id OR public.is_admin_or_super(auth.uid()));

CREATE POLICY "Users insert own certificates"
ON public.certificates FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage certificates"
ON public.certificates FOR ALL
USING (public.is_admin_or_super(auth.uid()))
WITH CHECK (public.is_admin_or_super(auth.uid()));