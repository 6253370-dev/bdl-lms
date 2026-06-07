
REVOKE EXECUTE ON FUNCTION public.is_admin_or_super(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_can_view_course(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_room_participant(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_event_invitee(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_email_by_employee_id(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_admin_reply() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_certificate() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_exam_invite() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
