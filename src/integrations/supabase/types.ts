export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      answers: {
        Row: {
          id: string
          is_correct: boolean
          position: number
          question_id: string
          text: string
        }
        Insert: {
          id?: string
          is_correct?: boolean
          position?: number
          question_id: string
          text: string
        }
        Update: {
          id?: string
          is_correct?: boolean
          position?: number
          question_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      attempt_responses: {
        Row: {
          answer_id: string | null
          attempt_id: string
          created_at: string
          id: string
          is_correct: boolean
          question_id: string
          time_spent_seconds: number
        }
        Insert: {
          answer_id?: string | null
          attempt_id: string
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id: string
          time_spent_seconds?: number
        }
        Update: {
          answer_id?: string | null
          attempt_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          time_spent_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "attempt_responses_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_responses_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "block_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_lesson_participants: {
        Row: {
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          lesson_id: string
          patronymic: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          lesson_id: string
          patronymic?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          lesson_id?: string
          patronymic?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_lesson_participants_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "attendance_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_lessons: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string
          exam_dates: string[]
          id: string
          start_date: string
          teacher_first_name: string | null
          teacher_last_name: string | null
          teacher_patronymic: string | null
          teacher_user_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date: string
          exam_dates?: string[]
          id?: string
          start_date: string
          teacher_first_name?: string | null
          teacher_last_name?: string | null
          teacher_patronymic?: string | null
          teacher_user_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string
          exam_dates?: string[]
          id?: string
          start_date?: string
          teacher_first_name?: string | null
          teacher_last_name?: string | null
          teacher_patronymic?: string | null
          teacher_user_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          attendance_date: string
          created_at: string
          id: string
          lesson_id: string
          participant_id: string
          present: boolean
          updated_at: string
        }
        Insert: {
          attendance_date: string
          created_at?: string
          id?: string
          lesson_id: string
          participant_id: string
          present?: boolean
          updated_at?: string
        }
        Update: {
          attendance_date?: string
          created_at?: string
          id?: string
          lesson_id?: string
          participant_id?: string
          present?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "attendance_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "attendance_lesson_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_answers: {
        Row: {
          id: string
          is_correct: boolean
          position: number
          question_id: string
          text: string
        }
        Insert: {
          id?: string
          is_correct?: boolean
          position?: number
          question_id: string
          text: string
        }
        Update: {
          id?: string
          is_correct?: boolean
          position?: number
          question_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "bank_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_questions: {
        Row: {
          created_at: string
          created_by: string | null
          difficulty: Database["public"]["Enums"]["bank_difficulty"]
          folder_id: string
          id: string
          question_type: Database["public"]["Enums"]["bank_question_type"]
          text: string
          time_limit_seconds: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          difficulty?: Database["public"]["Enums"]["bank_difficulty"]
          folder_id: string
          id?: string
          question_type?: Database["public"]["Enums"]["bank_question_type"]
          text: string
          time_limit_seconds?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          difficulty?: Database["public"]["Enums"]["bank_difficulty"]
          folder_id?: string
          id?: string
          question_type?: Database["public"]["Enums"]["bank_question_type"]
          text?: string
          time_limit_seconds?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_questions_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "question_bank_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      block_attempts: {
        Row: {
          block_id: string
          correct_count: number
          course_id: string
          created_at: string
          duration_seconds: number
          id: string
          passed: boolean
          score_percent: number
          total_questions: number
          user_id: string
        }
        Insert: {
          block_id: string
          correct_count?: number
          course_id: string
          created_at?: string
          duration_seconds?: number
          id?: string
          passed?: boolean
          score_percent?: number
          total_questions?: number
          user_id: string
        }
        Update: {
          block_id?: string
          correct_count?: number
          course_id?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          passed?: boolean
          score_percent?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "block_attempts_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "course_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_attempts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_templates: {
        Row: {
          created_at: string
          file_type: string
          file_url: string
          id: string
          is_active: boolean
          name: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_type: string
          file_url: string
          id?: string
          is_active?: boolean
          name: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_type?: string
          file_url?: string
          id?: string
          is_active?: boolean
          name?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      certificates: {
        Row: {
          course_id: string
          course_title: string
          full_name: string
          id: string
          issued_at: string
          score_percent: number
          serial: string
          user_id: string
        }
        Insert: {
          course_id: string
          course_title: string
          full_name: string
          id?: string
          issued_at?: string
          score_percent?: number
          serial?: string
          user_id: string
        }
        Update: {
          course_id?: string
          course_title?: string
          full_name?: string
          id?: string
          issued_at?: string
          score_percent?: number
          serial?: string
          user_id?: string
        }
        Relationships: []
      }
      course_blocks: {
        Row: {
          block_type: Database["public"]["Enums"]["block_type"]
          course_id: string
          created_at: string
          description: string | null
          docx_url: string | null
          external_video_url: string | null
          id: string
          passing_score: number | null
          pdf_url: string | null
          position: number
          pptx_url: string | null
          shuffle_questions: boolean
          time_limit_seconds: number | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          block_type: Database["public"]["Enums"]["block_type"]
          course_id: string
          created_at?: string
          description?: string | null
          docx_url?: string | null
          external_video_url?: string | null
          id?: string
          passing_score?: number | null
          pdf_url?: string | null
          position?: number
          pptx_url?: string | null
          shuffle_questions?: boolean
          time_limit_seconds?: number | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          block_type?: Database["public"]["Enums"]["block_type"]
          course_id?: string
          created_at?: string
          description?: string | null
          docx_url?: string | null
          external_video_url?: string | null
          id?: string
          passing_score?: number | null
          pdf_url?: string | null
          position?: number
          pptx_url?: string | null
          shuffle_questions?: boolean
          time_limit_seconds?: number | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_blocks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_views: {
        Row: {
          course_id: string
          id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          course_id: string
          id?: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          course_id?: string
          id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_views_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          certificate_template_url: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          folder_id: string | null
          id: string
          is_published: boolean
          passing_score: number
          title: string
          updated_at: string
        }
        Insert: {
          certificate_template_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          folder_id?: string | null
          id?: string
          is_published?: boolean
          passing_score?: number
          title: string
          updated_at?: string
        }
        Update: {
          certificate_template_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          folder_id?: string | null
          id?: string
          is_published?: boolean
          passing_score?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_event_invitees: {
        Row: {
          created_at: string
          event_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_event_invitees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "exam_events"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          exam_id: string
          id: string
          location: string | null
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at: string
          exam_id: string
          id?: string
          location?: string | null
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string
          exam_id?: string
          id?: string
          location?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_events_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "standalone_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_comments: {
        Row: {
          author_id: string
          block_id: string
          body: string
          course_id: string
          created_at: string
          id: string
          parent_id: string | null
          user_id: string
        }
        Insert: {
          author_id: string
          block_id: string
          body: string
          course_id: string
          created_at?: string
          id?: string
          parent_id?: string | null
          user_id: string
        }
        Update: {
          author_id?: string
          block_id?: string
          body?: string
          course_id?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_comments_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "course_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_comments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "lesson_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      library_books: {
        Row: {
          author: string | null
          category: string | null
          category_id: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          file_name: string | null
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          author?: string | null
          category?: string | null
          category_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          author?: string | null
          category?: string | null
          category_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_books_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "library_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      library_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          employee_id: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          employee_id: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          employee_id?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      question_bank_folders: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "question_bank_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          block_id: string
          created_at: string
          id: string
          position: number
          text: string
          time_limit_seconds: number | null
        }
        Insert: {
          block_id: string
          created_at?: string
          id?: string
          position?: number
          text: string
          time_limit_seconds?: number | null
        }
        Update: {
          block_id?: string
          created_at?: string
          id?: string
          position?: number
          text?: string
          time_limit_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "course_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_answers: {
        Row: {
          id: string
          is_correct: boolean
          position: number
          question_id: string
          text: string
        }
        Insert: {
          id?: string
          is_correct?: boolean
          position?: number
          question_id: string
          text: string
        }
        Update: {
          id?: string
          is_correct?: boolean
          position?: number
          question_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          correct_count: number
          created_at: string
          duration_seconds: number
          id: string
          passed: boolean
          quiz_id: string
          score_percent: number
          total_questions: number
          user_id: string
        }
        Insert: {
          correct_count?: number
          created_at?: string
          duration_seconds?: number
          id?: string
          passed?: boolean
          quiz_id: string
          score_percent?: number
          total_questions?: number
          user_id: string
        }
        Update: {
          correct_count?: number
          created_at?: string
          duration_seconds?: number
          id?: string
          passed?: boolean
          quiz_id?: string
          score_percent?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          created_at: string
          id: string
          is_multiple: boolean
          position: number
          quiz_id: string
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_multiple?: boolean
          position?: number
          quiz_id: string
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          is_multiple?: boolean
          position?: number
          quiz_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_responses: {
        Row: {
          answer_id: string | null
          attempt_id: string
          created_at: string
          id: string
          is_correct: boolean
          question_id: string
        }
        Insert: {
          answer_id?: string | null
          attempt_id: string
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id: string
        }
        Update: {
          answer_id?: string | null
          attempt_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_responses_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_rooms: {
        Row: {
          code: string
          created_at: string
          current_question_index: number
          current_question_started_at: string | null
          finished_at: string | null
          host_id: string
          id: string
          question_time_seconds: number
          quiz_id: string
          status: Database["public"]["Enums"]["quiz_room_status"]
        }
        Insert: {
          code: string
          created_at?: string
          current_question_index?: number
          current_question_started_at?: string | null
          finished_at?: string | null
          host_id: string
          id?: string
          question_time_seconds?: number
          quiz_id: string
          status?: Database["public"]["Enums"]["quiz_room_status"]
        }
        Update: {
          code?: string
          created_at?: string
          current_question_index?: number
          current_question_started_at?: string | null
          finished_at?: string | null
          host_id?: string
          id?: string
          question_time_seconds?: number
          quiz_id?: string
          status?: Database["public"]["Enums"]["quiz_room_status"]
        }
        Relationships: [
          {
            foreignKeyName: "quiz_rooms_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_published: boolean
          passing_score: number
          time_limit_seconds: number | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          passing_score?: number
          time_limit_seconds?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          passing_score?: number
          time_limit_seconds?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      room_answers: {
        Row: {
          answer_id: string | null
          created_at: string
          id: string
          is_correct: boolean
          participant_id: string
          question_id: string
          response_ms: number
          room_id: string
          score_awarded: number
          user_id: string
        }
        Insert: {
          answer_id?: string | null
          created_at?: string
          id?: string
          is_correct?: boolean
          participant_id: string
          question_id: string
          response_ms?: number
          room_id: string
          score_awarded?: number
          user_id: string
        }
        Update: {
          answer_id?: string | null
          created_at?: string
          id?: string
          is_correct?: boolean
          participant_id?: string
          question_id?: string
          response_ms?: number
          room_id?: string
          score_awarded?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_answers_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "room_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_answers_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "quiz_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_participants: {
        Row: {
          finished: boolean
          full_name: string
          id: string
          joined_at: string
          room_id: string
          score: number
          user_id: string
        }
        Insert: {
          finished?: boolean
          full_name: string
          id?: string
          joined_at?: string
          room_id: string
          score?: number
          user_id: string
        }
        Update: {
          finished?: boolean
          full_name?: string
          id?: string
          joined_at?: string
          room_id?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "quiz_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      standalone_exam_answers: {
        Row: {
          id: string
          is_correct: boolean
          position: number
          question_id: string
          text: string
        }
        Insert: {
          id?: string
          is_correct?: boolean
          position?: number
          question_id: string
          text: string
        }
        Update: {
          id?: string
          is_correct?: boolean
          position?: number
          question_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "standalone_exam_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "standalone_exam_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      standalone_exam_attempts: {
        Row: {
          correct_count: number
          created_at: string
          duration_seconds: number
          exam_id: string
          id: string
          passed: boolean
          score_percent: number
          total_questions: number
          user_id: string
        }
        Insert: {
          correct_count?: number
          created_at?: string
          duration_seconds?: number
          exam_id: string
          id?: string
          passed?: boolean
          score_percent?: number
          total_questions?: number
          user_id: string
        }
        Update: {
          correct_count?: number
          created_at?: string
          duration_seconds?: number
          exam_id?: string
          id?: string
          passed?: boolean
          score_percent?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "standalone_exam_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "standalone_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      standalone_exam_questions: {
        Row: {
          created_at: string
          exam_id: string
          id: string
          position: number
          text: string
          time_limit_seconds: number | null
        }
        Insert: {
          created_at?: string
          exam_id: string
          id?: string
          position?: number
          text: string
          time_limit_seconds?: number | null
        }
        Update: {
          created_at?: string
          exam_id?: string
          id?: string
          position?: number
          text?: string
          time_limit_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "standalone_exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "standalone_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      standalone_exam_responses: {
        Row: {
          answer_id: string | null
          attempt_id: string
          created_at: string
          id: string
          is_correct: boolean
          question_id: string
          time_spent_seconds: number
        }
        Insert: {
          answer_id?: string | null
          attempt_id: string
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id: string
          time_spent_seconds?: number
        }
        Update: {
          answer_id?: string | null
          attempt_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          time_spent_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "standalone_exam_responses_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "standalone_exam_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      standalone_exams: {
        Row: {
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_published: boolean
          passing_score: number
          password: string
          shuffle_questions: boolean
          time_limit_seconds: number | null
          title: string
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          passing_score?: number
          password: string
          shuffle_questions?: boolean
          time_limit_seconds?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          passing_score?: number
          password?: string
          shuffle_questions?: boolean
          time_limit_seconds?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_course_access: {
        Row: {
          course_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_course_access_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_folder_access: {
        Row: {
          created_at: string
          folder_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          folder_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          folder_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_email_by_employee_id: {
        Args: { _employee_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_super: { Args: { _user_id: string }; Returns: boolean }
      is_event_invitee: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      is_room_participant: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_view_course: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      verify_exam_password: {
        Args: { _exam_id: string; _password: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "user"
      bank_difficulty: "easy" | "medium" | "hard"
      bank_question_type: "multiple_choice" | "open_ended" | "practice"
      block_type: "lesson" | "practice" | "quiz" | "final_exam"
      quiz_room_status: "lobby" | "active" | "finished"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "admin", "user"],
      bank_difficulty: ["easy", "medium", "hard"],
      bank_question_type: ["multiple_choice", "open_ended", "practice"],
      block_type: ["lesson", "practice", "quiz", "final_exam"],
      quiz_room_status: ["lobby", "active", "finished"],
    },
  },
} as const
