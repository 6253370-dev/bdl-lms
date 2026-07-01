import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { useAuth } from "@/lib/auth";
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
} from "lucide-react";
import { toast } from "sonner";
import { FileUpload } from "@/components/FileUpload";
import { BankPicker, type ImportedQuestion } from "@/components/BankPicker";

export const Route = createFileRoute("/exams")({
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
};


type ExamQuestion = {
  id: string;
  exam_id: string;
  text: string;
  position: number;
  time_limit_seconds: number | null;
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
      .select("id,title,description,time_limit_seconds,passing_score,is_published,created_at,cover_image_url,shuffle_questions")
      .order("created_at", { ascending: false });
    setExams((data ?? []) as Exam[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const visibleExams = exams.filter((e) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      e.title.toLowerCase().includes(q) ||
      (e.description ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold mb-1">Müstəqil imtahanlar</h1>
          <p className="text-muted-foreground">
            Kurslardan asılı olmayan, şifrə ilə qorunan imtahanlar.
          </p>
        </div>
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
      </div>

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
            <Card key={exam.id} className="p-5 flex flex-col overflow-hidden">
              <div
                className="h-28 -mx-5 -mt-5 mb-3 bg-cover bg-center"
                style={exam.cover_image_url
                  ? { backgroundImage: `url(${exam.cover_image_url})` }
                  : { background: "var(--gradient-hero)" }}
              />
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-amber-600" />
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
  const [showPassword, setShowPassword] = useState(false);
  const [timeLimitMin, setTimeLimitMin] = useState(
    exam?.time_limit_seconds ? String(Math.round(exam.time_limit_seconds / 60)) : "",
  );
  const [passingScore, setPassingScore] = useState(String(exam?.passing_score ?? 60));
  const [isPublished, setIsPublished] = useState(exam?.is_published ?? false);
  const [shuffleQuestions, setShuffleQuestions] = useState(exam?.shuffle_questions ?? false);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(exam?.cover_image_url ?? null);
  const [examId, setExamId] = useState<string | null>(exam?.id ?? null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);


  useEffect(() => {
    if (!examId) return;
    (async () => {
      const { data: qs } = await supabase
        .from("standalone_exam_questions")
        .select("id,exam_id,text,position,time_limit_seconds")
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
    if (!examId && !password.trim()) return toast.error("Şifrə tələb olunur");
    setSaving(true);
    const payload: any = {
      title: title.trim(),
      description: description.trim() || null,
      time_limit_seconds: timeLimitMin ? Number(timeLimitMin) * 60 : null,
      passing_score: Number(passingScore) || 60,
      is_published: isPublished,
      shuffle_questions: shuffleQuestions,
      cover_image_url: coverImageUrl,
    };

    if (password.trim()) payload.password = password.trim();

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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
              <Label>Şifrə {examId && <span className="text-xs text-muted-foreground">(boş buraxsanız dəyişməz)</span>}</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={examId ? "••••••" : "Tələb olunur"}
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
  const { user } = useAuth();
  const [stage, setStage] = useState<"password" | "running" | "result">("password");
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [startedAt, setStartedAt] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [result, setResult] = useState<{
    correct: number;
    total: number;
    percent: number;
    passed: boolean;
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
    setVerifying(true);
    const { data: ok, error } = await supabase.rpc("verify_exam_password", {
      _exam_id: exam.id,
      _password: password,
    });
    if (error || !ok) {
      setVerifying(false);
      toast.error("Şifrə yanlışdır");
      return;
    }
    const { data: qs } = await supabase
      .from("standalone_exam_questions")
      .select("id,exam_id,text,position,time_limit_seconds")
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

  const submit = async () => {
    if (!user) return;
    const total = questions.length;
    let correct = 0;
    const responses = questions.map((q) => {
      const chosen = selected[q.id];
      const ansObj = q.answers.find((a) => a.id === chosen);
      const isCorrect = !!ansObj?.is_correct;
      if (isCorrect) correct++;
      return {
        question_id: q.id,
        answer_id: chosen ?? null,
        is_correct: isCorrect,
        time_spent_seconds: 0,
      };
    });
    const percent = Math.round((correct / total) * 100);
    const passed = percent >= exam.passing_score;
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
    setResult({ correct, total, percent, passed });
    setStage("result");
  };

  const q = questions[current];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
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
              <DialogTitle className="flex items-center justify-between">
                <span>
                  Sual {current + 1} / {questions.length}
                </span>
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
              <div className="space-y-2">
                {q.answers.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelected((s) => ({ ...s, [q.id]: a.id }))}
                    className={`w-full text-left p-3 rounded-md border transition ${
                      selected[q.id] === a.id
                        ? "border-primary bg-primary/5"
                        : "border-input hover:bg-accent"
                    }`}
                  >
                    {a.text}
                  </button>
                ))}
              </div>
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
              {result.passed ? (
                <CheckCircle2 className="h-14 w-14 mx-auto text-emerald-500" />
              ) : (
                <XCircle className="h-14 w-14 mx-auto text-destructive" />
              )}
              <div className="font-display text-4xl font-bold">{result.percent}%</div>
              <p className="text-muted-foreground">
                {result.correct} / {result.total} doğru ·{" "}
                {result.passed ? "Keçib" : "Keçməyib"}
              </p>
            </div>
            <DialogFooter>
              <Button onClick={onClose}>Bağla</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Results -------------------- */

function ExamResults({ exam, onClose }: { exam: Exam; onClose: () => void }) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

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
    XLSX.writeFile(wb, `${exam.title.replace(/\s+/g, "_")}_neticeler.xlsx`);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

