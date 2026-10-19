ALTER TABLE public.profiles ADD COLUMN team text;

CREATE TABLE public.gamification_boss_battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  question_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  question_count integer NOT NULL DEFAULT 20,
  duration_seconds integer NOT NULL DEFAULT 300,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gamification_boss_battles TO authenticated;
GRANT ALL ON public.gamification_boss_battles TO service_role;
ALTER TABLE public.gamification_boss_battles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read boss battles" ON public.gamification_boss_battles FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage boss battles" ON public.gamification_boss_battles FOR ALL TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TABLE public.gamification_boss_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id uuid NOT NULL REFERENCES public.gamification_boss_battles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  correct_count integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  duration_seconds integer NOT NULL DEFAULT 0,
  score_percent numeric NOT NULL DEFAULT 0,
  xp_earned integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (battle_id, user_id)
);
GRANT SELECT, INSERT ON public.gamification_boss_attempts TO authenticated;
GRANT ALL ON public.gamification_boss_attempts TO service_role;
ALTER TABLE public.gamification_boss_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read boss attempts" ON public.gamification_boss_attempts FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own boss attempts" ON public.gamification_boss_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);