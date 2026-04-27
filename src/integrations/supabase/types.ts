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
        Relationships: []
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
            foreignKeyName: "lesson_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "lesson_comments"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_published: boolean
          passing_score: number
          password: string
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
          password: string
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
          password?: string
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
        Relationships: []
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
      block_type: "lesson" | "practice" | "quiz" | "final_exam"
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
      block_type: ["lesson", "practice", "quiz", "final_exam"],
    },
  },
} as const
