import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  FolderPlus,
  Folder as FolderIcon,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Search,
  Library,
  ChevronRight,
  ChevronDown,
  Copy,
  FileText,
  ListChecks,
  MessageSquareText,
} from "lucide-react";

import { toast } from "sonner";
import { PageHeader } from "@/components/design/PageHeader";
import { StatCard } from "@/components/design/StatCard";
import { StatusChip } from "@/components/design/StatusChip";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/question-bank")({
  head: () => ({ meta: [
    { title: "Sual bankı | Baku Digital Lab" },
    { name: "description", content: "Təlim və imtahan suallarının idarə edilməsi." },
    { property: "og:title", content: "Sual bankı | Baku Digital Lab" },
    { property: "og:description", content: "Təlim və imtahan suallarının idarə edilməsi." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <ProtectedRoute requireAdmin>
      <QuestionBankPage />
    </ProtectedRoute>
  ),
});

type BankFolder = {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
};

type BankQuestion = {
  id: string;
  folder_id: string;
  text: string;
  question_type: "multiple_choice" | "open_ended" | "practice";
  difficulty: "easy" | "medium" | "hard";
  time_limit_seconds: number | null;
  is_gamification_enabled: boolean;
  answers?: { id: string; text: string; is_correct: boolean; position: number }[];
};

const DIFF_LABEL: Record<string, string> = {
  easy: "Asan",
  medium: "Orta",
  hard: "Çətin",
};
const TYPE_LABEL: Record<string, string> = {
  multiple_choice: "Çoxseçimli",
  open_ended: "Açıq sual",
  practice: "Təcrübə",
};

function QuestionBankPage() {
  const [folders, setFolders] = useState<BankFolder[]>([]);
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [folderDialog, setFolderDialog] = useState<{ open: boolean; folder: BankFolder | null }>({
    open: false,
    folder: null,
  });
  const [questionDialog, setQuestionDialog] = useState<{ open: boolean; question: BankQuestion | null }>({
    open: false,
    question: null,
  });
  const [search, setSearch] = useState("");
  const [gamifFilter, setGamifFilter] = useState<"all" | "on" | "off">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [typeCounts, setTypeCounts] = useState({ total: 0, mc: 0, open: 0 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const { user } = useAuth();
  const toggleIn = (setter: typeof setSelected, id: string) =>
    setter((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleExpanded = (id: string) => {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };


  const loadFolders = async () => {
    const { data } = await supabase
      .from("question_bank_folders")
      .select("id,name,description,parent_id")
      .order("name");
    setFolders((data ?? []) as BankFolder[]);


    const { data: qs } = await supabase
      .from("bank_questions")
      .select("folder_id,question_type");
    const counts: Record<string, number> = {};
    const byType = { total: 0, mc: 0, open: 0 };
    (qs ?? []).forEach((r: { folder_id: string; question_type: string }) => {
      counts[r.folder_id] = (counts[r.folder_id] ?? 0) + 1;
      byType.total++;
      if (r.question_type === "multiple_choice") byType.mc++;
      if (r.question_type === "open_ended") byType.open++;
    });
    setFolderCounts(counts);
    setTypeCounts(byType);
  };


  const loadQuestions = async (folderId: string | null) => {
    if (!folderId) {
      setQuestions([]);
      return;
    }
    const { data: qs } = await supabase
      .from("bank_questions")
      .select("id,folder_id,text,question_type,difficulty,time_limit_seconds,is_gamification_enabled")
      .eq("folder_id", folderId)
      .order("created_at", { ascending: false });
    const ids = (qs ?? []).map((q) => q.id);
    const { data: ans } = ids.length
      ? await supabase
          .from("bank_answers")
          .select("id,question_id,text,is_correct,position")
          .in("question_id", ids)
          .order("position")
      : { data: [] as any[] };
    setQuestions(
      (qs ?? []).map((q: any) => ({
        ...q,
        answers: (ans ?? []).filter((a: any) => a.question_id === q.id),
      })),
    );
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadFolders();
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    loadQuestions(activeFolder);
    setSelected(new Set());
    setOpenRows(new Set());
  }, [activeFolder]);

  // Maddə 51: sualı cavabları ilə birlikdə eyni mövzuda kopyalamaq (redaktorun insert sorğuları ilə eyni sütunlar).
  const copyQuestion = async (q: BankQuestion) => {
    const { data, error } = await supabase
      .from("bank_questions")
      .insert({
        folder_id: q.folder_id,
        text: `${q.text} (kopya)`,
        question_type: q.question_type,
        difficulty: q.difficulty,
        time_limit_seconds: q.time_limit_seconds,
        is_gamification_enabled: q.is_gamification_enabled,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (error || !data) return toast.error(error?.message ?? "Kopyalanmadı");
    const rows = (q.answers ?? []).map((a, idx) => ({
      question_id: data.id,
      text: a.text,
      is_correct: a.is_correct,
      position: idx,
    }));
    if (rows.length) {
      const { error: aErr } = await supabase.from("bank_answers").insert(rows);
      if (aErr) return toast.error(aErr.message);
    }
    toast.success("Sual kopyalandı");
    loadQuestions(activeFolder);
    loadFolders();
  };

  // Maddə 51: seçilmiş sualları silmək (tək-tək silmə ilə eyni sorğu).
  const deleteSelected = async () => {
    const ids = [...selected];
    if (!ids.length || !confirm(`${ids.length} sual silinsin?`)) return;
    setBulkBusy(true);
    const { error } = await supabase.from("bank_questions").delete().in("id", ids);
    setBulkBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Silindi");
    setSelected(new Set());
    setQuestions((qs) => qs.filter((q) => !ids.includes(q.id)));
    loadFolders();
  };

  const filteredQs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter((x) => {
      if (gamifFilter === "on" && !x.is_gamification_enabled) return false;
      if (gamifFilter === "off" && x.is_gamification_enabled) return false;
      return !q || x.text.toLowerCase().includes(q);
    });
  }, [questions, search, gamifFilter]);

  const deleteFolder = async (id: string) => {
    if (!confirm("Mövzu və içindəki bütün suallar silinsin?")) return;
    const { error } = await supabase.from("question_bank_folders").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Silindi");
    if (activeFolder === id) setActiveFolder(null);
    loadFolders();
  };

  const deleteQuestionWithRefresh = async (id: string) => {
    if (!confirm("Sual silinsin?")) return;
    const { error } = await supabase.from("bank_questions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setQuestions((qs) => qs.filter((q) => q.id !== id));
    loadFolders();
  };

  return (
    <div className="bento-page">
      <PageHeader
        title="Sual Bankı"
        description="Bütün imtahanlar üçün mərkəzi sual repozitorisi."
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard icon={FileText} label="Cəmi sual" value={typeCounts.total.toLocaleString("az-AZ")} />
            <StatCard icon={ListChecks} label="Test sualları" value={typeCounts.mc.toLocaleString("az-AZ")} />
            <StatCard icon={MessageSquareText} label="Açıq suallar" value={typeCounts.open.toLocaleString("az-AZ")} />
            <StatCard icon={FolderIcon} label="Mövzular" value={folders.length.toLocaleString("az-AZ")} />
          </div>

          <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            {/* Folders */}
            <section aria-labelledby="qb-folders" className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <h2 id="qb-folders" className="font-display font-semibold">Mövzular</h2>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  aria-label="Yeni mövzu"
                  onClick={() => setFolderDialog({ open: true, folder: null })}
                >
                  <FolderPlus className="h-4 w-4" />
                </Button>
              </div>
              {folders.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Hələ mövzu yoxdur
                </p>
              ) : (
                <div className="space-y-0.5">
                  <FolderTree
                    folders={folders}
                    counts={folderCounts}
                    parentId={null}
                    depth={0}
                    activeFolder={activeFolder}
                    onSelect={setActiveFolder}
                    onEdit={(f) => setFolderDialog({ open: true, folder: f })}
                    onDelete={deleteFolder}
                    expanded={expanded}
                    onToggle={toggleExpanded}
                  />
                </div>
              )}
            </section>

            {/* Questions */}
            <section className="min-w-0">
              {!activeFolder ? (
                <Card className="p-12 text-center border-dashed">
                  <Library className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <h3 className="font-display font-semibold">Mövzu seçin</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sual əlavə etmək üçün soldan qovluq seçin və ya yeni qovluq yaradın.
                  </p>
                </Card>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                  <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
                    <div className="relative min-w-[12rem] flex-1">
                      <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Sual axtar..."
                        aria-label="Sual axtar"
                        className="pl-9"
                      />
                    </div>
                    <Select value={gamifFilter} onValueChange={(v) => setGamifFilter(v as typeof gamifFilter)}>
                      <SelectTrigger className="w-44" aria-label="Gamification filtri">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Hamısı</SelectItem>
                        <SelectItem value="on">🟢 Gamification</SelectItem>
                        <SelectItem value="off">⚪ Gamification deaktiv</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={() => setQuestionDialog({ open: true, question: null })}>
                      <Plus className="h-4 w-4" /> Yeni sual
                    </Button>
                  </div>

                  {selected.size > 0 && (
                    <div className="flex flex-wrap items-center gap-3 border-b border-border bg-brand-50 px-4 py-2.5 text-sm dark:bg-brand-600/15" role="status">
                      <span className="font-medium text-brand-700 dark:text-brand-300">{selected.size} sual seçilib</span>
                      <Button size="sm" variant="destructive" disabled={bulkBusy} onClick={deleteSelected}>
                        {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Seçilənləri sil
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                        Seçimi ləğv et
                      </Button>
                    </div>
                  )}

                  {filteredQs.length === 0 ? (
                    <p className="p-10 text-center text-sm text-muted-foreground">
                      Bu qovluqda hələ sual yoxdur
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 border-b border-border bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
                        <Checkbox
                          aria-label="Hamısını seç"
                          checked={
                            filteredQs.every((q) => selected.has(q.id))
                              ? true
                              : filteredQs.some((q) => selected.has(q.id))
                                ? "indeterminate"
                                : false
                          }
                          onCheckedChange={(v) =>
                            setSelected(v === true ? new Set(filteredQs.map((q) => q.id)) : new Set())
                          }
                        />
                        <span className="hidden w-8 sm:inline">#</span>
                        <span className="flex-1">Sual</span>
                        <span className="hidden w-[7.5rem] sm:block">Əməliyyatlar</span>
                      </div>
                      <ul className="divide-y divide-border">
                        {filteredQs.map((q, idx) => {
                          const open = openRows.has(q.id);
                          const hasAnswers = q.question_type !== "open_ended" && (q.answers?.length ?? 0) > 0;
                          return (
                            <li key={q.id} className={cn("px-4 py-3", selected.has(q.id) && "bg-brand-25 dark:bg-brand-600/10")}>
                              <div className="flex items-start gap-3">
                                <Checkbox
                                  className="mt-0.5"
                                  aria-label={`Sual ${idx + 1} seç`}
                                  checked={selected.has(q.id)}
                                  onCheckedChange={() => toggleIn(setSelected, q.id)}
                                />
                                <span className="hidden w-8 shrink-0 pt-0.5 text-sm tabular-nums text-muted-foreground sm:inline">
                                  {String(idx + 1).padStart(3, "0")}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <button
                                    type="button"
                                    className="flex w-full items-start gap-1.5 rounded text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/25"
                                    aria-expanded={hasAnswers ? open : undefined}
                                    onClick={() => hasAnswers && toggleIn(setOpenRows, q.id)}
                                  >
                                    {hasAnswers && (
                                      <ChevronRight className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} aria-hidden="true" />
                                    )}
                                    <span className="min-w-0 flex-1 break-words">{q.text}</span>
                                  </button>
                                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                    <StatusChip tone={q.question_type === "open_ended" ? "brand" : "gray"}>{TYPE_LABEL[q.question_type]}</StatusChip>
                                    <StatusChip tone={q.difficulty === "easy" ? "success" : q.difficulty === "hard" ? "error" : "warning"}>
                                      {DIFF_LABEL[q.difficulty]}
                                    </StatusChip>
                                    <span className="text-xs text-muted-foreground" title="Gamification">
                                      {q.is_gamification_enabled ? "🟢 Aktiv" : "⚪ Aktiv deyil"}
                                    </span>
                                    {q.time_limit_seconds && (
                                      <span className="text-xs text-muted-foreground tabular-nums">{q.time_limit_seconds}s</span>
                                    )}
                                  </div>
                                  {hasAnswers && open && (
                                    <ul className="mt-2 space-y-1">
                                      {q.answers!.map((a) => (
                                        <li
                                          key={a.id}
                                          className={cn(
                                            "flex items-start gap-2 text-xs",
                                            a.is_correct ? "font-medium text-[var(--success-700)] dark:text-[var(--success-500)]" : "text-muted-foreground",
                                          )}
                                        >
                                          <span className="inline-block w-3 shrink-0">{a.is_correct ? "✓" : "•"}</span>
                                          <span className="min-w-0 break-words">{a.text}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                                <div className="flex shrink-0 gap-0.5">
                                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Redaktə et" onClick={() => setQuestionDialog({ open: true, question: q })}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Kopyala" onClick={() => copyQuestion(q)}>
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-[var(--error-50)] hover:text-[var(--error-600)]" aria-label="Sil" onClick={() => deleteQuestionWithRefresh(q.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {folderDialog.open && (
        <FolderEditor
          folder={folderDialog.folder}
          folders={folders}
          onClose={() => setFolderDialog({ open: false, folder: null })}
          onSaved={() => {
            setFolderDialog({ open: false, folder: null });
            loadFolders();
          }}
        />
      )}

      {questionDialog.open && activeFolder && (
        <QuestionEditor
          question={questionDialog.question}
          folderId={activeFolder}
          folders={folders}
          onClose={() => setQuestionDialog({ open: false, question: null })}
          onSaved={() => {
            setQuestionDialog({ open: false, question: null });
            loadQuestions(activeFolder);
            loadFolders();
          }}
        />
      )}

    </div>
  );
}

/* ============ Folder Editor ============ */

function FolderEditor({
  folder,
  folders,
  onClose,
  onSaved,
}: {
  folder: BankFolder | null;
  folders: BankFolder[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState(folder?.name ?? "");
  const [description, setDescription] = useState(folder?.description ?? "");
  const [parentId, setParentId] = useState<string>(folder?.parent_id ?? "none");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast.error("Ad tələb olunur");
    setSaving(true);
    const payload: any = {
      name: name.trim(),
      description: description.trim() || null,
      parent_id: parentId === "none" ? null : parentId,
    };
    let error;
    if (folder) {
      ({ error } = await supabase.from("question_bank_folders").update(payload).eq("id", folder.id));
    } else {
      payload.created_by = user?.id ?? null;
      ({ error } = await supabase.from("question_bank_folders").insert(payload));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Yadda saxlanıldı");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{folder ? "Mövzunu redaktə et" : "Yeni mövzu"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Ad</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Məs: Satış" />
          </div>
          <div className="grid gap-2">
            <Label>Təsvir</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid gap-2">
            <Label>Alt mövzu</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Yoxdur —</SelectItem>
                {folders
                  .filter((f) => f.id !== folder?.id)
                  .map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Ləğv et
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Saxla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ Question Editor ============ */

function QuestionEditor({
  question,
  folderId,
  folders,
  onClose,
  onSaved,
}: {
  question: BankQuestion | null;
  folderId: string;
  folders: BankFolder[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [text, setText] = useState(question?.text ?? "");
  const [type, setType] = useState<BankQuestion["question_type"]>(
    question?.question_type ?? "multiple_choice",
  );
  const [difficulty, setDifficulty] = useState<BankQuestion["difficulty"]>(
    question?.difficulty ?? "medium",
  );
  const [gamifEnabled, setGamifEnabled] = useState(question?.is_gamification_enabled ?? false);
  const [timeLimit, setTimeLimit] = useState(
    question?.time_limit_seconds ? String(question.time_limit_seconds) : "",
  );
  const initialFolder = question?.folder_id ?? folderId;
  const rootOf = (id: string): string => {
    let cur = folders.find((f) => f.id === id);
    while (cur?.parent_id) {
      const p = folders.find((f) => f.id === cur!.parent_id);
      if (!p) break;
      cur = p;
    }
    return cur?.id ?? id;
  };
  const initialRoot = initialFolder ? rootOf(initialFolder) : "";
  const [rootFolder, setRootFolder] = useState(initialRoot);
  const [subFolder, setSubFolder] = useState(
    initialFolder && initialFolder !== initialRoot ? initialFolder : "",
  );
  const [openRoots, setOpenRoots] = useState<Set<string>>(new Set());
  const rootFolders = folders.filter((f) => !f.parent_id);
  const subOptions = folders.filter((f) => f.parent_id === rootFolder);
  const targetFolder = subFolder || rootFolder;

  const [answers, setAnswers] = useState<{ id?: string; text: string; is_correct: boolean }[]>(
    question?.answers && question.answers.length
      ? question.answers.map((a) => ({ id: a.id, text: a.text, is_correct: a.is_correct }))
      : [
          { text: "", is_correct: true },
          { text: "", is_correct: false },
          { text: "", is_correct: false },
          { text: "", is_correct: false },
        ],
  );
  const [saving, setSaving] = useState(false);

  const updateAnswer = (i: number, patch: Partial<typeof answers[number]>) => {
    setAnswers((arr) => arr.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  };

  const save = async () => {
    if (!text.trim()) return toast.error("Sual mətni tələb olunur");
    if (!targetFolder) return toast.error("Mövzu seçin");

    if (type !== "open_ended") {
      const valid = answers.filter((a) => a.text.trim());
      if (valid.length < 2) return toast.error("Ən az 2 cavab variantı tələb olunur");
      if (!valid.some((a) => a.is_correct)) return toast.error("Ən az bir doğru cavab seçin");
    }
    setSaving(true);
    const payload: any = {
      folder_id: targetFolder,
      text: text.trim(),
      question_type: type,
      difficulty,
      time_limit_seconds: timeLimit ? Number(timeLimit) : null,
      is_gamification_enabled: gamifEnabled,
    };
    let qId = question?.id;
    if (question) {
      const { error } = await supabase.from("bank_questions").update(payload).eq("id", question.id);
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
      // wipe & re-insert answers
      await supabase.from("bank_answers").delete().eq("question_id", question.id);
    } else {
      payload.created_by = user?.id ?? null;
      const { data, error } = await supabase
        .from("bank_questions")
        .insert(payload)
        .select()
        .single();
      if (error || !data) {
        setSaving(false);
        return toast.error(error?.message ?? "Xəta");
      }
      qId = data.id;
    }
    if (type !== "open_ended" && qId) {
      const rows = answers
        .filter((a) => a.text.trim())
        .map((a, idx) => ({
          question_id: qId,
          text: a.text.trim(),
          is_correct: a.is_correct,
          position: idx,
        }));
      if (rows.length) {
        const { error: aErr } = await supabase.from("bank_answers").insert(rows);
        if (aErr) {
          setSaving(false);
          return toast.error(aErr.message);
        }
      }
    }
    setSaving(false);
    toast.success("Yadda saxlanıldı");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{question ? "Sualı redaktə et" : "Yeni sual"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Sual mətni</Label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Növ</Label>
              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="multiple_choice">Çoxseçimli</SelectItem>
                  <SelectItem value="open_ended">Açıq sual</SelectItem>
                  <SelectItem value="practice">Təcrübə</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Çətinlik</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Asan</SelectItem>
                  <SelectItem value="medium">Orta</SelectItem>
                  <SelectItem value="hard">Çətin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Vaxt limiti (san)</Label>
              <Input
                type="number"
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
                placeholder="Opsional"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={gamifEnabled}
              onChange={(e) => setGamifEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            Gamification üçün aktiv — bu sual Gamification Center-də istifadə oluna bilər
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Mövzu</Label>
              <div className="border rounded-md max-h-44 overflow-y-auto p-1">
                {rootFolders.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2">Mövzu yoxdur</p>
                )}
                {rootFolders.map((f) => {
                  const kids = folders.filter((c) => c.parent_id === f.id);
                  const isOpen = openRoots.has(f.id);
                  return (
                    <div key={f.id}>
                      <div
                        className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-sm cursor-pointer ${
                          rootFolder === f.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                        }`}
                        onClick={() => {
                          setRootFolder(f.id);
                          setSubFolder("");
                        }}
                      >
                        {kids.length > 0 ? (
                          <button
                            type="button"
                            aria-label={isOpen ? "Bağla" : "Aç"}
                            className="p-0.5 text-muted-foreground shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenRoots((s) => {
                                const n = new Set(s);
                                n.has(f.id) ? n.delete(f.id) : n.add(f.id);
                                return n;
                              });
                            }}
                          >
                            {isOpen ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                        ) : (
                          <span className="w-[18px] shrink-0" />
                        )}
                        <FolderIcon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 truncate">{f.name}</span>
                      </div>
                      {isOpen &&
                        kids.map((k) => (
                          <div
                            key={k.id}
                            className="pl-8 pr-2 py-1 text-xs text-muted-foreground truncate"
                          >
                            {k.name}
                          </div>
                        ))}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Alt mövzu</Label>
              <Select
                value={subFolder}
                onValueChange={setSubFolder}
                disabled={!rootFolder || subOptions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={rootFolder ? "Alt mövzu seçin (opsional)" : "Əvvəlcə mövzu seçin"} />
                </SelectTrigger>
                <SelectContent>
                  {subOptions.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {rootFolder && subOptions.length === 0 && (
                <p className="text-xs text-muted-foreground">Bu mövzunun alt mövzusu yoxdur</p>
              )}
            </div>
          </div>


          {type !== "open_ended" && (
            <div className="space-y-2">
              <Label>Cavab variantları (3-5)</Label>
              {answers.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={a.is_correct}
                    onChange={(e) => updateAnswer(i, { is_correct: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Input
                    value={a.text}
                    onChange={(e) => updateAnswer(i, { text: e.target.value })}
                    placeholder={`Variant ${i + 1}`}
                  />
                  {answers.length > 2 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setAnswers((arr) => arr.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {answers.length < 5 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAnswers((a) => [...a, { text: "", is_correct: false }])}
                >
                  <Plus className="h-4 w-4" /> Variant əlavə et
                </Button>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Ləğv et
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Saxla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ Folder Tree ============ */

function FolderTree({
  folders,
  counts,
  parentId,
  depth,
  activeFolder,
  onSelect,
  onEdit,
  onDelete,
  expanded,
  onToggle,
}: {
  folders: BankFolder[];
  counts: Record<string, number>;
  parentId: string | null;
  depth: number;
  activeFolder: string | null;
  onSelect: (id: string) => void;
  onEdit: (f: BankFolder) => void;
  onDelete: (id: string) => void;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const children = folders.filter((f) => (f.parent_id ?? null) === parentId);
  if (children.length === 0) return null;
  const totalFor = (id: string): number => {
    const own = counts[id] ?? 0;
    const kids = folders.filter((c) => c.parent_id === id);
    return own + kids.reduce((s, k) => s + totalFor(k.id), 0);
  };
  return (
    <>
      {children.map((f) => {
        const hasKids = folders.some((c) => c.parent_id === f.id);
        const isOpen = expanded.has(f.id);
        const count = totalFor(f.id);
        return (
          <div key={f.id}>
            <div
              className={`group flex items-center gap-1 px-2 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                activeFolder === f.id
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted"
              }`}
              style={{ paddingLeft: 4 + depth * 14 }}
              onClick={() => onSelect(f.id)}
            >
              {hasKids ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(f.id);
                  }}
                  className="p-0.5 text-muted-foreground hover:text-foreground shrink-0"
                  aria-label={isOpen ? "Bağla" : "Aç"}
                >
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : (
                <span className="w-[18px] shrink-0" />
              )}
              <FolderIcon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{f.name}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                {count}
              </Badge>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(f);
                }}
                aria-label="Redaktə et"
                className="p-1 text-muted-foreground hover:text-foreground md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(f.id);
                }}
                aria-label="Sil"
                className="p-1 text-muted-foreground hover:text-destructive md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
              >

                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {hasKids && isOpen && (
              <FolderTree
                folders={folders}
                counts={counts}
                parentId={f.id}
                depth={depth + 1}
                activeFolder={activeFolder}
                onSelect={onSelect}
                onEdit={onEdit}
                onDelete={onDelete}
                expanded={expanded}
                onToggle={onToggle}
              />
            )}
          </div>
        );
      })}
    </>
  );

}

