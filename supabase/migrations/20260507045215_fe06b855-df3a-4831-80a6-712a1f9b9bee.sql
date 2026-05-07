-- Calendar Events
CREATE TABLE public.exam_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.exam_event_invitees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.exam_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'invited',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX idx_exam_events_starts_at ON public.exam_events(starts_at);
CREATE INDEX idx_exam_event_invitees_user ON public.exam_event_invitees(user_id);
CREATE INDEX idx_exam_event_invitees_event ON public.exam_event_invitees(event_id);

ALTER TABLE public.exam_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_event_invitees ENABLE ROW LEVEL SECURITY;

-- Helper for invitee visibility
CREATE OR REPLACE FUNCTION public.is_event_invitee(_event_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.exam_event_invitees WHERE event_id = _event_id AND user_id = _user_id)
$$;

-- exam_events policies
CREATE POLICY "Admins manage events" ON public.exam_events
  FOR ALL USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()));

CREATE POLICY "Invitees view events" ON public.exam_events
  FOR SELECT USING (is_admin_or_super(auth.uid()) OR is_event_invitee(id, auth.uid()));

-- invitees policies
CREATE POLICY "Admins manage invitees" ON public.exam_event_invitees
  FOR ALL USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()));

CREATE POLICY "Users view own invitations" ON public.exam_event_invitees
  FOR SELECT USING (auth.uid() = user_id OR is_admin_or_super(auth.uid()));

-- Update timestamp trigger
CREATE TRIGGER update_exam_events_updated_at
  BEFORE UPDATE ON public.exam_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notification on invite
CREATE OR REPLACE FUNCTION public.notify_on_exam_invite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_title TEXT;
  v_starts TIMESTAMPTZ;
BEGIN
  SELECT title, starts_at INTO v_title, v_starts FROM public.exam_events WHERE id = NEW.event_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    NEW.user_id,
    'exam_invite',
    'Yeni imtahan dəvətnaməsi',
    COALESCE(v_title, '') || ' · ' || to_char(v_starts AT TIME ZONE 'UTC', 'DD.MM.YYYY HH24:MI'),
    '/calendar'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_exam_invite
  AFTER INSERT ON public.exam_event_invitees
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_exam_invite();