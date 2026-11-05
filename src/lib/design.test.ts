import { describe, expect, it } from "vitest";
import { dateToIso, initials, isoToDate, rangeLabel } from "./design";
import { countUnansweredThreads } from "./commentThreads";

// reports.tsx-dəki filtr məntiqi (dəyişməyib) — DateRangePicker eyni sətirləri verməlidir.
const inRange = (from: string, to: string, created: string) => {
  if (from && new Date(created) < new Date(from)) return false;
  if (to && new Date(created) > new Date(to + "T23:59:59")) return false;
  return true;
};

describe("DateRangePicker dəyərləri", () => {
  it("YYYY-MM-DD sətri dəyişmədən geri çevrilir", () => {
    for (const s of ["2025-05-01", "2025-05-31", "2024-02-29", "2025-12-31", "2026-01-01"]) {
      expect(dateToIso(isoToDate(s))).toBe(s);
    }
  });

  it("təqvimdə seçilən gün input-un yazacağı sətirlə eynidir", () => {
    expect(dateToIso(new Date(2025, 4, 1))).toBe("2025-05-01");
    expect(dateToIso(new Date(2025, 11, 31))).toBe("2025-12-31");
  });

  it("boş dəyər filtr yoxdur deməkdir", () => {
    expect(isoToDate("")).toBeUndefined();
    expect(dateToIso(undefined)).toBe("");
  });

  it("sərhəd günlərində filtr nəticəsi köhnə input ilə eynidir", () => {
    const attempts = [
      "2025-04-30T23:59:59Z",
      "2025-05-01T00:00:00Z",
      "2025-05-31T19:59:59Z",
      "2025-05-31T20:00:00Z",
      "2025-06-01T00:00:00Z",
    ];
    const picked = { from: dateToIso(new Date(2025, 4, 1)), to: dateToIso(new Date(2025, 4, 31)) };
    const old = { from: "2025-05-01", to: "2025-05-31" };
    expect(attempts.map((a) => inRange(picked.from, picked.to, a))).toEqual(
      attempts.map((a) => inRange(old.from, old.to, a)),
    );
    expect(attempts.map((a) => inRange(picked.from, "", a))).toEqual(
      attempts.map((a) => inRange(old.from, "", a)),
    );
    expect(attempts.map((a) => inRange("", picked.to, a))).toEqual(
      attempts.map((a) => inRange("", old.to, a)),
    );
  });

  it("etiket dd.MM.yyyy formatındadır", () => {
    expect(rangeLabel({ from: "2025-05-01", to: "2025-05-31" })).toBe("01.05.2025 – 31.05.2025");
    expect(rangeLabel({ from: "", to: "" })).toBe("Tarix aralığı");
  });
});

describe("initials", () => {
  it("ad və soyadın baş hərfləri", () => {
    expect(initials("Aysel Kərimova")).toBe("AK");
    expect(initials("əli")).toBe("Ə");
    expect(initials("")).toBe("?");
  });
});

describe("cavablanmamış şərh zəncirləri", () => {
  const admins = new Set(["admin"]);
  it("son mesajı admin olmayan zəncir sayılır", () => {
    const msgs = [
      { user_id: "u1", block_id: "b1", author_id: "u1", created_at: "2026-01-01T10:00:00Z" },
      { user_id: "u1", block_id: "b1", author_id: "admin", created_at: "2026-01-01T11:00:00Z" },
      { user_id: "u2", block_id: "b1", author_id: "u2", created_at: "2026-01-01T09:00:00Z" },
      { user_id: "u1", block_id: "b2", author_id: "admin", created_at: "2026-01-01T08:00:00Z" },
      { user_id: "u1", block_id: "b2", author_id: "u1", created_at: "2026-01-01T12:00:00Z" },
    ];
    // u1/b1: admin cavab verib; u2/b1: cavabsız; u1/b2: istifadəçi admin-dən sonra yazıb → cavabsız
    expect(countUnansweredThreads(msgs, admins)).toBe(2);
  });
});
