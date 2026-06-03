
DELETE FROM public.exam_events WHERE exam_id NOT IN (SELECT id FROM public.standalone_exams);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exam_events_exam_id_fkey') THEN
    ALTER TABLE public.exam_events
      ADD CONSTRAINT exam_events_exam_id_fkey
      FOREIGN KEY (exam_id) REFERENCES public.standalone_exams(id) ON DELETE CASCADE;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
