GRANT EXECUTE ON FUNCTION public.is_admin_or_super(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon, service_role;