
-- Allow users to see their own participant row (fixes post-insert RLS visibility check
-- and ensures realtime payloads are delivered to the participant themselves).
CREATE POLICY "Users view own participant row"
ON public.room_participants
FOR SELECT
USING (auth.uid() = user_id);
