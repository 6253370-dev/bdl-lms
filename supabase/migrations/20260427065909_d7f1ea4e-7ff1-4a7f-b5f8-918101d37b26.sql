
-- ============ user_course_access ============
CREATE TABLE public.user_course_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);
CREATE INDEX idx_uca_user ON public.user_course_access(user_id);
CREATE INDEX idx_uca_course ON public.user_course_access(course_id);
ALTER TABLE public.user_course_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage course access"
  ON public.user_course_access FOR ALL
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Users view own course access"
  ON public.user_course_access FOR SELECT
  USING (auth.uid() = user_id);

-- ============ user_folder_access ============
CREATE TABLE public.user_folder_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  folder_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, folder_id)
);
CREATE INDEX idx_ufa_user ON public.user_folder_access(user_id);
CREATE INDEX idx_ufa_folder ON public.user_folder_access(folder_id);
ALTER TABLE public.user_folder_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage folder access"
  ON public.user_folder_access FOR ALL
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Users view own folder access"
  ON public.user_folder_access FOR SELECT
  USING (auth.uid() = user_id);

-- ============ course_views (recent viewed) ============
CREATE TABLE public.course_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);
CREATE INDEX idx_cv_user_time ON public.course_views(user_id, viewed_at DESC);
ALTER TABLE public.course_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own views"
  ON public.course_views FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all views"
  ON public.course_views FOR SELECT
  USING (public.is_admin_or_super(auth.uid()));

-- ============ Helper function ============
CREATE OR REPLACE FUNCTION public.user_can_view_course(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_admin_or_super(_user_id)
    OR (
      -- if no per-user rules exist for this user, default to allow
      NOT EXISTS (SELECT 1 FROM public.user_course_access WHERE user_id = _user_id)
      AND NOT EXISTS (SELECT 1 FROM public.user_folder_access WHERE user_id = _user_id)
    )
    OR EXISTS (SELECT 1 FROM public.user_course_access WHERE user_id = _user_id AND course_id = _course_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_folder_access ufa
      JOIN public.courses c ON c.folder_id = ufa.folder_id
      WHERE ufa.user_id = _user_id AND c.id = _course_id
    )
$$;
