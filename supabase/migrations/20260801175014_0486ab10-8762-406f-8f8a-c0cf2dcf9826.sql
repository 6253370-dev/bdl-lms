CREATE TABLE IF NOT EXISTS public.library_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE UNIQUE INDEX IF NOT EXISTS library_categories_name_unique ON public.library_categories (lower(name));

GRANT SELECT ON public.library_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_categories TO authenticated;
GRANT ALL ON public.library_categories TO service_role;

ALTER TABLE public.library_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view categories"
ON public.library_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert categories"
ON public.library_categories FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can update categories"
ON public.library_categories FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can delete categories"
ON public.library_categories FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_library_categories_updated_at
BEFORE UPDATE ON public.library_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.library_books
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.library_categories(id) ON DELETE SET NULL;

-- Migrate existing free-text categories into the new table
INSERT INTO public.library_categories (name)
SELECT DISTINCT trim(category) FROM public.library_books
WHERE category IS NOT NULL AND trim(category) <> ''
ON CONFLICT DO NOTHING;

UPDATE public.library_books b
SET category_id = c.id
FROM public.library_categories c
WHERE b.category_id IS NULL AND b.category IS NOT NULL AND lower(trim(b.category)) = lower(c.name);

ALTER TABLE public.attendance_lessons
  ADD COLUMN IF NOT EXISTS teacher_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS teacher_last_name text,
  ADD COLUMN IF NOT EXISTS teacher_first_name text,
  ADD COLUMN IF NOT EXISTS teacher_patronymic text,
  ADD COLUMN IF NOT EXISTS exam_dates date[] NOT NULL DEFAULT '{}';