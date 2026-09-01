import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  FileQuestion, Plus, Play, Trash2, Pencil, Loader2, Users, KeyRound,
  CheckCircle2, XCircle, Radio, History, Trophy, Library, Volume2, VolumeX,
} from "lucide-react";
import { useRoomMusic } from "@/lib/roomMusic";
import { FileUpload } from "@/components/FileUpload";
import { Music } from "lucide-react";
import { toast } from "sonner";
import { BankPicker, type ImportedQuestion } from "@/components/BankPicker";

export const Route = createFileRoute("/quiz")({
  component: () => (
    <ProtectedRoute>
      <QuizHub />
    </ProtectedRoute>
  ),
});

type Quiz = {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
  music_url: string | null;
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

type Room = {
  id: string;
  quiz_id: string;
  host_id: string;
  code: string;
  status: "lobby" | "active" | "finished";
  current_question_index: number;
  current_question_started_at: string | null;
  question_time_seconds: number;
  created_at: string;
  finished_at: string | null;
};

function genCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/* =========================================================
   Hub: parol qoşulması (user) + admin idarəsi
========================================================= */
function QuizHub() {
  const { isAdmin } = useAuth();
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);

  const join = async () => {
    if (!code.trim()) return;
    setJoining(true);
    const { data, error } = await supabase
      .from("quiz_rooms")
      .select("*")
      .eq("code", code.trim())
      .maybeSingle();
    setJoining(false);
    if (error || !data) {
      toast.error("Otaq tapılmadı");
      return;
    }
    if (data.status === "finished") {
      toast.error("Bu otaq artıq bitib");
      return;
    }
    setActiveRoom(data as Room);
  };

  if (activeRoom) {
    return <LiveRoom roomId={activeRoom.id} onLeave={() => setActiveRoom(null)} />;
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold mb-2">Live Quiz</h1>
        <p className="text-muted-foreground">
          Real vaxtda çoxlu istifadəçi ilə yarış. Otaq parolu ilə qoşul.
        </p>
      </div>

      <Card className="p-6 max-w-md">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound className="h-5 w-5 text-primary" />
          <div className="font-display font-semibold">Otağa qoşul</div>
        </div>
        <div className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6 rəqəmli kod"
            onKeyDown={(e) => e.key === "Enter" && join()}
          />
          <Button onClick={join} disabled={joining}>
            {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : "Qoşul"}
          </Button>
        </div>
      </Card>

      {isAdmin && <AdminPanel onEnterRoom={(r) => setActiveRoom(r)} />}
    </div>
  );
}

