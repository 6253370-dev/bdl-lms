
-- ============== LIBRARY ==============
CREATE TABLE public.library_books (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  description TEXT,
  category TEXT,
  cover_image_url TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT,
  file_name TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_books TO authenticated;
GRANT ALL ON public.library_books TO service_role;

ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view books"
ON public.library_books FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert books"
ON public.library_books FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can update books"
ON public.library_books FOR UPDATE TO authenticated
USING (public.is_admin_or_super(auth.uid()))
WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can delete books"
ON public.library_books FOR DELETE TO authenticated
USING (public.is_admin_or_super(auth.uid()));

CREATE TRIGGER update_library_books_updated_at
BEFORE UPDATE ON public.library_books
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for library-books bucket
CREATE POLICY "Authenticated read library-books"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'library-books');

CREATE POLICY "Admins upload library-books"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'library-books' AND public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins update library-books"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'library-books' AND public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins delete library-books"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'library-books' AND public.is_admin_or_super(auth.uid()));

-- ============== ATTENDANCE ==============
CREATE TABLE public.attendance_lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_lessons TO authenticated;
GRANT ALL ON public.attendance_lessons TO service_role;

ALTER TABLE public.attendance_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view lessons"
ON public.attendance_lessons FOR SELECT TO authenticated
USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Super admin create lessons"
ON public.attendance_lessons FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins update lessons"
ON public.attendance_lessons FOR UPDATE TO authenticated
USING (public.is_admin_or_super(auth.uid()))
WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Super admin delete lessons"
ON public.attendance_lessons FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_attendance_lessons_updated_at
BEFORE UPDATE ON public.attendance_lessons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.attendance_lesson_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL REFERENCES public.attendance_lessons(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name TEXT,
  last_name TEXT,
  patronymic TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.attendance_lesson_participants (lesson_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_lesson_participants TO authenticated;
GRANT ALL ON public.attendance_lesson_participants TO service_role;

ALTER TABLE public.attendance_lesson_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage participants"
ON public.attendance_lesson_participants FOR ALL TO authenticated
USING (public.is_admin_or_super(auth.uid()))
WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL REFERENCES public.attendance_lessons(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.attendance_lesson_participants(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  present BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (participant_id, attendance_date)
);

CREATE INDEX ON public.attendance_records (lesson_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT ALL ON public.attendance_records TO service_role;

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage attendance"
ON public.attendance_records FOR ALL TO authenticated
USING (public.is_admin_or_super(auth.uid()))
WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TRIGGER update_attendance_records_updated_at
BEFORE UPDATE ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
