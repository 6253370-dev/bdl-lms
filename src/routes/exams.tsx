import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AttemptDetailDialog, type AttemptDetailRef } from "./reports";
import { useAuth } from "@/lib/auth";
import { useExamProctor, getExamBlock, enterFullscreen, exitFullscreen, EXAM_BLOCKED_MSG } from "@/hooks/use-exam-proctor";
import {
  ClipboardList,
  Plus,
  Lock,
  Play,
  Eye,
  EyeOff,
  Trash2,
  Pencil,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Loader2,
  ListChecks,
  Search,
  Image as ImageIcon,
  Library,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { FileUpload } from "@/components/FileUpload";
import { CertificateTemplateSelect } from "@/components/CertificateTemplateSelect";
import { BankPicker, type ImportedQuestion } from "@/components/BankPicker";
import { PageHeader } from "@/components/design/PageHeader";

export const Route = createFileRoute("/exams")({
  head: () => ({
    meta: [
      { title: "İmtahanlar — Learning Management System" },
      { name: "description", content: "Müstəqil imtahanlar, suallar və imtahan nəticələri." },
      { property: "og:title", content: "İmtahanlar — Learning Management System" },
      { property: "og:description", content: "Müstəqil imtahanlar, suallar və imtahan nəticələri." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    exam: typeof search['exam'] === "string" ? (search['exam'] as string) : undefined,
  }),
  component: () => (
    <ProtectedRoute>
      <ExamsPage />
    </ProtectedRoute>
  ),
});

type Exam = {
  id: string;
  title: string;
  description: string | null;
  time_limit_seconds: number | null;
  passing_score: number;
  is_published: boolean;
  created_at: string;
  cover_image_url: string | null;
  shuffle_questions: boolean;
  certificate_template_url: string | null;
  has_password: boolean;
};


type ExamQuestion = {
  id: string;
  exam_id: string;
  text: string;
  position: number;
  time_limit_seconds: number | null;
  is_open_ended: boolean;
  answers: { id: string; text: string; position: number; is_correct: boolean }[];
};

type Attempt = {
  id: string;
  exam_id: string;
  user_id: string;
  score_percent: number;
  correct_count: number;
  total_questions: number;
  duration_seconds: number;
  passed: boolean;
  created_at: string;
  profile?: { full_name: string; employee_id: string } | null;
};

function ExamsPage() {
  const { isAdmin } = useAuth();
  const { exam: examParam } = Route.useSearch();
  const [autoOpened, setAutoOpened] = useState(false);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [runnerExam, setRunnerExam] = useState<Exam | null>(null);
  const [resultsExam, setResultsExam] = useState<Exam | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("standalone_exams")
      .select("id,title,description,time_limit_seconds,passing_score,is_published,created_at,cover_image_url,shuffle_questions,certificate_template_url,has_password")
      .order("created_at", { ascending: false });
    setExams((data ?? []) as Exam[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (autoOpened || !examParam || exams.length === 0) return;
    const target = exams.find((e) => e.id === examParam);
    if (target) {
      setRunnerExam(target);
      setAutoOpened(true);
    }
  }, [examParam, exams, autoOpened]);

  const visibleExams = exams.filter((e) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      e.title.toLowerCase().includes(q) ||
      (e.description ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="bento-page">
      <PageHeader
        title="Müstəqil imtahanlar"
        description="Kurslardan asılı olmayan, şifrə ilə qorunan imtahanlar."
        actions={
          <>
            {isAdmin && (
              <Button
                onClick={() => {
                  setActiveExam(null);
                  setEditorOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Yeni imtahan
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="İmtahan axtar..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : visibleExams.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-display font-semibold">{search ? "Nəticə tapılmadı" : "Hələ imtahan yoxdur"}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin
              ? "İlk şifrəli imtahanınızı yaradın."
              : "Hələ heç bir imtahan dərc olunmayıb."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleExams.map((exam) => (
            <Card key={exam.id} className="p-4 flex flex-col overflow-hidden border-0">
              <div className="aspect-video mb-4 rounded-md overflow-hidden bg-muted flex items-center justify-center">{exam.cover_image_url ? <img src={exam.cover_image_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <ClipboardList className="h-10 w-10 text-primary/50" />}</div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  {exam.has_password && <Lock className="h-4 w-4 text-amber-600" />}
                  <Badge variant={exam.is_published ? "default" : "secondary"}>
                    {exam.is_published ? "Dərc olunub" : "Qaralama"}
                  </Badge>
                </div>
                {exam.time_limit_seconds && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {Math.round(exam.time_limit_seconds / 60)}d
                  </span>
                )}
              </div>
              <h3 className="font-display font-semibold text-lg">{exam.title}</h3>
              {exam.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {exam.description}
                </p>
              )}
              <div className="text-xs text-muted-foreground mt-2">
                Keçid balı: {exam.passing_score}%
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {exam.is_published && (
                  <Button size="sm" onClick={() => setRunnerExam(exam)}>
                    <Play className="h-4 w-4" /> İmtahana başla
                  </Button>
                )}
                {isAdmin && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setActiveExam(exam);
                        setEditorOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" /> Redaktə et
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setResultsExam(exam)}>
                      <ListChecks className="h-4 w-4" /> Nəticələr
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        if (!confirm(`"${exam.title}" silinsin?`)) return;
                        const { error } = await supabase.from("standalone_exams").delete().eq("id", exam.id);
                        if (error) toast.error(error.message);
                        else {
                          toast.success("Silindi");
                          load();
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" /> Sil
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}


      {editorOpen && (
        <ExamEditor
          exam={activeExam}
          onClose={() => {
            setEditorOpen(false);
            setActiveExam(null);
          }}
          onSaved={() => {
            setEditorOpen(false);
            setActiveExam(null);
            load();
          }}
        />
      )}

      {runnerExam && (
        <ExamRunner exam={runnerExam} onClose={() => setRunnerExam(null)} />
      )}

      {resultsExam && (
        <ExamResults exam={resultsExam} onClose={() => setResultsExam(null)} />
      )}
    </div>
  );
}

/* -------------------- Editor -------------------- */

function ExamEditor({
  exam,
  onClose,
  onSaved,
}: {
  exam: Exam | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(exam?.title ?? "");
  const [description, setDescription] = useState(exam?.description ?? "");
  const [password, setPassword] = useState("");
  const [requirePassword, setRequirePassword] = useState(exam?.has_password ?? false);
  const [showPassword, setShowPassword] = useState(false);
  const [timeLimitMin, setTimeLimitMin] = useState(
    exam?.time_limit_seconds ? String(Math.round(exam.time_limit_seconds / 60)) : "",
  );
  const [passingScore, setPassingScore] = useState(String(exam?.passing_score ?? 60));
  const [isPublished, setIsPublished] = useState(exam?.is_published ?? false);
  const [shuffleQuestions, setShuffleQuestions] = useState(exam?.shuffle_questions ?? false);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(exam?.cover_image_url ?? null);
  const [certTemplateUrl, setCertTemplateUrl] = useState<string | null>(exam?.certificate_template_url ?? null);
  const [examId, setExamId] = useState<string | null>(exam?.id ?? null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);


  useEffect(() => {
    if (!examId) return;
    (async () => {
      const { data: qs } = await supabase
        .from("standalone_exam_questions")
        .select("id,exam_id,text,position,time_limit_seconds,is_open_ended")
        .eq("exam_id", examId)
        .order("position");
      const ids = (qs ?? []).map((q) => q.id);
      const { data: ans } = ids.length
        ? await supabase
            .from("standalone_exam_answers")
            .select("id,question_id,text,position,is_correct")
            .in("question_id", ids)
            .order("position")
        : { data: [] as any[] };
      setQuestions(
        (qs ?? []).map((q) => ({
          ...q,
          answers: (ans ?? []).filter((a: any) => a.question_id === q.id),
        })) as ExamQuestion[],
      );
    })();
  }, [examId]);

  const saveExam = async () => {
    if (!title.trim()) return toast.error("Başlıq tələb olunur");

    setSaving(true);
    const payload: any = {
      title: title.trim(),
      description: description.trim() || null,
      time_limit_seconds: timeLimitMin ? Number(timeLimitMin) * 60 : null,
      passing_score: Number(passingScore) || 60,
      is_published: isPublished,
      shuffle_questions: shuffleQuestions,
      cover_image_url: coverImageUrl,
      certificate_template_url: certTemplateUrl,
    };

    if (!requirePassword) payload.password = "";
    else if (password.trim()) payload.password = password.trim();
    else if (!examId) payload.password = "";

    if (examId) {
      const { error } = await supabase
        .from("standalone_exams")
        .update(payload)
        .eq("id", examId);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("İmtahan yeniləndi");
    } else {
      const { data, error } = await supabase
        .from("standalone_exams")
        .insert(payload)
        .select()
        .single();
      setSaving(false);
      if (error) return toast.error(error.message);
      setExamId(data!.id);
      toast.success("İmtahan yaradıldı — indi suallar əlavə edin");
    }
  };

  const addQuestion = async () => {
    if (!examId) return toast.error("Əvvəlcə imtahanı yadda saxla");
    const { data, error } = await supabase
      .from("standalone_exam_questions")
      .insert({
        exam_id: examId,
        text: "Yeni sual",
        position: questions.length,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setQuestions((q) => [...q, { ...data!, answers: [] } as ExamQuestion]);
  };

  const importFromBank = async (items: ImportedQuestion[]): Promise<void> => {
    if (!examId) {
      toast.error("Əvvəlcə imtahanı yadda saxla");
      return;
    }
    let pos = questions.length;
    for (const item of items) {
      const { data: q, error } = await supabase
        .from("standalone_exam_questions")
        .insert({
          exam_id: examId,
          text: item.text,
          position: pos++,
          time_limit_seconds: item.time_limit_seconds,
          is_open_ended: item.is_open_ended,
        })
        .select()
        .single();
      if (error || !q) {
        toast.error(error?.message ?? "Xəta");
        continue;
      }
      if (item.answers.length) {
        await supabase.from("standalone_exam_answers").insert(
          item.answers.map((a) => ({
            question_id: q.id,
            text: a.text,
            is_correct: a.is_correct,
            position: a.position,
          })),
        );
      }
      const { data: aData } = await supabase
        .from("standalone_exam_answers")
        .select("id,question_id,text,position,is_correct")
        .eq("question_id", q.id)
        .order("position");
      setQuestions((qs) => [
        ...qs,
        { ...(q as any), answers: aData ?? [] } as ExamQuestion,
      ]);
    }
    toast.success(`${items.length} sual əlavə edildi`);
    return;
  };

  const updateQuestion = async (id: string, patch: Partial<ExamQuestion>) => {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    await supabase.from("standalone_exam_questions").update(patch as any).eq("id", id);
  };

  const deleteQuestion = async (id: string) => {
    await supabase.from("standalone_exam_questions").delete().eq("id", id);
    setQuestions((qs) => qs.filter((q) => q.id !== id));
  };

  const addAnswer = async (questionId: string) => {
    const q = questions.find((x) => x.id === questionId);
    if (!q) return;
    const { data, error } = await supabase
      .from("standalone_exam_answers")
      .insert({
        question_id: questionId,
        text: "Option",
        position: q.answers.length,
        is_correct: false,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setQuestions((qs) =>
      qs.map((x) =>
        x.id === questionId ? { ...x, answers: [...x.answers, data!] } : x,
      ),
    );
  };

  const updateAnswer = async (
    questionId: string,
    answerId: string,
    patch: Partial<ExamQuestion["answers"][number]>,
  ) => {
    setQuestions((qs) =>
      qs.map((q) =>
        q.id === questionId
          ? { ...q, answers: q.answers.map((a) => (a.id === answerId ? { ...a, ...patch } : a)) }
          : q,
      ),
    );
    await supabase.from("standalone_exam_answers").update(patch as any).eq("id", answerId);
  };

  const deleteAnswer = async (questionId: string, answerId: string) => {
    await supabase.from("standalone_exam_answers").delete().eq("id", answerId);
    setQuestions((qs) =>
      qs.map((q) =>
        q.id === questionId ? { ...q, answers: q.answers.filter((a) => a.id !== answerId) } : q,
      ),
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{examId ? "İmtahanı redaktə et" : "Yeni imtahan"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Başlıq</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Təsvir</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Şifrə <span className="text-xs text-muted-foreground">(opsional)</span></Label>
                <Switch checked={requirePassword} onCheckedChange={setRequirePassword} />
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  disabled={!requirePassword}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={requirePassword ? (examId ? "••••••" : "Şifrə daxil edin") : "Şifrəsiz"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Vaxt limiti (dəq)</Label>
              <Input
                type="number"
                value={timeLimitMin}
                onChange={(e) => setTimeLimitMin(e.target.value)}
                placeholder="Opsional"
              />
            </div>
            <div className="grid gap-2">
              <Label>Keçid balı (%)</Label>
              <Input
                type="number"
                value={passingScore}
                onChange={(e) => setPassingScore(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isPublished} onCheckedChange={setIsPublished} id="pub" />
            <Label htmlFor="pub">Dərc olunub (istifadəçilərə görünür)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={shuffleQuestions} onCheckedChange={setShuffleQuestions} id="shuf" />
            <Label htmlFor="shuf">Sualları qarışdır (hər istifadəçi üçün fərqli sıra)</Label>
          </div>

          <CertificateTemplateSelect value={certTemplateUrl} onChange={setCertTemplateUrl} />

          <FileUpload
            label="Üz şəkli"
            icon={ImageIcon}
            value={coverImageUrl}
            onChange={setCoverImageUrl}
            accept="image/*"
            folder="covers"
          />


          <div className="flex justify-end">
            <Button onClick={saveExam} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {examId ? "Detalları yadda saxla" : "İmtahan yarat"}
            </Button>
          </div>

          {examId && (
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-display font-semibold">Suallar</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setBankOpen(true)}>
                    <Library className="h-4 w-4" /> Sual Bankından
                  </Button>
                  <Button size="sm" variant="outline" onClick={addQuestion}>
                    <Plus className="h-4 w-4" /> Yeni sual
                  </Button>
                </div>
              </div>
              {questions.length === 0 && (
                <p className="text-sm text-muted-foreground">Hələ sual yoxdur.</p>
              )}
              {questions.map((q, idx) => (
                <Card key={q.id} className="p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-muted-foreground mt-2">Q{idx + 1}</span>
                    <Textarea
                      value={q.text}
                      onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                      rows={2}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteQuestion(q.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 pl-6">
                    <Switch
                      id={`open-${q.id}`}
                      checked={q.is_open_ended}
                      onCheckedChange={(v) => updateQuestion(q.id, { is_open_ended: v })}
                    />
                    <Label htmlFor={`open-${q.id}`} className="text-sm">
                      Açıq tipli sual (istifadəçi cavabı yazır, admin qiymətləndirir)
                    </Label>
                  </div>
                  {q.is_open_ended ? (
                    <p className="pl-6 text-xs text-muted-foreground">
                      Bu sual avtomatik hesablanmır — «İmtahan yoxlaması» bölməsində 0–1 aralığında qiymət verilir.
                    </p>
                  ) : (
                  <div className="space-y-2 pl-6">
                    {q.answers.map((a) => (
                      <div key={a.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={a.is_correct}
                          onChange={(e) =>
                            updateAnswer(q.id, a.id, { is_correct: e.target.checked })
                          }
                          className="h-4 w-4"
                        />
                        <Input
                          value={a.text}
                          onChange={(e) => updateAnswer(q.id, a.id, { text: e.target.value })}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteAnswer(q.id, a.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button size="sm" variant="ghost" onClick={() => addAnswer(q.id)}>
                      <Plus className="h-4 w-4" /> Variant əlavə et
                    </Button>
                  </div>
                  )}

                </Card>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Bağla
          </Button>
        </DialogFooter>
      </DialogContent>
      {bankOpen && (
        <BankPicker
          open={bankOpen}
          onClose={() => setBankOpen(false)}
          onImport={importFromBank}
        />
      )}
    </Dialog>
  );
}

/* -------------------- Runner -------------------- */

function ExamRunner({ exam, onClose }: { exam: Exam; onClose: () => void }) {
  const { user, isAdmin } = useAuth();
  const [stage, setStage] = useState<"password" | "loading" | "running" | "result" | "blocked">(
    exam.has_password ? "password" : "loading",
  );
  const [blockReason, setBlockReason] = useState("");
  useExamProctor(stage === "running", !isAdmin, (reason) => {
    setBlockReason(reason);
    setStage("blocked");
  });
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [questionListOpen, setQuestionListOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [openAnswers, setOpenAnswers] = useState<Record<string, string>>({});
  const [startedAt, setStartedAt] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [result, setResult] = useState<{
    correct: number;
    total: number;
    percent: number;
    passed: boolean;
    pendingReview: boolean;
  } | null>(null);

  useEffect(() => {
    if (stage !== "running" || !exam.time_limit_seconds) return;
    const id = setInterval(() => {
      setRemaining((r) => (r === null ? r : Math.max(0, r - 1)));
    }, 1000);
    return () => clearInterval(id);
  }, [stage, exam.time_limit_seconds]);

  useEffect(() => {
    if (remaining === 0) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const verifyAndStart = async () => {
    if (!isAdmin) void enterFullscreen();
    setVerifying(true);
    if (user && !isAdmin) {
      const reason = await getExamBlock(user.id);
      if (reason) {
        setVerifying(false);
        void exitFullscreen();
        setBlockReason(reason);
        setStage("blocked");
        return;
      }
    }
    const { data: ok, error } = await supabase.rpc("verify_exam_password", {
      _exam_id: exam.id,
      _password: password,
    });
    if (error || !ok) {
      setVerifying(false);
      toast.error(exam.has_password ? "Şifrə yanlışdır" : "İmtahan açıla bilmədi");
      if (!exam.has_password) onClose();
      return;
    }
    const { data: qs } = await supabase
      .from("standalone_exam_questions")
      .select("id,exam_id,text,position,time_limit_seconds,is_open_ended")
      .eq("exam_id", exam.id)
      .order("position");
    const ids = (qs ?? []).map((q) => q.id);
    const { data: ans } = ids.length
      ? await supabase
          .from("standalone_exam_answers")
          .select("id,question_id,text,position,is_correct")
          .in("question_id", ids)
          .order("position")
      : { data: [] as any[] };
    let full = (qs ?? []).map((q) => ({
      ...q,
      answers: (ans ?? []).filter((a: any) => a.question_id === q.id),
    })) as ExamQuestion[];
    if (full.length === 0) {
      setVerifying(false);
      toast.error("Bu imtahanda sual yoxdur");
      if (!exam.has_password) onClose();
      return;
    }
    if (exam.shuffle_questions) {
      full = [...full].sort(() => Math.random() - 0.5);
    }
    setQuestions(full);
    setStartedAt(Date.now());
    if (exam.time_limit_seconds) setRemaining(exam.time_limit_seconds);
    setStage("running");
    setVerifying(false);
  };

  // Şifrəsiz imtahanlar birbaşa başlayır
  useEffect(() => {
    if (!exam.has_password) void verifyAndStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam.id]);

  const submit = async () => {
    if (!user) return;
    const total = questions.length;
    let correct = 0;
    let openCount = 0;
    const responses = questions.map((q) => {
      if (q.is_open_ended) {
        openCount++;
        return {
          question_id: q.id,
          answer_id: null,
          answer_text: (openAnswers[q.id] ?? "").trim() || null,
          is_correct: false,
          grade: null as number | null,
          time_spent_seconds: 0,
        };
      }
      const chosen = selected[q.id];
      const ansObj = q.answers.find((a) => a.id === chosen);
      const isCorrect = !!ansObj?.is_correct;
      if (isCorrect) correct++;
      return {
        question_id: q.id,
        answer_id: chosen ?? null,
        answer_text: null,
        is_correct: isCorrect,
        grade: isCorrect ? 1 : 0,
        time_spent_seconds: 0,
      };
    });
    const pendingReview = openCount > 0;
    const percent = Math.round((correct / total) * 100);
    const passed = pendingReview ? false : percent >= exam.passing_score;
    const duration = Math.round((Date.now() - startedAt) / 1000);

    const { data: attempt, error } = await supabase
      .from("standalone_exam_attempts")
      .insert({
        exam_id: exam.id,
        user_id: user.id,
        score_percent: percent,
        correct_count: correct,
        total_questions: total,
        duration_seconds: duration,
        passed,
        needs_review: pendingReview,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    if (responses.length) {
      await supabase
        .from("standalone_exam_responses")
        .insert(responses.map((r) => ({ ...r, attempt_id: attempt!.id })));
    }
    setResult({ correct, total, percent, passed, pendingReview });
    setStage("result");
    void exitFullscreen();
  };

  const q = questions[current];

  const closeExam = () => {
    onClose();
    // Let the runner unmount and remove its proctor listeners before exiting fullscreen.
    requestAnimationFrame(() => { void exitFullscreen(); });
  };

  const requestClose = () => {
    if (stage === "running") setCloseConfirmOpen(true);
    else closeExam();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) requestClose(); }}>
      <DialogContent className="max-w-2xl">
        {stage === "blocked" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Lock className="h-4 w-4" /> İmtahan bloklandı
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p className="font-medium">Səbəb: {blockReason}</p>
              <p className="text-muted-foreground">{EXAM_BLOCKED_MSG}</p>
              <Button className="w-full" variant="outline" onClick={onClose}>Bağla</Button>
            </div>
          </>
        )}
        {stage === "loading" && (
          <>
            <DialogHeader>
              <DialogTitle>{exam.title}</DialogTitle>
            </DialogHeader>
            <div className="py-10 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          </>
        )}

        {stage === "password" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="h-4 w-4" /> {exam.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {exam.description && (
                <p className="text-sm text-muted-foreground">{exam.description}</p>
              )}
              <div className="text-sm flex gap-4 text-muted-foreground">
                <span>Keçid balı: {exam.passing_score}%</span>
                {exam.time_limit_seconds && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {Math.round(exam.time_limit_seconds / 60)} dəq
                  </span>
                )}
              </div>
              <div className="grid gap-2">
                <Label>İmtahan şifrəsi</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && verifyAndStart()}
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={onClose}>
                  Ləğv et
                </Button>
                <Button onClick={verifyAndStart} disabled={verifying || !password}>
                  {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
                  İmtahana başla
                </Button>
              </DialogFooter>
            </div>
          </>
        )}

        {stage === "running" && q && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between gap-2 pr-6">
                <Popover open={questionListOpen} onOpenChange={setQuestionListOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" aria-label="Sual seç">
                      Sual {current + 1} / {questions.length}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-96 max-w-[calc(100vw-3rem)] p-2">
                    <div className="max-h-[min(24rem,50dvh)] overflow-y-auto space-y-1" aria-label="Suallar">
                      {questions.map((question, index) => {
                        const answered = question.is_open_ended
                          ? Boolean(openAnswers[question.id]?.trim())
                          : Boolean(selected[question.id]);
                        return (
                          <Button
                            key={question.id}
                            variant={index === current ? "secondary" : "ghost"}
                            className="h-auto w-full items-start justify-start gap-3 whitespace-normal p-3 text-left"
                            aria-current={index === current ? "step" : undefined}
                            onClick={() => { setCurrent(index); setQuestionListOpen(false); }}
                          >
                            <span className="min-w-0 flex-1 space-y-1">
                              <span className="block font-semibold">Sual {index + 1}</span>
                              <span className="block break-words text-sm font-normal">{question.text}</span>
                            </span>
                            <CheckCircle2
                              className={`mt-1 h-4 w-4 shrink-0 ${answered ? "text-primary" : "text-muted-foreground"}`}
                              aria-label={answered ? "Cavablandırılıb" : "Cavablandırılmayıb"}
                            />
                          </Button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
                {remaining !== null && (
                  <span className="text-sm font-mono text-amber-600 flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {Math.floor(remaining / 60)}:
                    {String(remaining % 60).padStart(2, "0")}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="font-medium">{q.text}</p>
              {q.is_open_ended ? (
                <Textarea
                  rows={6}
                  placeholder="Cavabınızı buraya yazın…"
                  value={openAnswers[q.id] ?? ""}
                  onChange={(e) => setOpenAnswers((s) => ({ ...s, [q.id]: e.target.value }))}
                />
              ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {q.answers.map((a) => (
                  <Button variant="outline"
                    key={a.id}
                    onClick={() => setSelected((s) => ({ ...s, [q.id]: a.id }))}
                    className={`h-auto min-h-16 whitespace-normal justify-start w-full text-left p-4 rounded-md border transition ${
                      selected[q.id] === a.id
                        ? "border-primary bg-primary/5"
                        : "border-input hover:bg-accent"
                    }`}
                  >
                    {a.text}
                  </Button>
                ))}
              </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                disabled={current === 0}
                onClick={() => setCurrent((c) => c - 1)}
              >
                Əvvəlki
              </Button>
              {current < questions.length - 1 ? (
                <Button onClick={() => setCurrent((c) => c + 1)}>Növbəti</Button>
              ) : (
                <Button onClick={submit}>İmtahanı bitir</Button>
              )}
            </DialogFooter>
          </>
        )}

        {stage === "result" && result && (
          <>
            <DialogHeader>
              <DialogTitle>Nəticə</DialogTitle>
            </DialogHeader>
            <div className="text-center py-6 space-y-3">
              {result.pendingReview ? (
                <Clock className="h-14 w-14 mx-auto text-amber-500" />
              ) : result.passed ? (
                <CheckCircle2 className="h-14 w-14 mx-auto text-emerald-500" />
              ) : (
                <XCircle className="h-14 w-14 mx-auto text-destructive" />
              )}
              {result.pendingReview ? (
                <>
                  <div className="font-display text-2xl font-bold">Cavablar qəbul edildi</div>
                  <p className="text-muted-foreground">
                    Bu imtahanda açıq tipli suallar var. Yekun nəticə admin yoxlamasından sonra elan olunacaq.
                  </p>
                </>
              ) : (
                <>
                  <div className="font-display text-4xl font-bold">{result.percent}%</div>
                  <p className="text-muted-foreground">
                    {result.correct} / {result.total} doğru ·{" "}
                    {result.passed ? "Keçib" : "Keçməyib"}
                  </p>
                </>
              )}
            </div>
            <DialogFooter>
              <Button onClick={onClose}>Bağla</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
      <AlertDialog open={closeConfirmOpen && stage === "running"} onOpenChange={setCloseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>İmtahanı bağlamaq istəyirsiniz?</AlertDialogTitle>
            <AlertDialogDescription>
              İmtahan tamamlanmayacaq və bu cəhdin cavabları yadda saxlanılmayacaq.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İmtahana davam et</AlertDialogCancel>
            <AlertDialogAction onClick={closeExam}>İmtahanı bağla</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

/* -------------------- Results -------------------- */

function ExamResults({ exam, onClose }: { exam: Exam; onClose: () => void }) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [detail, setDetail] = useState<AttemptDetailRef | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("standalone_exam_attempts")
        .select(
          "id,exam_id,user_id,score_percent,correct_count,total_questions,duration_seconds,passed,created_at",
        )
        .eq("exam_id", exam.id)
        .order("created_at", { ascending: false });
      const userIds = Array.from(new Set((data ?? []).map((a) => a.user_id)));
      const { data: profs } = userIds.length
        ? await supabase
            .from("profiles")
            .select("id,full_name,employee_id")
            .in("id", userIds)
        : { data: [] as any[] };
      const merged = (data ?? []).map((a) => ({
        ...a,
        profile: (profs ?? []).find((p: any) => p.id === a.user_id) ?? null,
      })) as Attempt[];
      setAttempts(merged);
      setLoading(false);
    })();
  }, [exam.id]);

  const filtered = attempts.filter((a) => {
    const t = new Date(a.created_at).getTime();
    if (fromDate && t < new Date(fromDate + "T00:00:00").getTime()) return false;
    if (toDate && t > new Date(toDate + "T23:59:59").getTime()) return false;
    return true;
  });

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const exportXLSX = async () => {
    const XLSX = await import("xlsx");
    const rows = filtered.map((a) => ({
      "Əməkdaş ID": a.profile?.employee_id ?? "",
      "Ad": a.profile?.full_name ?? "",
      "Bal %": Number(a.score_percent),
      "Doğru": a.correct_count,
      "Cəmi": a.total_questions,
      "Müddət (san)": a.duration_seconds,
      "Nəticə": a.passed ? "Keçib" : "Keçməyib",
      "Tarix": fmt(a.created_at),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Nəticələr");
    XLSX.writeFile(wb, `Hesabat_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>Nəticələr — {exam.title}</span>
            <Button size="sm" variant="outline" onClick={exportXLSX} disabled={!filtered.length}>
              <Download className="h-4 w-4" /> Excel ixrac et
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3 mb-3">
          <div className="grid gap-1">
            <Label className="text-xs">Başlanğıc tarix</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9" />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Son tarix</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9" />
          </div>
          {(fromDate || toDate) && (
            <Button size="sm" variant="ghost" onClick={() => { setFromDate(""); setToDate(""); }}>
              Sıfırla
            </Button>
          )}
          <div className="ml-auto text-xs text-muted-foreground">{filtered.length} nəticə</div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nəticə tapılmadı.</p>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-2">Əməkdaş</th>
                  <th className="p-2">Ad</th>
                  <th className="p-2 text-right">Bal</th>
                  <th className="p-2 text-right">Doğru</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Tarix</th>
                  <th className="p-2 text-right">Bax</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="p-2 font-mono text-xs">{a.profile?.employee_id ?? "—"}</td>
                    <td className="p-2">{a.profile?.full_name ?? "—"}</td>
                    <td className="p-2 text-right font-medium">{Number(a.score_percent)}%</td>
                    <td className="p-2 text-right">
                      {a.correct_count}/{a.total_questions}
                    </td>
                    <td className="p-2">
                      <Badge variant={a.passed ? "default" : "destructive"}>
                        {a.passed ? "Keçib" : "Keçməyib"}
                      </Badge>
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">{fmt(a.created_at)}</td>
                    <td className="p-2 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="Cavab vərəqəsi"
                        onClick={() =>
                          setDetail({
                            kind: "exam",
                            attemptId: a.id,
                            title: exam.title,
                            user: a.profile
                              ? {
                                  id: a.user_id,
                                  full_name: a.profile.full_name,
                                  employee_id: a.profile.employee_id,
                                }
                              : undefined,
                            score: Number(a.score_percent),
                            passed: a.passed,
                            duration: a.duration_seconds,
                            date: a.created_at,
                            parentId: exam.id,
                          })
                        }
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {detail && (
          <AttemptDetailDialog detailRef={detail} onClose={() => setDetail(null)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

