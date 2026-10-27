import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cellsOf, generateCrossword, normalizeWord, type GeneratedCrossword, type PlacedWord } from "@/lib/crossword";
import { Grid3x3, Plus, Trash2, Pencil, Wand2, Loader2, ArrowLeft, CheckCircle2, Clock, BarChart3, PlayCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const fmtSecs = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export const Route = createFileRoute("/crosswords")({
  validateSearch: (s: Record<string, unknown>): { resume?: string } =>
    typeof s.resume === "string" && s.resume ? { resume: s.resume } : {},
  head: () => ({
    meta: [
      { title: "Krossvordlar · Baku Digital Lab" },
      { name: "description", content: "Təlim krossvordlarını həll et və ya yeni krossvord qur." },
      { property: "og:title", content: "Krossvordlar · Baku Digital Lab" },
      { property: "og:description", content: "Təlim krossvordları — həll et və öyrən." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <CrosswordsPage />
    </ProtectedRoute>
  ),
});

type Crossword = {
  id: string; title: string; description: string | null; is_published: boolean;
  rows: number; cols: number; layout: PlacedWord[]; created_at: string;
};
type Completion = { crossword_id: string; score_percent: number };

type Draft = { filled: number; elapsed: number };

function CrosswordsPage() {
  const { isAdmin, user } = useAuth();
  const { resume } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [items, setItems] = useState<Crossword[]>([]);
  const [done, setDone] = useState<Record<string, number>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Crossword | null | "new">(null);
  const [solving, setSolving] = useState<Crossword | null>(null);
  const [stats, setStats] = useState<Crossword | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("crosswords")
      .select("id,title,description,is_published,rows,cols,layout,created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data ?? []) as unknown as Crossword[]);
    if (user) {
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase.from("crossword_completions").select("crossword_id,score_percent").eq("user_id", user.id),
        supabase.from("crossword_progress").select("crossword_id,cell_values,elapsed_seconds").eq("user_id", user.id),
      ]);
      const best: Record<string, number> = {};
      ((c ?? []) as Completion[]).forEach((x) => { best[x.crossword_id] = Math.max(best[x.crossword_id] ?? 0, Number(x.score_percent)); });
      setDone(best);
      const d: Record<string, Draft> = {};
      (p ?? []).forEach((x) => {
        const filled = Object.values((x.cell_values ?? {}) as Record<string, string>).filter(Boolean).length;
        if (filled > 0) d[x.crossword_id] = { filled, elapsed: x.elapsed_seconds };
      });
      setDrafts(d);
    }
    setLoading(false);
  };
  useEffect(() => { void load(); }, [user?.id]);

  // Open a crossword directly via ?resume=<id> (e.g. from the profile page)
  useEffect(() => {
    if (!resume || loading) return;
    const cw = items.find((x) => x.id === resume);
    if (cw) setSolving(cw);
    void navigate({ search: {}, replace: true });
  }, [resume, loading, items]);

  const remove = async (id: string) => {
    if (!confirm("Bu krossvordu silmək istədiyinizə əminsiniz?")) return;
    const { error } = await supabase.from("crosswords").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Silindi"); void load();
  };

  if (solving) return <Solver cw={solving} onBack={() => { setSolving(null); void load(); }} />;

  const draftItems = items.filter((cw) => drafts[cw.id]);
  const totalCells = (cw: Crossword) => new Set(cw.layout.flatMap((w) => cellsOf(w).map(({ r, c }) => `${r},${c}`))).size;

  return (
    <div className="bento-page space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Krossvordlar</h1>
          <p className="text-muted-foreground text-sm">
            {isAdmin ? "Sözləri və sualları yaz — sistem krossvordu avtomatik qursun." : "Krossvordları həll et və biliyini yoxla."}
          </p>
        </div>
        {isAdmin && <Button onClick={() => setEditing("new")}><Plus className="h-4 w-4 mr-2" />Yeni krossvord</Button>}
      </div>

      {!loading && draftItems.length > 0 && (
        <Card className="p-4 border-warning/50 bg-warning/10 space-y-3">
          <div className="flex items-center gap-2 font-semibold"><PlayCircle className="h-5 w-5 text-warning" />Yarımçıq qalmış krossvordlar</div>
          <div className="flex flex-col gap-2">
            {draftItems.map((cw) => (
              <div key={cw.id} className="flex flex-wrap items-center gap-3 rounded-md bg-background p-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{cw.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {drafts[cw.id].filled}/{totalCells(cw)} xana doldurulub · {fmtSecs(drafts[cw.id].elapsed)}
                  </div>
                </div>
                <Button size="sm" onClick={() => setSolving(cw)}><PlayCircle className="h-4 w-4 mr-2" />Davam et</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Grid3x3 className="h-10 w-10 mx-auto mb-3 opacity-50" />Hələ krossvord yoxdur.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((cw) => (
            <Card key={cw.id} className="p-5 flex flex-col gap-3 border-0">
              <div className="h-36 flex items-center justify-center overflow-hidden rounded-md bg-muted/40" aria-hidden="true"><div className="pointer-events-none origin-center scale-[0.4]"><GridView rows={cw.rows} cols={cw.cols} layout={cw.layout} /></div></div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-tight">{cw.title}</h3>
                <div className="flex gap-1 flex-wrap justify-end">
                  {drafts[cw.id] && <Badge className="bg-warning text-warning-foreground hover:bg-warning">Yarımçıq</Badge>}
                  {isAdmin && <Badge variant={cw.is_published ? "default" : "secondary"}>{cw.is_published ? "Dərc olunub" : "Layihə"}</Badge>}
                </div>
              </div>
              {cw.description && <p className="text-sm text-muted-foreground line-clamp-2">{cw.description}</p>}
              <div className="text-xs text-muted-foreground flex gap-3">
                <span>{cw.layout.length} söz</span><span>{cw.rows}×{cw.cols}</span>
                {done[cw.id] !== undefined && <span className="text-primary font-medium">Ən yaxşı: {done[cw.id]}%</span>}
              </div>
              <div className="mt-auto flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => setSolving(cw)} disabled={!cw.is_published && !isAdmin}>
                  {drafts[cw.id] ? <><PlayCircle className="h-4 w-4 mr-2" />Davam et</> : done[cw.id] !== undefined ? "Yenidən həll et" : "Həll et"}
                </Button>
                {isAdmin && <>
                  <Button size="icon" variant="outline" className="h-9 w-9" title="Nəticələr" onClick={() => setStats(cw)}><BarChart3 className="h-4 w-4" /></Button>
                  <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => setEditing(cw)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => remove(cw.id)}><Trash2 className="h-4 w-4" /></Button>
                </>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && <Builder initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />}
      {stats && <ResultsDialog cw={stats} onClose={() => setStats(null)} />}
    </div>
  );
}

function GridView({ rows, cols, layout, values, results, onCell, onKey, onFocusCell, active, inputsRef }: {
  rows: number; cols: number; layout: PlacedWord[];
  values?: Record<string, string>; results?: Record<string, boolean>;
  onCell?: (k: string, v: string, r: number, c: number) => void;
  onKey?: (e: React.KeyboardEvent, r: number, c: number) => void;
  onFocusCell?: (r: number, c: number, toggle: boolean) => void;
  active?: Set<string>;
  inputsRef?: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
}) {
  const cells = useMemo(() => {
    const m = new Map<string, number | null>();
    layout.forEach((w) => cellsOf(w).forEach(({ r, c }, i) => {
      const k = `${r},${c}`;
      if (i === 0) m.set(k, w.number); else if (!m.has(k)) m.set(k, null);
    }));
    return m;
  }, [layout]);
  const size = cols > 14 ? "w-6 h-6 text-xs" : "w-8 h-8 md:w-9 md:h-9 text-sm";
  return (
    <div className="overflow-auto">
      <div className="inline-grid gap-px" style={{ gridTemplateColumns: `repeat(${cols}, auto)` }}>
        {Array.from({ length: rows * cols }, (_, idx) => {
          const r = Math.floor(idx / cols), c = idx % cols, k = `${r},${c}`;
          if (!cells.has(k)) return <div key={k} className={size} />;
          const num = cells.get(k);
          const res = results?.[k];
          return (
            <div key={k} className={cn("relative border border-border bg-background", size,
              active?.has(k) && "bg-accent", res === true && "bg-success/20", res === false && "bg-destructive/20")}>
              {num != null && <span className="absolute top-0 left-0.5 text-[9px] leading-none text-muted-foreground">{num}</span>}
              {onCell ? (
                <input
                  ref={(el) => { if (inputsRef) inputsRef.current[k] = el; }}
                  value={values?.[k] ?? ""}
                  maxLength={2}
                  onChange={(e) => onCell(k, normalizeWord(e.target.value).slice(-1), r, c)}
                  onKeyDown={(e) => onKey?.(e, r, c)}
                  onFocus={() => onFocusCell?.(r, c, false)}
                  onClick={(e) => { if (document.activeElement === e.currentTarget && e.detail > 0) onFocusCell?.(r, c, e.detail >= 2); }}
                  className={cn("w-full h-full text-center font-semibold uppercase bg-transparent outline-none focus:bg-accent",
                    res === true && "text-success", res === false && "text-destructive")}
                />
              ) : (
                <span className="flex w-full h-full items-center justify-center font-semibold">{values?.[k]}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Clues({ layout, onPick, results }: { layout: PlacedWord[]; onPick?: (i: number) => void; results?: boolean[] }) {
  const group = (d: "across" | "down") => layout.map((w, i) => ({ w, i })).filter((x) => x.w.direction === d);
  return (
    <div className="grid sm:grid-cols-2 gap-4 text-sm">
      {(["across", "down"] as const).map((d) => (
        <div key={d}>
          <div className="font-semibold mb-2">{d === "across" ? "Üfüqi" : "Şaquli"}</div>
          <ol className="space-y-1">
            {group(d).map(({ w, i }) => (
              <li key={i} onClick={() => onPick?.(i)} className={cn("cursor-pointer rounded px-1 hover:bg-muted flex gap-2",
                results?.[i] === true && "text-success", results?.[i] === false && "text-destructive")}>
                <span className="font-semibold">{w.number}.</span><span>{w.clue} <span className="text-muted-foreground">({w.length})</span></span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

function Solver({ cw, onBack }: { cw: Crossword; onBack: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [activeWord, setActiveWord] = useState(0);
  const [result, setResult] = useState<{ correct: number; total: number; results: boolean[]; xp?: number; seconds: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(Date.now());
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const { user } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [restored, setRestored] = useState(false);
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const doneRef = useRef(false);

  // Load saved progress
  useEffect(() => {
    if (!user) return;
    supabase.from("crossword_progress").select("cell_values,elapsed_seconds").eq("crossword_id", cw.id).eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data && Object.values((data.cell_values ?? {}) as Record<string, string>).some(Boolean)) {
          setValues((data.cell_values ?? {}) as Record<string, string>);
          started.current = Date.now() - data.elapsed_seconds * 1000;
          setElapsed(data.elapsed_seconds);
          setRestored(true);
        }
        setLoaded(true);
      });
  }, [user, cw.id]);

  const saveProgress = () => {
    if (!user || !loaded || doneRef.current) return;
    const hasAny = Object.values(valuesRef.current).some(Boolean);
    if (!hasAny) {
      // Nothing typed yet — don't keep an empty draft around
      void supabase.from("crossword_progress").delete().eq("crossword_id", cw.id).eq("user_id", user.id).then(() => {});
      return;
    }
    const secs = Math.round((Date.now() - started.current) / 1000);
    void supabase.from("crossword_progress").upsert(
      { crossword_id: cw.id, user_id: user.id, cell_values: valuesRef.current, elapsed_seconds: secs, updated_at: new Date().toISOString() },
      { onConflict: "crossword_id,user_id" },
    ).then(() => {});
  };

  // Save after edits (debounced) and periodically; also on leave
  useEffect(() => {
    if (!loaded || result) return;
    const t = setTimeout(saveProgress, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, loaded]);
  useEffect(() => {
    if (!loaded || result) return;
    const t = setInterval(saveProgress, 15000);
    return () => { clearInterval(t); saveProgress(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, result]);

  useEffect(() => {
    if (result) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [result]);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const clearProgress = () => { if (user) void supabase.from("crossword_progress").delete().eq("crossword_id", cw.id).eq("user_id", user.id).then(() => {}); };

  const active = useMemo(() => new Set(cellsOf(cw.layout[activeWord] ?? cw.layout[0]).map(({ r, c }) => `${r},${c}`)), [activeWord, cw]);
  const cellResults = useMemo(() => {
    if (!result) return undefined;
    const m: Record<string, boolean> = {};
    cw.layout.forEach((w, i) => cellsOf(w).forEach(({ r, c }) => {
      const k = `${r},${c}`; m[k] = (m[k] ?? true) && result.results[i];
    }));
    return m;
  }, [result, cw]);

  const wordsAt = (r: number, c: number) => cw.layout.map((w, i) => ({ w, i })).filter(({ w }) => cellsOf(w).some((x) => x.r === r && x.c === c)).map((x) => x.i);
  const focus = (r: number, c: number) => inputs.current[`${r},${c}`]?.focus();

  const onCell = (k: string, v: string, r: number, c: number) => {
    setValues((s) => ({ ...s, [k]: v }));
    if (!v) return;
    let idx = activeWord;
    if (!wordsAt(r, c).includes(idx)) { idx = wordsAt(r, c)[0] ?? idx; setActiveWord(idx); }
    const cells = cellsOf(cw.layout[idx]);
    const pos = cells.findIndex((x) => x.r === r && x.c === c);
    const next = cells[pos + 1];
    if (next) focus(next.r, next.c);
  };

  const onKey = (e: React.KeyboardEvent, r: number, c: number) => {
    const k = `${r},${c}`;
    const move: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (move[e.key]) {
      e.preventDefault();
      const [dr, dc] = move[e.key];
      let nr = r + dr, nc = c + dc;
      while (nr >= 0 && nc >= 0 && nr < cw.rows && nc < cw.cols) {
        if (inputs.current[`${nr},${nc}`]) { focus(nr, nc); const ws = wordsAt(nr, nc); const want = dr ? "down" : "across"; const m = ws.find((i) => cw.layout[i].direction === want) ?? ws[0]; if (m !== undefined) setActiveWord(m); return; }
        nr += dr; nc += dc;
      }
    } else if (e.key === "Backspace" && !values[k]) {
      e.preventDefault();
      const cells = cellsOf(cw.layout[activeWord]);
      const pos = cells.findIndex((x) => x.r === r && x.c === c);
      const prev = cells[pos - 1];
      if (prev) { setValues((s) => ({ ...s, [`${prev.r},${prev.c}`]: "" })); focus(prev.r, prev.c); }
    }
  };

  const onFocusCell = (r: number, c: number, toggle: boolean) => {
    const ws = wordsAt(r, c);
    if (!ws.length) return;
    if (toggle && ws.length > 1) setActiveWord(ws.find((i) => i !== activeWord) ?? ws[0]);
    else if (!ws.includes(activeWord)) setActiveWord(ws[0]);
  };

  const pick = (i: number) => {
    setActiveWord(i);
    const f = cellsOf(cw.layout[i])[0];
    focus(f.r, f.c);
  };

  const submit = async () => {
    setBusy(true);
    const seconds = Math.round((Date.now() - started.current) / 1000);
    const answers = cw.layout.map((w) => cellsOf(w).map(({ r, c }) => values[`${r},${c}`] ?? "").join(""));
    const { data, error } = await supabase.rpc("check_crossword", { _id: cw.id, _answers: answers, _duration: seconds });
    setBusy(false);
    if (error) return toast.error(error.message.includes("not found") ? "Krossvord dərc olunmayıb." : error.message);
    const r = data as unknown as { correct: number; total: number; results: boolean[]; xp?: number };
    doneRef.current = true;
    setResult({ ...r, seconds });
    clearProgress();
    toast.success(`${r.correct} / ${r.total} söz düzgündür${r.xp ? ` · +${r.xp} XP` : ""}`);
  };

  const restart = () => { doneRef.current = false; clearProgress(); setValues({}); setResult(null); setRestored(false); started.current = Date.now(); setElapsed(0); };
  const resetDraft = () => {
    if (!confirm("Yazdığınız bütün hərflər silinəcək və saniyəölçən sıfırlanacaq. Davam edilsin?")) return;
    restart();
  };

  return (
    <div className="bento-page space-y-5">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Krossvordlar</Button>
      {restored && !result && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
          <PlayCircle className="h-5 w-5 text-warning shrink-0" />
          <span className="flex-1 min-w-0">Dayandığınız yerdən bərpa olundu — yazdığınız hərflər və vaxt yerindədir.</span>
          <Button size="sm" variant="outline" onClick={resetDraft}><RotateCcw className="h-4 w-4 mr-2" />Təmizlə və yenidən başla</Button>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold">{cw.title}</h1>
          {cw.description && <p className="text-muted-foreground text-sm">{cw.description}</p>}
        </div>
        <Badge variant="secondary" className="text-base gap-1.5 px-3 py-1"><Clock className="h-4 w-4" />{fmt(result ? result.seconds : elapsed)}</Badge>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-6 items-start">
        <div className="p-4 sm:p-8 bg-card rounded-lg overflow-auto flex justify-center">
          <GridView rows={cw.rows} cols={cw.cols} layout={cw.layout} values={values} onCell={onCell} onKey={onKey} onFocusCell={onFocusCell} active={active} results={cellResults} inputsRef={inputs} />
        </div>
        <Card className="p-4 space-y-4">
          {cw.layout[activeWord] && !result && (
            <div className="rounded-lg bg-accent p-3 text-sm"><b>{cw.layout[activeWord].number}. {cw.layout[activeWord].direction === "across" ? "Üfüqi" : "Şaquli"}:</b> {cw.layout[activeWord].clue}</div>
          )}
          <Clues layout={cw.layout} onPick={pick} results={result?.results} />
          {result && (
            <div className="rounded-lg bg-muted p-4 text-sm space-y-1">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" />
                Nəticə: <b>{result.correct} / {result.total}</b> ({Math.round((result.correct / Math.max(result.total, 1)) * 100)}%)</div>
              <div>Vaxt: <b>{fmt(result.seconds)}</b></div>
              <div className="text-primary font-semibold">{result.xp ? `+${result.xp} XP qazandınız` : "Bu nəticə üçün əlavə XP yoxdur (əvvəlki ən yaxşı nəticənizi keçin)."}</div>
              {result.results.some((r) => !r) && (
                <div className="pt-2">
                  <div className="font-semibold text-destructive">Səhv sözlər:</div>
                  <ul className="list-disc pl-5 text-destructive">
                    {cw.layout.map((w, i) => result.results[i] === false && (
                      <li key={i}>{w.number}. {w.direction === "across" ? "Üfüqi" : "Şaquli"} — {w.clue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2">
            {!result && <Button onClick={submit} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Yoxla</Button>}
            {result && <Button variant="outline" onClick={restart}>Yenidən başla</Button>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Builder({ initial, onClose, onSaved }: { initial: Crossword | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [published, setPublished] = useState(initial?.is_published ?? false);
  const [rows, setRows] = useState<{ word: string; clue: string }[]>([{ word: "", clue: "" }, { word: "", clue: "" }, { word: "", clue: "" }]);
  const [gen, setGen] = useState<GeneratedCrossword | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!initial) return;
    void supabase.rpc("get_crossword_answers", { _id: initial.id }).then(({ data }) => {
      const ans = (data ?? []) as string[];
      if (ans.length) {
        setRows(initial.layout.map((w, i) => ({ word: ans[i] ?? "", clue: w.clue })));
        setGen({ rows: initial.rows, cols: initial.cols, layout: initial.layout, answers: ans, skipped: [] });
      }
    });
  }, [initial]);

  const build = () => {
    const valid = rows.filter((r) => normalizeWord(r.word).length >= 2 && r.clue.trim());
    if (valid.length < 2) return toast.error("Ən azı 2 söz və sual daxil edin.");
    const g = generateCrossword(valid);
    setGen(g);
    if (g.skipped.length) toast.warning(`Bu sözlər birləşdirilə bilmədi: ${g.skipped.join(", ")}`);
  };

  const previewValues = useMemo(() => {
    const m: Record<string, string> = {};
    gen?.layout.forEach((w, i) => cellsOf(w).forEach(({ r, c }, j) => { m[`${r},${c}`] = gen.answers[i][j]; }));
    return m;
  }, [gen]);

  const save = async () => {
    if (!title.trim()) return toast.error("Başlıq daxil edin.");
    if (!gen || gen.layout.length < 2) return toast.error("Əvvəlcə krossvordu qurun.");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const payload = {
      title: title.trim(), description: description.trim() || null, is_published: published,
      rows: gen.rows, cols: gen.cols, layout: gen.layout as never, answers: gen.answers as never,
    };
    const { error } = initial
      ? await supabase.from("crosswords").update(payload).eq("id", initial.id)
      : await supabase.from("crosswords").insert({ ...payload, created_by: u.user?.id });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Yadda saxlanıldı"); onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "Krossvordu redaktə et" : "Yeni krossvord"}</DialogTitle></DialogHeader>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Başlıq</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Təsvir</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Sözlər və suallar</Label>
              {rows.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <Input className="w-36 uppercase" placeholder="Söz" value={r.word}
                    onChange={(e) => setRows((s) => s.map((x, j) => j === i ? { ...x, word: e.target.value } : x))} />
                  <Input className="flex-1" placeholder="Sual" value={r.clue}
                    onChange={(e) => setRows((s) => s.map((x, j) => j === i ? { ...x, clue: e.target.value } : x))} />
                  <Button size="icon" variant="ghost" onClick={() => setRows((s) => s.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setRows((s) => [...s, { word: "", clue: "" }])}><Plus className="h-4 w-4 mr-1" />Söz əlavə et</Button>
                <Button size="sm" onClick={build}><Wand2 className="h-4 w-4 mr-1" />Krossvordu qur</Button>
              </div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={published} onCheckedChange={setPublished} /><Label>Dərc olunsun</Label></div>
          </div>
          <div className="space-y-3">
            <Label>Önizləmə</Label>
            {gen && gen.layout.length ? (
              <>
                <Card className="p-3"><GridView rows={gen.rows} cols={gen.cols} layout={gen.layout} values={previewValues} /></Card>
                <Clues layout={gen.layout} />
                {gen.skipped.length > 0 && <p className="text-sm text-destructive">Yerləşdirilmədi: {gen.skipped.join(", ")} — başqa sözlərlə ortaq hərfi olan sözlər əlavə edin.</p>}
                <Button variant="outline" size="sm" onClick={build}>Başqa variant qur</Button>
              </>
            ) : <Card className="p-8 text-center text-sm text-muted-foreground">Sözləri yazıb "Krossvordu qur" düyməsini basın.</Card>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Ləğv et</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Yadda saxla</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ResultRow = { user_id: string; correct_count: number; total_words: number; score_percent: number; duration_seconds: number; xp_earned: number; completed_at: string };

function ResultsDialog({ cw, onClose }: { cw: Crossword; onClose: () => void }) {
  const [rows, setRows] = useState<(ResultRow & { name: string; team: string | null; attempts: number })[] | null>(null);
  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.from("crossword_completions")
        .select("user_id,correct_count,total_words,score_percent,duration_seconds,xp_earned,completed_at")
        .eq("crossword_id", cw.id).order("completed_at", { ascending: false });
      if (error) { toast.error(error.message); setRows([]); return; }
      const list = (data ?? []) as ResultRow[];
      const ids = [...new Set(list.map((x) => x.user_id))];
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id,full_name,team").in("id", ids)
        : { data: [] as { id: string; full_name: string; team: string | null }[] };
      const pm = new Map((profs ?? []).map((p) => [p.id, p]));
      const best = new Map<string, ResultRow & { attempts: number; xpTotal: number }>();
      list.forEach((x) => {
        const cur = best.get(x.user_id);
        const better = !cur || Number(x.score_percent) > Number(cur.score_percent) ||
          (Number(x.score_percent) === Number(cur.score_percent) && x.duration_seconds < cur.duration_seconds);
        const attempts = (cur?.attempts ?? 0) + 1, xpTotal = (cur?.xpTotal ?? 0) + x.xp_earned;
        best.set(x.user_id, better ? { ...x, attempts, xpTotal } : { ...cur!, attempts, xpTotal });
      });
      setRows([...best.values()].map((b) => ({ ...b, xp_earned: b.xpTotal, name: pm.get(b.user_id)?.full_name ?? "—", team: pm.get(b.user_id)?.team ?? null }))
        .sort((a, b) => Number(b.score_percent) - Number(a.score_percent) || a.duration_seconds - b.duration_seconds));
    })();
  }, [cw.id]);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nəticələr — {cw.title}</DialogTitle></DialogHeader>
        {!rows ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          : rows.length === 0 ? <p className="text-center text-muted-foreground py-8">Hələ heç kim həll etməyib.</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-2">#</th><th className="pr-2">İştirakçı</th><th className="pr-2">Komanda</th><th className="pr-2">Düzgün</th><th className="pr-2">Faiz</th><th className="pr-2">Vaxt</th><th className="pr-2">Cəhd</th><th className="pr-2">XP</th><th>Tarix</th>
                </tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.user_id} className="border-b last:border-0">
                      <td className="py-2 pr-2">{i + 1}</td><td className="pr-2 font-medium">{r.name}</td><td className="pr-2">{r.team ?? "—"}</td>
                      <td className="pr-2">{r.correct_count}/{r.total_words}</td><td className="pr-2">{Number(r.score_percent)}%</td>
                      <td className="pr-2">{fmt(r.duration_seconds)}</td><td className="pr-2">{r.attempts}</td><td className="pr-2">{r.xp_earned}</td>
                      <td className="text-xs text-muted-foreground">{new Date(r.completed_at).toLocaleString("az-AZ")}</td>
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
