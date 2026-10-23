CREATE TABLE public.crosswords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  is_published boolean NOT NULL DEFAULT false,
  rows integer NOT NULL DEFAULT 0,
  cols integer NOT NULL DEFAULT 0,
  layout jsonb NOT NULL DEFAULT '[]'::jsonb,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crosswords TO authenticated;
GRANT ALL ON public.crosswords TO service_role;
ALTER TABLE public.crosswords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crosswords admin all" ON public.crosswords FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
-- Users read published crosswords but never the answers column
REVOKE SELECT ON public.crosswords FROM authenticated;
GRANT SELECT (id, title, description, is_published, rows, cols, layout, created_by, created_at, updated_at) ON public.crosswords TO authenticated;
CREATE POLICY "crosswords read published" ON public.crosswords FOR SELECT TO authenticated
  USING (is_published OR public.is_admin_or_super(auth.uid()));
CREATE TRIGGER crosswords_updated BEFORE UPDATE ON public.crosswords
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.crossword_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crossword_id uuid NOT NULL REFERENCES public.crosswords(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  correct_count integer NOT NULL,
  total_words integer NOT NULL,
  score_percent numeric NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.crossword_completions TO authenticated;
GRANT ALL ON public.crossword_completions TO service_role;
ALTER TABLE public.crossword_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read" ON public.crossword_completions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_super(auth.uid()));

-- Admin reads answers
CREATE OR REPLACE FUNCTION public.get_crossword_answers(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin_or_super(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN (SELECT answers FROM public.crosswords WHERE id = _id);
END $$;

-- Server-side checking; _answers = jsonb array of strings in layout order
CREATE OR REPLACE FUNCTION public.check_crossword(_id uuid, _answers jsonb, _duration integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cw record; total int; ok int := 0; i int; res jsonb := '[]'::jsonb; good boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO cw FROM public.crosswords WHERE id = _id AND is_published;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  total := jsonb_array_length(cw.answers);
  FOR i IN 0..total-1 LOOP
    good := upper(coalesce(_answers->>i, '')) = upper(cw.answers->>i);
    IF good THEN ok := ok + 1; END IF;
    res := res || to_jsonb(good);
  END LOOP;
  INSERT INTO public.crossword_completions(crossword_id, user_id, correct_count, total_words, score_percent, duration_seconds)
  VALUES (_id, auth.uid(), ok, total, CASE WHEN total = 0 THEN 0 ELSE round(ok*100.0/total, 1) END, greatest(coalesce(_duration,0),0));
  RETURN jsonb_build_object('correct', ok, 'total', total, 'results', res);
END $$;
GRANT EXECUTE ON FUNCTION public.check_crossword(uuid, jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_crossword_answers(uuid) TO authenticated;