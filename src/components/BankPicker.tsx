import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Folder as FolderIcon, Loader2, Sparkles, Search, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";

type Folder = { id: string; name: string; parent_id: string | null };
type BankQ = {
  id: string;
  folder_id: string;
  text: string;
  question_type: "multiple_choice" | "open_ended" | "practice";
  difficulty: "easy" | "medium" | "hard";
  time_limit_seconds: number | null;
  answers: { id: string; text: string; is_correct: boolean; position: number }[];
};

export type ImportedQuestion = {
  text: string;
  time_limit_seconds: number | null;
  answers: { text: string; is_correct: boolean; position: number }[];
};

/**
 * Reusable picker dialog. Returns selected questions as plain snapshots
 * (caller persists them into its own exam tables).
 */
export function BankPicker({
  open,
  onClose,
  onImport,
  multiple = true,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (questions: ImportedQuestion[]) => Promise<void> | void;
  multiple?: boolean;
}) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [questions, setQuestions] = useState<BankQ[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"manual" | "auto">("manual");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  // Auto-generate state
  const [autoFolders, setAutoFolders] = useState<Set<string>>(new Set());
  const toggleAutoFolder = (id: string) => {
    setAutoFolders((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const [autoCount, setAutoCount] = useState("10");
  const [autoEasy, setAutoEasy] = useState("");
  const [autoMedium, setAutoMedium] = useState("");
  const [autoHard, setAutoHard] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("question_bank_folders")
        .select("id,name,parent_id")
        .order("name");
      setFolders((data ?? []) as Folder[]);
      setExpanded(new Set());
      const { data: qs } = await supabase.from("bank_questions").select("folder_id");
      const counts: Record<string, number> = {};
      (qs ?? []).forEach((r: any) => {
        counts[r.folder_id] = (counts[r.folder_id] ?? 0) + 1;
      });
      setFolderCounts(counts);
    })();
  }, [open]);


  useEffect(() => {
    if (!activeFolder) {
      setQuestions([]);
      return;
    }
    (async () => {
      setLoading(true);
      const { data: qs } = await supabase
        .from("bank_questions")
        .select("id,folder_id,text,question_type,difficulty,time_limit_seconds")
        .eq("folder_id", activeFolder);
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
      setLoading(false);
    })();
  }, [activeFolder]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter((x) => !q || x.text.toLowerCase().includes(q));
  }, [questions, search]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else {
        if (!multiple) n.clear();
        n.add(id);
      }
      return n;
    });
  };

  const toSnapshot = (q: BankQ): ImportedQuestion => ({
    text: q.text,
    time_limit_seconds: q.time_limit_seconds,
    answers: q.answers.map((a, i) => ({
      text: a.text,
      is_correct: a.is_correct,
      position: i,
    })),
  });

  const importSelected = async () => {
    const picks = questions.filter((q) => selected.has(q.id));
    if (picks.length === 0) return toast.error("Heç bir sual seçilməyib");
    await onImport(picks.map(toSnapshot));
    setSelected(new Set());
    onClose();
  };

  const generateAuto = async () => {
    const folderIds = [...autoFolders];
    if (folderIds.length === 0) return toast.error("Ən azı bir mövzu seçin");
    const total = Number(autoCount);
    const e = Number(autoEasy) || 0;
    const m = Number(autoMedium) || 0;
    const h = Number(autoHard) || 0;
    const useDiff = e + m + h > 0;
    if (!useDiff && (!total || total < 1)) return toast.error("Sual sayını daxil edin");

    setGenerating(true);
    // load full pool from the selected folders
    const { data: qs } = await supabase
      .from("bank_questions")
      .select("id,folder_id,text,question_type,difficulty,time_limit_seconds")
      .in("folder_id", folderIds);
    const pool = (qs ?? []) as BankQ[];

    const pickN = (arr: BankQ[], n: number) => {
      const shuffled = [...arr].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, n);
    };

    let picked: BankQ[] = [];
    if (useDiff) {
      const byD = {
        easy: pool.filter((q) => q.difficulty === "easy"),
        medium: pool.filter((q) => q.difficulty === "medium"),
        hard: pool.filter((q) => q.difficulty === "hard"),
      };
      if (byD.easy.length < e || byD.medium.length < m || byD.hard.length < h) {
        toast.warning(
          `Qovluqda kifayət qədər sual yoxdur (Asan: ${byD.easy.length}, Orta: ${byD.medium.length}, Çətin: ${byD.hard.length}). Mövcud olanlar əlavə ediləcək.`,
        );
      }
      picked = [
        ...pickN(byD.easy, e),
        ...pickN(byD.medium, m),
        ...pickN(byD.hard, h),
      ];
    } else {
      if (pool.length < total) {
        toast.warning(
          `Qovluqda yalnız ${pool.length} sual var. Hamısı əlavə ediləcək.`,
        );
      }
      picked = pickN(pool, total);
    }

    if (picked.length === 0) {
      setGenerating(false);
      return toast.error("Heç bir sual tapılmadı");
    }

    // Load answers for picked
    const ids = picked.map((q) => q.id);
    const { data: ans } = await supabase
      .from("bank_answers")
      .select("id,question_id,text,is_correct,position")
      .in("question_id", ids)
      .order("position");
    const full = picked.map((q) => ({
      ...q,
      answers: (ans ?? []).filter((a: any) => a.question_id === q.id),
    })) as BankQ[];

    await onImport(full.map(toSnapshot));
    setGenerating(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sual Bankından əlavə et</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="manual">Suallar seç</TabsTrigger>
            <TabsTrigger value="auto">
              <Sparkles className="h-4 w-4" /> Avtomatik yarat
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual">
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <div className="space-y-1 max-h-[50vh] overflow-y-auto border rounded-md p-2">
                {folders.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2">
                    Sual bankında mövzu yoxdur.
                  </p>
                )}
                <FolderPickerTree
                  folders={folders}
                  counts={folderCounts}
                  parentId={null}
                  depth={0}
                  activeFolder={activeFolder}
                  onSelect={setActiveFolder}
                  expanded={expanded}
                  onToggle={toggleExpanded}
                />
              </div>


              <div className="space-y-3">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Axtar..."
                    className="pl-9"
                  />
                </div>
                <div className="max-h-[45vh] overflow-y-auto space-y-2 pr-1">
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : filtered.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      {activeFolder ? "Sual yoxdur" : "Mövzu seçin"}
                    </p>
                  ) : (
                    filtered.map((q) => (
                      <label
                        key={q.id}
                        className={`flex items-start gap-3 p-3 border rounded-md cursor-pointer ${
                          selected.has(q.id) ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(q.id)}
                          onChange={() => toggle(q.id)}
                          className="h-4 w-4 mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {q.difficulty === "easy"
                                ? "Asan"
                                : q.difficulty === "hard"
                                ? "Çətin"
                                : "Orta"}
                            </Badge>
                          </div>
                          <p className="text-sm">{q.text}</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={onClose}>
                Ləğv et
              </Button>
              <Button onClick={importSelected} disabled={selected.size === 0}>
                {selected.size} sual əlavə et
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="auto">
            <div className="space-y-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Mövzular (bir və ya bir neçə)</Label>
                  <span className="text-xs text-muted-foreground">{autoFolders.size} seçilib</span>
                </div>
                <div className="max-h-[30vh] overflow-y-auto border rounded-md p-2 space-y-1">
                  {folders.length === 0 && (
                    <p className="text-xs text-muted-foreground p-2">Sual bankında mövzu yoxdur.</p>
                  )}
                  {(() => {
                    const flatten = (parentId: string | null, depth: number): { f: Folder; depth: number }[] => {
                      const kids = folders.filter((x) => (x.parent_id ?? null) === parentId);
                      return kids.flatMap((k) => [{ f: k, depth }, ...flatten(k.id, depth + 1)]);
                    };
                    return flatten(null, 0).map(({ f, depth }) => (
                      <label
                        key={f.id}
                        className="flex items-center gap-2 text-sm py-1 px-1 rounded hover:bg-muted cursor-pointer"
                        style={{ paddingLeft: 4 + depth * 14 }}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={autoFolders.has(f.id)}
                          onChange={() => toggleAutoFolder(f.id)}
                        />
                        <FolderIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate">{f.name}</span>
                        <span className="text-[10px] bg-muted rounded px-1.5 py-0.5">
                          {folderCounts[f.id] ?? 0}
                        </span>
                      </label>
                    ));
                  })()}
                </div>
              </div>



              <div className="grid gap-2">
                <Label>Sual sayı (çətinlik göstərilməsə)</Label>
                <Input
                  type="number"
                  value={autoCount}
                  onChange={(e) => setAutoCount(e.target.value)}
                />
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">
                  Çətinlik bölgüsü <span className="text-muted-foreground text-xs">(opsional)</span>
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-1">
                    <Label className="text-xs">Asan</Label>
                    <Input
                      type="number"
                      value={autoEasy}
                      onChange={(e) => setAutoEasy(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Orta</Label>
                    <Input
                      type="number"
                      value={autoMedium}
                      onChange={(e) => setAutoMedium(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Çətin</Label>
                    <Input
                      type="number"
                      value={autoHard}
                      onChange={(e) => setAutoHard(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={onClose}>
                Ləğv et
              </Button>
              <Button onClick={generateAuto} disabled={generating || autoFolders.size === 0}>
                {generating && <Loader2 className="h-4 w-4 animate-spin" />}
                <Sparkles className="h-4 w-4" /> Avtomatik yarat
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function FolderPickerTree({
  folders,
  counts,
  parentId,
  depth,
  activeFolder,
  onSelect,
  expanded,
  onToggle,
}: {
  folders: Folder[];
  counts: Record<string, number>;
  parentId: string | null;
  depth: number;
  activeFolder: string | null;
  onSelect: (id: string) => void;
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
        return (
          <div key={f.id}>
            <div
              className={`w-full flex items-center gap-1 px-2 py-1.5 text-sm rounded-md ${
                activeFolder === f.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
              }`}
              style={{ paddingLeft: 4 + depth * 14 }}
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
              <button
                type="button"
                onClick={() => onSelect(f.id)}
                className="flex-1 flex items-center gap-2 min-w-0 text-left"
              >
                <FolderIcon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-[10px] bg-muted rounded px-1.5 py-0.5">{totalFor(f.id)}</span>
              </button>
            </div>
            {hasKids && isOpen && (
              <FolderPickerTree
                folders={folders}
                counts={counts}
                parentId={f.id}
                depth={depth + 1}
                activeFolder={activeFolder}
                onSelect={onSelect}
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


