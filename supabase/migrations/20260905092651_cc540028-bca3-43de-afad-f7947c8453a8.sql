-- ENUMS
CREATE TYPE public.live_room_status AS ENUM ('scheduled','live','ended','cancelled');
CREATE TYPE public.live_audience AS ENUM ('all','course','selected');
CREATE TYPE public.live_participant_status AS ENUM ('joined','left');
CREATE TYPE public.live_hand_status AS ENUM ('pending','approved','rejected','resolved');

-- ROOMS
CREATE TABLE public.live_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  teacher_id uuid NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  scheduled_date date NOT NULL,
  scheduled_start_time time NOT NULL,
  planned_duration integer NOT NULL DEFAULT 60,
  room_code text NOT NULL UNIQUE,
  status public.live_room_status NOT NULL DEFAULT 'scheduled',
  audience public.live_audience NOT NULL DEFAULT 'all',
  audience_course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_rooms TO authenticated;
GRANT ALL ON public.live_rooms TO service_role;
ALTER TABLE public.live_rooms ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.live_room_invitees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_room_invitees TO authenticated;
GRANT ALL ON public.live_room_invitees TO service_role;
ALTER TABLE public.live_room_invitees ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.live_room_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  total_duration integer NOT NULL DEFAULT 0,
  status public.live_participant_status NOT NULL DEFAULT 'joined',
  mic_enabled boolean NOT NULL DEFAULT false,
  cam_enabled boolean NOT NULL DEFAULT false,
  force_muted boolean NOT NULL DEFAULT false,
  can_speak boolean NOT NULL DEFAULT false,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_room_participants TO authenticated;
GRANT ALL ON public.live_room_participants TO service_role;
ALTER TABLE public.live_room_participants ENABLE ROW LEVEL SECURITY;
CREATE INDEX live_room_participants_room_idx ON public.live_room_participants(room_id);

CREATE TABLE public.live_room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  full_name text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_room_messages TO authenticated;
GRANT ALL ON public.live_room_messages TO service_role;
ALTER TABLE public.live_room_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX live_room_messages_room_idx ON public.live_room_messages(room_id, created_at);

CREATE TABLE public.live_room_hand_raises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  full_name text,
  raised_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  status public.live_hand_status NOT NULL DEFAULT 'pending'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_room_hand_raises TO authenticated;
GRANT ALL ON public.live_room_hand_raises TO service_role;
ALTER TABLE public.live_room_hand_raises ENABLE ROW LEVEL SECURITY;
CREATE INDEX live_room_hand_raises_room_idx ON public.live_room_hand_raises(room_id);

CREATE TABLE public.live_room_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  user_id uuid,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.live_room_events TO authenticated;
GRANT ALL ON public.live_room_events TO service_role;
ALTER TABLE public.live_room_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX live_room_events_room_idx ON public.live_room_events(room_id, created_at);

-- ACCESS HELPERS
CREATE OR REPLACE FUNCTION public.is_live_room_host(_room_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_or_super(_user_id)
     OR EXISTS (SELECT 1 FROM public.live_rooms r WHERE r.id = _room_id AND r.teacher_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.can_access_live_room(_room_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.live_rooms r
    WHERE r.id = _room_id
      AND (
        public.is_admin_or_super(_user_id)
        OR r.teacher_id = _user_id
        OR r.audience = 'all'
        OR (r.audience = 'course' AND r.audience_course_id IS NOT NULL
            AND public.user_can_view_course(_user_id, r.audience_course_id))
        OR (r.audience = 'selected' AND EXISTS (
              SELECT 1 FROM public.live_room_invitees i
              WHERE i.room_id = r.id AND i.user_id = _user_id))
      )
  )
$$;

-- POLICIES: rooms
CREATE POLICY "live_rooms_select" ON public.live_rooms FOR SELECT TO authenticated
  USING (public.can_access_live_room(id, auth.uid()));
CREATE POLICY "live_rooms_insert" ON public.live_rooms FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "live_rooms_update" ON public.live_rooms FOR UPDATE TO authenticated
  USING (public.is_live_room_host(id, auth.uid()))
  WITH CHECK (public.is_live_room_host(id, auth.uid()));
CREATE POLICY "live_rooms_delete" ON public.live_rooms FOR DELETE TO authenticated
  USING (public.is_live_room_host(id, auth.uid()));

-- POLICIES: invitees
CREATE POLICY "live_invitees_select" ON public.live_room_invitees FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_live_room_host(room_id, auth.uid()));
CREATE POLICY "live_invitees_manage" ON public.live_room_invitees FOR ALL TO authenticated
  USING (public.is_live_room_host(room_id, auth.uid()))
  WITH CHECK (public.is_live_room_host(room_id, auth.uid()));

-- POLICIES: participants
CREATE POLICY "live_participants_select" ON public.live_room_participants FOR SELECT TO authenticated
  USING (public.can_access_live_room(room_id, auth.uid()));
CREATE POLICY "live_participants_insert" ON public.live_room_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_access_live_room(room_id, auth.uid()));
CREATE POLICY "live_participants_update" ON public.live_room_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_live_room_host(room_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_live_room_host(room_id, auth.uid()));
CREATE POLICY "live_participants_delete" ON public.live_room_participants FOR DELETE TO authenticated
  USING (public.is_live_room_host(room_id, auth.uid()));

