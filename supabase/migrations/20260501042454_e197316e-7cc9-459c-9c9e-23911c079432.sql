
-- Cascade deletes for course-related content so admins can delete a course in one shot
ALTER TABLE public.course_blocks DROP CONSTRAINT IF EXISTS course_blocks_course_id_fkey;
ALTER TABLE public.course_blocks
  ADD CONSTRAINT course_blocks_course_id_fkey
  FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;

ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_block_id_fkey;
ALTER TABLE public.questions
  ADD CONSTRAINT questions_block_id_fkey
  FOREIGN KEY (block_id) REFERENCES public.course_blocks(id) ON DELETE CASCADE;

ALTER TABLE public.answers DROP CONSTRAINT IF EXISTS answers_question_id_fkey;
ALTER TABLE public.answers
  ADD CONSTRAINT answers_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;

ALTER TABLE public.block_attempts DROP CONSTRAINT IF EXISTS block_attempts_course_id_fkey;
ALTER TABLE public.block_attempts
  ADD CONSTRAINT block_attempts_course_id_fkey
  FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;

ALTER TABLE public.block_attempts DROP CONSTRAINT IF EXISTS block_attempts_block_id_fkey;
ALTER TABLE public.block_attempts
  ADD CONSTRAINT block_attempts_block_id_fkey
  FOREIGN KEY (block_id) REFERENCES public.course_blocks(id) ON DELETE CASCADE;

ALTER TABLE public.attempt_responses DROP CONSTRAINT IF EXISTS attempt_responses_attempt_id_fkey;
ALTER TABLE public.attempt_responses
  ADD CONSTRAINT attempt_responses_attempt_id_fkey
  FOREIGN KEY (attempt_id) REFERENCES public.block_attempts(id) ON DELETE CASCADE;

ALTER TABLE public.lesson_comments DROP CONSTRAINT IF EXISTS lesson_comments_course_id_fkey;
ALTER TABLE public.lesson_comments
  ADD CONSTRAINT lesson_comments_course_id_fkey
  FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;

ALTER TABLE public.lesson_comments DROP CONSTRAINT IF EXISTS lesson_comments_block_id_fkey;
ALTER TABLE public.lesson_comments
  ADD CONSTRAINT lesson_comments_block_id_fkey
  FOREIGN KEY (block_id) REFERENCES public.course_blocks(id) ON DELETE CASCADE;

ALTER TABLE public.course_views DROP CONSTRAINT IF EXISTS course_views_course_id_fkey;
ALTER TABLE public.course_views
  ADD CONSTRAINT course_views_course_id_fkey
  FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;

ALTER TABLE public.user_course_access DROP CONSTRAINT IF EXISTS user_course_access_course_id_fkey;
ALTER TABLE public.user_course_access
  ADD CONSTRAINT user_course_access_course_id_fkey
  FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;

-- Standalone exams
ALTER TABLE public.standalone_exam_questions DROP CONSTRAINT IF EXISTS standalone_exam_questions_exam_id_fkey;
ALTER TABLE public.standalone_exam_questions
  ADD CONSTRAINT standalone_exam_questions_exam_id_fkey
  FOREIGN KEY (exam_id) REFERENCES public.standalone_exams(id) ON DELETE CASCADE;

ALTER TABLE public.standalone_exam_answers DROP CONSTRAINT IF EXISTS standalone_exam_answers_question_id_fkey;
ALTER TABLE public.standalone_exam_answers
  ADD CONSTRAINT standalone_exam_answers_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES public.standalone_exam_questions(id) ON DELETE CASCADE;

ALTER TABLE public.standalone_exam_attempts DROP CONSTRAINT IF EXISTS standalone_exam_attempts_exam_id_fkey;
ALTER TABLE public.standalone_exam_attempts
  ADD CONSTRAINT standalone_exam_attempts_exam_id_fkey
  FOREIGN KEY (exam_id) REFERENCES public.standalone_exams(id) ON DELETE CASCADE;

ALTER TABLE public.standalone_exam_responses DROP CONSTRAINT IF EXISTS standalone_exam_responses_attempt_id_fkey;
ALTER TABLE public.standalone_exam_responses
  ADD CONSTRAINT standalone_exam_responses_attempt_id_fkey
  FOREIGN KEY (attempt_id) REFERENCES public.standalone_exam_attempts(id) ON DELETE CASCADE;

-- Quizzes
ALTER TABLE public.quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_quiz_id_fkey;
ALTER TABLE public.quiz_questions
  ADD CONSTRAINT quiz_questions_quiz_id_fkey
  FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;

ALTER TABLE public.quiz_answers DROP CONSTRAINT IF EXISTS quiz_answers_question_id_fkey;
ALTER TABLE public.quiz_answers
  ADD CONSTRAINT quiz_answers_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES public.quiz_questions(id) ON DELETE CASCADE;

ALTER TABLE public.quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_quiz_id_fkey;
ALTER TABLE public.quiz_attempts
  ADD CONSTRAINT quiz_attempts_quiz_id_fkey
  FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;

ALTER TABLE public.quiz_responses DROP CONSTRAINT IF EXISTS quiz_responses_attempt_id_fkey;
ALTER TABLE public.quiz_responses
  ADD CONSTRAINT quiz_responses_attempt_id_fkey
  FOREIGN KEY (attempt_id) REFERENCES public.quiz_attempts(id) ON DELETE CASCADE;
