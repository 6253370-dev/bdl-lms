
-- Status enum
DO $$ BEGIN
  CREATE TYPE public.quiz_room_status AS ENUM ('lobby','active','finished');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Rooms
CREATE TABLE public.quiz_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  host_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  status public.quiz_room_status NOT NULL DEFAULT 'lobby',
  current_question_index int NOT NULL DEFAULT -1,
  current_question_started_at timestamptz,
  question_time_seconds int NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX idx_quiz_rooms_code ON public.quiz_rooms(code);

ALTER TABLE public.quiz_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage rooms" ON public.quiz_rooms
  FOR ALL USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Auth read rooms" ON public.quiz_rooms
  FOR SELECT TO authenticated USING (true);

-- Participants
CREATE TABLE public.room_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.quiz_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  score int NOT NULL DEFAULT 0,
  finished boolean NOT NULL DEFAULT false,
  UNIQUE (room_id, user_id)
);

CREATE INDEX idx_room_participants_room ON public.room_participants(room_id);

ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;

-- Helper: is the user a participant of the given room?
CREATE OR REPLACE FUNCTION public.is_room_participant(_room_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.room_participants WHERE room_id = _room_id AND user_id = _user_id)
$$;

CREATE POLICY "Users join rooms" ON public.room_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Participants & admins view list" ON public.room_participants
  FOR SELECT USING (
    public.is_admin_or_super(auth.uid())
    OR public.is_room_participant(room_id, auth.uid())
  );

CREATE POLICY "Admins manage participants" ON public.room_participants
  FOR UPDATE USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Server score updates" ON public.room_participants
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Answers
CREATE TABLE public.room_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.quiz_rooms(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.room_participants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  question_id uuid NOT NULL,
  answer_id uuid,
  is_correct boolean NOT NULL DEFAULT false,
  response_ms int NOT NULL DEFAULT 0,
  score_awarded int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, question_id)
);

CREATE INDEX idx_room_answers_room ON public.room_answers(room_id);

ALTER TABLE public.room_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own answers" ON public.room_answers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Participants & admins view answers" ON public.room_answers
  FOR SELECT USING (
    public.is_admin_or_super(auth.uid())
    OR public.is_room_participant(room_id, auth.uid())
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_answers;

ALTER TABLE public.quiz_rooms REPLICA IDENTITY FULL;
ALTER TABLE public.room_participants REPLICA IDENTITY FULL;
ALTER TABLE public.room_answers REPLICA IDENTITY FULL;
