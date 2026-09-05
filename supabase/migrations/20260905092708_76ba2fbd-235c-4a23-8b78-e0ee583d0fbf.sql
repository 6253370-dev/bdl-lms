REVOKE EXECUTE ON FUNCTION public.is_live_room_host(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_access_live_room(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.generate_live_room_code() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.find_live_room_by_code(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.generate_live_room_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_live_room_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_live_room(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_live_room_host(uuid, uuid) TO authenticated;