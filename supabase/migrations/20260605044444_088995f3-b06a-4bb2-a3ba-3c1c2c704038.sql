
-- Question Bank module
CREATE TYPE public.bank_question_type AS ENUM ('multiple_choice', 'open_ended', 'practice');
CREATE TYPE public.bank_difficulty AS ENUM ('easy', 'medium', 'hard');

CREATE TABLE public.question_bank_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  parent_id uuid REFERENCES public.question_bank_folders(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.question_bank_folders TO authenticated;
GRANT ALL ON public.question_bank_folders TO service_role;
ALTER TABLE public.question_bank_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read bank folders" ON public.question_bank_folders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage bank folders" ON public.question_bank_folders FOR ALL USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TABLE public.bank_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES public.question_bank_folders(id) ON DELETE CASCADE,
  text text NOT NULL,
  question_type public.bank_question_type NOT NULL DEFAULT 'multiple_choice',
  difficulty public.bank_difficulty NOT NULL DEFAULT 'medium',
  time_limit_seconds int,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bank_questions TO authenticated;
GRANT ALL ON public.bank_questions TO service_role;
ALTER TABLE public.bank_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read bank questions" ON public.bank_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage bank questions" ON public.bank_questions FOR ALL USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TABLE public.bank_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.bank_questions(id) ON DELETE CASCADE,
  text text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.bank_answers TO authenticated;
GRANT ALL ON public.bank_answers TO service_role;
ALTER TABLE public.bank_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read bank answers" ON public.bank_answers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage bank answers" ON public.bank_answers FOR ALL USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TRIGGER trg_bank_folders_updated BEFORE UPDATE ON public.question_bank_folders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bank_questions_updated BEFORE UPDATE ON public.bank_questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_bank_questions_folder ON public.bank_questions(folder_id);
CREATE INDEX idx_bank_questions_difficulty ON public.bank_questions(difficulty);
CREATE INDEX idx_bank_answers_question ON public.bank_answers(question_id);
