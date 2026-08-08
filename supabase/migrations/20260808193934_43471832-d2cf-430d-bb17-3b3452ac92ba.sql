-- 1. Quiz music
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS music_url text;

-- 2. Calendar event types
ALTER TABLE public.exam_events
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'exam',
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attendance_lesson_id uuid REFERENCES public.attendance_lessons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.exam_events ALTER COLUMN exam_id DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.exam_events ADD CONSTRAINT exam_events_event_type_check
    CHECK (event_type IN ('exam','online_course','offline_course'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Richer notification for invites
CREATE OR REPLACE FUNCTION public.notify_on_exam_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_title TEXT;
  v_starts TIMESTAMPTZ;
  v_ends TIMESTAMPTZ;
  v_type TEXT;
  v_location TEXT;
  v_notes TEXT;
  v_body TEXT;
BEGIN
  SELECT title, starts_at, ends_at, event_type, location, notes
    INTO v_title, v_starts, v_ends, v_type, v_location, v_notes
  FROM public.exam_events WHERE id = NEW.event_id;

  v_body := COALESCE(v_title, '')
    || ' · ' || to_char(v_starts AT TIME ZONE 'UTC', 'DD.MM.YYYY')
    || ' · ' || to_char(v_starts AT TIME ZONE 'UTC', 'HH24:MI')
    || '-' || to_char(v_ends AT TIME ZONE 'UTC', 'HH24:MI');

  IF v_type = 'offline_course' THEN
    v_body := v_body
      || COALESCE(' · Məkan: ' || v_location, '')
      || COALESCE(' · Qeyd: ' || v_notes, '');
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    NEW.user_id,
    'exam_invite',
    CASE
      WHEN v_type = 'offline_course' THEN 'Offline kursa dəvət'
      WHEN v_type = 'online_course' THEN 'Online kursa dəvət'
      ELSE 'Yeni imtahan dəvətnaməsi'
    END,
    v_body,
    '/calendar'
  );
  RETURN NEW;
END;
$function$;

-- 4. Per-lesson admin-defined minimum view time
ALTER TABLE public.course_blocks ADD COLUMN IF NOT EXISTS min_view_seconds integer;

-- 5. Profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- 6. Certificate template linkage
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS certificate_template_id uuid REFERENCES public.certificate_templates(id) ON DELETE SET NULL;
ALTER TABLE public.standalone_exams ADD COLUMN IF NOT EXISTS certificate_template_id uuid REFERENCES public.certificate_templates(id) ON DELETE SET NULL;
ALTER TABLE public.standalone_exams ADD COLUMN IF NOT EXISTS certificate_template_url text;