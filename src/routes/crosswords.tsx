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
import { Grid3x3, Plus, Trash2, Pencil, Wand2, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/crosswords")({
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

function CrosswordsPage() {
  const { isAdmin, user } = useAuth();
  const [items, setItems] = useState<Crossword[]>([]);
  const [done, setDone] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Crossword | null | "new">(null);
  const [solving, setSolving] = useState<Crossword | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("crosswords")
      .select("id,title,description,is_published,rows,cols,layout,created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data ?? []) as unknown as Crossword[]);
    if (user) {
      const { data: c } = await supabase.from("crossword_completions")
        .select("crossword_id,score_percent").eq("user_id", user.id);
      const best: Record<string, number> = {};
      ((c ?? []) as Completion[]).forEach((x) => { best[x.crossword_id] = Math.max(best[x.crossword_id] ?? 0, Number(x.score_percent)); });
      setDone(best);
    }
    setLoading(false);
  };
  useEffect(() => { void load(); }, [user?.id]);

  const remove = async (id: string) => {
    if (!confirm("Bu krossvordu silmək istədiyinizə əminsiniz?")) return;
    const { error } = await supabase.from("crosswords").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Silindi"); void load();
  };

  if (solving) return <Solver cw={solving} onBack={() => { setSolving(null); void load(); }} />;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Krossvordlar</h1>
          <p className="text-muted-foreground text-sm">
            {isAdmin ? "Sözləri və sualları yaz — sistem krossvordu avtomatik qursun." : "Krossvordları həll et və biliyini yoxla."}
          </p>
        </div>
        {isAdmin && <Button onClick={() => setEditing("new")}><Plus className="h-4 w-4 mr-2" />Yeni krossvord</Button>}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Grid3x3 className="h-10 w-10 mx-auto mb-3 opacity-50" />Hələ krossvord yoxdur.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((cw) => (
            <Card key={cw.id} className="p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-tight">{cw.title}</h3>
                {isAdmin && <Badge variant={cw.is_published ? "default" : "secondary"}>{cw.is_published ? "Dərc olunub" : "Layihə"}</Badge>}
              </div>
              {cw.description && <p className="text-sm text-muted-foreground line-clamp-2">{cw.description}</p>}
              <div className="text-xs text-muted-foreground flex gap-3">
                <span>{cw.layout.length} söz</span><span>{cw.rows}×{cw.cols}</span>
                {done[cw.id] !== undefined && <span className="text-primary font-medium">Ən yaxşı: {done[cw.id]}%</span>}
              </div>
              <div className="mt-auto flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => setSolving(cw)} disabled={!cw.is_published && !isAdmin}>
                  {done[cw.id] !== undefined ? "Yenidən həll et" : "Həll et"}
                </Button>
                {isAdmin && <>
                  <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => setEditing(cw)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => remove(cw.id)}><Trash2 className="h-4 w-4" /></Button>
                </>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && <Builder initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />}
    </div>
  );
}

function GridView({ rows, cols, layout, values, results, onCell, active, inputsRef }: {
  rows: number; cols: number; layout: PlacedWord[];
  values?: Record<string, string>; results?: Record<string, boolean>;
  onCell?: (k: string, v: string, r: number, c: number) => void;
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
              active?.has(k) && "bg-accent", res === true && "bg-primary/15", res === false && "bg-destructive/15")}>
              {num != null && <span className="absolute top-0 left-0.5 text-[9px] leading-none text-muted-foreground">{num}</span>}
              {onCell ? (
                <input
                  ref={(el) => { if (inputsRef) inputsRef.current[k] = el; }}
                  value={values?.[k] ?? ""}
                  maxLength={2}
                  onChange={(e) => onCell(k, normalizeWord(e.target.value).slice(-1), r, c)}
                  className="w-full h-full text-center font-semibold uppercase bg-transparent outline-none focus:bg-accent"
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
                results?.[i] === true && "text-primary", results?.[i] === false && "text-destructive")}>
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
  const [result, setResult] = useState<{ correct: number; total: number; results: boolean[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(Date.now());
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const active = useMemo(() => new Set(cellsOf(cw.layout[activeWord] ?? cw.layout[0]).map(({ r, c }) => `${r},${c}`)), [activeWord, cw]);
  const cellResults = useMemo(() => {
    if (!result) return undefined;
    const m: Record<string, boolean> = {};
    cw.layout.forEach((w, i) => cellsOf(w).forEach(({ r, c }) => {
      const k = `${r},${c}`; m[k] = (m[k] ?? true) && result.results[i];
    }));
    return m;
  }, [result, cw]);

  const onCell = (k: string, v: string, r: number, c: number) => {
    setValues((s) => ({ ...s, [k]: v }));
    if (!v) return;
    let w = cw.layout[activeWord];
    let cells = w ? cellsOf(w) : [];
    let pos = cells.findIndex((x) => x.r === r && x.c === c);
    if (pos < 0) {
      const idx = cw.layout.findIndex((ww) => cellsOf(ww).some((x) => x.r === r && x.c === c));
      if (idx >= 0) { setActiveWord(idx); w = cw.layout[idx]; cells = cellsOf(w); pos = cells.findIndex((x) => x.r === r && x.c === c); }
    }
    const next = cells[pos + 1];
    if (next) inputs.current[`${next.r},${next.c}`]?.focus();
  };

  const pick = (i: number) => {
    setActiveWord(i);
    const f = cellsOf(cw.layout[i])[0];
    inputs.current[`${f.r},${f.c}`]?.focus();
  };

  const submit = async () => {
    setBusy(true);
    const answers = cw.layout.map((w) => cellsOf(w).map(({ r, c }) => values[`${r},${c}`] ?? "").join(""));
    const { data, error } = await supabase.rpc("check_crossword", {
      _id: cw.id, _answers: answers, _duration: Math.round((Date.now() - started.current) / 1000),
    });
    setBusy(false);
    if (error) return toast.error(error.message.includes("not found") ? "Krossvord dərc olunmayıb." : error.message);
    const r = data as unknown as { correct: number; total: number; results: boolean[] };
    setResult(r);
    toast.success(`${r.correct} / ${r.total} söz düzgündür`);
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-5">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Krossvordlar</Button>
      <div>
        <h1 className="text-2xl font-display font-bold">{cw.title}</h1>
        {cw.description && <p className="text-muted-foreground text-sm">{cw.description}</p>}
      </div>
      <div className="grid lg:grid-cols-[auto_1fr] gap-6 items-start">
        <Card className="p-4">
          <GridView rows={cw.rows} cols={cw.cols} layout={cw.layout} values={values} onCell={onCell} active={active} results={cellResults} inputsRef={inputs} />
        </Card>
        <Card className="p-4 space-y-4">
          <Clues layout={cw.layout} onPick={pick} results={result?.results} />
          {result && (
            <div className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Nəticə: <b>{result.correct} / {result.total}</b> ({Math.round((result.correct / Math.max(result.total, 1)) * 100)}%)
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={submit} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Yoxla</Button>
            {result && <Button variant="outline" onClick={() => { setValues({}); setResult(null); started.current = Date.now(); }}>Yenidən başla</Button>}
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
