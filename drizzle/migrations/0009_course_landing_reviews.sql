-- Instructor profile fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS headline text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;

-- Course landing page fields
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS short_description text;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS instructor_name text;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'Azərbaycan dili';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS what_you_will_learn jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS requirements jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Course reviews (1-5 stars + comment, one per user per course)
CREATE TABLE public.course_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, user_id)
);

GRANT SELECT ON public.course_reviews TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.course_reviews TO authenticated;
GRANT ALL ON public.course_reviews TO service_role;

ALTER TABLE public.course_reviews ENABLE ROW LEVEL SECURITY;

-- Everyone signed in can read reviews
CREATE POLICY "Authenticated can read course reviews"
ON public.course_reviews FOR SELECT TO authenticated
USING (true);

-- Only users who completed the course (all non-quiz blocks done) can insert their own review
CREATE POLICY "Completers can insert own review"
ON public.course_reviews FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND NOT EXISTS (
    SELECT 1 FROM public.course_blocks cb
    WHERE cb.course_id = course_reviews.course_id
      AND cb.block_type <> 'quiz'
      AND NOT EXISTS (
        SELECT 1 FROM public.block_progress bp
        WHERE bp.block_id = cb.id
          AND bp.user_id = auth.uid()
          AND bp.completed = true
      )
  )
);

-- Users can update/delete only their own review
CREATE POLICY "Users update own review"
ON public.course_reviews FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own review"
ON public.course_reviews FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_course_reviews_course ON public.course_reviews (course_id);
CREATE INDEX idx_course_reviews_user ON public.course_reviews (user_id);