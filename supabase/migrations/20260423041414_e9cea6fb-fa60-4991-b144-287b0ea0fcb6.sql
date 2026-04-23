-- Attempts at a quiz / practice / final exam
CREATE TABLE public.block_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  block_id uuid NOT NULL REFERENCES public.course_blocks(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  total_questions integer NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  score_percent numeric(5,2) NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  duration_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_attempts_user ON public.block_attempts(user_id);
CREATE INDEX idx_attempts_block ON public.block_attempts(block_id);
CREATE INDEX idx_attempts_course ON public.block_attempts(course_id);

ALTER TABLE public.block_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own attempts" ON public.block_attempts FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin_or_super(auth.uid()));
CREATE POLICY "Users insert own attempts" ON public.block_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Per-question response inside an attempt
CREATE TABLE public.attempt_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.block_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer_id uuid REFERENCES public.answers(id) ON DELETE SET NULL,
  is_correct boolean NOT NULL DEFAULT false,
  time_spent_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_responses_attempt ON public.attempt_responses(attempt_id);

ALTER TABLE public.attempt_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own responses" ON public.attempt_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.block_attempts a
      WHERE a.id = attempt_id
        AND (a.user_id = auth.uid() OR public.is_admin_or_super(auth.uid()))
    )
  );
CREATE POLICY "Users insert own responses" ON public.attempt_responses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.block_attempts a
      WHERE a.id = attempt_id AND a.user_id = auth.uid()
    )
  );