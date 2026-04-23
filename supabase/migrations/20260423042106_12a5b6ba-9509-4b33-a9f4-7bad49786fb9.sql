
-- Standalone exam tables
CREATE TABLE public.standalone_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  password text NOT NULL,
  time_limit_seconds integer,
  passing_score integer NOT NULL DEFAULT 60,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.standalone_exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.standalone_exams(id) ON DELETE CASCADE,
  text text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  time_limit_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.standalone_exam_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.standalone_exam_questions(id) ON DELETE CASCADE,
  text text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  is_correct boolean NOT NULL DEFAULT false
);

CREATE TABLE public.standalone_exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.standalone_exams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  score_percent numeric NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  duration_seconds integer NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.standalone_exam_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.standalone_exam_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL,
  answer_id uuid,
  is_correct boolean NOT NULL DEFAULT false,
  time_spent_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.standalone_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standalone_exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standalone_exam_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standalone_exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standalone_exam_responses ENABLE ROW LEVEL SECURITY;

-- Exams
CREATE POLICY "Admins manage exams" ON public.standalone_exams
  FOR ALL USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()));
CREATE POLICY "Auth read published exams" ON public.standalone_exams
  FOR SELECT TO authenticated USING (is_published OR is_admin_or_super(auth.uid()));

-- Questions
CREATE POLICY "Admins manage exam questions" ON public.standalone_exam_questions
  FOR ALL USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()));
CREATE POLICY "Auth read exam questions" ON public.standalone_exam_questions
  FOR SELECT TO authenticated USING (true);

-- Answers
CREATE POLICY "Admins manage exam answers" ON public.standalone_exam_answers
  FOR ALL USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()));
CREATE POLICY "Auth read exam answers" ON public.standalone_exam_answers
  FOR SELECT TO authenticated USING (true);

-- Attempts
CREATE POLICY "Users insert own exam attempts" ON public.standalone_exam_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own exam attempts" ON public.standalone_exam_attempts
  FOR SELECT USING (auth.uid() = user_id OR is_admin_or_super(auth.uid()));

-- Responses
CREATE POLICY "Users insert own exam responses" ON public.standalone_exam_responses
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.standalone_exam_attempts a
    WHERE a.id = standalone_exam_responses.attempt_id AND a.user_id = auth.uid()
  ));
CREATE POLICY "Users view own exam responses" ON public.standalone_exam_responses
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.standalone_exam_attempts a
    WHERE a.id = standalone_exam_responses.attempt_id
      AND (a.user_id = auth.uid() OR is_admin_or_super(auth.uid()))
  ));

CREATE TRIGGER trg_standalone_exams_updated
  BEFORE UPDATE ON public.standalone_exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_se_questions_exam ON public.standalone_exam_questions(exam_id);
CREATE INDEX idx_se_answers_question ON public.standalone_exam_answers(question_id);
CREATE INDEX idx_se_attempts_exam ON public.standalone_exam_attempts(exam_id);
CREATE INDEX idx_se_attempts_user ON public.standalone_exam_attempts(user_id);
