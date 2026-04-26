-- Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id) WHERE is_read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id OR is_admin_or_super(auth.uid()));

CREATE POLICY "Users update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins manage notifications"
ON public.notifications FOR ALL
USING (is_admin_or_super(auth.uid()))
WITH CHECK (is_admin_or_super(auth.uid()));

CREATE POLICY "System inserts notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Trigger: notify user when admin replies in their lesson comment thread
CREATE OR REPLACE FUNCTION public.notify_on_admin_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_title TEXT;
  v_block_title TEXT;
BEGIN
  -- Only notify if the author is admin and the thread owner is a different user
  IF NEW.author_id <> NEW.user_id AND public.is_admin_or_super(NEW.author_id) THEN
    SELECT c.title, b.title INTO v_course_title, v_block_title
    FROM public.courses c
    LEFT JOIN public.course_blocks b ON b.id = NEW.block_id
    WHERE c.id = NEW.course_id;

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      NEW.user_id,
      'comment_reply',
      'Admin şərhinizə cavab verdi',
      COALESCE(v_course_title, '') || COALESCE(' · ' || v_block_title, ''),
      '/courses/' || NEW.course_id::text || '/play'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_admin_reply
AFTER INSERT ON public.lesson_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_admin_reply();

-- Trigger: notify user when a certificate is issued
CREATE OR REPLACE FUNCTION public.notify_on_certificate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    NEW.user_id,
    'certificate_issued',
    'Yeni sertifikat qazandın 🎉',
    NEW.course_title,
    '/certificates'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_certificate
AFTER INSERT ON public.certificates
FOR EACH ROW EXECUTE FUNCTION public.notify_on_certificate();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;