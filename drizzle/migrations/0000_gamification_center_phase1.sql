ALTER TABLE public.bank_questions ADD COLUMN is_gamification_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE public.gamification_duels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL,
  opponent_id uuid NOT NULL,
  question_count integer NOT NULL DEFAULT 10,
  duration_seconds integer NOT NULL DEFAULT 120,
  status text NOT NULL DEFAULT 'pending',
  question_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  winner_id uuid,
  challenger_score integer,
  opponent_score integer,
  challenger_time_ms integer,
  opponent_time_ms integer,
  challenger_finished_at timestamptz,
  opponent_finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gamification_duels TO authenticated;
GRANT ALL ON public.gamification_duels TO service_role;
ALTER TABLE public.gamification_duels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants can view duels" ON public.gamification_duels FOR SELECT TO authenticated USING (auth.uid() = challenger_id OR auth.uid() = opponent_id OR public.is_admin_or_super(auth.uid()));
CREATE POLICY "challenger can create duel" ON public.gamification_duels FOR INSERT TO authenticated WITH CHECK (auth.uid() = challenger_id);
CREATE POLICY "participants can update duel" ON public.gamification_duels FOR UPDATE TO authenticated USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

CREATE TABLE public.gamification_duel_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duel_id uuid NOT NULL REFERENCES public.gamification_duels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  question_id uuid NOT NULL REFERENCES public.bank_questions(id) ON DELETE CASCADE,
  answer_id uuid REFERENCES public.bank_answers(id) ON DELETE SET NULL,
  is_correct boolean NOT NULL DEFAULT false,
  response_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gamification_duel_answers TO authenticated;
GRANT ALL ON public.gamification_duel_answers TO service_role;
ALTER TABLE public.gamification_duel_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants can view duel answers" ON public.gamification_duel_answers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.gamification_duels d WHERE d.id = duel_id AND (d.challenger_id = auth.uid() OR d.opponent_id = auth.uid()))
  OR public.is_admin_or_super(auth.uid())
);
CREATE POLICY "user inserts own duel answers" ON public.gamification_duel_answers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.gamification_xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  xp integer NOT NULL,
  ref_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.gamification_xp_events TO authenticated;
GRANT ALL ON public.gamification_xp_events TO service_role;
ALTER TABLE public.gamification_xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own xp" ON public.gamification_xp_events FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin_or_super(auth.uid()));
CREATE POLICY "users insert own xp" ON public.gamification_xp_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.gamification_xp_config (
  key text PRIMARY KEY,
  xp integer NOT NULL,
  label text
);
GRANT SELECT ON public.gamification_xp_config TO authenticated;
GRANT ALL ON public.gamification_xp_config TO service_role;
ALTER TABLE public.gamification_xp_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated can read xp config" ON public.gamification_xp_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage xp config" ON public.gamification_xp_config FOR ALL TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TABLE public.gamification_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gamification_badges TO authenticated;
GRANT ALL ON public.gamification_badges TO service_role;
ALTER TABLE public.gamification_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read badges" ON public.gamification_badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage badges" ON public.gamification_badges FOR ALL TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TABLE public.gamification_user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.gamification_badges(id) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);
GRANT SELECT, INSERT ON public.gamification_user_badges TO authenticated;
GRANT ALL ON public.gamification_user_badges TO service_role;
ALTER TABLE public.gamification_user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own badges" ON public.gamification_user_badges FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin_or_super(auth.uid()));
CREATE POLICY "users insert own badges" ON public.gamification_user_badges FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.gamification_daily_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_date date NOT NULL UNIQUE,
  question_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  xp_reward integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gamification_daily_challenges TO authenticated;
GRANT ALL ON public.gamification_daily_challenges TO service_role;
ALTER TABLE public.gamification_daily_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read challenges" ON public.gamification_daily_challenges FOR SELECT TO authenticated USING (true);

CREATE TABLE public.gamification_challenge_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.gamification_daily_challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  correct_count integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  xp_earned integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);
GRANT SELECT, INSERT ON public.gamification_challenge_attempts TO authenticated;
GRANT ALL ON public.gamification_challenge_attempts TO service_role;
ALTER TABLE public.gamification_challenge_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own attempts" ON public.gamification_challenge_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin_or_super(auth.uid()));
CREATE POLICY "users insert own attempts" ON public.gamification_challenge_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);