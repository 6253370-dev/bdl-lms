CREATE TABLE public.crossword_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crossword_id uuid NOT NULL REFERENCES public.crosswords(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  cell_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  elapsed_seconds integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (crossword_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crossword_progress TO authenticated;
GRANT ALL ON public.crossword_progress TO service_role;
ALTER TABLE public.crossword_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own progress" ON public.crossword_progress FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());