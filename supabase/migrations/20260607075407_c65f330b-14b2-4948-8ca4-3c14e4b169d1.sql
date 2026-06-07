
-- 1) Hide standalone_exams.password from authenticated reads
REVOKE SELECT (password) ON public.standalone_exams FROM authenticated, anon;

-- 2) Remove ability for users to self-update score on room_participants.
--    Keep admin updates; drop the broad self-update policy.
DROP POLICY IF EXISTS "Server score updates" ON public.room_participants;

-- Allow participants to only mark themselves finished (no score column change via this policy is enforceable
-- without column grants; revoke column-level UPDATE on score to authenticated)
REVOKE UPDATE (score) ON public.room_participants FROM authenticated, anon;

-- 3) Lock down SECURITY DEFINER helper functions: only verify_exam_password is called via RPC.
REVOKE EXECUTE ON FUNCTION public.is_admin_or_super(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_can_view_course(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_room_participant(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_event_invitee(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_email_by_employee_id(text) FROM anon, authenticated;
-- verify_exam_password stays callable (used by RPC for exam password gate)

-- 4) Realtime notifications channel authorization: restrict subscribing to own user channel
-- Topic convention: "user:<uuid>" for personal notification channels.
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can subscribe to own realtime topic" ON realtime.messages;
CREATE POLICY "Users can subscribe to own realtime topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = 'user:' || auth.uid()::text
  OR realtime.topic() LIKE 'room:%'
  OR realtime.topic() LIKE 'public:%'
);

DROP POLICY IF EXISTS "Users can broadcast to own realtime topic" ON realtime.messages;
CREATE POLICY "Users can broadcast to own realtime topic"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() = 'user:' || auth.uid()::text
  OR realtime.topic() LIKE 'room:%'
);
