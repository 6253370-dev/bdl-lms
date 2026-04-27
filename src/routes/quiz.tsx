import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  FileQuestion,
  Plus,
  Play,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
  Clock,
  CheckCircle2,
  XCircle,
  Trophy,
  ListChecks,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/quiz")({
  component: () => (
    <ProtectedRoute>
      <QuizPage />
    </ProtectedRoute>
  ),
});

type Quiz = {
  id: string;
  title: string;
  description: string | null;
  time_limit_seconds: number | null;
  passing_score: number;
  is_published: boolean;
  created_at: string;
};

type QuizQuestion = {
  id: string;
  quiz_id: string;
  text: string;
  position: number;
  is_multiple: boolean;
  answers: { id: string; text: string; position: number; is_correct: boolean }[];
};

type Attempt = {
  id: string;
  quiz_id: string;
  user_id: string;
  score_percent: number;
  correct_count: number;
  total_questions: number;
  duration_seconds: number;
  passed: boolean;
  created_at: string;
  profile?: { full_name: string; employee_id: string } | null;
};

function QuizPage() {
  const { isAdmin, user } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Quiz | null>(null);
  const [playing, setPlaying] = useState<Quiz | null>(null);
  const [viewingHistory, setViewingHistory] = useState<Quiz | null>(null);
  const [viewingBoard, setViewingBoard] = useState<Quiz | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("quizzes")
      .select("*")
      .order("created_at", { ascending: false });
    setQuizzes((data ?? []) as Quiz[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    let list = isAdmin ? quizzes : quizzes.filter((q) => q.is_published);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((x) => x.title.toLowerCase().includes(q) || (x.description ?? "").toLowerCase().includes(q));
    return list;
  }, [quizzes, isAdmin, search]);

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold mb-2">Quizlər</h1>
          <p className="text-muted-foreground">
            Bilik yoxlaması üçün vaxtlı suallar.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Yeni quiz
          </Button>
        )}
      </div>

      <div className="mb-6 relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Quiz axtar..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <FileQuestion className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-display font-semibold">Hələ quiz yoxdur</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin ? "İlk quizi yaratmaq üçün düyməyə basın." : "Tezliklə əlavə olunacaq."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((q) => (
            <QuizCard
              key={q.id}
              quiz={q}
              isAdmin={isAdmin}
              onPlay={() => setPlaying(q)}
              onEdit={() => setEditing(q)}
              onHistory={() => setViewingHistory(q)}
              onBoard={() => setViewingBoard(q)}
              onChanged={load}
            />
          ))}
        </div>
      )}

      {createOpen && (
        <QuizFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSaved={load}
          userId={user?.id ?? null}
        />
      )}
      {editing && (
        <QuizFormDialog
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          onSaved={load}
          userId={user?.id ?? null}
          existing={editing}
        />
      )}
      {playing && (
        <PlayerDialog
          quiz={playing}
          open={!!playing}
          onClose={() => setPlaying(null)}
        />
      )}
      {viewingHistory && (
        <HistoryDialog
          quiz={viewingHistory}
          open={!!viewingHistory}
          onClose={() => setViewingHistory(null)}
          userId={user?.id ?? null}
        />
      )}
      {viewingBoard && (
        <LeaderboardDialog
          quiz={viewingBoard}
          open={!!viewingBoard}
          onClose={() => setViewingBoard(null)}
        />
      )}
    </div>
  );
}

