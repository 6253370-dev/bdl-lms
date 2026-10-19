CREATE POLICY "live_rooms_select_owner" ON public.live_rooms FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR teacher_id = auth.uid() OR public.is_admin_or_super(auth.uid()));