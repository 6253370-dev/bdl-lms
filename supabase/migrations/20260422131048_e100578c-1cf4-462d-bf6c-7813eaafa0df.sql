
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_employee_id ON public.profiles(employee_id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_super(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin', 'super_admin'))
$$;

CREATE OR REPLACE FUNCTION public.get_email_by_employee_id(_employee_id TEXT)
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.email FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE p.employee_id = _employee_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins update profiles" ON public.profiles FOR UPDATE
  USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Super admin inserts profiles" ON public.profiles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins delete profiles" ON public.profiles FOR DELETE
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TABLE public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  passing_score INT NOT NULL DEFAULT 60,
  is_published BOOLEAN NOT NULL DEFAULT false,
  certificate_template_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_courses_updated_at BEFORE UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TYPE public.block_type AS ENUM ('lesson', 'practice', 'quiz', 'final_exam');

CREATE TABLE public.course_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  block_type public.block_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  position INT NOT NULL DEFAULT 0,
  video_url TEXT,
  external_video_url TEXT,
  pdf_url TEXT,
  pptx_url TEXT,
  docx_url TEXT,
  time_limit_seconds INT,
  passing_score INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_course_blocks_course ON public.course_blocks(course_id, position);
CREATE TRIGGER trg_course_blocks_updated_at BEFORE UPDATE ON public.course_blocks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID NOT NULL REFERENCES public.course_blocks(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  time_limit_seconds INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_questions_block ON public.questions(block_id, position);

CREATE TABLE public.answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  position INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_answers_question ON public.answers(question_id, position);

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read folders" ON public.folders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage folders" ON public.folders FOR ALL
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Auth read courses" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage courses" ON public.courses FOR ALL
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Auth read blocks" ON public.course_blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage blocks" ON public.course_blocks FOR ALL
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Auth read questions" ON public.questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage questions" ON public.questions FOR ALL
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Auth read answers" ON public.answers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage answers" ON public.answers FOR ALL
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

INSERT INTO storage.buckets (id, name, public)
VALUES ('course-media', 'course-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read course media" ON storage.objects FOR SELECT
  USING (bucket_id = 'course-media');
CREATE POLICY "Admins upload course media" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'course-media' AND public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins update course media" ON storage.objects FOR UPDATE
  USING (bucket_id = 'course-media' AND public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins delete course media" ON storage.objects FOR DELETE
  USING (bucket_id = 'course-media' AND public.is_admin_or_super(auth.uid()));