function QuizCard({
  quiz,
  isAdmin,
  onPlay,
  onEdit,
  onHistory,
  onBoard,
  onChanged,
}: {
  quiz: Quiz;
  isAdmin: boolean;
  onPlay: () => void;
  onEdit: () => void;
  onHistory: () => void;
  onBoard: () => void;
  onChanged: () => void;
}) {
  const togglePublish = async () => {
    const { error } = await supabase
      .from("quizzes")
      .update({ is_published: !quiz.is_published })
      .eq("id", quiz.id);
    if (error) toast.error(error.message);
    else {
      toast.success(quiz.is_published ? "Layihə statusuna keçirildi" : "Dərc edildi");
      onChanged();
    }
  };

  const remove = async () => {
    if (!confirm(`"${quiz.title}" silinsin?`)) return;
    const { error } = await supabase.from("quizzes").delete().eq("id", quiz.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Silindi");
      onChanged();
    }
  };

  return (
    <Card className="p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display font-semibold leading-tight">{quiz.title}</h3>
        <Badge variant={quiz.is_published ? "default" : "secondary"}>
          {quiz.is_published ? "Dərc" : "Layihə"}
        </Badge>
      </div>
      {quiz.description && (
        <p className="text-sm text-muted-foreground line-clamp-2">{quiz.description}</p>
      )}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {quiz.time_limit_seconds && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {Math.round(quiz.time_limit_seconds / 60)} dəq
          </span>
        )}
        <span>Keçid: {quiz.passing_score}%</span>
      </div>
      <div className="flex flex-wrap gap-2 mt-auto pt-2">
        <Button size="sm" onClick={onPlay} disabled={!quiz.is_published && !isAdmin}>
          <Play className="h-3.5 w-3.5" /> Başla
        </Button>
        <Button size="sm" variant="outline" onClick={onHistory}>
          <ListChecks className="h-3.5 w-3.5" /> Tarixçə
        </Button>
        <Button size="sm" variant="outline" onClick={onBoard}>
          <Trophy className="h-3.5 w-3.5" /> Liderlər
        </Button>
        {isAdmin && (
          <>
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" onClick={togglePublish}>
              {quiz.is_published ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button size="sm" variant="outline" onClick={remove}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

/* ---------------- Form (create / edit + questions) ---------------- */

function QuizFormDialog({
  open,
  onOpenChange,
  onSaved,
  userId,
  existing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
  userId: string | null;
  existing?: Quiz;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [timeMin, setTimeMin] = useState(
    existing?.time_limit_seconds ? Math.round(existing.time_limit_seconds / 60) : 10,
  );
  const [pass, setPass] = useState(existing?.passing_score ?? 60);
  const [published, setPublished] = useState(existing?.is_published ?? false);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [activeTab, setActiveTab] = useState("info");

  useEffect(() => {
    if (existing) loadQuestions(existing.id);
  }, [existing]);

  const loadQuestions = async (quizId: string) => {
    const { data: qs } = await supabase
      .from("quiz_questions")
      .select("*")
      .eq("quiz_id", quizId)
      .order("position");
    if (!qs) return;
    const ids = qs.map((q) => q.id);
    const { data: ans } = await supabase
      .from("quiz_answers")
      .select("*")
      .in("question_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
      .order("position");
    setQuestions(
      qs.map((q) => ({
        ...q,
        answers: (ans ?? []).filter((a) => a.question_id === q.id),
      })) as QuizQuestion[],
    );
  };

  const save = async () => {
    if (!title.trim()) {
      toast.error("Başlıq tələb olunur");
      return;
    }
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      time_limit_seconds: timeMin > 0 ? timeMin * 60 : null,
      passing_score: pass,
      is_published: published,
      created_by: userId,
    };
    if (existing) {
      const { error } = await supabase.from("quizzes").update(payload).eq("id", existing.id);
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      toast.success("Yeniləndi");
    } else {
      const { data, error } = await supabase
        .from("quizzes")
        .insert(payload)
        .select()
        .single();
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      toast.success("Yaradıldı");
      // switch to questions tab on the newly created quiz
      onSaved();
      setSaving(false);
      onOpenChange(false);
      return;
    }
    setSaving(false);
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Quiz redaktəsi" : "Yeni quiz"}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="info">Məlumat</TabsTrigger>
            <TabsTrigger value="questions" disabled={!existing}>
              Suallar ({questions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 pt-4">
            <div>
              <Label>Başlıq</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Təsvir</Label>
              <Textarea
                value={description ?? ""}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vaxt limiti (dəqiqə, 0 = limitsiz)</Label>
                <Input
                  type="number"
                  value={timeMin}
                  onChange={(e) => setTimeMin(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Keçid balı (%)</Label>
                <Input
                  type="number"
                  value={pass}
                  onChange={(e) => setPass(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={published} onCheckedChange={setPublished} />
              <Label>Dərc et</Label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Ləğv et
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Yadda saxlanılır..." : "Yadda saxla"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="questions" className="pt-4">
            {existing && (
              <QuestionsEditor
                quizId={existing.id}
                questions={questions}
                reload={() => loadQuestions(existing.id)}
              />
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function QuestionsEditor({
  quizId,
  questions,
  reload,
}: {
  quizId: string;
  questions: QuizQuestion[];
  reload: () => void;
}) {
  const [text, setText] = useState("");
  const [isMulti, setIsMulti] = useState(false);
  const [answers, setAnswers] = useState<{ text: string; is_correct: boolean }[]>([
    { text: "", is_correct: false },
    { text: "", is_correct: false },
  ]);
  const [saving, setSaving] = useState(false);

  const addAnswer = () =>
    setAnswers((a) => [...a, { text: "", is_correct: false }]);

  const reset = () => {
    setText("");
    setIsMulti(false);
    setAnswers([
      { text: "", is_correct: false },
      { text: "", is_correct: false },
    ]);
  };

  const addQuestion = async () => {
    if (!text.trim()) return toast.error("Sual mətnini daxil edin");
    const valid = answers.filter((a) => a.text.trim());
    if (valid.length < 2) return toast.error("Ən azı 2 cavab variantı lazımdır");
    if (!valid.some((a) => a.is_correct)) return toast.error("Ən azı 1 doğru cavab seçin");
    setSaving(true);
    const { data: q, error } = await supabase
      .from("quiz_questions")
      .insert({
        quiz_id: quizId,
        text: text.trim(),
        position: questions.length,
        is_multiple: isMulti,
      })
      .select()
      .single();
    if (error || !q) {
      toast.error(error?.message ?? "Xəta");
      setSaving(false);
      return;
    }
    const { error: aErr } = await supabase.from("quiz_answers").insert(
      valid.map((a, i) => ({
        question_id: q.id,
        text: a.text.trim(),
        is_correct: a.is_correct,
        position: i,
      })),
    );
    if (aErr) toast.error(aErr.message);
    else toast.success("Sual əlavə edildi");
    reset();
    setSaving(false);
    reload();
  };

  const removeQuestion = async (id: string) => {
    if (!confirm("Sual silinsin?")) return;
    await supabase.from("quiz_answers").delete().eq("question_id", id);
    const { error } = await supabase.from("quiz_questions").delete().eq("id", id);
    if (error) toast.error(error.message);
    else reload();
  };

  return (
    <div className="space-y-6">
      <Card className="p-4 space-y-3">
        <div className="font-display font-semibold">Yeni sual</div>
        <Textarea
          placeholder="Sual mətni"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <Switch checked={isMulti} onCheckedChange={setIsMulti} />
          <Label>Çoxsaylı doğru cavab</Label>
        </div>
        <div className="space-y-2">
          {answers.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <Checkbox
                checked={a.is_correct}
                onCheckedChange={(c) =>
                  setAnswers((arr) =>
                    arr.map((x, idx) =>
                      idx === i
                        ? { ...x, is_correct: !!c }
                        : isMulti
                          ? x
                          : { ...x, is_correct: false },
                    ),
                  )
                }
              />
              <Input
                value={a.text}
                placeholder={`Cavab ${i + 1}`}
                onChange={(e) =>
                  setAnswers((arr) =>
                    arr.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)),
                  )
                }
              />
              {answers.length > 2 && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setAnswers((arr) => arr.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={addAnswer}>
            <Plus className="h-3 w-3" /> Variant əlavə et
          </Button>
        </div>
        <Button onClick={addQuestion} disabled={saving}>
          {saving ? "..." : "Sualı əlavə et"}
        </Button>
      </Card>

      <div className="space-y-2">
        <div className="font-display font-semibold">
          Mövcud suallar ({questions.length})
        </div>
        {questions.map((q, i) => (
          <Card key={q.id} className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="font-medium">
                {i + 1}. {q.text}{" "}
                {q.is_multiple && (
                  <Badge variant="secondary" className="ml-1">
                    çoxsaylı
                  </Badge>
                )}
              </div>
              <Button size="icon" variant="ghost" onClick={() => removeQuestion(q.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <ul className="text-sm space-y-1 ml-4">
              {q.answers.map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  {a.is_correct ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className={a.is_correct ? "" : "text-muted-foreground"}>
                    {a.text}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Player ---------------- */

function PlayerDialog({
  quiz,
  open,
  onClose,
}: {
  quiz: Quiz;
  open: boolean;
  onClose: () => void;
}) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [responses, setResponses] = useState<Record<string, string[]>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [result, setResult] = useState<{
    correct: number;
    total: number;
    percent: number;
    passed: boolean;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: qs } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", quiz.id)
        .order("position");
      const ids = (qs ?? []).map((q) => q.id);
      const { data: ans } = await supabase
        .from("quiz_answers")
        .select("*")
        .in("question_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
        .order("position");
      setQuestions(
        (qs ?? []).map((q) => ({
          ...q,
          answers: (ans ?? []).filter((a) => a.question_id === q.id),
        })) as QuizQuestion[],
      );
      setLoading(false);
    })();
  }, [quiz.id]);

  useEffect(() => {
    if (!started || timeLeft === null) return;
    if (timeLeft <= 0) {
      submit();
      return;
    }
    const t = setTimeout(() => setTimeLeft((v) => (v ?? 0) - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, started]);

  const begin = () => {
    setStarted(true);
    setStartedAt(Date.now());
    if (quiz.time_limit_seconds) setTimeLeft(quiz.time_limit_seconds);
  };

  const toggle = (qid: string, aid: string, multi: boolean) => {
    setResponses((r) => {
      const cur = r[qid] ?? [];
      if (multi) {
        return {
          ...r,
          [qid]: cur.includes(aid) ? cur.filter((x) => x !== aid) : [...cur, aid],
        };
      }
      return { ...r, [qid]: [aid] };
    });
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      toast.error("Daxil olun");
      setSubmitting(false);
      return;
    }
    let correct = 0;
    const responseRows: {
      question_id: string;
      answer_id: string | null;
      is_correct: boolean;
    }[] = [];
    for (const q of questions) {
      const correctIds = q.answers.filter((a) => a.is_correct).map((a) => a.id).sort();
      const picked = (responses[q.id] ?? []).slice().sort();
      const isCorrect =
        correctIds.length === picked.length &&
        correctIds.every((id, i) => id === picked[i]);
      if (isCorrect) correct++;
      if (picked.length === 0) {
        responseRows.push({ question_id: q.id, answer_id: null, is_correct: false });
      } else {
        for (const aid of picked) {
          responseRows.push({
            question_id: q.id,
            answer_id: aid,
            is_correct: isCorrect,
          });
        }
      }
    }
    const total = questions.length;
    const percent = total ? Math.round((correct / total) * 100) : 0;
    const passed = percent >= quiz.passing_score;
    const duration = Math.round((Date.now() - startedAt) / 1000);

    const { data: attempt, error } = await supabase
      .from("quiz_attempts")
      .insert({
        quiz_id: quiz.id,
        user_id: uid,
        score_percent: percent,
        correct_count: correct,
        total_questions: total,
        duration_seconds: duration,
        passed,
      })
      .select()
      .single();
    if (error || !attempt) {
      toast.error(error?.message ?? "Xəta");
      setSubmitting(false);
      return;
    }
    if (responseRows.length) {
      await supabase
        .from("quiz_responses")
        .insert(responseRows.map((r) => ({ ...r, attempt_id: attempt.id })));
    }
    setResult({ correct, total, percent, passed });
    setSubmitting(false);
  };

  const cur = questions[idx];
  const progress = questions.length ? ((idx + 1) / questions.length) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{quiz.title}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : questions.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">Sual yoxdur</div>
        ) : result ? (
          <div className="py-6 text-center space-y-3">
            <div className="text-5xl font-bold font-display">{result.percent}%</div>
            <Badge variant={result.passed ? "default" : "destructive"} className="text-base">
              {result.passed ? "Keçdiniz 🎉" : "Keçmədiniz"}
            </Badge>
            <p className="text-sm text-muted-foreground">
              {result.correct} / {result.total} doğru cavab
            </p>
            <Button onClick={onClose}>Bağla</Button>
          </div>
        ) : !started ? (
          <div className="py-6 space-y-3">
            <p className="text-muted-foreground">{quiz.description}</p>
            <div className="flex gap-3 text-sm">
              <Badge variant="secondary">{questions.length} sual</Badge>
              {quiz.time_limit_seconds && (
                <Badge variant="secondary">
                  <Clock className="h-3 w-3 mr-1" />
                  {Math.round(quiz.time_limit_seconds / 60)} dəq
                </Badge>
              )}
              <Badge variant="secondary">Keçid: {quiz.passing_score}%</Badge>
            </div>
            <Button onClick={begin}>
              <Play className="h-4 w-4" /> Başla
            </Button>
          </div>
        ) : cur ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>
                Sual {idx + 1} / {questions.length}
              </span>
              {timeLeft !== null && (
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="h-3.5 w-3.5" />
                  {Math.floor(timeLeft / 60)}:
                  {String(timeLeft % 60).padStart(2, "0")}
                </span>
              )}
            </div>
            <Progress value={progress} />
            <Card className="p-4">
              <p className="font-medium mb-3">{cur.text}</p>
              <div className="space-y-2">
                {cur.answers.map((a) => {
                  const picked = (responses[cur.id] ?? []).includes(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggle(cur.id, a.id, cur.is_multiple)}
                      className={`w-full text-left p-3 rounded-md border transition-colors ${
                        picked
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-4 w-4 rounded${
                            cur.is_multiple ? "-sm" : "-full"
                          } border ${picked ? "bg-primary border-primary" : "border-border"}`}
                        />
                        <span className="text-sm">{a.text}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                disabled={idx === 0}
              >
                Geri
              </Button>
              {idx < questions.length - 1 ? (
                <Button onClick={() => setIdx((i) => i + 1)}>Növbəti</Button>
              ) : (
                <Button onClick={submit} disabled={submitting}>
                  {submitting ? "Göndərilir..." : "Bitir"}
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- History ---------------- */

function HistoryDialog({
  quiz,
  open,
  onClose,
  userId,
}: {
  quiz: Quiz;
  open: boolean;
  onClose: () => void;
  userId: string | null;
}) {
  const [items, setItems] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!userId) return;
      setLoading(true);
      const { data } = await supabase
        .from("quiz_attempts")
        .select("*")
        .eq("quiz_id", quiz.id)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setItems((data ?? []) as Attempt[]);
      setLoading(false);
    })();
  }, [quiz.id, userId]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mənim cəhdlərim — {quiz.title}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-8 text-center">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">Cəhd yoxdur</div>
        ) : (
          <div className="space-y-2">
            {items.map((a) => (
              <Card key={a.id} className="p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{a.score_percent}%</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString("az-AZ")} ·{" "}
                    {a.correct_count}/{a.total_questions} doğru ·{" "}
                    {Math.floor(a.duration_seconds / 60)}:
                    {String(a.duration_seconds % 60).padStart(2, "0")}
                  </div>
                </div>
                <Badge variant={a.passed ? "default" : "destructive"}>
                  {a.passed ? "Keçdi" : "Keçmədi"}
                </Badge>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Leaderboard ---------------- */

function LeaderboardDialog({
  quiz,
  open,
  onClose,
}: {
  quiz: Quiz;
  open: boolean;
  onClose: () => void;
}) {
  const [items, setItems] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Best attempt per user — we fetch all then dedupe client-side, top 10
      const { data: attempts } = await supabase
        .from("quiz_attempts")
        .select("*")
        .eq("quiz_id", quiz.id)
        .order("score_percent", { ascending: false })
        .order("duration_seconds", { ascending: true })
        .limit(200);
      const byUser = new Map<string, Attempt>();
      for (const a of (attempts ?? []) as Attempt[]) {
        if (!byUser.has(a.user_id)) byUser.set(a.user_id, a);
      }
      const top = Array.from(byUser.values()).slice(0, 10);
      // fetch profiles
      const uids = top.map((t) => t.user_id);
      if (uids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, employee_id")
          .in("id", uids);
        const map = new Map((profs ?? []).map((p) => [p.id, p]));
        for (const t of top)
          t.profile = (map.get(t.user_id) as Attempt["profile"]) ?? null;
      }
      setItems(top);
      setLoading(false);
    })();
  }, [quiz.id]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Liderlər lövhəsi — {quiz.title}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-8 text-center">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">Hələ cəhd yoxdur</div>
        ) : (
          <div className="space-y-2">
            {items.map((a, i) => (
              <Card key={a.id} className="p-3 flex items-center gap-3">
                <div className="font-display font-bold text-lg w-8 text-center">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium">
                    {a.profile?.full_name ?? "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ID {a.profile?.employee_id} ·{" "}
                    {Math.floor(a.duration_seconds / 60)}:
                    {String(a.duration_seconds % 60).padStart(2, "0")}
                  </div>
                </div>
                <Badge variant={a.passed ? "default" : "secondary"}>
                  {a.score_percent}%
                </Badge>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
