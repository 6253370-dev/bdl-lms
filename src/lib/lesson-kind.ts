// Dərsin məzmun növü və müddət göstəricisi (Mərhələ 2, maddə 23, 28).
// Pleyer və kurs redaktoru eyni ikon/yazıdan istifadə edir.
import {
  BookOpen,
  Dumbbell,
  FileQuestion,
  FileText,
  GraduationCap,
  Link2,
  Presentation,
  ScrollText,
  Video,
  type LucideIcon,
} from "lucide-react";

export type LessonKind =
  "video" | "external" | "pdf" | "pptx" | "docx" | "lesson" | "practice" | "quiz" | "final_exam";

export interface LessonLike {
  block_type: string;
  video_url?: string | null;
  external_video_url?: string | null;
  pdf_url?: string | null;
  pptx_url?: string | null;
  docx_url?: string | null;
}

/** Bir dərsdə bir neçə material ola bilər; ilk (əsas) olan növ kimi götürülür. */
export function lessonKind(b: LessonLike): LessonKind {
  if (b.block_type === "practice" || b.block_type === "quiz" || b.block_type === "final_exam") {
    return b.block_type;
  }
  if (b.video_url) return "video";
  if (b.external_video_url) return "external";
  if (b.pdf_url) return "pdf";
  if (b.pptx_url) return "pptx";
  if (b.docx_url) return "docx";
  return "lesson";
}

export const LESSON_KIND: Record<LessonKind, { label: string; icon: LucideIcon }> = {
  video: { label: "Video dərs", icon: Video },
  external: { label: "Xarici video", icon: Link2 },
  pdf: { label: "PDF", icon: FileText },
  pptx: { label: "Təqdimat", icon: Presentation },
  docx: { label: "Sənəd", icon: ScrollText },
  lesson: { label: "Dərs", icon: BookOpen },
  practice: { label: "Məşq", icon: Dumbbell },
  quiz: { label: "Quiz", icon: FileQuestion },
  final_exam: { label: "Son imtahan", icon: GraduationCap },
};

/** Saniyəni "N dəq" kimi göstərir (yuxarı yuvarlaqlaşdırılır). Boş/0 → null. */
export function formatMinutes(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return null;
  return `${Math.max(1, Math.ceil(seconds / 60))} dəq`;
}

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;
