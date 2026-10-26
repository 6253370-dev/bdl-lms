import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Loader2, Play, Pencil, Check, BookOpen, Dumbbell, FileQuestion,
  GraduationCap, Users, Globe, RefreshCw, Award, Video, ChevronDown, ChevronUp,
  CheckCircle2, Circle,
} from "lucide-react";
import { StarRating } from "@/components/StarRating";
import { CourseReviews } from "@/components/CourseReviews";
import { cn } from "@/lib/utils";
import { recordCourseView } from "@/lib/course-views";

export const Route = createFileRoute("/courses/$courseId/")({
  head: () => ({
    meta: [
      { title: "Kurs — Baku Digital Lab" },
      { name: "description", content: "Kurs haqqında ətraflı məlumat, müəllim, proqram və rəylər." },
      { property: "og:title", content: "Kurs — Baku Digital Lab" },
      { property: "og:description", content: "Kurs haqqında ətraflı məlumat, müəllim, proqram və rəylər." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <CourseLandingPage />
    </ProtectedRoute>
  ),
});

type BlockType = "lesson" | "practice" | "quiz" | "final_exam";

interface Course {
  id: string;
  title: string;
  description: string | null;
  short_description: string | null;
  instructor_name: string | null;
  created_by: string | null;
  language: string;
  what_you_will_learn: string[];
  requirements: string[];
  passing_score: number;
  is_published: boolean;
  cover_image_url: string | null;
  certificate_template_url: string | null;
  updated_at: string;
}

interface Block {
  id: string;
  block_type: BlockType;
  title: string;
  position: number;
  min_view_seconds: number | null;
}

interface InstructorProfile {
  full_name: string;
  headline: string | null;
  bio: string | null;
  avatar_url: string | null;
}

const blockMeta: Record<BlockType, { icon: typeof BookOpen; label: string; tone: string }> = {
  lesson: { icon: BookOpen, label: "Dərs", tone: "bg-primary/10 text-primary" },
  practice: { icon: Dumbbell, label: "Məşq", tone: "bg-accent text-accent-foreground" },
  quiz: { icon: FileQuestion, label: "Quiz", tone: "bg-warning/15 text-warning-foreground" },
  final_exam: { icon: GraduationCap, label: "Son imtahan", tone: "bg-success/15 text-success" },
};

function CourseLandingPage() {
  const { courseId } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [participants, setParticipants] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [instructor, setInstructor] = useState<InstructorProfile | null>(null);
  const [instructorRating, setInstructorRating] = useState<{ avg: number; count: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllLearn, setShowAllLearn] = useState(false);
  const [expandAbout, setExpandAbout] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: c }, { data: b }, { data: revs }, { data: progAll }] = await Promise.all([
      supabase.from("courses").select("*").eq("id", courseId).maybeSingle(),
      supabase.from("course_blocks").select("id,block_type,title,position,min_view_seconds").eq("course_id", courseId).order("position"),
      supabase.from("course_reviews").select("rating").eq("course_id", courseId),
      supabase.from("block_progress").select("user_id").eq("course_id", courseId),
    ]);
    const course = c as Course | null;
    if (course) {
      course.what_you_will_learn = Array.isArray(course.what_you_will_learn) ? course.what_you_will_learn : [];
      course.requirements = Array.isArray(course.requirements) ? course.requirements : [];
    }
    setCourse(course);
    setBlocks((b ?? []) as Block[]);
    const ratings = (revs ?? []) as { rating: number }[];
    setReviewCount(ratings.length);
    setAvgRating(ratings.length ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0);
    setParticipants(new Set(((progAll ?? []) as { user_id: string }[]).map((p) => p.user_id)).size);

    if (user?.id) {
      const { data: mine } = await supabase
        .from("block_progress")
        .select("block_id")
        .eq("course_id", courseId)
        .eq("user_id", user.id)
        .eq("completed", true);
      setCompleted(new Set(((mine ?? []) as { block_id: string }[]).map((r) => r.block_id)));
    }

    const teacherName = course?.instructor_name?.trim() || "";
    const teacherId = course?.created_by ?? null;
    if (teacherName || teacherId) {
      let prof: InstructorProfile | null = null;
      if (teacherName) {
        const { data } = await supabase
          .from("profiles")
          .select("full_name,headline,bio,avatar_url")
          .eq("full_name", teacherName)
          .maybeSingle();
        prof = (data as InstructorProfile) ?? null;
      }
      // Müəllim seçilməyibsə kursu yaradanın profili göstərilir
      if (!prof && teacherId) {
        const { data } = await supabase
          .from("profiles")
          .select("full_name,headline,bio,avatar_url")
          .eq("id", teacherId)
          .maybeSingle();
        prof = (data as InstructorProfile) ?? null;
      }
      if (prof) setInstructor(prof);
      else if (teacherName) setInstructor({ full_name: teacherName, headline: null, bio: null, avatar_url: null });

      // Instructor rating: average across all published courses taught by this instructor
      const taught = teacherName
        ? await supabase.from("courses").select("id").eq("instructor_name", teacherName).eq("is_published", true)
        : await supabase.from("courses").select("id").eq("created_by", teacherId as string).eq("is_published", true);
      const ids = ((taught.data ?? []) as { id: string }[]).map((x) => x.id);
      if (ids.length) {
        const { data: allRevs } = await supabase.from("course_reviews").select("rating").in("course_id", ids);
        const arr = (allRevs ?? []) as { rating: number }[];
        if (arr.length) {
          setInstructorRating({ avg: arr.reduce((s, r) => s + r.rating, 0) / arr.length, count: arr.length });
        }
      }
    }
    setLoading(false);
  }, [courseId, user?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user?.id || !course?.id || (!course.is_published && !isAdmin)) return;
    void recordCourseView(user.id, course.id);
  }, [user?.id, course?.id, course?.is_published, isAdmin]);

  const stats = useMemo(() => {
    const lessons = blocks.filter((b) => b.block_type === "lesson").length;
    const practices = blocks.filter((b) => b.block_type === "practice").length;
    const quizzes = blocks.filter((b) => b.block_type === "quiz").length;
    const exams = blocks.filter((b) => b.block_type === "final_exam").length;
    const videoSeconds = blocks
      .filter((b) => b.block_type === "lesson")
      .reduce((s, b) => s + (b.min_view_seconds ?? 0), 0);
    return { lessons, practices, quizzes, exams, videoSeconds };
  }, [blocks]);

  const completableBlocks = useMemo(() => blocks.filter((b) => b.block_type !== "quiz"), [blocks]);
  const canReview = useMemo(
    () => completableBlocks.length > 0 && completableBlocks.every((b) => completed.has(b.id)),
    [completableBlocks, completed],
  );
  const started = completed.size > 0;

  if (loading) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!course || (!course.is_published && !isAdmin)) {
    return (
      <div className="p-10 max-w-3xl mx-auto">
        <Card className="p-10 text-center border-dashed">
          <p className="text-muted-foreground">Bu kurs mövcud deyil və ya hələ dərc olunmayıb.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/courses"><ArrowLeft className="h-4 w-4 mr-2" /> Bütün kurslar</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const updated = new Date(course.updated_at);
  const updatedLabel = `${String(updated.getMonth() + 1).padStart(2, "0")}.${updated.getFullYear()}`;
  const learnItems = course.what_you_will_learn.filter((s) => s.trim());
  const reqItems = course.requirements.filter((s) => s.trim());
  const videoHours = stats.videoSeconds / 3600;

  return (
    <div className="max-w-5xl mx-auto pb-16">
      {/* Hero */}
      <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
        <div className="px-6 lg:px-10 py-10 bg-muted/30">
          <nav className="text-sm text-muted-foreground mb-4 flex items-center gap-1.5 flex-wrap">
            <Link to="/courses" className="hover:text-foreground">Kurslar</Link>
            <span>/</span>
            <span className="text-foreground">{course.title}</span>
          </nav>
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1 min-w-0">
              <div className="flex gap-2 flex-wrap mb-3">
                {avgRating >= 4.5 && reviewCount >= 3 && (
                  <Badge className="bg-warning/15 text-warning-foreground border-0">Ən yüksək reytinq</Badge>
                )}
                {participants >= 100 && (
                  <Badge className="bg-success/15 text-success border-0">Lider</Badge>
                )}
                {!course.is_published && <Badge variant="secondary">Layihə</Badge>}
              </div>
              <h1 className="font-display text-3xl lg:text-4xl font-bold leading-tight">{course.title}</h1>
              {course.short_description && (
                <p className="text-muted-foreground mt-3 text-lg leading-relaxed">{course.short_description}</p>
              )}
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                <span className="font-bold text-lg text-foreground">{avgRating ? avgRating.toFixed(1) : "—"}</span>
                <StarRating value={avgRating} size="sm" />
                <a href="#reyler" className="text-sm text-primary hover:underline">({reviewCount} rəy)</a>
              </div>
              <div className="flex items-center gap-x-5 gap-y-2 mt-4 text-sm text-muted-foreground flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4" /> {participants} iştirakçı
                </span>
                {(instructor?.full_name || course.instructor_name) && (
                  <span>Müəllim: <span className="text-foreground font-medium">{instructor?.full_name || course.instructor_name}</span></span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <RefreshCw className="h-4 w-4" /> Son yenilənmə: {updatedLabel}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="h-4 w-4" /> {course.language}
                </span>
              </div>
              <div className="flex gap-2 mt-6 flex-wrap">
                <Button asChild size="lg">
                  <Link to="/courses/$courseId/play" params={{ courseId: course.id }}>
                    <Play className="h-4 w-4 mr-2" />
                    {canReview ? "Kursu təkrar keç" : started ? "Davam et" : "Kursa başla"}
                  </Link>
                </Button>
                {isAdmin && (
                  <Button asChild size="lg" variant="outline">
                    <Link to="/courses/$courseId/edit" params={{ courseId: course.id }}>
                      <Pencil className="h-4 w-4 mr-2" /> Kursu redaktə et
                    </Link>
                  </Button>
                )}
              </div>
            </div>
            {course.cover_image_url && (
              <div className="md:w-72 shrink-0">
                <img
                  src={course.cover_image_url}
                  alt={course.title}
                  className="w-full aspect-video object-cover rounded-xl border border-border shadow-sm"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-10 space-y-12 mt-10">
        {/* What you will learn */}
        {learnItems.length > 0 && (
          <section>
            <h2 className="font-display text-2xl font-bold mb-4">Kursda nələr öyrənəcəksiniz</h2>
            <Card className="p-6">
              <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
                {(showAllLearn ? learnItems : learnItems.slice(0, 6)).map((item, i) => (
                  <li key={i} className="flex gap-2.5 text-sm">
                    <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              {learnItems.length > 6 && (
                <Button variant="ghost" size="sm" className="mt-4" onClick={() => setShowAllLearn((v) => !v)}>
                  {showAllLearn ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                  {showAllLearn ? "Yığcamlaşdır" : `Daha çox göstər (${learnItems.length - 6})`}
                </Button>
              )}
            </Card>
          </section>
        )}

        {/* Includes */}
        <section>
          <h2 className="font-display text-2xl font-bold mb-4">Kursa daxildir</h2>
          <Card className="p-6">
            <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <li className="flex items-center gap-2.5">
                <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                {stats.lessons} dərs{stats.practices > 0 && `, ${stats.practices} məşq`}
              </li>
              {stats.videoSeconds > 0 && (
                <li className="flex items-center gap-2.5">
                  <Video className="h-4 w-4 text-muted-foreground shrink-0" />
                  {videoHours >= 1 ? `${videoHours.toFixed(1)} saat` : `${Math.round(stats.videoSeconds / 60)} dəqiqə`} video məzmun
                </li>
              )}
              {stats.quizzes + stats.exams > 0 && (
                <li className="flex items-center gap-2.5">
                  <FileQuestion className="h-4 w-4 text-muted-foreground shrink-0" />
                  {stats.quizzes + stats.exams} qiymətləndirmə
                </li>
              )}
              <li className="flex items-center gap-2.5">
                <RefreshCw className="h-4 w-4 text-muted-foreground shrink-0" />
                Limitsiz giriş
              </li>
              {course.certificate_template_url && (
                <li className="flex items-center gap-2.5">
                  <Award className="h-4 w-4 text-muted-foreground shrink-0" />
                  Bitirmə sertifikatı
                </li>
              )}
            </ul>
          </Card>
        </section>

        {/* Curriculum */}
        <section>
          <h2 className="font-display text-2xl font-bold mb-4">Kursun materialları</h2>
          <p className="text-sm text-muted-foreground mb-3">
            {blocks.length} bölmə · {stats.lessons + stats.practices} dərs
          </p>
          <Card className="divide-y divide-border overflow-hidden">
            {blocks.map((b, i) => {
              const meta = blockMeta[b.block_type];
              const Icon = meta.icon;
              const done = completed.has(b.id);
              return (
                <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xs text-muted-foreground tabular-nums w-6">{i + 1}</span>
                  <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", meta.tone)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{b.title}</div>
                    <div className="text-xs text-muted-foreground">{meta.label}</div>
                  </div>
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  )}
                </div>
              );
            })}
            {blocks.length === 0 && (
              <p className="px-4 py-8 text-sm text-muted-foreground text-center">Hələ məzmun əlavə olunmayıb.</p>
            )}
          </Card>
        </section>

        {/* Requirements */}
        {reqItems.length > 0 && (
          <section>
            <h2 className="font-display text-2xl font-bold mb-4">Tələblər</h2>
            <ul className="list-disc pl-6 space-y-2 text-sm">
              {reqItems.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </section>
        )}

        {/* About */}
        {course.description && (
          <section>
            <h2 className="font-display text-2xl font-bold mb-4">Haqqında</h2>
            <div className={cn("text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground", !expandAbout && "line-clamp-6")}>
              {course.description}
            </div>
            {course.description.length > 400 && (
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setExpandAbout((v) => !v)}>
                {expandAbout ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                {expandAbout ? "Yığcamlaşdır" : "Daha çox göstər"}
              </Button>
            )}
          </section>
        )}

        {/* Instructor */}
        {instructor && (
          <section>
            <h2 className="font-display text-2xl font-bold mb-4">Müəllim</h2>
            <Card className="p-6">
              <div className="flex gap-4 items-start">
                <div className="h-16 w-16 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xl font-semibold overflow-hidden shrink-0">
                  {instructor.avatar_url ? (
                    <img src={instructor.avatar_url} alt={instructor.full_name} className="h-full w-full object-cover" />
                  ) : (
                    instructor.full_name[0]?.toUpperCase() ?? "?"
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-lg">{instructor.full_name}</h3>
                  {instructor.headline && <p className="text-sm text-muted-foreground">{instructor.headline}</p>}
                  {instructorRating && (
                    <div className="flex items-center gap-2 mt-2">
                      <StarRating value={instructorRating.avg} size="sm" />
                      <span className="text-sm text-muted-foreground">
                        {instructorRating.avg.toFixed(1)} müəllim reytinqi · {instructorRating.count} rəy
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {instructor.bio && (
                <p className="text-sm text-muted-foreground leading-relaxed mt-4 whitespace-pre-wrap">{instructor.bio}</p>
              )}
            </Card>
          </section>
        )}

        {/* Reviews */}
        <section id="reyler">
          <h2 className="font-display text-2xl font-bold mb-4">Rəylər</h2>
          <CourseReviews courseId={course.id} canReview={canReview} />
        </section>
      </div>
    </div>
  );
}
