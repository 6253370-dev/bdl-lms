import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, BookOpen, Dumbbell, FileQuestion, GraduationCap,
  Loader2, CheckCircle2, XCircle, Play, Trophy, Clock, FileText, Video, Award,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { LessonComments } from "@/components/LessonComments";
import { downloadCertificateSmart } from "@/lib/certificate";

export const Route = createFileRoute("/courses/$courseId/play")({
  component: () => (
    <ProtectedRoute>
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
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: c }, { data: b }] = await Promise.all([
      supabase.from("courses").select("id,title,description,passing_score,certificate_template_url").eq("id", courseId).single(),
      supabase.from("course_blocks").select("*").eq("course_id", courseId).order("position"),
    ]);
    setCourse(c as Course);
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
        .eq("course_id", courseId);
      done = new Set((prog ?? []).map((p) => p.block_id));
      setCompleted(done);
    }
    // Davam ediləcək ilk tamamlanmamış dərs
    const firstOpen = list.find((x) => !done.has(x.id)) ?? list[list.length - 1];
    setActiveId(firstOpen?.id ?? null);
    setLoading(false);
  }, [courseId, user?.id]);

  useEffect(() => { load(); }, [load]);

  const markComplete = useCallback(async (blockId: string) => {
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
  }, [user?.id, courseId]);


  // Record course view for "recently viewed" dashboard
  useEffect(() => {
    if (!user?.id || !courseId) return;
    supabase.from("course_views").insert({ user_id: user.id, course_id: courseId }).then(() => {});
  }, [user?.id, courseId]);

  if (loading) {
    return <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!course) return null;

  const active = blocks.find((b) => b.id === activeId) ?? null;

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-3.5rem)]">
      {/* Sidebar */}
      <aside className="order-2 lg:order-1 lg:w-80 lg:border-r bg-background/50 lg:flex lg:flex-col lg:h-[calc(100vh-3.5rem)] lg:sticky lg:top-0">
        <div className="p-5 border-b shrink-0">
          <button
            onClick={() => navigate({ to: "/courses" })}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {t.player.allCourses}
          </button>
          <h2 className="font-display font-bold text-lg leading-tight">{course.title}</h2>
          {course.description && <p className="text-xs text-muted-foreground mt-1">{course.description}</p>}
        </div>
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            {blocks.length === 0 && (
              <div className="text-sm text-muted-foreground p-4 text-center">{t.player.noContent}</div>
            )}
            {blocks.map((b, i) => {
              const Icon = meta[b.block_type].icon;
              const isActive = b.id === activeId;
              const isDone = completed.has(b.id);
              const unlocked = i === 0 || isDone || completed.has(blocks[i - 1].id);
              return (
                <button
                  key={b.id}
                  onClick={() => unlocked && setActiveId(b.id)}
                  disabled={!unlocked}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors",
                    isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                    !unlocked && "opacity-50 cursor-not-allowed hover:bg-transparent",
                  )}
                >
                  <div className={cn("h-7 w-7 rounded-md flex items-center justify-center shrink-0",
                    isActive ? "bg-primary-foreground/15" : meta[b.block_type].tone)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn("text-[10px] uppercase tracking-wider",
                      isActive ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {String(i + 1).padStart(2, "0")} · {meta[b.block_type].label}
                    </div>
                    <div className="font-medium truncate">{b.title}</div>
                  </div>
                  {isDone ? (
                    <CheckCircle2 className={cn("h-5 w-5 shrink-0", isActive ? "text-primary-foreground" : "text-success")} />
                  ) : !unlocked ? (
                    <Lock className={cn("h-4 w-4 shrink-0", isActive ? "text-primary-foreground/70" : "text-muted-foreground")} />
                  ) : (
                    <Circle className={cn("h-5 w-5 shrink-0", isActive ? "text-primary-foreground/70" : "text-muted-foreground/50")} />
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </aside>

      {/* Content */}
      <section className="order-1 lg:order-2 flex-1 p-6 lg:p-10 max-w-5xl mx-auto w-full">
        {!active ? (
          <Card className="p-12 text-center border-dashed">
            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">{t.player.noContent}</p>
          </Card>
        ) : active.block_type === "lesson" ? (
          <LessonView
            key={active.id}
            block={active}
            onComplete={() => markComplete(active.id)}
            nextBlockId={(() => {
              const i = blocks.findIndex((b) => b.id === active.id);
              return i >= 0 && i < blocks.length - 1 ? blocks[i + 1].id : null;
            })()}
            onGoNext={(id) => setActiveId(id)}
          />
        ) : (
          <AssessmentView
            key={active.id}
            block={active}
            course={course}
            onComplete={() => markComplete(active.id)}
            nextBlockId={(() => {
              const i = blocks.findIndex((b) => b.id === active.id);
              return i >= 0 && i < blocks.length - 1 ? blocks[i + 1].id : null;
            })()}
            onGoNext={(id) => setActiveId(id)}
          />
        )}

      </section>
    </div>
  );
}

function LessonView({ block, nextBlockId, onGoNext }: { block: Block; nextBlockId: string | null; onGoNext: (id: string) => void }) {
  const navigate = useNavigate();
  const required = block.min_view_seconds ?? 0;
  const [elapsed, setElapsed] = useState(0);
  const unlocked = required <= 0 || elapsed >= required;

  useEffect(() => {
    setElapsed(0);
    if (!block.min_view_seconds) return;
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [block.id, block.min_view_seconds]);

  const remaining = Math.max(0, required - elapsed);

  return (
    <div className="space-y-6">
      <LessonContent block={block} />

      <Card className="p-5 space-y-3">
        {required > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {unlocked
                  ? "Minimum baxış vaxtı tamamlandı"
                  : `Davam etmək üçün daha ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")} qalıb`}
              </span>
              <span className="font-semibold">{Math.min(100, Math.round((elapsed / required) * 100))}%</span>
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
          className="w-full"
          size="lg"
          disabled={!unlocked}
          onClick={() => (nextBlockId ? onGoNext(nextBlockId) : navigate({ to: "/courses" }))}
        >
          {unlocked ? null : <Clock className="h-4 w-4 mr-2" />}
          {nextBlockId ? "Davam et" : t.player.allCourses}
        </Button>
      </Card>

      <LessonComments blockId={block.id} courseId={block.course_id} />
    </div>
  );
}


function LessonContent({ block, onProgress }: { block: Block; onProgress?: (ratio: number) => void }) {
  const seen = useRef<Set<number>>(new Set());
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration || !isFinite(v.duration)) return;
    seen.current.add(Math.floor(v.currentTime));
    onProgress?.(Math.min(1, seen.current.size / Math.floor(v.duration)));
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{t.player.lesson}</div>
        <h1 className="font-display text-3xl font-bold">{block.title}</h1>
        {block.description && <p className="text-muted-foreground mt-2">{block.description}</p>}
      </div>

      {block.external_video_url && (
        <Card className="overflow-hidden aspect-video">
          <iframe
            src={toEmbedUrl(block.external_video_url)}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={block.title}
          />
        </Card>
      )}

      {block.video_url && (
        <Card className="overflow-hidden">
          <video
            ref={videoRef}
            src={block.video_url}
            controls
            className="w-full"
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => onProgress?.(1)}
          />
        </Card>
      )}

      {block.pdf_url && (
        <Card className="overflow-hidden h-[70vh]">
          <iframe src={block.pdf_url} className="w-full h-full" title={`${block.title} PDF`} />
        </Card>
      )}

      {block.pptx_url && (
        <Card className="overflow-hidden h-[70vh]">
          <iframe
            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(block.pptx_url)}`}
            className="w-full h-full"
            title={`${block.title} PPTX`}
          />
        </Card>
      )}

      {block.docx_url && (
        <Card className="overflow-hidden h-[70vh]">
          <iframe
            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(block.docx_url)}`}
            className="w-full h-full"
            title={`${block.title} DOCX`}
          />
        </Card>
      )}

      {!block.external_video_url && !block.video_url && !block.pdf_url && !block.pptx_url && !block.docx_url && (
        <Card className="p-12 text-center border-dashed">
          <Video className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t.courses.noMedia}</p>
        </Card>
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
  } catch { return url; }
}

interface Question {
  id: string;
  text: string;
  position: number;
  time_limit_seconds: number | null;
  answers: { id: string; text: string; is_correct: boolean; position: number }[];
}

interface ResultRow {
  questionId: string;
  selectedAnswerId: string | null;
  isCorrect: boolean;
  timeSpent: number;
}

function AssessmentView({ block, course, nextBlockId, onGoNext }: { block: Block; course: Course; nextBlockId: string | null; onGoNext: (id: string) => void }) {
  const { user, profile } = useAuth();
  const courseId = course.id;
  const coursePassingScore = course.passing_score;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<"intro" | "running" | "done">("intro");
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [questionStart, setQuestionStart] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState<{ correct: number; total: number; percent: number; passed: boolean } | null>(null);
  const [certificate, setCertificate] = useState<{ serial: string; issued_at: string } | null>(null);
  const [secsLeft, setSecsLeft] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);

  const passingScore = block.block_type === "final_exam" ? (block.passing_score ?? coursePassingScore) : 0;
  const timePer = block.time_limit_seconds ?? null;
  const currentLimit = questions[idx]?.time_limit_seconds ?? timePer ?? null;
  const Icon = meta[block.block_type].icon;

  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true);
      const { data: qs } = await supabase
        .from("questions").select("id,text,position,time_limit_seconds").eq("block_id", block.id).order("position");
      const ids = (qs ?? []).map((q) => q.id);
      const { data: ans } = ids.length
        ? await supabase.from("answers").select("id,text,is_correct,position,question_id").in("question_id", ids).order("position")
        : { data: [] };
      if (canceled) return;
      setQuestions((qs ?? []).map((q) => ({
        ...q,
        answers: (ans ?? []).filter((a: { question_id: string }) => a.question_id === q.id) as Question["answers"],
      })));
      setLoading(false);
    })();
    return () => { canceled = true; };
  }, [block.id]);

  const startAttempt = () => {
    if (questions.length === 0) {
      toast.error("Bu qiymətləndirmədə hələ sual yoxdur");
      return;
    }
    setIdx(0);
    setResults([]);
    setSelected(null);
    setQuestionStart(Date.now());
    setStage("running");
  };

  const recordAndAdvance = useCallback((answerId: string | null) => {
    const q = questions[idx];
    if (!q) return;
    const correctAnswer = q.answers.find((a) => a.is_correct);
    const isCorrect = !!answerId && answerId === correctAnswer?.id;
    const timeSpent = Math.round((Date.now() - questionStart) / 1000);
    const next = [...results, { questionId: q.id, selectedAnswerId: answerId, isCorrect, timeSpent }];
    setResults(next);
    setSelected(null);
    if (idx + 1 >= questions.length) {
      void finalize(next);
    } else {
      setIdx(idx + 1);
      setQuestionStart(Date.now());
    }
  }, [idx, questions, questionStart, results]); // eslint-disable-line react-hooks/exhaustive-deps

  const finalize = async (allResults: ResultRow[]) => {
    if (!user) { toast.error(t.common.notSignedIn); return; }
    setSubmitting(true);
    const correct = allResults.filter((r) => r.isCorrect).length;
    const total = allResults.length;
    const percent = total ? Math.round((correct / total) * 1000) / 10 : 0;
    const passed = block.block_type === "final_exam" ? percent >= passingScore : true;
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
      })
      .select().single();

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
          is_correct: r.isCorrect,
          time_spent_seconds: r.timeSpent,
        })),
      );
      if (rErr) toast.error(rErr.message);
    }

    setScore({ correct, total, percent, passed });
    setStage("done");
    setSubmitting(false);

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
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (stage === "intro") {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center", meta[block.block_type].tone)}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{meta[block.block_type].label}</div>
            <h1 className="font-display text-2xl font-bold leading-tight">{block.title}</h1>
          </div>
        </div>
        {block.description && <p className="text-muted-foreground mb-6">{block.description}</p>}

        <Card className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Stat label={t.common.questions} value={String(questions.length)} />
            {timePer && <Stat label={t.common.timePerQuestion} value={`${timePer}s`} icon={Clock} />}
            {block.block_type === "final_exam" && (
              <Stat label={t.common.passScore} value={`${passingScore}%`} icon={Trophy} />
            )}
          </div>
          <Button size="lg" className="w-full" onClick={startAttempt} disabled={questions.length === 0}>
            <Play className="h-4 w-4 mr-2" />
            {questions.length === 0 ? t.courses.noQuestionsYet : `${t.common.start} ${meta[block.block_type].label}`}
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
          <span className="text-muted-foreground">{t.common.questionOf} {idx + 1} {t.common.of} {questions.length}</span>
          {secsLeft !== null && (
            <span className={cn(
              "inline-flex items-center gap-1 font-semibold tabular-nums",
              secsLeft <= 5 ? "text-destructive" : "text-muted-foreground",
            )}>
              <Clock className="h-3.5 w-3.5" />
              {Math.floor(Math.max(0, secsLeft) / 60)}:{String(Math.max(0, secsLeft) % 60).padStart(2, "0")}
            </span>
          )}
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted mb-6 overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${((idx) / questions.length) * 100}%` }} />
        </div>

        <Card className="p-6 space-y-5">
          <h2 className="font-display text-xl font-semibold leading-snug">{q.text}</h2>
          {locked && (
            <p className="text-sm text-destructive">Vaxt bitdi — bu sual bağlandı, növbəti suala keçilir.</p>
          )}
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
                    isSel ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                    locked && "opacity-60 pointer-events-none",
                  )}
                >
                  <span className={cn("inline-block h-4 w-4 rounded-full border-2 mr-3 align-middle",
                    isSel ? "border-primary bg-primary" : "border-muted-foreground/40")} />
                  {a.text}
                </button>
              );
            })}
          </div>
          <Button
            size="lg"
            className="w-full"
            disabled={!selected || submitting || locked}
            onClick={() => recordAndAdvance(selected)}
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
      <div className={cn("h-20 w-20 rounded-full mx-auto mb-6 flex items-center justify-center",
        score.passed ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
        {score.passed ? <CheckCircle2 className="h-10 w-10" /> : <XCircle className="h-10 w-10" />}
      </div>
      <h1 className="font-display text-3xl font-bold mb-2">
        {block.block_type === "final_exam"
          ? score.passed ? t.common.congrats : t.common.notQuiteThere
          : t.common.attemptComplete}
      </h1>
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
              <div className="text-xs text-muted-foreground">{t.cert.serial}: {certificate.serial}</div>
            </div>
          </div>
          <Button
            className="w-full"
            onClick={() => downloadCertificateSmart({
              fullName: profile.full_name,
              courseTitle: course.title,
              scorePercent: score.percent,
              serial: certificate.serial,
              issuedAt: certificate.issued_at,
            }, course.certificate_template_url)}
          >
            <Award className="h-4 w-4 mr-2" /> {t.cert.download}
          </Button>
        </Card>
      )}

      <div className="flex gap-3 justify-center">
        <Button variant="outline" onClick={() => { setStage("intro"); setScore(null); }}>
          Yenidən cəhd et
        </Button>
        {block.block_type === "final_exam" ? (
          <Button asChild>
            <Link to="/courses">{t.commonExtras.showAllCourses}</Link>
          </Button>
        ) : nextBlockId ? (
          <Button onClick={() => onGoNext(nextBlockId)}>
            {t.commonExtras.continue}
          </Button>
        ) : (
          <Button asChild>
            <Link to="/courses">{t.commonExtras.showAllCourses}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof BookOpen }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </div>
      <div className="font-display text-lg font-semibold">{value}</div>
    </div>
  );
}
