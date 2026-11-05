import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Loader2,
  Play,
  Pencil,
  BookOpen,
  Dumbbell,
  FileQuestion,
  GraduationCap,
  Users,
  Globe,
  RefreshCw,
  Award,
  Video,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  Star,
  ChevronRight,
  UserRound,
  Infinity as InfinityIcon,
} from "lucide-react";
import { CourseReviews } from "@/components/CourseReviews";
import { cn } from "@/lib/utils";
import { recordCourseView } from "@/lib/course-views";
import { IconChip } from "@/components/design/IconChip";
import { StatusChip } from "@/components/design/StatusChip";
import { UserAvatar } from "@/components/design/UserAvatar";
import { ratingsByCourse, type RatingSummary } from "@/lib/dashboard-courses";
import { similarCourses, type SimilarCandidate } from "@/lib/courses-catalog";

export const Route = createFileRoute("/courses/$courseId/")({
  head: () => ({
    meta: [
      { title: "Kurs — Baku Digital Lab" },
      {
        name: "description",
        content: "Kurs haqqında ətraflı məlumat, müəllim, proqram və rəylər.",
      },
      { property: "og:title", content: "Kurs — Baku Digital Lab" },
      {
        property: "og:description",
        content: "Kurs haqqında ətraflı məlumat, müəllim, proqram və rəylər.",
      },
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
  folder_id: string | null;
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

interface InstructorStats {
  rating: { avg: number; count: number } | null;
  students: number;
  courses: number;
}

const blockMeta: Record<
  BlockType,
  { icon: typeof BookOpen; label: string; tone: "brand" | "gray" | "warning" | "success" }
> = {
  lesson: { icon: BookOpen, label: "Dərs", tone: "brand" },
  practice: { icon: Dumbbell, label: "Məşq", tone: "gray" },
  quiz: { icon: FileQuestion, label: "Quiz", tone: "warning" },
  final_exam: { icon: GraduationCap, label: "Son imtahan", tone: "success" },
};

/** Bento kartı: hər bölmə eyni çərçivə və başlıq ölçüsündə. */
function BentoCard({
  title,
  aside,
  children,
  className,
  id,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const headingId = `${id ?? title.replace(/\s+/g, "-").toLowerCase()}-title`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(
        "min-w-0 scroll-mt-20 rounded-xl border border-border bg-card p-5 shadow-card sm:p-6",
        className,
      )}
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={headingId} className="font-display text-lg font-semibold">
          {title}
        </h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

function CourseLandingPage() {
  const { courseId } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [participants, setParticipants] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [instructor, setInstructor] = useState<InstructorProfile | null>(null);
  const [instructorStats, setInstructorStats] = useState<InstructorStats | null>(null);
  const [similar, setSimilar] = useState<SimilarCandidate[]>([]);
  const [similarRatings, setSimilarRatings] = useState<Record<string, RatingSummary>>({});
  const [loading, setLoading] = useState(true);
  const [showAllLearn, setShowAllLearn] = useState(false);
  const [expandAbout, setExpandAbout] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: c }, { data: b }, { data: revs }, { data: progAll }] = await Promise.all([
      supabase.from("courses").select("*").eq("id", courseId).maybeSingle(),
      supabase
        .from("course_blocks")
        .select("id,block_type,title,position,min_view_seconds")
        .eq("course_id", courseId)
        .order("position"),
      supabase.from("course_reviews").select("rating").eq("course_id", courseId),
      supabase.from("block_progress").select("user_id").eq("course_id", courseId),
    ]);
    const course = c as Course | null;
    if (course) {
      course.what_you_will_learn = Array.isArray(course.what_you_will_learn)
        ? course.what_you_will_learn
        : [];
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

    // Kateqoriya (qovluq) adı və oxşar kurslar (maddə 79).
    // Siyahı istifadəçinin baxa bildiyi kurslardan gəlir (dashboard_allowed_courses).
    const [folderRes, allowedRes, sameFolderRes] = await Promise.all([
      course?.folder_id
        ? supabase.from("folders").select("name").eq("id", course.folder_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.rpc("dashboard_allowed_courses"),
      course?.folder_id
        ? supabase
            .from("courses")
            .select("id")
            .eq("folder_id", course.folder_id)
            .eq("is_published", true)
        : Promise.resolve({ data: [] as { id: string }[] }),
    ]);
    setFolderName((folderRes.data as { name: string } | null)?.name ?? null);
    const allowed: SimilarCandidate[] = (allowedRes.data ?? []).map((x) => ({
      ...x,
      viewers: Number(x.viewers),
    }));
    const picked = similarCourses(
      courseId,
      allowed,
      new Set(((sameFolderRes.data ?? []) as { id: string }[]).map((x) => x.id)),
    );
    setSimilar(picked);
    if (picked.length) {
      const { data: simRevs } = await supabase
        .from("course_reviews")
        .select("course_id,rating")
        .in(
          "course_id",
          picked.map((x) => x.id),
        );
      setSimilarRatings(Object.fromEntries(ratingsByCourse(simRevs ?? [])));
    } else {
      setSimilarRatings({});
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
      else if (teacherName)
        setInstructor({ full_name: teacherName, headline: null, bio: null, avatar_url: null });

      // Müəllim statistikası (maddə 80): dərc olunmuş kursları, onlarda dərs keçən
      // unikal istifadəçilər və bütün kurslarının orta reytinqi.
      const taught = teacherName
        ? await supabase
            .from("courses")
            .select("id")
            .eq("instructor_name", teacherName)
            .eq("is_published", true)
        : await supabase
            .from("courses")
            .select("id")
            .eq("created_by", teacherId as string)
            .eq("is_published", true);
      const ids = ((taught.data ?? []) as { id: string }[]).map((x) => x.id);
      let rating: InstructorStats["rating"] = null;
      let students = 0;
      if (ids.length) {
        const [{ data: allRevs }, { data: learners }] = await Promise.all([
          supabase.from("course_reviews").select("rating").in("course_id", ids),
          supabase.from("block_progress").select("user_id").in("course_id", ids),
        ]);
        const arr = (allRevs ?? []) as { rating: number }[];
        if (arr.length)
          rating = { avg: arr.reduce((s, r) => s + r.rating, 0) / arr.length, count: arr.length };
        students = new Set(((learners ?? []) as { user_id: string }[]).map((l) => l.user_id)).size;
      }
      setInstructorStats({ rating, students, courses: ids.length });
    }
    setLoading(false);
  }, [courseId, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

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
            <Link to="/courses">
              <ArrowLeft className="h-4 w-4 mr-2" /> Bütün kurslar
            </Link>
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
  const teacherName = instructor?.full_name || course.instructor_name;

  // Bento şəbəkəsində boş xana qalmasın: son kart ("Oxşar kurslar") qalan sütunları doldurur.
  const cardCount = (learnItems.length > 0 ? 1 : 0) + 1 + (instructor ? 1 : 0) + 3;
  const similarSpan = cn(
    cardCount % 2 === 1 && "md:col-span-2",
    cardCount % 3 === 1 && "xl:col-span-3",
    cardCount % 3 === 2 && "xl:col-span-2",
    cardCount % 3 === 0 && "xl:col-span-1",
  );

  const includes: { icon: typeof BookOpen; text: string }[] = [
    {
      icon: BookOpen,
      text: `${stats.lessons} dərs${stats.practices > 0 ? `, ${stats.practices} məşq` : ""}`,
    },
    ...(stats.videoSeconds > 0
      ? [
          {
            icon: Video,
            text: `${videoHours >= 1 ? `${videoHours.toFixed(1)} saat` : `${Math.round(stats.videoSeconds / 60)} dəqiqə`} video məzmun`,
          },
        ]
      : []),
    ...(stats.quizzes + stats.exams > 0
      ? [{ icon: FileQuestion, text: `${stats.quizzes + stats.exams} qiymətləndirmə` }]
      : []),
    { icon: InfinityIcon, text: "Limitsiz giriş" },
    ...(course.certificate_template_url ? [{ icon: Award, text: "Bitirmə sertifikatı" }] : []),
  ];

  return (
    <div className="bento-page pb-16">
      {/* Hero (maddə 76) */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-8">
          <div className="min-w-0 flex-1">
            <nav
              aria-label="Səhifə yolu"
              className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
            >
              <Link to="/courses" className="hover:text-foreground">
                Kurslar
              </Link>
              {folderName && (
                <>
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{folderName}</span>
                </>
              )}
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="min-w-0 truncate text-foreground" aria-current="page">
                {course.title}
              </span>
            </nav>
            <div className="mb-3 flex flex-wrap gap-2">
              {folderName && <StatusChip tone="brand">{folderName}</StatusChip>}
              {avgRating >= 4.5 && reviewCount >= 3 && (
                <StatusChip tone="warning">Ən yüksək reytinq</StatusChip>
              )}
              {participants >= 100 && <StatusChip tone="success">Lider</StatusChip>}
              {!course.is_published && <StatusChip tone="gray">Layihə</StatusChip>}
            </div>
            <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl lg:text-4xl">
              {course.title}
            </h1>
            {course.short_description && (
              <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {course.short_description}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-secondary-foreground">
              <a href="#reyler" className="inline-flex items-center gap-1.5 hover:text-primary">
                <Star
                  className="h-4 w-4 fill-[var(--warning-500)] text-[var(--warning-500)]"
                  aria-hidden="true"
                />
                <span className="font-semibold text-foreground">
                  {avgRating ? avgRating.toFixed(1) : "—"}
                </span>
                <span className="text-muted-foreground">({reviewCount} rəy)</span>
              </a>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />{" "}
                {participants} iştirakçı
              </span>
              {teacherName && (
                <span className="inline-flex items-center gap-1.5">
                  <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Müəllim: <span className="font-medium text-foreground">{teacherName}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-muted-foreground" aria-hidden="true" />{" "}
                {course.language}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Son
                yenilənmə: {updatedLabel}
              </span>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
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
            <div className="shrink-0 lg:w-[40%]">
              <img
                src={course.cover_image_url}
                alt={course.title}
                className="aspect-video w-full rounded-xl object-cover"
              />
            </div>
          )}
        </div>
      </section>

      {/* Bento düzülüşü (maddə 76) */}
      <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {learnItems.length > 0 && (
          <BentoCard title="Kursda nələr öyrənəcəksiniz">
            <ul className="space-y-3">
              {(showAllLearn ? learnItems : learnItems.slice(0, 6)).map((item, i) => (
                <li key={i} className="flex gap-2.5 text-sm">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            {learnItems.length > 6 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={() => setShowAllLearn((v) => !v)}
              >
                {showAllLearn ? (
                  <ChevronUp className="h-4 w-4 mr-1" />
                ) : (
                  <ChevronDown className="h-4 w-4 mr-1" />
                )}
                {showAllLearn ? "Yığcamlaşdır" : `Daha çox göstər (${learnItems.length - 6})`}
              </Button>
            )}
          </BentoCard>
        )}

        <BentoCard title="Kursa daxildir">
          <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-1 2xl:grid-cols-2">
            {includes.map(({ icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm font-medium">
                <IconChip icon={icon} size="sm" />
                {text}
              </li>
            ))}
          </ul>
        </BentoCard>

        {instructor && (
          <BentoCard title="Müəllim">
            <div className="flex items-center gap-4">
              <UserAvatar name={instructor.full_name} src={instructor.avatar_url} size="lg" />
              <div className="min-w-0">
                <h3 className="font-display text-base font-semibold">{instructor.full_name}</h3>
                {instructor.headline && (
                  <p className="text-sm text-muted-foreground">{instructor.headline}</p>
                )}
              </div>
            </div>
            {instructor.bio && (
              <p className="mt-4 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {instructor.bio}
              </p>
            )}
            {instructorStats && (
              <dl className="mt-5 grid grid-cols-3 divide-x divide-border border-t border-border pt-4 text-center">
                <div>
                  <dd className="font-display text-lg font-semibold tabular-nums">
                    {instructorStats.students.toLocaleString("az-AZ")}
                  </dd>
                  <dt className="text-xs text-muted-foreground">Tələbə</dt>
                </div>
                <div>
                  <dd className="font-display text-lg font-semibold tabular-nums">
                    {instructorStats.courses}
                  </dd>
                  <dt className="text-xs text-muted-foreground">Kurs</dt>
                </div>
                <div>
                  <dd className="font-display text-lg font-semibold tabular-nums">
                    {instructorStats.rating ? instructorStats.rating.avg.toFixed(1) : "—"}
                  </dd>
                  <dt className="text-xs text-muted-foreground">Müəllim reytinqi</dt>
                </div>
              </dl>
            )}
          </BentoCard>
        )}

        <BentoCard
          title="Kursun materialları"
          aside={
            <span className="text-sm text-muted-foreground">
              {blocks.length} bölmə · {stats.lessons + stats.practices} dərs
            </span>
          }
        >
          {blocks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Hələ məzmun əlavə olunmayıb.
            </p>
          ) : (
            <ol className="space-y-2">
              {blocks.map((b, i) => {
                const meta = blockMeta[b.block_type];
                const done = completed.has(b.id);
                return (
                  <li
                    key={b.id}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
                  >
                    <span className="w-5 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                    <IconChip icon={meta.icon} tone={meta.tone} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 break-words text-sm font-medium" title={b.title}>
                        {b.title}
                      </div>
                      <div className="text-xs text-muted-foreground">{meta.label}</div>
                    </div>
                    {done ? (
                      <CheckCircle2
                        className="h-4 w-4 shrink-0 text-[var(--success-500)]"
                        aria-label="Tamamlanıb"
                      />
                    ) : (
                      <Circle
                        className="h-4 w-4 shrink-0 text-muted-foreground/40"
                        aria-hidden="true"
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </BentoCard>

        <BentoCard title="Rəylər" id="reyler">
          <CourseReviews courseId={course.id} canReview={canReview} embedded />
        </BentoCard>

        <BentoCard
          title="Oxşar kurslar"
          className={similarSpan}
          aside={
            <Link
              to="/courses"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-[var(--primary-hover)]"
            >
              Hamısına bax <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          }
        >
          {similar.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">Oxşar kurs tapılmadı.</p>
          ) : (
            <ul className="space-y-3">
              {similar.map((s) => {
                const r = similarRatings[s.id];
                return (
                  <li key={s.id}>
                    <Link
                      to="/courses/$courseId"
                      params={{ courseId: s.id }}
                      className="group flex items-center gap-3 rounded-lg p-1.5 -m-1.5 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {s.cover_image_url ? (
                          <img
                            src={s.cover_image_url}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center text-muted-foreground">
                            <BookOpen className="h-5 w-5" aria-hidden="true" />
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold group-hover:text-primary">
                          {s.title}
                        </span>
                        {s.teacher && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {s.teacher}
                          </span>
                        )}
                        <span className="mt-1 flex items-center gap-1.5 text-xs text-secondary-foreground">
                          {r ? (
                            <>
                              <Star
                                className="h-3.5 w-3.5 fill-[var(--warning-500)] text-[var(--warning-500)]"
                                aria-hidden="true"
                              />
                              <span className="font-semibold">{r.average.toFixed(1)}</span>
                              <span aria-hidden="true">·</span>
                            </>
                          ) : null}
                          <span>{s.viewers} nəfər baxıb</span>
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </BentoCard>
      </div>

      {(reqItems.length > 0 || course.description) && (
        <div
          className={cn(
            "mt-5 grid gap-5",
            reqItems.length > 0 &&
              course.description &&
              "lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]",
          )}
        >
          {reqItems.length > 0 && (
            <BentoCard title="Tələblər">
              <ul className="list-disc space-y-2 pl-5 text-sm">
                {reqItems.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </BentoCard>
          )}

          {course.description && (
            <BentoCard title="Haqqında">
              <div
                className={cn(
                  "whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground",
                  !expandAbout && "line-clamp-6",
                )}
              >
                {course.description}
              </div>
              {course.description.length > 400 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => setExpandAbout((v) => !v)}
                >
                  {expandAbout ? (
                    <ChevronUp className="h-4 w-4 mr-1" />
                  ) : (
                    <ChevronDown className="h-4 w-4 mr-1" />
                  )}
                  {expandAbout ? "Yığcamlaşdır" : "Daha çox göstər"}
                </Button>
              )}
            </BentoCard>
          )}
        </div>
      )}
    </div>
  );
}
