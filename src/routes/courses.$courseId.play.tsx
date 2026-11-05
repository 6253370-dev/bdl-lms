import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  BookOpen,
  Dumbbell,
  FileQuestion,
  GraduationCap,
  Loader2,
  CheckCircle2,
  XCircle,
  Play,
  Trophy,
  Clock,
  Video,
  Award,
  Circle,
  Lock as LockIcon,
  ChevronLeft,
  ChevronRight,
  X,
  PanelRightOpen,
  PanelRightClose,
  PlayCircle,
  Gauge,
} from "lucide-react";
import type { ReactNode } from "react";
import { RingProgress } from "@/components/design/RingProgress";
import { LESSON_KIND, PLAYBACK_RATES, formatMinutes, lessonKind } from "@/lib/lesson-kind";

const SPEED_KEY = "bdl-player-speed";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { recordCourseView } from "@/lib/course-views";
import { Textarea } from "@/components/ui/textarea";
import { CourseReviews } from "@/components/CourseReviews";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LessonComments } from "@/components/LessonComments";
import { downloadCertificateSmart } from "@/lib/certificate";
import {
  useExamProctor,
  getExamBlock,
  enterFullscreen,
  exitFullscreen,
  EXAM_BLOCKED_MSG,
} from "@/hooks/use-exam-proctor";

