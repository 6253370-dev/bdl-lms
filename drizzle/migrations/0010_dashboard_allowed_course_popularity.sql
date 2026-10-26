CREATE OR REPLACE FUNCTION public.dashboard_allowed_courses()
RETURNS TABLE(id uuid, title text, cover_image_url text, teacher text, viewers bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.title, c.cover_image_url,
    coalesce(nullif(btrim(c.instructor_name), ''), p.full_name, '') AS teacher,
    (SELECT count(DISTINCT v.user_id) FROM public.course_views v WHERE v.course_id = c.id) AS viewers
  FROM public.courses c
  LEFT JOIN public.profiles p ON p.id = c.created_by
  WHERE auth.uid() IS NOT NULL
    AND c.is_published
    AND public.user_can_view_course(auth.uid(), c.id)
  ORDER BY viewers DESC, c.title, c.id;
$$;
REVOKE ALL ON FUNCTION public.dashboard_allowed_courses() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_allowed_courses() TO authenticated, service_role;
COMMENT ON FUNCTION public.dashboard_allowed_courses() IS 'Published courses visible to the caller, ranked by unique viewers. Returns aggregate counts only, never individual viewing records.';