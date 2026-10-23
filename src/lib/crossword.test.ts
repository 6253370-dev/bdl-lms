import { describe, it, expect } from "vitest";
import { generateCrossword, cellsOf } from "./crossword";

describe("generateCrossword", () => {
  it("connects intersecting words with consistent letters", () => {
    const g = generateCrossword([
      { word: "alqoritm", clue: "a" },
      { word: "server", clue: "b" },
      { word: "kod", clue: "c" },
    ]);
    expect(g.skipped).toEqual([]);
    expect(g.layout).toHaveLength(3);
    const grid = new Map<string, string>();
    g.layout.forEach((w, i) =>
      cellsOf(w).forEach(({ r, c }, j) => {
        const k = `${r},${c}`;
        if (grid.has(k)) expect(grid.get(k)).toBe(g.answers[i][j]);
        grid.set(k, g.answers[i][j]);
      }),
    );
  });
  it("skips words that share no letters", () => {
    const g = generateCrossword([{ word: "AAAA", clue: "x" }, { word: "BBB", clue: "y" }]);
    expect(g.skipped).toEqual(["BBB"]);
  });
});