export const Route = createFileRoute("/courses/$courseId/play")({
  head: () => ({
    meta: [
      { title: "Kurs dərsləri | Baku Digital Lab" },
      { name: "description", content: "Kurs dərsləri, məşqlər və şəxsi təlim proqresi." },
      { property: "og:title", content: "Kurs dərsləri | Baku Digital Lab" },
      { property: "og:description", content: "Dərslərə davam edin və təliminizi tamamlayın." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ProtectedRoute showAppShell={false}>
      <CoursePlayer />
    </ProtectedRoute>
  ),
});

type BlockType = "lesson" | "practice" | "quiz" | "final_exam";

interface Block {
  id: string;
  course_id: string;
  block_type: BlockType;
  title: string;
  description: string | null;
  position: number;
  video_url: string | null;
  external_video_url: string | null;
  pdf_url: string | null;
  pptx_url: string | null;
  docx_url: string | null;
  time_limit_seconds: number | null;
  min_view_seconds: number | null;
  passing_score: number | null;
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  passing_score: number;
  certificate_template_url: string | null;
  instructor_name: string | null;
  language: string | null;
  short_description: string | null;
  created_by: string | null;
  teacher_name?: string;
}

const meta: Record<BlockType, { icon: typeof BookOpen; label: string; tone: string }> = {
  lesson: { icon: BookOpen, label: "Dərs", tone: "bg-primary/10 text-primary" },
  practice: { icon: Dumbbell, label: "Məşq", tone: "bg-accent text-accent-foreground" },
  quiz: { icon: FileQuestion, label: "Quiz", tone: "bg-warning/15 text-warning-foreground" },
  final_exam: { icon: GraduationCap, label: "Son imtahan", tone: "bg-success/15 text-success" },
};

function CoursePlayer() {
  const { courseId } = Route.useParams();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [materialsOpen, setMaterialsOpen] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  // Maddə 24: video sürəti dərslər arasında yadda qalır (yalnız bu brauzerdə).
  const [speed, setSpeed] = useState(1);
  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(SPEED_KEY));
      if ((PLAYBACK_RATES as readonly number[]).includes(saved)) setSpeed(saved);
    } catch {
      /* Storage may be unavailable. */
    }
  }, []);
  const changeSpeed = (v: number) => {
    setSpeed(v);
    try {
      window.localStorage.setItem(SPEED_KEY, String(v));
    } catch {
      /* skip */
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: c }, { data: b }] = await Promise.all([
      supabase
        .from("courses")
        .select(
          "id,title,description,passing_score,certificate_template_url,instructor_name,language,short_description,created_by",
        )
        .eq("id", courseId)
        .single(),
      supabase.from("course_blocks").select("*").eq("course_id", courseId).order("position"),
    ]);
    if (c) {
      const { data: creator } = c.created_by
        ? await supabase.from("profiles").select("full_name").eq("id", c.created_by).maybeSingle()
        : { data: null };
      setCourse({
        ...c,
        teacher_name: c.instructor_name?.trim() || creator?.full_name || "—",
      } as Course);
    } else setCourse(null);
    const raw = (b ?? []) as Block[];
    // Hide standalone "quiz" blocks from the player and ensure final_exam is the last step
    const filtered = raw.filter((x) => x.block_type !== "quiz");
    const list = [
      ...filtered.filter((x) => x.block_type !== "final_exam"),
      ...filtered.filter((x) => x.block_type === "final_exam"),
    ];
    setBlocks(list);

    let done = new Set<string>();
    if (user?.id) {
      const { data: prog } = await supabase
        .from("block_progress")
        .select("block_id")
        .eq("user_id", user.id)
        .eq("course_id", courseId)
        .eq("completed", true);
      done = new Set((prog ?? []).map((p) => p.block_id));
      setCompleted(done);
    }
    // Davam ediləcək ilk tamamlanmamış dərs
    const firstOpen = list.find((x) => !done.has(x.id)) ?? list[list.length - 1];
    setActiveId(firstOpen?.id ?? null);
    setLoading(false);
  }, [courseId, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const markComplete = useCallback(
    async (blockId: string) => {
      if (!user?.id) return;
      setCompleted((prev) => {
        if (prev.has(blockId)) return prev;
        const next = new Set(prev);
        next.add(blockId);
        return next;
      });
      await supabase
        .from("block_progress")
        .upsert(
          { user_id: user.id, course_id: courseId, block_id: blockId, completed: true },
          { onConflict: "user_id,block_id" },
        );
    },
    [user?.id, courseId],
  );

  // Record course view for "recently viewed" dashboard
  useEffect(() => {
    if (!user?.id || course?.id !== courseId) return;
    void recordCourseView(user.id, courseId);
  }, [user?.id, course?.id, courseId]);

  if (loading) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!course) return null;

  const active = blocks.find((b) => b.id === activeId) ?? null;

  const activeIndex = blocks.findIndex((b) => b.id === activeId);
  const doneCount = blocks.filter((b) => completed.has(b.id)).length;
  const percent = blocks.length ? Math.round((doneCount / blocks.length) * 100) : 0;
  const canReview = blocks.length > 0 && blocks.every((b) => completed.has(b.id));
  const previous = blocks[activeIndex - 1];
  const next = blocks[activeIndex + 1];
  const previousUnlocked =
    previous &&
    (activeIndex === 1 || completed.has(previous.id) || completed.has(blocks[activeIndex - 2]?.id));

  // Maddə 23: "Əvvəlki / Növbəti dərs" icmal kartının altında; kilid qaydaları əvvəlki kimidir.
  const nav = active ? (
    <div className="flex items-center justify-between gap-3">
      <Button
        variant="outline"
        disabled={!previousUnlocked}
        onClick={() => previous && setActiveId(previous.id)}
      >
        <ChevronLeft className="h-4 w-4" /> Əvvəlki dərs
      </Button>
      <span className="text-xs text-muted-foreground tabular-nums">
        {activeIndex + 1} / {blocks.length}
      </span>
      <Button
        disabled={!next || !completed.has(active.id)}
        onClick={() => next && setActiveId(next.id)}
      >
        Növbəti dərs <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  ) : null;

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex min-h-16 items-center gap-3 px-3 sm:px-5">
          <Button variant="ghost" size="icon" asChild className="shrink-0" title="Kursa qayıt">
            <Link to="/courses/$courseId" params={{ courseId }} aria-label="Kursa qayıt">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-sm font-semibold leading-snug break-words sm:text-base">
              {course.title}
            </h1>
            {active && (
              <p className="truncate text-xs text-muted-foreground sm:text-sm">
                {activeIndex + 1}. {active.title}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="hidden text-right text-xs text-muted-foreground sm:block">
              {doneCount}/{blocks.length}
              <br />
              tamamlandı
            </span>
            <RingProgress
              value={percent}
              size={44}
              stroke={4}
              label="Kurs proqresi"
              className="text-xs"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => setMaterialsOpen((v) => !v)}
            aria-label={materialsOpen ? "Materialları gizlət" : "Materialları göstər"}
            aria-expanded={materialsOpen}
            title={materialsOpen ? "Materialları gizlət" : "Materialları göstər"}
          >
            {materialsOpen ? (
              <PanelRightClose className="h-5 w-5" />
            ) : (
              <PanelRightOpen className="h-5 w-5" />
            )}
          </Button>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1600px] flex-col items-start gap-5 lg:flex-row lg:p-6">
        <section className="w-full min-w-0 flex-1 space-y-5">
          {!active ? (
            <div className="py-24 text-center text-muted-foreground">
              <BookOpen className="h-10 w-10 mx-auto mb-3" />
              {t.player.noContent}
            </div>
          ) : active.block_type === "lesson" ? (
            <LessonView
              key={active.id}
              block={active}
              course={course}
              canReview={canReview}
              onComplete={() => markComplete(active.id)}
              nextBlockId={next?.id ?? null}
              onGoNext={setActiveId}
              speed={speed}
              onSpeedChange={changeSpeed}
              nav={nav}
            />
          ) : (
            <>
              <div className="border-b px-4 py-8 sm:px-8 lg:rounded-xl lg:border lg:bg-card lg:shadow-card">
                <AssessmentView
                  key={active.id}
                  block={active}
                  course={course}
                  onComplete={() => markComplete(active.id)}
                  nextBlockId={next?.id ?? null}
                  onGoNext={setActiveId}
                />
              </div>
              <PlayerDetails block={active} course={course} canReview={canReview} nav={nav} />
            </>
          )}
        </section>
        {materialsOpen && (
          <aside
            aria-label="Kursun materialları"
            className="w-full overflow-y-auto border-t bg-card lg:sticky lg:top-[5.5rem] lg:max-h-[calc(100dvh-7rem)] lg:w-80 lg:shrink-0 lg:rounded-xl lg:border lg:shadow-card xl:w-96"
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="font-display text-base font-semibold">Kursun materialları</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {blocks.length} material · {doneCount} tamamlandı
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMaterialsOpen(false)}
                aria-label="Materialları bağla"
                title="Materialları bağla"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {blocks.length === 0 && (
              <p className="p-5 text-sm text-muted-foreground">{t.player.noContent}</p>
            )}
            <ol className="space-y-1 p-2">
              {blocks.map((b, i) => {
                const isActive = b.id === activeId;
                const isDone = completed.has(b.id);
                const unlocked = i === 0 || isDone || completed.has(blocks[i - 1].id);
                const kind = LESSON_KIND[lessonKind(b)];
                const KindIcon = kind.icon;
                const minutes = formatMinutes(b.min_view_seconds);
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      disabled={!unlocked}
                      onClick={() => setActiveId(b.id)}
                      aria-current={isActive ? "step" : undefined}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60",
                        isActive
                          ? "bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-200"
                          : "hover:bg-muted",
                      )}
                    >
                      <span className="mt-0.5 shrink-0" aria-hidden="true">
                        {isDone ? (
                          <CheckCircle2 className="h-5 w-5 fill-primary text-primary-foreground" />
                        ) : isActive ? (
                          <PlayCircle className="h-5 w-5 text-primary" />
                        ) : !unlocked ? (
                          <LockIcon className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground/60" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium break-words">
                          <span className="tabular-nums text-muted-foreground">{i + 1}.</span>{" "}
                          {b.title}
                        </span>
                        <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <KindIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          {kind.label}
                          {isActive && " · İndi baxılır"}
                          <span className="sr-only">
                            {isDone ? ", tamamlanıb" : !unlocked ? ", kilidli" : ""}
                          </span>
                        </span>
                      </span>
                      {minutes && (
                        <span className="mt-0.5 shrink-0 text-xs tabular-nums text-muted-foreground">
                          {minutes}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>
        )}
      </div>
    </div>
  );
}

function PlayerDetails({
  block,
  course,
  canReview,
  nav,
}: {
  block: Block;
  course: Course;
  canReview: boolean;
  nav?: ReactNode;
}) {
  const kind = LESSON_KIND[lessonKind(block)];
  const KindIcon = kind.icon;
  const minutes = formatMinutes(block.min_view_seconds);
  return (
    <div className="border-y bg-card lg:rounded-xl lg:border lg:shadow-card">
      <Tabs defaultValue="overview" className="w-full">
        <div className="border-b px-3 sm:px-6">
          <TabsList className="h-14 w-full justify-start gap-1 sm:gap-5 rounded-none bg-transparent p-0">
            {[
              ["overview", "İcmal"],
              ["notes", "Şəxsi qeydlər"],
              ["reviews", "Rəylər"],
            ].map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-full rounded-none border-b-2 border-transparent px-3 text-sm data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="overview" className="m-0 px-4 py-6 sm:px-6 space-y-5">
          <div>
            <h2 className="font-display text-xl font-semibold break-words sm:text-2xl">
              {block.title}
            </h2>
            {block.description && (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {block.description}
              </p>
            )}
            {/* Maddə 23: dərs metası */}
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Dərs haqqında">
              {minutes && (
                <li className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-secondary-foreground">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {minutes}
                </li>
              )}
              <li className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-secondary-foreground">
                <KindIcon className="h-3.5 w-3.5" aria-hidden="true" /> {kind.label}
              </li>
            </ul>
          </div>
          <div className="border-t pt-5">
            <h3 className="font-semibold mb-2">Kurs haqqında</h3>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {course.short_description || course.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span>
                Müəllim: <span className="font-medium">{course.teacher_name}</span>
              </span>
              {course.language && (
                <span>
                  Dil: <span className="font-medium">{course.language}</span>
                </span>
              )}
            </div>
            <Button variant="link" asChild className="px-0 mt-2">
              <Link to="/courses/$courseId" params={{ courseId: course.id }}>
                Kursun təqdimatına bax <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="notes" className="m-0 px-4 py-6 sm:px-6">
          <LessonComments blockId={block.id} courseId={course.id} />
        </TabsContent>
        <TabsContent value="reviews" className="m-0 px-4 py-6 sm:px-6">
          {!canReview && (
            <p className="text-sm text-muted-foreground mb-5">
              Kursu qiymətləndirmək üçün onu tam başa vurmalısınız.
            </p>
          )}
          <CourseReviews courseId={course.id} canReview={canReview} embedded />
        </TabsContent>
      </Tabs>
      {nav && <div className="border-t px-4 py-4 sm:px-6">{nav}</div>}
    </div>
  );
}

function LessonView({
  block,
  course,
  canReview,
  nextBlockId,
  onGoNext,
  onComplete,
  speed,
  onSpeedChange,
  nav,
}: {
  block: Block;
  course: Course;
  canReview: boolean;
  nextBlockId: string | null;
  onGoNext: (id: string) => void;
  onComplete: () => void;
  speed: number;
  onSpeedChange: (v: number) => void;
  nav?: ReactNode;
}) {
  const navigate = useNavigate();
  const required = block.min_view_seconds ?? 0;
  const hasVideo = !!(block.video_url || block.external_video_url);
  const [elapsed, setElapsed] = useState(0);
  // Videolarda sayğac yalnız "play" basıldıqdan sonra işləyir; digər fayl tiplərində dərsə girən kimi.
  const [counting, setCounting] = useState(!hasVideo);
  const unlocked = required <= 0 || elapsed >= required;

  useEffect(() => {
    setElapsed(0);
    setCounting(!hasVideo);
  }, [block.id, hasVideo]);

  useEffect(() => {
    if (!required || !counting) return;
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [block.id, required, counting]);

  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  useEffect(() => {
    if (unlocked) completeRef.current();
  }, [unlocked, block.id]);

  const remaining = Math.max(0, required - elapsed);

  return (
    <div className="space-y-5">
      <div className="overflow-hidden bg-card lg:rounded-xl lg:border lg:shadow-card">
        <LessonContent
          block={block}
          videoStarted={counting}
          onVideoPlay={() => setCounting(true)}
          onVideoPause={() => setCounting(false)}
          speed={speed}
          onSpeedChange={onSpeedChange}
        />

        <div className="border-t px-4 py-4 sm:px-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          {required > 0 && (
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">
                  {unlocked
                    ? "Minimum baxış vaxtı tamamlandı"
                    : !counting && hasVideo
                      ? "Vaxt sayğacı videonu başlatdıqdan sonra işləyəcək"
                      : `Davam etmək üçün daha ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")} qalıb`}
                </span>
                <span className="font-semibold">
                  {Math.min(100, Math.round((elapsed / required) * 100))}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full transition-all", unlocked ? "bg-success" : "bg-primary")}
                  style={{ width: `${Math.min(100, (elapsed / required) * 100)}%` }}
                />
              </div>
            </div>
          )}
          <Button
            className="sm:ml-auto shrink-0"
            size="default"
            disabled={!unlocked}
            onClick={() => (nextBlockId ? onGoNext(nextBlockId) : navigate({ to: "/courses" }))}
          >
            {unlocked ? null : <Clock className="h-4 w-4 mr-2" />}
            {nextBlockId ? "Davam et" : t.player.allCourses}
          </Button>
        </div>
      </div>

      <PlayerDetails block={block} course={course} canReview={canReview} nav={nav} />
    </div>
  );
}

function LessonContent({
  block,
  onProgress,
  videoStarted = true,
  onVideoPlay,
  onVideoPause,
  speed = 1,
  onSpeedChange,
}: {
  block: Block;
  onProgress?: (ratio: number) => void;
  videoStarted?: boolean;
  onVideoPlay?: () => void;
  onVideoPause?: () => void;
  speed?: number;
  onSpeedChange?: (v: number) => void;
}) {
  const seen = useRef<Set<number>>(new Set());
  const videoRef = useRef<HTMLVideoElement>(null);

  // Maddə 24: seçilmiş sürət videoya tətbiq olunur (yeni dərs yüklənəndə də).
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed, block.video_url]);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration || !isFinite(v.duration)) return;
    seen.current.add(Math.floor(v.currentTime));
    onProgress?.(Math.min(1, seen.current.size / Math.floor(v.duration)));
  };

  return (
    <div className="bg-muted/40">
      {block.external_video_url && (
        <div className="overflow-hidden aspect-video relative">
          <iframe
            src={toEmbedUrl(block.external_video_url)}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={block.title}
          />
          {!videoStarted && onVideoPlay && (
            <Button
              variant="ghost"
              type="button"
              onClick={onVideoPlay}
              className="absolute inset-0 w-full h-full rounded-none flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-sm text-sm font-medium"
            >
              <span className="rounded-full bg-primary text-primary-foreground px-5 py-2.5">
                Videoya bax
              </span>
              <span className="text-muted-foreground text-xs">
                Baxış vaxtı bu andan hesablanacaq
              </span>
            </Button>
          )}
        </div>
      )}

      {block.video_url && (
        <div className="overflow-hidden">
          <video
            ref={videoRef}
            src={block.video_url}
            controls
            className="w-full"
            onPlay={onVideoPlay}
            onPause={onVideoPause}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={(e) => {
              e.currentTarget.playbackRate = speed;
            }}
            onEnded={() => {
              onProgress?.(1);
              onVideoPause?.();
            }}
          />
          {onSpeedChange && (
            <div className="flex flex-wrap items-center gap-2 border-t bg-card px-4 py-2.5 sm:px-6">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Gauge className="h-4 w-4" aria-hidden="true" /> Sürət
              </span>
              <div role="group" aria-label="Video sürəti" className="flex flex-wrap gap-1">
                {PLAYBACK_RATES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={speed === r}
                    onClick={() => onSpeedChange(r)}
                    className={cn(
                      "h-7 rounded-full px-2.5 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
                      speed === r
                        ? "bg-primary text-primary-foreground"
                        : "text-secondary-foreground hover:bg-muted",
                    )}
                  >
                    {r.toLocaleString("az-AZ")}×
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {block.pdf_url && (
        <div className="overflow-hidden h-[min(68dvh,850px)] min-h-80">
          <iframe src={block.pdf_url} className="w-full h-full" title={`${block.title} PDF`} />
        </div>
      )}

      {block.pptx_url && (
        <div className="overflow-hidden aspect-[4/3] sm:aspect-auto sm:h-[min(68dvh,850px)]">
          <iframe
            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(block.pptx_url)}`}
            className="w-full h-full"
            title={`${block.title} PPTX`}
          />
        </div>
      )}

      {block.docx_url && (
        <div className="overflow-hidden h-[min(68dvh,850px)] min-h-80">
          <iframe
            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(block.docx_url)}`}
            className="w-full h-full"
            title={`${block.title} DOCX`}
          />
        </div>
      )}

      {!block.external_video_url &&
        !block.video_url &&
        !block.pdf_url &&
        !block.pptx_url &&
        !block.docx_url && (
          <div className="py-20 px-4 text-center">
            <Video className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">{t.courses.noMedia}</p>
          </div>
        )}
    </div>
  );
}

function toEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    return url;
  } catch {
    return url;
  }
}