-- POLICIES: messages
CREATE POLICY "live_messages_select" ON public.live_room_messages FOR SELECT TO authenticated
  USING (public.can_access_live_room(room_id, auth.uid()));
CREATE POLICY "live_messages_insert" ON public.live_room_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_access_live_room(room_id, auth.uid()));
CREATE POLICY "live_messages_update" ON public.live_room_messages FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_live_room_host(room_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_live_room_host(room_id, auth.uid()));
CREATE POLICY "live_messages_delete" ON public.live_room_messages FOR DELETE TO authenticated
  USING (public.is_live_room_host(room_id, auth.uid()));

-- POLICIES: hand raises
CREATE POLICY "live_hands_select" ON public.live_room_hand_raises FOR SELECT TO authenticated
  USING (public.can_access_live_room(room_id, auth.uid()));
CREATE POLICY "live_hands_insert" ON public.live_room_hand_raises FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_access_live_room(room_id, auth.uid()));
CREATE POLICY "live_hands_update" ON public.live_room_hand_raises FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_live_room_host(room_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_live_room_host(room_id, auth.uid()));
CREATE POLICY "live_hands_delete" ON public.live_room_hand_raises FOR DELETE TO authenticated
  USING (public.is_live_room_host(room_id, auth.uid()));

-- POLICIES: events
CREATE POLICY "live_events_select" ON public.live_room_events FOR SELECT TO authenticated
  USING (public.is_live_room_host(room_id, auth.uid()));
CREATE POLICY "live_events_insert" ON public.live_room_events FOR INSERT TO authenticated
  WITH CHECK (public.can_access_live_room(room_id, auth.uid()));

-- TRIGGERS
CREATE TRIGGER trg_live_rooms_updated BEFORE UPDATE ON public.live_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_live_participants_updated BEFORE UPDATE ON public.live_room_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ROOM CODE GENERATOR
CREATE OR REPLACE FUNCTION public.generate_live_room_code()
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text;
  i integer := 0;
BEGIN
  LOOP
    v_code := 'LIVE-' || lpad((floor(random() * 10000))::int::text, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.live_rooms WHERE room_code = v_code);
    i := i + 1;
    IF i > 50 THEN
      v_code := 'LIVE-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
      EXIT;
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;
GRANT EXECUTE ON FUNCTION public.generate_live_room_code() TO authenticated;

-- LOOKUP BY CODE (bypasses select policy only to report status; access still enforced)
CREATE OR REPLACE FUNCTION public.find_live_room_by_code(_code text)
RETURNS TABLE (id uuid, title text, status public.live_room_status, allowed boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.title, r.status, public.can_access_live_room(r.id, auth.uid())
  FROM public.live_rooms r
  WHERE upper(r.room_code) = upper(_code)
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.find_live_room_by_code(text) TO authenticated;

-- REALTIME
ALTER TABLE public.live_rooms REPLICA IDENTITY FULL;
ALTER TABLE public.live_room_participants REPLICA IDENTITY FULL;
ALTER TABLE public.live_room_messages REPLICA IDENTITY FULL;
ALTER TABLE public.live_room_hand_raises REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_room_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_room_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_room_hand_raises;