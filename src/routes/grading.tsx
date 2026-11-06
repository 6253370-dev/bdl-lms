import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ClipboardCheck, CheckCircle2, Loader2, ChevronLeft, ChevronRight, X } from "lucide-react";
import { StatCard } from "@/components/design/StatCard";
import { PillTabsList, PillTabsTrigger } from "@/components/design/PillTabs";
import { PageHeader } from "@/components/design/PageHeader";
import { StatusChip } from "@/components/design/StatusChip";
import { UserAvatar } from "@/components/design/UserAvatar";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { azDateLong, azTime } from "@/lib/az-date";

export const Route = createFileRoute("/grading")({
  head: () => ({
    meta: [
      { title: "İmtahan yoxlaması — Baku Digital Lab" },
      { name: "description", content: "Açıq tipli sualların admin tərəfindən qiymətləndirilməsi və yekun nəticənin hesablanması." },
      { property: "og:title", content: "İmtahan yoxlaması — Baku Digital Lab" },
      { property: "og:description", content: "Açıq tipli sualları yoxlayın və nəticələri hesablayın." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GradingPage,
});

type Source = "exam" | "course";

interface PendingAttempt {
  id: string;
  source: Source;
  title: string;
  userName: string;
  totalQuestions: number;
  createdAt: string;
  needsReview: boolean;
  scorePercent: number;
  passingScore: number;
  userId: string;
  courseId?: string | null;
  blockId?: string | null;
  blockType?: string | null;
  courseTitle?: string | null;
}


interface OpenResponse {
  id: string;
  questionText: string;
  answerText: string | null;
  grade: number | null;
}

const GRADES = [0, 0.25, 0.5, 0.75, 1];

function GradingPage() {
  return (
    <ProtectedRoute requireAdmin>
      <GradingInner />
    </ProtectedRoute>
  );
}

function GradingInner() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingAttempt[]>([]);
  const [done, setDone] = useState<PendingAttempt[]>([]);
  const [active, setActive] = useState<PendingAttempt | null>(null);
  const [tab, setTab] = useState<"pending" | "done">("pending");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: names }, { data: examAttempts }, { data: blockAttempts }] = await Promise.all([
      supabase.from("profiles").select("id,full_name"),
      supabase
        .from("standalone_exam_attempts")
        .select("id,user_id,total_questions,created_at,needs_review,score_percent,exam_id,standalone_exams(title,passing_score)")
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("block_attempts")
        .select("id,user_id,total_questions,created_at,needs_review,score_percent,block_id,course_id,course_blocks(title,passing_score,block_type),courses(title,passing_score)")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

    const nameMap = new Map((names ?? []).map((p) => [p.id, p.full_name]));

    const rows: PendingAttempt[] = [];
    for (const a of (examAttempts ?? []) as any[]) {
      rows.push({
        id: a.id,
        source: "exam",
        title: a.standalone_exams?.title ?? "İmtahan",
        userName: nameMap.get(a.user_id) ?? "—",
        userId: a.user_id,
        totalQuestions: a.total_questions,
        createdAt: a.created_at,
        needsReview: !!a.needs_review,
        scorePercent: Number(a.score_percent),
        passingScore: a.standalone_exams?.passing_score ?? 60,
      });
    }
    for (const a of (blockAttempts ?? []) as any[]) {
      rows.push({
        id: a.id,
        source: "course",
        title: `${a.courses?.title ?? "Kurs"} · ${a.course_blocks?.title ?? "Qiymətləndirmə"}`,
        userName: nameMap.get(a.user_id) ?? "—",
        userId: a.user_id,
        courseId: a.course_id,
        blockId: a.block_id,
        blockType: a.course_blocks?.block_type ?? null,
        courseTitle: a.courses?.title ?? null,
        totalQuestions: a.total_questions,
        createdAt: a.created_at,
        needsReview: !!a.needs_review,
        scorePercent: Number(a.score_percent),
        passingScore: a.course_blocks?.passing_score ?? a.courses?.passing_score ?? 60,
      });
    }


    setPending(rows.filter((r) => r.needsReview));
    setDone(rows.filter((r) => !r.needsReview).slice(0, 50));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const queue = tab === "pending" ? pending : done;

  return (
    <div className="bento-page space-y-6">
      <PageHeader
        title="İmtahan yoxlaması"
        description="Açıq tipli sualları qiymətləndirin (0–1). Yekun nəticə verdiyiniz qiymətlər əsasında hesablanır."
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard
          icon={ClipboardCheck}
          label="Yoxlama gözləyir"
          value={pending.length}
          tone="warning"
        />
        <StatCard
          icon={CheckCircle2}
          label="Son yoxlanılan nəticələr"
          value={done.length}
          tone="success"
        />
      </div>

      <div className={cn("grid items-start gap-5", active && "lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)_320px]")}>
        <section aria-label="Yoxlanılacaq işlər" className={cn("min-w-0 rounded-2xl border border-border bg-card shadow-card", active && "lg:row-span-2 2xl:row-span-1")}>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "pending" | "done")} className="p-4 pb-2">
            <PillTabsList aria-label="Yoxlama statusu">
              <PillTabsTrigger value="pending" count={pending.length}>
                Gözləyən
              </PillTabsTrigger>
              <PillTabsTrigger value="done">Yoxlanılmış</PillTabsTrigger>
            </PillTabsList>
          </Tabs>
          <AttemptList
            loading={loading}
            rows={queue}
            activeId={active ? `${active.source}-${active.id}` : null}
            onOpen={setActive}
            emptyText={tab === "pending" ? "Yoxlanılası imtahan yoxdur." : "Hələ nəticə yoxdur."}
          />
        </section>

        {active && (
          <GradePanel
            key={`${active.source}-${active.id}`}
            attempt={active}
            position={queue.findIndex((r) => r.id === active.id && r.source === active.source)}
            queueLength={queue.length}
            onNavigate={(dir) => {
              const i = queue.findIndex((r) => r.id === active.id && r.source === active.source);
              const next = queue[i + dir];
              if (next) setActive(next);
            }}
            graderId={user?.id ?? null}
            onClose={() => setActive(null)}
            onSaved={() => { setActive(null); void load(); }}
          />
        )}
      </div>
    </div>
  );
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${azDateLong(d)}, ${azTime(d)}`;
}

function AttemptList({
  loading, rows, activeId, onOpen, emptyText,
}: {
  loading: boolean; rows: PendingAttempt[]; activeId: string | null;
  onOpen: (a: PendingAttempt) => void; emptyText: string;
}) {
  if (loading) return <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>;
  if (!rows.length) return <p className="px-5 pb-5 pt-2 text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => {
        const key = `${r.source}-${r.id}`;
        const isActive = key === activeId;
        return (
          <li key={key}>
            <button
              type="button"
              onClick={() => onOpen(r)}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring/25",
                isActive ? "bg-brand-50 dark:bg-brand-600/15" : "hover:bg-muted/50",
              )}
            >
              <UserAvatar name={r.userName} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium break-words">{r.userName}</span>
                <span className="block text-sm text-muted-foreground break-words">{r.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Göndərilib: {fmtDateTime(r.createdAt)} · {r.totalQuestions} sual
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                {r.needsReview ? (
                  <StatusChip tone="warning">Yoxlanılmayıb</StatusChip>
                ) : (
                  <StatusChip tone="gray">{r.scorePercent}%</StatusChip>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function GradePanel({
  attempt, position, queueLength, onNavigate, graderId, onClose, onSaved,
}: {
  attempt: PendingAttempt;
  position: number;
  queueLength: number;
  onNavigate: (dir: -1 | 1) => void;
  graderId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<OpenResponse[]>([]);
  const [grades, setGrades] = useState<Record<string, number>>({});
  const [autoCorrect, setAutoCorrect] = useState(0);
  const [qIndex, setQIndex] = useState(0);

  const respTable = attempt.source === "exam" ? "standalone_exam_responses" : "attempt_responses";
  const qTable = attempt.source === "exam" ? "standalone_exam_questions" : "questions";

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: resp } = await supabase
        .from(respTable as any)
        .select("id,question_id,answer_text,grade,is_correct")
        .eq("attempt_id", attempt.id);
      const list = (resp ?? []) as any[];
      const qIds = list.map((r) => r.question_id);
      const { data: qs } = qIds.length
        ? await supabase.from(qTable as any).select("id,text,is_open_ended").in("id", qIds)
        : { data: [] as any[] };
      const qMap = new Map((qs ?? []).map((q: any) => [q.id, q]));

      const open: OpenResponse[] = [];
      let closedCorrect = 0;
      for (const r of list) {
        const q = qMap.get(r.question_id);
        if (q?.is_open_ended) {
          open.push({
            id: r.id,
            questionText: q.text,
            answerText: r.answer_text,
            grade: r.grade === null || r.grade === undefined ? null : Number(r.grade),
          });
        } else if (r.is_correct) {
          closedCorrect++;
        }
      }
      setRows(open);
      setGrades(Object.fromEntries(open.map((o) => [o.id, o.grade ?? 0])));
      setAutoCorrect(closedCorrect);
      setQIndex(0);
      setLoading(false);
    })();
  }, [attempt.id, respTable, qTable]);

  const openSum = rows.reduce((s, r) => s + (grades[r.id] ?? 0), 0);
  const total = attempt.totalQuestions || (rows.length + autoCorrect) || 1;
  const percent = Math.round(((autoCorrect + openSum) / total) * 1000) / 10;
  const passed = percent >= attempt.passingScore;
  const current = rows[qIndex];
  const currentGrade = current ? grades[current.id] ?? 0 : 0;
  const setCurrentGrade = (g: number) => current && setGrades((s) => ({ ...s, [current.id]: g }));

  const save = async () => {
    setSaving(true);
    for (const r of rows) {
      const g = grades[r.id] ?? 0;
      const { error } = await supabase
        .from(respTable as any)
        .update({ grade: g, is_correct: g >= 0.5, graded_by: graderId, graded_at: new Date().toISOString() })
        .eq("id", r.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
    }
    const attemptsTable = attempt.source === "exam" ? "standalone_exam_attempts" : "block_attempts";
    const { error: aErr } = await supabase
      .from(attemptsTable as any)
      .update({
        score_percent: percent,
        correct_count: Math.round(autoCorrect + openSum),
        passed,
        needs_review: false,
      })
      .eq("id", attempt.id);
    if (aErr) { setSaving(false); toast.error(aErr.message); return; }

    // Kurs imtahanı: proqresi yenilə və lazım gəldikdə sertifikat ver
    if (attempt.source === "course" && passed && attempt.courseId && attempt.blockId) {
      const { error: pErr } = await supabase
        .from("block_progress")
        .upsert(
          {
            user_id: attempt.userId,
            course_id: attempt.courseId,
            block_id: attempt.blockId,
            completed: true,
            completed_at: new Date().toISOString(),
          },
          { onConflict: "user_id,block_id" },
        );
      if (pErr) toast.error(pErr.message);

      if (attempt.blockType === "final_exam") {
        const { data: existing } = await supabase
          .from("certificates")
          .select("id")
          .eq("user_id", attempt.userId)
          .eq("course_id", attempt.courseId)
          .maybeSingle();
        if (!existing) {
          const { error: cErr } = await supabase.from("certificates").insert({
            user_id: attempt.userId,
            course_id: attempt.courseId,
            full_name: attempt.userName,
            course_title: attempt.courseTitle ?? "Kurs",
            score_percent: percent,
          });
          if (cErr) toast.error(cErr.message);
          else toast.success("Sertifikat verildi");
        }
      }
    }

    setSaving(false);
    toast.success("Nəticə hesablandı");
    onSaved();

  };

  return (
    <>
      {/* Orta sütun: cavab */}
      <section aria-label="Tələbənin cavabı" className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <UserAvatar name={attempt.userName} size="md" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display font-semibold break-words">{attempt.userName}</h2>
            <p className="text-sm text-muted-foreground break-words">{attempt.title}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Əvvəlki iş" disabled={position <= 0} onClick={() => onNavigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">{position + 1} / {queueLength}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Növbəti iş" disabled={position >= queueLength - 1} onClick={() => onNavigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Bağla" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
        ) : rows.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">Bu cəhddə açıq tipli sual yoxdur.</p>
        ) : current && (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl bg-muted/50 p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">Sual {qIndex + 1}</span>
                <span className="flex gap-1.5">
                  <StatusChip tone="gray">Açıq cavab</StatusChip>
                  <StatusChip tone="gray">1 bal</StatusChip>
                </span>
              </div>
              <p className="font-medium break-words">{current.questionText}</p>
            </div>
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">Tələbənin cavabı</h3>
                <span className="text-xs text-muted-foreground">Göndərilib: {fmtDateTime(attempt.createdAt)}</span>
              </div>
              <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-border p-4 text-sm leading-relaxed">
                {current.answerText ?? "(cavab yazılmayıb)"}
              </div>
            </div>
            {rows.length > 1 && (
              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" size="sm" disabled={qIndex === 0} onClick={() => setQIndex((i) => i - 1)}>
                  <ChevronLeft className="h-4 w-4" /> Əvvəlki sual
                </Button>
                <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">{qIndex + 1} / {rows.length}</span>
                <Button variant="outline" size="sm" disabled={qIndex >= rows.length - 1} onClick={() => setQIndex((i) => i + 1)}>
                  Növbəti sual <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Sağ sütun: qiymətləndirmə */}
      <section aria-label="Qiymətləndirmə" className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="border-b border-border pb-3 font-display font-semibold">Qiymətləndirmə</h2>
        {current ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="grade-slider" className="font-semibold">Qiymət (1 bal)</Label>
              <span className="font-display text-xl font-bold tabular-nums">{currentGrade.toFixed(2)}</span>
            </div>
            <Slider
              id="grade-slider"
              aria-label="Qiymət"
              min={0}
              max={1}
              step={0.25}
              value={[currentGrade]}
              onValueChange={(v) => setCurrentGrade(v[0] ?? 0)}
            />
            <div className="grid grid-cols-5 gap-1.5">
              {GRADES.map((g) => (
                <Button
                  key={g}
                  size="sm"
                  className="px-0 tabular-nums"
                  aria-pressed={currentGrade === g}
                  variant={currentGrade === g ? "default" : "outline"}
                  onClick={() => setCurrentGrade(g)}
                >
                  {g === 0 || g === 1 ? g.toFixed(0) : String(g)}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Qiymətləndiriləsi açıq sual yoxdur.</p>
        )}

        <dl className="mt-5 space-y-1.5 rounded-xl bg-muted/50 p-4 text-sm">
          <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Test sualları üzrə doğru</dt><dd className="font-semibold tabular-nums">{autoCorrect}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Açıq suallar üzrə bal</dt><dd className="font-semibold tabular-nums">{openSum.toFixed(2)}</dd></div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Yekun nəticə</dt>
            <dd className="flex items-center gap-2 font-semibold tabular-nums">
              {percent}%
              <StatusChip tone={passed ? "success" : "error"}>{passed ? "Keçib" : "Keçməyib"}</StatusChip>
            </dd>
          </div>
        </dl>

        <Button className="mt-5 w-full" onClick={save} disabled={saving || loading || rows.length === 0}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Nəticəni yadda saxla
        </Button>
      </section>
    </>
  );
}