/* =========================================================
   Admin paneli: quiz CRUD + otaq yarat / izlə
========================================================= */
function AdminPanel({ onEnterRoom }: { onEnterRoom: (r: Room) => void }) {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [history, setHistory] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Quiz | "new" | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: q }, { data: r }, { data: h }] = await Promise.all([
      supabase.from("quizzes").select("id,title,description,is_published,music_url,created_at").order("created_at", { ascending: false }),
      supabase.from("quiz_rooms").select("*").neq("status", "finished").order("created_at", { ascending: false }),
      supabase.from("quiz_rooms").select("*").eq("status", "finished").order("finished_at", { ascending: false }).limit(100),
    ]);
    setQuizzes((q ?? []) as Quiz[]);
    setRooms((r ?? []) as Room[]);
    setHistory((h ?? []) as Room[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createRoom = async (quiz: Quiz, password: string, timeSec: number) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("quiz_rooms")
      .insert({
        quiz_id: quiz.id,
        host_id: user.id,
        code: password,
        question_time_seconds: timeSec,
      })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    toast.success(`Otaq yaradıldı · Kod: ${data.code}`);
    load();
    onEnterRoom(data as Room);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="rooms">
        <TabsList>
          <TabsTrigger value="rooms">Aktiv otaqlar ({rooms.length})</TabsTrigger>
          <TabsTrigger value="quizzes">Quizlər ({quizzes.length})</TabsTrigger>
          <TabsTrigger value="history">Tarixçə ({history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="rooms" className="pt-4">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : rooms.length === 0 ? (
            <Card className="p-8 text-center border-dashed text-muted-foreground text-sm">
              Aktiv otaq yoxdur. Quizlər tabından yeni otaq yarat.
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {rooms.map((r) => {
                const q = quizzes.find((x) => x.id === r.quiz_id);
                return (
                  <Card key={r.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-display font-semibold">{q?.title ?? "Quiz"}</div>
                      <div className="text-xs text-muted-foreground inline-flex items-center gap-2 mt-1">
                        <KeyRound className="h-3 w-3" /> {r.code}
                        <Badge variant={r.status === "lobby" ? "secondary" : "default"} className="ml-2">
                          {r.status === "lobby" ? "Lobby" : "Aktiv"}
                        </Badge>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => onEnterRoom(r)}>
                      <Radio className="h-3.5 w-3.5" /> İdarə et
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="quizzes" className="pt-4 space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Yeni quiz</Button>
          </div>
          {quizzes.length === 0 ? (
            <Card className="p-8 text-center border-dashed text-muted-foreground text-sm">
              <FileQuestion className="h-8 w-8 mx-auto mb-2" /> Hələ quiz yoxdur
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {quizzes.map((q) => (
                <QuizAdminCard
                  key={q.id}
                  quiz={q}
                  onEdit={() => setEditing(q)}
                  onCreateRoom={(pw, t) => createRoom(q, pw, t)}
                  onChanged={load}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="pt-4">
          <HistoryTab rooms={history} quizzes={quizzes} loading={loading} onChanged={load} />
        </TabsContent>
      </Tabs>

      {editing && (
        <QuizFormDialog
          existing={editing === "new" ? undefined : editing}
          userId={user?.id ?? null}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

/* =========================================================
   Tarixçə: bitmiş otaqlar + iştirakçı nəticələri
========================================================= */
function HistoryTab({
  rooms, quizzes, loading, onChanged,
}: {
  rooms: Room[]; quizzes: Quiz[]; loading: boolean; onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [parts, setParts] = useState<Record<string, { id: string; full_name: string; score: number }[]>>({});
  const [loadingParts, setLoadingParts] = useState<string | null>(null);

  const toggle = async (roomId: string) => {
    if (expanded === roomId) { setExpanded(null); return; }
    setExpanded(roomId);
    if (!parts[roomId]) {
      setLoadingParts(roomId);
      const { data } = await supabase
        .from("room_participants")
        .select("id, full_name, score")
        .eq("room_id", roomId)
        .order("score", { ascending: false });
      setParts((p) => ({ ...p, [roomId]: (data ?? []) as any }));
      setLoadingParts(null);
    }
  };

  const remove = async (roomId: string) => {
    if (!confirm("Bu otaq tarixçədən silinsin?")) return;
    const { error } = await supabase.from("quiz_rooms").delete().eq("id", roomId);
    if (error) { toast.error(error.message); return; }
    toast.success("Silindi");
    onChanged();
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (rooms.length === 0) {
    return (
      <Card className="p-8 text-center border-dashed text-muted-foreground text-sm">
        <History className="h-8 w-8 mx-auto mb-2" /> Bitmiş otaq tarixçəsi yoxdur
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {rooms.map((r) => {
        const q = quizzes.find((x) => x.id === r.quiz_id);
        const isOpen = expanded === r.id;
        const list = parts[r.id] ?? [];
        return (
          <Card key={r.id} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <button onClick={() => toggle(r.id)} className="flex-1 text-left">
                <div className="font-display font-semibold">{q?.title ?? "Quiz"}</div>
                <div className="text-xs text-muted-foreground inline-flex items-center gap-2 mt-1 flex-wrap">
                  <KeyRound className="h-3 w-3" /> {r.code}
                  <Badge variant="outline">Bitdi</Badge>
                  {r.finished_at && (
                    <span>{new Date(r.finished_at).toLocaleString("az-AZ")}</span>
                  )}
                </div>
              </button>
              <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {isOpen && (
              <div className="mt-4 border-t pt-3">
                {loadingParts === r.id ? (
                  <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                ) : list.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-2">İştirakçı yoxdur</div>
                ) : (
                  <div className="space-y-1.5">
                    {list.map((p, i) => (
                      <div key={p.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-muted/50">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                          {i === 0 && <Trophy className="h-3.5 w-3.5 text-yellow-500" />}
                          <span>{p.full_name}</span>
                        </div>
                        <Badge variant="secondary">{p.score} xal</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}


function QuizAdminCard({
  quiz, onEdit, onCreateRoom, onChanged,
}: {
  quiz: Quiz;
  onEdit: () => void;
  onCreateRoom: (password: string, timeSec: number) => void;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState(genCode());
  const [t, setT] = useState(20);

  const remove = async () => {
    if (!confirm(`"${quiz.title}" silinsin?`)) return;
    const { error } = await supabase.from("quizzes").delete().eq("id", quiz.id);
    if (error) toast.error(error.message);
    else { toast.success("Silindi"); onChanged(); }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-display font-semibold">{quiz.title}</div>
          {quiz.description && <p className="text-xs text-muted-foreground line-clamp-2">{quiz.description}</p>}
        </div>
        <Badge variant={quiz.is_published ? "default" : "secondary"}>
          {quiz.is_published ? "Dərc" : "Layihə"}
        </Badge>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" onClick={() => setOpen(true)}><Radio className="h-3.5 w-3.5" /> Otaq yarat</Button>
        <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="outline" onClick={remove}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Yeni otaq · {quiz.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Otaq parolu / kodu</Label>
              <div className="flex gap-2">
                <Input value={pw} onChange={(e) => setPw(e.target.value)} />
                <Button variant="outline" onClick={() => setPw(genCode())}>Yenilə</Button>
              </div>
            </div>
            <div>
              <Label>Hər sual üçün vaxt (saniyə)</Label>
              <Input type="number" value={t} onChange={(e) => setT(Number(e.target.value))} min={5} max={120} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Ləğv</Button>
            <Button onClick={() => { onCreateRoom(pw, t); setOpen(false); }}>Yarat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* =========================================================
   Quiz form (info + suallar)
========================================================= */
function QuizFormDialog({
  existing, userId, onClose, onSaved,
}: {
  existing?: Quiz;
  userId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [published, setPublished] = useState(existing?.is_published ?? true);
  const [musicUrl, setMusicUrl] = useState<string | null>(existing?.music_url ?? null);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [tab, setTab] = useState("info");
  const [savedId, setSavedId] = useState<string | null>(existing?.id ?? null);

  useEffect(() => {
    if (savedId) loadQuestions(savedId);
  }, [savedId]);

  const loadQuestions = async (id: string) => {
    const { data: qs } = await supabase.from("quiz_questions").select("*").eq("quiz_id", id).order("position");
    if (!qs) return;
    const ids = qs.map((q) => q.id);
    const { data: ans } = await supabase
      .from("quiz_answers").select("*")
      .in("question_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
      .order("position");
    setQuestions(qs.map((q) => ({ ...q, answers: (ans ?? []).filter((a) => a.question_id === q.id) })) as QuizQuestion[]);
  };

  const save = async () => {
    if (!title.trim()) return toast.error("Başlıq tələb olunur");
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      is_published: published,
      music_url: musicUrl,
      created_by: userId,
    };
    if (savedId) {
      const { error } = await supabase.from("quizzes").update(payload).eq("id", savedId);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("quizzes").insert(payload).select().single();
      if (error || !data) { toast.error(error?.message ?? "Xəta"); setSaving(false); return; }
      setSavedId(data.id);
      setTab("questions");
    }
    setSaving(false);
    toast.success("Yadda saxlanıldı");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{existing ? "Quiz redaktəsi" : "Yeni quiz"}</DialogTitle></DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="info">Məlumat</TabsTrigger>
            <TabsTrigger value="questions" disabled={!savedId}>Suallar ({questions.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="space-y-4 pt-4">
            <div><Label>Başlıq</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><Label>Təsvir</Label><Textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="flex items-center gap-2"><Switch checked={published} onCheckedChange={setPublished} /><Label>Dərc et</Label></div>
            <FileUpload
              label="Fon musiqisi (MP3)"
              icon={Music}
              value={musicUrl}
              onChange={setMusicUrl}
              accept="audio/mpeg,.mp3"
              folder="quiz-music"
            />
            {musicUrl && <audio src={musicUrl} controls className="w-full" />}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Bağla</Button>
              <Button onClick={save} disabled={saving}>{saving ? "..." : "Yadda saxla"}</Button>
            </DialogFooter>
          </TabsContent>
          <TabsContent value="questions" className="pt-4">
            {savedId && <QuestionsEditor quizId={savedId} questions={questions} reload={() => loadQuestions(savedId)} />}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function QuestionsEditor({ quizId, questions, reload }: { quizId: string; questions: QuizQuestion[]; reload: () => void; }) {
  const [text, setText] = useState("");
  const [answers, setAnswers] = useState<{ text: string; is_correct: boolean }[]>([
    { text: "", is_correct: false },
    { text: "", is_correct: false },
  ]);
  const [saving, setSaving] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);

  const reset = () => {
    setText("");
    setAnswers([{ text: "", is_correct: false }, { text: "", is_correct: false }]);
  };

  const addQuestion = async () => {
    if (!text.trim()) return toast.error("Sual mətnini daxil edin");
    const valid = answers.filter((a) => a.text.trim());
    if (valid.length < 2) return toast.error("Ən azı 2 cavab variantı");
    if (!valid.some((a) => a.is_correct)) return toast.error("Doğru cavab seçin");
    setSaving(true);
    const { data: q, error } = await supabase.from("quiz_questions").insert({
      quiz_id: quizId, text: text.trim(), position: questions.length, is_multiple: false,
    }).select().single();
    if (error || !q) { toast.error(error?.message ?? "Xəta"); setSaving(false); return; }
    const { error: aErr } = await supabase.from("quiz_answers").insert(
      valid.map((a, i) => ({ question_id: q.id, text: a.text.trim(), is_correct: a.is_correct, position: i }))
    );
    if (aErr) toast.error(aErr.message);
    else toast.success("Sual əlavə edildi");
    reset();
    setSaving(false);
    reload();
  };

  const importFromBank = async (items: ImportedQuestion[]) => {
    let pos = questions.length;
    for (const item of items) {
      const { data: q, error } = await supabase.from("quiz_questions").insert({
        quiz_id: quizId, text: item.text, position: pos++, is_multiple: false,
      }).select().single();
      if (error || !q) { toast.error(error?.message ?? "Xəta"); continue; }
      if (item.answers.length) {
        await supabase.from("quiz_answers").insert(
          item.answers.map((a) => ({
            question_id: q.id,
            text: a.text,
            is_correct: a.is_correct,
            position: a.position,
          })),
        );
      }
    }
    toast.success(`${items.length} sual əlavə edildi`);
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
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-display font-semibold">Yeni sual</div>
          <Button size="sm" variant="outline" onClick={() => setBankOpen(true)}>
            <Library className="h-4 w-4" /> Sual Bankından
          </Button>
        </div>
        <Textarea placeholder="Sual mətni" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="space-y-2">
          {answers.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <Checkbox
                checked={a.is_correct}
                onCheckedChange={(c) => setAnswers((arr) => arr.map((x, idx) => idx === i ? { ...x, is_correct: !!c } : { ...x, is_correct: false }))}
              />
              <Input value={a.text} placeholder={`Cavab ${i + 1}`}
                onChange={(e) => setAnswers((arr) => arr.map((x, idx) => idx === i ? { ...x, text: e.target.value } : x))} />
              {answers.length > 2 && (
                <Button size="icon" variant="ghost" onClick={() => setAnswers((arr) => arr.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setAnswers((a) => [...a, { text: "", is_correct: false }])}>
            <Plus className="h-3 w-3" /> Variant əlavə et
          </Button>
        </div>
        <Button onClick={addQuestion} disabled={saving}>{saving ? "..." : "Sualı əlavə et"}</Button>
      </Card>
      {bankOpen && (
        <BankPicker
          open={bankOpen}
          onClose={() => setBankOpen(false)}
          onImport={importFromBank}
        />
      )}

      <div className="space-y-2">
        <div className="font-display font-semibold">Mövcud suallar ({questions.length})</div>
        {questions.map((q, i) => (
          <Card key={q.id} className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="font-medium">{i + 1}. {q.text}</div>
              <Button size="icon" variant="ghost" onClick={() => removeQuestion(q.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
            <ul className="text-sm space-y-1 ml-4">
              {q.answers.map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  {a.is_correct ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className={a.is_correct ? "" : "text-muted-foreground"}>{a.text}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   LiveRoom: lobby + game + results (admin & user)
========================================================= */
type Participant = {
  id: string;
  user_id: string;
  full_name: string;
  score: number;
  finished: boolean;
};

function LiveRoom({ roomId, onLeave }: { roomId: string; onLeave: () => void }) {
  const { user, profile, isAdmin } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const { musicOn, toggleMusic, hasMusic } = useRoomMusic(musicUrl, room?.status ?? "lobby");



  // join (auto for non-admin)
  useEffect(() => {
    if (!user || !profile) return;
    (async () => {
      // fetch room
      const { data: r } = await supabase.from("quiz_rooms").select("*").eq("id", roomId).maybeSingle();
      if (!r) { toast.error("Otaq yoxdur"); onLeave(); return; }
      setRoom(r as Room);

      const { data: qz } = await supabase.from("quizzes").select("music_url").eq("id", r.quiz_id).maybeSingle();
      setMusicUrl((qz as { music_url: string | null } | null)?.music_url ?? null);

      // fetch questions
      const { data: qs } = await supabase.from("quiz_questions").select("*").eq("quiz_id", r.quiz_id).order("position");
      const ids = (qs ?? []).map((q) => q.id);
      const { data: ans } = await supabase.from("quiz_answers").select("*")
        .in("question_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).order("position");
      setQuestions((qs ?? []).map((q) => ({ ...q, answers: (ans ?? []).filter((a) => a.question_id === q.id) })) as QuizQuestion[]);

      // join as participant (admin too can spectate without joining)
      if (!isAdmin) {
        const { data: existing } = await supabase
          .from("room_participants").select("id").eq("room_id", roomId).eq("user_id", user.id).maybeSingle();
        if (existing) {
          setMyParticipantId(existing.id);
        } else {
          const { data: p, error } = await supabase.from("room_participants").insert({
            room_id: roomId, user_id: user.id, full_name: profile.full_name,
          }).select("id").single();
          if (error) toast.error(error.message);
          else if (p) setMyParticipantId(p.id);
        }
      }

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.id, profile?.id, isAdmin]);

  // realtime: room + participants (+ polling fallback so heç nə itmir)
  useEffect(() => {
    let alive = true;
    const refreshParticipants = async () => {
      const { data } = await supabase
        .from("room_participants")
        .select("id,user_id,full_name,score,finished")
        .eq("room_id", roomId)
        .order("score", { ascending: false });
      if (alive && data) setParticipants(data as Participant[]);
    };
    const refreshRoom = async () => {
      const { data } = await supabase.from("quiz_rooms").select("*").eq("id", roomId).maybeSingle();
      if (alive && data) setRoom(data as Room);
    };

    const ch = supabase.channel(`room:${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_rooms", filter: `id=eq.${roomId}` },
        (payload) => { if (payload.new) setRoom(payload.new as Room); })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_participants", filter: `room_id=eq.${roomId}` },
        () => { void refreshParticipants(); })
      .subscribe();

    void refreshParticipants();
    const poll = window.setInterval(() => {
      void refreshParticipants();
      void refreshRoom();
    }, 3000);

    return () => { alive = false; window.clearInterval(poll); supabase.removeChannel(ch); };
  }, [roomId]);


  if (loading || !room) {
    return <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const currentQ = room.current_question_index >= 0 ? questions[room.current_question_index] : null;

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-2">
            <KeyRound className="h-3 w-3" /> {room.code}
            <Badge variant={room.status === "lobby" ? "secondary" : room.status === "active" ? "default" : "outline"}>
              {room.status === "lobby" ? "Lobby" : room.status === "active" ? "Aktiv" : "Bitdi"}
            </Badge>
          </div>
          <h1 className="font-display text-2xl font-bold mt-1">Live Quiz Otağı</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm"><Users className="h-3.5 w-3.5 mr-1" /> {participants.length}</Badge>
          {hasMusic && <Button
            variant="outline"
            size="icon"
            onClick={toggleMusic}
            title={musicOn ? "Musiqini söndür" : "Otaq musiqisini yandır"}
            aria-label={musicOn ? "Musiqini söndür" : "Otaq musiqisini yandır"}
          >
            {musicOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>}
          <Button variant="outline" size="sm" onClick={onLeave}>Çıx</Button>
        </div>
      </div>

      {room.status === "lobby" && (
        <LobbyView room={room} participants={participants} questions={questions} isAdmin={isAdmin} />
      )}

      {room.status === "active" && currentQ && (
        <ActiveView
          room={room}
          question={currentQ}
          totalQuestions={questions.length}
          participants={participants}
          myParticipantId={myParticipantId}
          isAdmin={isAdmin}
          questions={questions}
        />
      )}

      {room.status === "finished" && (
        <FinishedView participants={participants} onLeave={onLeave} />
      )}
    </div>
  );
}

function LobbyView({ room, participants, questions, isAdmin }: { room: Room; participants: Participant[]; questions: QuizQuestion[]; isAdmin: boolean }) {
  const start = async () => {
    if (questions.length === 0) { toast.error("Quizdə sual yoxdur"); return; }
    const { error } = await supabase.from("quiz_rooms").update({
      status: "active",
      current_question_index: 0,
      current_question_started_at: new Date().toISOString(),
    }).eq("id", room.id);
    if (error) toast.error(error.message);
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <div className="font-display text-xl font-semibold mb-1">Lobby</div>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? "İştirakçılar qoşulduqca burada görünəcək. Hazır olanda Başlat düyməsinə basın." : "Admin yarışı başladanda quiz avtomatik açılacaq."}
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {participants.map((p) => (
          <div key={p.id} className="px-3 py-2 rounded-md bg-muted text-sm truncate">{p.full_name}</div>
        ))}
        {participants.length === 0 && (
          <div className="col-span-full text-sm text-muted-foreground text-center py-6">Hələ heç kim qoşulmayıb</div>
        )}
      </div>
      {isAdmin && (
        <Button size="lg" className="w-full" onClick={start} disabled={participants.length === 0}>
          <Play className="h-4 w-4 mr-1" /> Quizi başlat
        </Button>
      )}
    </Card>
  );
}

function ActiveView({
  room, question, totalQuestions, participants, myParticipantId, isAdmin, questions,
}: {
  room: Room; question: QuizQuestion; totalQuestions: number;
  participants: Participant[]; myParticipantId: string | null; isAdmin: boolean; questions: QuizQuestion[];
}) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ correct: boolean; score: number } | null>(null);
  const [now, setNow] = useState(Date.now());

  // reset on question change
  useEffect(() => {
    setSelected(null);
    setSubmitted(null);
  }, [question.id]);

  // ticker
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const startedAt = room.current_question_started_at ? new Date(room.current_question_started_at).getTime() : now;
  const elapsed = Math.max(0, now - startedAt);
  const limitMs = room.question_time_seconds * 1000;
  const remaining = Math.max(0, limitMs - elapsed);
  const progress = Math.min(100, (elapsed / limitMs) * 100);

  const submit = async (answerId: string) => {
    if (!user || !myParticipantId || submitted) return;
    const correctAnswer = question.answers.find((a) => a.is_correct);
    const isCorrect = answerId === correctAnswer?.id;
    const responseMs = elapsed;
    // speed-based: faster correct = more
    const ratio = Math.max(0, 1 - responseMs / limitMs);
    const award = isCorrect ? Math.round(500 + 500 * ratio) : 0;

    setSubmitted({ correct: isCorrect, score: award });

    const { error } = await supabase.from("room_answers").insert({
      room_id: room.id, participant_id: myParticipantId, user_id: user.id,
      question_id: question.id, answer_id: answerId,
      is_correct: isCorrect, response_ms: responseMs, score_awarded: award,
    });
    if (error) { toast.error(error.message); return; }
    if (award > 0) {
      // increment score on participant row (serverdən aktual bal oxunur)
      const { data: fresh } = await supabase
        .from("room_participants").select("score").eq("id", myParticipantId).maybeSingle();
      const base = fresh?.score ?? participants.find((p) => p.id === myParticipantId)?.score ?? 0;
      const { error: uErr } = await supabase
        .from("room_participants").update({ score: base + award }).eq("id", myParticipantId);
      if (uErr) toast.error(uErr.message);
    }
  };


  const next = async () => {
    const nextIdx = room.current_question_index + 1;
    if (nextIdx >= totalQuestions) {
      await supabase.from("quiz_rooms").update({ status: "finished", finished_at: new Date().toISOString() }).eq("id", room.id);
    } else {
      await supabase.from("quiz_rooms").update({
        current_question_index: nextIdx,
        current_question_started_at: new Date().toISOString(),
      }).eq("id", room.id);
    }
  };

  // auto-advance when timer hits 0 (admin drives the transition)
  useEffect(() => {
    if (!isAdmin) return;
    if (remaining > 0) return;
    const t = setTimeout(() => { next(); }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, remaining <= 0, question.id]);

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      <Card className="p-6 space-y-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Sual {room.current_question_index + 1} / {totalQuestions}</span>
          <span className="font-mono">{Math.ceil(remaining / 1000)}s</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>

        <h2 className="font-display text-xl font-semibold leading-snug">{question.text}</h2>

        <div className="space-y-2">
          {question.answers.map((a) => {
            const isSel = selected === a.id;
            const reveal = !!submitted;
            const isCorrect = a.is_correct;
            return (
              <button
                key={a.id}
                disabled={!!submitted || isAdmin || remaining <= 0}
                onClick={() => { setSelected(a.id); submit(a.id); }}
                className={[
                  "w-full text-left px-4 py-3 rounded-lg border-2 transition-all",
                  reveal && isCorrect ? "border-success bg-success/10" :
                  reveal && isSel && !isCorrect ? "border-destructive bg-destructive/10" :
                  isSel ? "border-primary bg-primary/5" :
                  "border-border hover:border-primary/40",
                  isAdmin ? "cursor-default opacity-90" : "",
                ].join(" ")}
              >
                {a.text}
              </button>
            );
          })}
        </div>

        {submitted && (
          <div className={["text-sm font-medium", submitted.correct ? "text-success" : "text-destructive"].join(" ")}>
            {submitted.correct ? `Doğrudur! +${submitted.score} bal` : "Səhv cavab"}
          </div>
        )}
        {!submitted && !isAdmin && remaining <= 0 && (
          <div className="text-sm text-muted-foreground">Vaxt bitdi.</div>
        )}

        {isAdmin && (
          <Button onClick={next} className="w-full">
            {room.current_question_index + 1 >= totalQuestions ? "Yarışı bitir" : "Növbəti sual"}
          </Button>
        )}
      </Card>

      <Card className="p-4 h-fit lg:sticky lg:top-20">
        <div className="font-display font-semibold mb-3 inline-flex items-center gap-2">
          <Users className="h-4 w-4" /> Liderlər
        </div>
        <ol className="space-y-1 text-sm">
          {participants.map((p, i) => (
            <li key={p.id} className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/40">
              <span className="truncate"><span className="text-muted-foreground mr-2">{i + 1}.</span>{p.full_name}</span>
              <span className="font-mono font-semibold">{p.score}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function FinishedView({ participants, onLeave }: { participants: Participant[]; onLeave: () => void }) {
  const sorted = [...participants].sort((a, b) => b.score - a.score);
  return (
    <Card className="p-6">
      <div className="font-display text-xl font-semibold mb-4">Final nəticələri</div>
      <ol className="space-y-2">
        {sorted.map((p, i) => (
          <li key={p.id} className={[
            "flex items-center justify-between px-4 py-3 rounded-lg",
            i === 0 ? "bg-warning/15" : i === 1 ? "bg-muted" : i === 2 ? "bg-accent" : "bg-muted/30",
          ].join(" ")}>
            <div className="flex items-center gap-3">
              <div className="font-display text-lg font-bold w-6 text-center">{i + 1}</div>
              <div className="font-medium">{p.full_name}</div>
            </div>
            <div className="font-mono text-lg font-semibold">{p.score}</div>
          </li>
        ))}
        {sorted.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">İştirakçı yoxdur</div>}
      </ol>
      <div className="mt-4">
        <Button variant="outline" className="w-full" onClick={onLeave}>Quiz bölməsinə qayıt</Button>
      </div>
    </Card>
  );
}
