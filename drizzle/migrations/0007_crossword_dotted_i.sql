CREATE OR REPLACE FUNCTION public.crossword_norm(t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT upper(translate(coalesce(t,''), 'İıi', 'III'))
$$;

CREATE OR REPLACE FUNCTION public.check_crossword(_id uuid, _answers jsonb, _duration integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cw record; total int; ok int := 0; i int; res jsonb := '[]'::jsonb; good boolean;
  prev_xp int; new_xp int; award int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO cw FROM public.crosswords WHERE id = _id AND is_published;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  total := jsonb_array_length(cw.answers);
  FOR i IN 0..total-1 LOOP
    good := public.crossword_norm(_answers->>i) = public.crossword_norm(cw.answers->>i);
    IF good THEN ok := ok + 1; END IF;
    res := res || to_jsonb(good);
  END LOOP;
  new_xp := ok * 25 + CASE WHEN total > 0 AND ok = total THEN 50 ELSE 0 END;
  SELECT coalesce(sum(xp_earned),0) INTO prev_xp FROM public.crossword_completions WHERE crossword_id = _id AND user_id = auth.uid();
  award := greatest(new_xp - prev_xp, 0);
  INSERT INTO public.crossword_completions(crossword_id, user_id, correct_count, total_words, score_percent, duration_seconds, xp_earned)
  VALUES (_id, auth.uid(), ok, total, CASE WHEN total = 0 THEN 0 ELSE round(ok*100.0/total, 1) END, greatest(coalesce(_duration,0),0), award);
  IF award > 0 THEN
    INSERT INTO public.gamification_xp_events(user_id, event_type, xp, ref_id) VALUES (auth.uid(), 'crossword', award, _id);
  END IF;
  RETURN jsonb_build_object('correct', ok, 'total', total, 'results', res, 'xp', award);
END $$;
GRANT EXECUTE ON FUNCTION public.check_crossword(uuid, jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crossword_norm(text) TO authenticated;