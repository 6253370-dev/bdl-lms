export type Direction = "across" | "down";

export interface PlacedWord {
  number: number;
  row: number;
  col: number;
  direction: Direction;
  length: number;
  clue: string;
}

export interface GeneratedCrossword {
  rows: number;
  cols: number;
  layout: PlacedWord[]; // public (no answers)
  answers: string[]; // same order as layout
  skipped: string[]; // words that could not be connected
}

export const normalizeWord = (w: string) =>
  w.trim().toLocaleUpperCase("az").replace(/[^A-ZÇƏĞIİÖŞÜ]/g, "");

interface Inner { word: string; clue: string; row: number; col: number; dir: Direction }

function tryBuild(entries: { word: string; clue: string }[]): { placed: Inner[]; skipped: string[] } {
  const grid = new Map<string, string>();
  const key = (r: number, c: number) => `${r},${c}`;
  const placed: Inner[] = [];
  const skipped: string[] = [];

  const canPlace = (w: string, r: number, c: number, dir: Direction) => {
    const dr = dir === "down" ? 1 : 0, dc = dir === "across" ? 1 : 0;
    // cells before/after must be empty
    if (grid.has(key(r - dr, c - dc)) || grid.has(key(r + dr * w.length, c + dc * w.length))) return -1;
    let crosses = 0;
    for (let i = 0; i < w.length; i++) {
      const rr = r + dr * i, cc = c + dc * i;
      const ex = grid.get(key(rr, cc));
      if (ex) {
        if (ex !== w[i]) return -1;
        crosses++;
      } else {
        // neighbours perpendicular must be empty
        if (grid.has(key(rr + dc, cc + dr)) || grid.has(key(rr - dc, cc - dr))) return -1;
      }
    }
    return crosses;
  };
  const put = (e: { word: string; clue: string }, r: number, c: number, dir: Direction) => {
    const dr = dir === "down" ? 1 : 0, dc = dir === "across" ? 1 : 0;
    for (let i = 0; i < e.word.length; i++) grid.set(key(r + dr * i, c + dc * i), e.word[i]);
    placed.push({ ...e, row: r, col: c, dir });
  };

  entries.forEach((e, idx) => {
    if (idx === 0) return put(e, 0, 0, "across");
    let best: { r: number; c: number; dir: Direction; score: number } | null = null;
    for (const p of placed) {
      for (let i = 0; i < p.word.length; i++) {
        for (let j = 0; j < e.word.length; j++) {
          if (p.word[i] !== e.word[j]) continue;
          const dir: Direction = p.dir === "across" ? "down" : "across";
          const pr = p.row + (p.dir === "down" ? i : 0);
          const pc = p.col + (p.dir === "across" ? i : 0);
          const r = dir === "down" ? pr - j : pr;
          const c = dir === "across" ? pc - j : pc;
          const s = canPlace(e.word, r, c, dir);
          if (s > 0 && (!best || s > best.score)) best = { r, c, dir, score: s };
        }
      }
    }
    if (best) put(e, best.r, best.c, best.dir);
    else skipped.push(e.word);
  });
  return { placed, skipped };
}

export function generateCrossword(input: { word: string; clue: string }[], attempts = 30): GeneratedCrossword {
  const entries = input
    .map((e) => ({ word: normalizeWord(e.word), clue: e.clue.trim() }))
    .filter((e) => e.word.length >= 2);
  let bestRes: { placed: Inner[]; skipped: string[] } | null = null;
  for (let a = 0; a < attempts; a++) {
    const order = [...entries].sort((x, y) => y.word.length - x.word.length);
    if (a > 0) {
      const [first, ...rest] = order;
      rest.sort(() => Math.random() - 0.5);
      order.splice(0, order.length, first, ...rest);
    }
    const res = tryBuild(order);
    if (!bestRes || res.skipped.length < bestRes.skipped.length) bestRes = res;
    if (res.skipped.length === 0) break;
  }
  const placed = bestRes?.placed ?? [];
  if (!placed.length) return { rows: 0, cols: 0, layout: [], answers: [], skipped: bestRes?.skipped ?? [] };

  let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
  for (const p of placed) {
    minR = Math.min(minR, p.row); minC = Math.min(minC, p.col);
    maxR = Math.max(maxR, p.row + (p.dir === "down" ? p.word.length - 1 : 0));
    maxC = Math.max(maxC, p.col + (p.dir === "across" ? p.word.length - 1 : 0));
  }
  const norm = placed.map((p) => ({ ...p, row: p.row - minR, col: p.col - minC }));
  norm.sort((a, b) => a.row - b.row || a.col - b.col);
  const numbers = new Map<string, number>();
  let n = 0;
  const layout: PlacedWord[] = [];
  const answers: string[] = [];
  for (const p of norm) {
    const k = `${p.row},${p.col}`;
    if (!numbers.has(k)) numbers.set(k, ++n);
    layout.push({ number: numbers.get(k)!, row: p.row, col: p.col, direction: p.dir, length: p.word.length, clue: p.clue });
    answers.push(p.word);
  }
  return { rows: maxR - minR + 1, cols: maxC - minC + 1, layout, answers, skipped: bestRes!.skipped };
}

export const cellsOf = (w: PlacedWord) =>
  Array.from({ length: w.length }, (_, i) => ({
    r: w.row + (w.direction === "down" ? i : 0),
    c: w.col + (w.direction === "across" ? i : 0),
  }));
