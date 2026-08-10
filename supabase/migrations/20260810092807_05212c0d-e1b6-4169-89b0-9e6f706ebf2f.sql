GRANT EXECUTE ON FUNCTION public.is_room_participant(uuid, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_event_invitee(uuid, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_view_course(uuid, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.verify_exam_password(uuid, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_email_by_employee_id(text) TO authenticated, anon, service_role;

CREATE TABLE IF NOT EXISTS public.block_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  block_id uuid NOT NULL REFERENCES public.course_blocks(id) ON DELETE CASCADE,
  completed boolean NOT NULL DEFAULT true,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, block_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.block_progress TO authenticated;
GRANT ALL ON public.block_progress TO service_role;

ALTER TABLE public.block_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own block progress"
  ON public.block_progress FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all block progress"
  ON public.block_progress FOR SELECT TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

CREATE TRIGGER update_block_progress_updated_at
  BEFORE UPDATE ON public.block_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();