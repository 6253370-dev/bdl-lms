import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ClipboardCheck, CheckCircle2, Loader2 } from "lucide-react";
import { StatCard } from "@/components/design/StatCard";
import { PillTabsList, PillTabsTrigger } from "@/components/design/PillTabs";

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

const GRADES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

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

  return (
    <div className="bento-page space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <ClipboardCheck className="h-7 w-7 text-primary" /> İmtahan yoxlaması
        </h1>
        <p className="text-muted-foreground mt-1">
          Açıq tipli sualları qiymətləndirin (0–1). Yekun nəticə verdiyiniz qiymətlər əsasında hesablanır.
        </p>
      </div>

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
      <Tabs defaultValue="pending">
        <PillTabsList aria-label="Yoxlama statusu">
          <PillTabsTrigger value="pending" count={pending.length}>
            Gözləyən
          </PillTabsTrigger>
          <PillTabsTrigger value="done">Yoxlanılmış</PillTabsTrigger>
        </PillTabsList>
        <TabsContent value="pending" className="mt-4">
          <AttemptList loading={loading} rows={pending} onOpen={setActive} emptyText="Yoxlanılası imtahan yoxdur." />
        </TabsContent>
        <TabsContent value="done" className="mt-4">
          <AttemptList loading={loading} rows={done} onOpen={setActive} emptyText="Hələ nəticə yoxdur." />
        </TabsContent>
      </Tabs>

      {active && (
        <GradeDialog
          attempt={active}
          graderId={user?.id ?? null}
          onClose={() => setActive(null)}
          onSaved={() => { setActive(null); void load(); }}
        />
      )}
    </div>
  );
}

function AttemptList({
  loading, rows, onOpen, emptyText,
}: { loading: boolean; rows: PendingAttempt[]; onOpen: (a: PendingAttempt) => void; emptyText: string }) {
  if (loading) return <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>;
  if (!rows.length) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <div className="question-rows">
      {rows.map((r) => (
        <Card key={`${r.source}-${r.id}`} className="p-5 flex flex-wrap items-center justify-between gap-3 border-0 shadow-none">
          <div className="min-w-0">
            <div className="font-medium truncate">{r.title}</div>
            <div className="text-sm text-muted-foreground">
              {r.userName} · {new Date(r.createdAt).toLocaleString("az-AZ")} · {r.totalQuestions} sual
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={r.source === "exam" ? "secondary" : "outline"}>
              {r.source === "exam" ? "Müstəqil imtahan" : "Kurs"}
            </Badge>
            {r.needsReview ? (
              <Badge variant="destructive">Yoxlanılmayıb</Badge>
            ) : (
              <Badge variant="secondary">{r.scorePercent}%</Badge>
            )}
            <Button size="sm" onClick={() => onOpen(r)}>
              {r.needsReview ? "Yoxla" : "Bax"}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function GradeDialog({
  attempt, graderId, onClose, onSaved,
}: { attempt: PendingAttempt; graderId: string | null; onClose: () => void; onSaved: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<OpenResponse[]>([]);
  const [grades, setGrades] = useState<Record<string, number>>({});
  const [autoCorrect, setAutoCorrect] = useState(0);

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
      setLoading(false);
    })();
  }, [attempt.id, respTable, qTable]);

  const openSum = rows.reduce((s, r) => s + (grades[r.id] ?? 0), 0);
  const total = attempt.totalQuestions || (rows.length + autoCorrect) || 1;
  const percent = Math.round(((autoCorrect + openSum) / total) * 1000) / 10;
  const passed = percent >= attempt.passingScore;

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
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{attempt.title} — {attempt.userName}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bu cəhddə açıq tipli sual yoxdur.</p>
        ) : (
          <div className="space-y-4">
            {rows.map((r, i) => (
              <Card key={r.id} className="p-4 space-y-3">
                <div className="text-sm font-medium">S{i + 1}. {r.questionText}</div>
                <Textarea readOnly rows={4} value={r.answerText ?? "(cavab yazılmayıb)"} />
                <div className="space-y-1.5">
                  <Label className="text-xs">Qiymət: {(grades[r.id] ?? 0).toFixed(1)}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {GRADES.map((g) => (
                      <Button
                        key={g}
                        size="sm"
                        variant={(grades[r.id] ?? 0) === g ? "default" : "outline"}
                        onClick={() => setGrades((s) => ({ ...s, [r.id]: g }))}
                      >
                        {g.toFixed(1)}
                      </Button>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
            <Card className="p-4 text-sm space-y-1">
              <div>Test sualları üzrə doğru: <b>{autoCorrect}</b></div>
              <div>Açıq suallar üzrə bal: <b>{openSum.toFixed(1)}</b></div>
              <div>Yekun nəticə: <b>{percent}%</b> · {passed ? "Keçib" : "Keçməyib"}</div>
            </Card>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bağla</Button>
          <Button onClick={save} disabled={saving || loading || rows.length === 0}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Nəticəni yadda saxla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