interface Question {
  id: string;
  text: string;
  position: number;
  time_limit_seconds: number | null;
  is_open_ended: boolean;
  answers: { id: string; text: string; is_correct: boolean; position: number }[];
}

interface ResultRow {
  questionId: string;
  selectedAnswerId: string | null;
  answerText: string | null;
  isOpenEnded: boolean;
  isCorrect: boolean;
  timeSpent: number;
}

function AssessmentView({
  block,
  course,
  nextBlockId,
  onGoNext,
  onComplete,
}: {
  block: Block;
  course: Course;
  nextBlockId: string | null;
  onGoNext: (id: string) => void;
  onComplete: () => void;
}) {
  const { user, profile, isAdmin } = useAuth();
  const courseId = course.id;
  const coursePassingScore = course.passing_score;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<"intro" | "running" | "done">("intro");
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [openText, setOpenText] = useState("");
  const [questionStart, setQuestionStart] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState<{
    correct: number;
    total: number;
    percent: number;
    passed: boolean;
    pendingReview: boolean;
  } | null>(null);
  const [certificate, setCertificate] = useState<{ serial: string; issued_at: string } | null>(
    null,
  );
  const [secsLeft, setSecsLeft] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const proctored = block.block_type === "final_exam" && !isAdmin;
  useExamProctor(stage === "running", proctored, (reason) => {
    setBlockReason(reason);
    setStage("intro");
  });

  const passingScore =
    block.block_type === "final_exam" ? (block.passing_score ?? coursePassingScore) : 0;
  const timePer = block.time_limit_seconds ?? null;
  const currentLimit = questions[idx]?.time_limit_seconds ?? timePer ?? null;
  const Icon = meta[block.block_type].icon;

  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true);
      const { data: qs } = await supabase
        .from("questions")
        .select("id,text,position,time_limit_seconds,is_open_ended")
        .eq("block_id", block.id)
        .order("position");
      const ids = (qs ?? []).map((q) => q.id);
      const { data: ans } = ids.length
        ? await supabase
            .from("answers")
            .select("id,text,is_correct,position,question_id")
            .in("question_id", ids)
            .order("position")
        : { data: [] };
      if (canceled) return;
      setQuestions(
        (qs ?? []).map((q) => ({
          ...q,
          answers: (ans ?? []).filter(
            (a: { question_id: string }) => a.question_id === q.id,
          ) as Question["answers"],
        })),
      );
      setLoading(false);
    })();
    return () => {
      canceled = true;
    };
  }, [block.id]);

  const startAttempt = async () => {
    if (questions.length === 0) {
      toast.error("Bu qiymətləndirmədə hələ sual yoxdur");
      return;
    }
    if (proctored) {
      void enterFullscreen();
      const reason = user ? await getExamBlock(user.id) : null;
      if (reason) {
        void exitFullscreen();
        setBlockReason(reason);
        return;
      }
    }
    setIdx(0);
    setResults([]);
    setSelected(null);
    setQuestionStart(Date.now());
    setStage("running");
  };

  const recordAndAdvance = useCallback(
    (answerId: string | null, text?: string) => {
      const q = questions[idx];
      if (!q) return;
      const correctAnswer = q.answers.find((a) => a.is_correct);
      const isCorrect = !q.is_open_ended && !!answerId && answerId === correctAnswer?.id;
      const timeSpent = Math.round((Date.now() - questionStart) / 1000);
      const next = [
        ...results,
        {
          questionId: q.id,
          selectedAnswerId: q.is_open_ended ? null : answerId,
          answerText: q.is_open_ended ? (text ?? "").trim() || null : null,
          isOpenEnded: q.is_open_ended,
          isCorrect,
          timeSpent,
        },
      ];
      setResults(next);
      setSelected(null);
      setOpenText("");
      if (idx + 1 >= questions.length) {
        void finalize(next);
      } else {
        setIdx(idx + 1);
        setQuestionStart(Date.now());
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idx, questions, questionStart, results],
  );

  const finalize = async (allResults: ResultRow[]) => {
    if (!user) {
      toast.error(t.common.notSignedIn);
      return;
    }
    setSubmitting(true);
    const correct = allResults.filter((r) => r.isCorrect).length;
    const total = allResults.length;
    const pendingReview = allResults.some((r) => r.isOpenEnded);
    const percent = total ? Math.round((correct / total) * 1000) / 10 : 0;
    const passed = pendingReview
      ? false
      : block.block_type === "final_exam"
        ? percent >= passingScore
        : true;
    const duration = allResults.reduce((s, r) => s + r.timeSpent, 0);

    const { data: attempt, error } = await supabase
      .from("block_attempts")
      .insert({
        user_id: user.id,
        block_id: block.id,
        course_id: courseId,
        total_questions: total,
        correct_count: correct,
        score_percent: percent,
        passed,
        duration_seconds: duration,
        needs_review: pendingReview,
      })
      .select()
      .single();

    if (error || !attempt) {
      toast.error(error?.message ?? "Cəhdi yadda saxlamaq mümkün olmadı");
      setSubmitting(false);
      return;
    }

    if (allResults.length) {
      const { error: rErr } = await supabase.from("attempt_responses").insert(
        allResults.map((r) => ({
          attempt_id: attempt.id,
          question_id: r.questionId,
          answer_id: r.selectedAnswerId,
          answer_text: r.answerText,
          grade: r.isOpenEnded ? null : r.isCorrect ? 1 : 0,
          is_correct: r.isCorrect,
          time_spent_seconds: r.timeSpent,
        })),
      );
      if (rErr) toast.error(rErr.message);
    }

    setScore({ correct, total, percent, passed, pendingReview });
    setStage("done");
    void exitFullscreen();
    setSubmitting(false);
    if (passed) onComplete();

    // Issue certificate when final exam is passed
    if (block.block_type === "final_exam" && passed && profile) {
      // Upsert: only one certificate per user/course (UNIQUE constraint)
      const { data: existing } = await supabase
        .from("certificates")
        .select("serial, issued_at")
        .eq("user_id", user.id)
        .eq("course_id", courseId)
        .maybeSingle();

      if (existing) {
        setCertificate(existing as { serial: string; issued_at: string });
      } else {
        const { data: cert, error: cErr } = await supabase
          .from("certificates")
          .insert({
            user_id: user.id,
            course_id: courseId,
            full_name: profile.full_name,
            course_title: course.title,
            score_percent: percent,
          })
          .select("serial, issued_at")
          .single();
        if (cErr) {
          toast.error(cErr.message);
        } else if (cert) {
          setCertificate(cert as { serial: string; issued_at: string });
          toast.success(t.cert.issuedToast);
        }
      }
    }
  };

  // Per-question countdown (sual üzrə vaxt; bitəndə sual bloklanır və növbətiyə keçir)
  const advanceRef = useRef(recordAndAdvance);
  advanceRef.current = recordAndAdvance;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    if (stage !== "running") return;
    setSecsLeft(currentLimit);
    setLocked(false);
  }, [stage, idx, currentLimit]);

  useEffect(() => {
    if (stage !== "running" || secsLeft === null) return;
    if (secsLeft <= 0) {
      setLocked(true);
      const to = window.setTimeout(() => advanceRef.current(selectedRef.current), 900);
      return () => window.clearTimeout(to);
    }
    const id = window.setTimeout(() => setSecsLeft((s) => (s === null ? s : s - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [stage, secsLeft]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (blockReason) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="p-6 space-y-3 border-destructive">
          <h2 className="font-display text-xl font-bold text-destructive">İmtahan bloklandı</h2>
          <p className="text-sm font-medium">Səbəb: {blockReason}</p>
          <p className="text-sm text-muted-foreground">{EXAM_BLOCKED_MSG}</p>
        </Card>
      </div>
    );
  }

  if (stage === "intro") {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div
            className={cn(
              "h-12 w-12 rounded-xl flex items-center justify-center",
              meta[block.block_type].tone,
            )}
          >
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {meta[block.block_type].label}
            </div>
            <h1 className="font-display text-2xl font-bold leading-tight">{block.title}</h1>
          </div>
        </div>
        {block.description && <p className="text-muted-foreground mb-6">{block.description}</p>}

        <Card className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Stat label={t.common.questions} value={String(questions.length)} />
            {timePer && (
              <Stat label={t.common.timePerQuestion} value={`${timePer}s`} icon={Clock} />
            )}
            {block.block_type === "final_exam" && (
              <Stat label={t.common.passScore} value={`${passingScore}%`} icon={Trophy} />
            )}
          </div>
          <Button
            size="lg"
            className="w-full"
            onClick={startAttempt}
            disabled={questions.length === 0}
          >
            <Play className="h-4 w-4 mr-2" />
            {questions.length === 0
              ? t.courses.noQuestionsYet
              : `${t.common.start} ${meta[block.block_type].label}`}
          </Button>
        </Card>
      </div>
    );
  }

  if (stage === "running") {
    const q = questions[idx];
    if (!q) return null;
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4 text-sm">
          <span className="text-muted-foreground">
            {t.common.questionOf} {idx + 1} {t.common.of} {questions.length}
          </span>
          {secsLeft !== null && (
            <span
              className={cn(
                "inline-flex items-center gap-1 font-semibold tabular-nums",
                secsLeft <= 5 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              {Math.floor(Math.max(0, secsLeft) / 60)}:
              {String(Math.max(0, secsLeft) % 60).padStart(2, "0")}
            </span>
          )}
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted mb-6 overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(idx / questions.length) * 100}%` }}
          />
        </div>

        <Card className="p-6 space-y-5">
          <h2 className="font-display text-xl font-semibold leading-snug">{q.text}</h2>
          {locked && (
            <p className="text-sm text-destructive">
              Vaxt bitdi — bu sual bağlandı, növbəti suala keçilir.
            </p>
          )}
          {q.is_open_ended ? (
            <Textarea
              rows={7}
              disabled={locked}
              placeholder="Cavabınızı buraya yazın…"
              value={openText}
              onChange={(e) => setOpenText(e.target.value)}
            />
          ) : (
            <div className="space-y-2">
              {q.answers.map((a) => {
                const isSel = selected === a.id;
                return (
                  <button
                    key={a.id}
                    disabled={locked}
                    onClick={() => setSelected(a.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-lg border-2 transition-all",
                      isSel
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40",
                      locked && "opacity-60 pointer-events-none",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 rounded-full border-2 mr-3 align-middle",
                        isSel ? "border-primary bg-primary" : "border-muted-foreground/40",
                      )}
                    />
                    {a.text}
                  </button>
                );
              })}
            </div>
          )}
          <Button
            size="lg"
            className="w-full"
            disabled={(q.is_open_ended ? !openText.trim() : !selected) || submitting || locked}
            onClick={() => recordAndAdvance(selected, openText)}
          >
            {idx + 1 === questions.length ? t.common.finish : t.common.nextQuestion}
          </Button>
        </Card>
      </div>
    );
  }

  // done
  if (!score) return null;
  return (
    <div className="max-w-xl mx-auto text-center">
      <div
        className={cn(
          "h-20 w-20 rounded-full mx-auto mb-6 flex items-center justify-center",
          score.pendingReview
            ? "bg-amber-500/15 text-amber-500"
            : score.passed
              ? "bg-success/15 text-success"
              : "bg-destructive/15 text-destructive",
        )}
      >
        {score.pendingReview ? (
          <Clock className="h-10 w-10" />
        ) : score.passed ? (
          <CheckCircle2 className="h-10 w-10" />
        ) : (
          <XCircle className="h-10 w-10" />
        )}
      </div>
      <h1 className="font-display text-3xl font-bold mb-2">
        {score.pendingReview
          ? "Cavablarınız qəbul edildi"
          : block.block_type === "final_exam"
            ? score.passed
              ? t.common.congrats
              : t.common.notQuiteThere
            : t.common.attemptComplete}
      </h1>
      {score.pendingReview && (
        <p className="text-muted-foreground mb-6">
          Açıq tipli suallar admin tərəfindən yoxlanıldıqdan sonra yekun nəticə hesablanacaq.
        </p>
      )}
      <p className="text-muted-foreground mb-6">
        {score.correct} / {score.total} {t.common.correct}
      </p>
      <Card className="p-6 mb-6">
        <div className="text-5xl font-display font-bold mb-1">{score.percent}%</div>
        <div className="text-sm text-muted-foreground">
          {block.block_type === "final_exam" ? `${t.common.passScore}: ${passingScore}%` : "Bal"}
        </div>
      </Card>

      {certificate && profile && (
        <Card className="p-5 mb-6 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Award className="h-5 w-5" />
            </div>
            <div className="text-left">
              <div className="font-display font-semibold">{t.cert.title}</div>
              <div className="text-xs text-muted-foreground">
                {t.cert.serial}: {certificate.serial}
              </div>
            </div>
          </div>
          <Button
            className="w-full"
            onClick={() =>
              downloadCertificateSmart(
                {
                  fullName: profile.full_name,
                  courseTitle: course.title,
                  scorePercent: score.percent,
                  serial: certificate.serial,
                  issuedAt: certificate.issued_at,
                },
                course.certificate_template_url,
              )
            }
          >
            <Award className="h-4 w-4 mr-2" /> {t.cert.download}
          </Button>
        </Card>
      )}

      <div className="flex gap-3 justify-center">
        <Button
          variant="outline"
          onClick={() => {
            setStage("intro");
            setScore(null);
          }}
        >
          Yenidən cəhd et
        </Button>
        {block.block_type === "final_exam" ? (
          <Button asChild>
            <Link to="/courses">{t.commonExtras.showAllCourses}</Link>
          </Button>
        ) : nextBlockId ? (
          <Button onClick={() => onGoNext(nextBlockId)}>{t.commonExtras.continue}</Button>
        ) : (
          <Button asChild>
            <Link to="/courses">{t.commonExtras.showAllCourses}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof BookOpen;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </div>
      <div className="font-display text-lg font-semibold">{value}</div>
    </div>
  );
}
