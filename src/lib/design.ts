// Dizayn komponentləri üçün ortaq köməkçilər (src/components/design/*).
import { useMemo, useState } from "react";
import { format, isValid, parse } from "date-fns";

/** Ad-soyaddan baş hərflər: "Aysel Kərimova" → "AK". */
export function initials(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toLocaleUpperCase("az");
}

// ---------- Tarix aralığı ("YYYY-MM-DD", köhnə <input type="date"> ilə eyni format) ----------
export interface DateRangeValue {
  from: string;
  to: string;
}

const ISO = "yyyy-MM-dd";

export function isoToDate(s: string): Date | undefined {
  if (!s) return undefined;
  const d = parse(s, ISO, new Date());
  return isValid(d) ? d : undefined;
}

export function dateToIso(d: Date | undefined): string {
  return d ? format(d, ISO) : "";
}

export function rangeLabel(v: DateRangeValue, placeholder = "Tarix aralığı") {
  const f = isoToDate(v.from);
  const t = isoToDate(v.to);
  const fmt = (d: Date) => format(d, "dd.MM.yyyy");
  if (f && t) return `${fmt(f)} – ${fmt(t)}`;
  if (f) return `${fmt(f)} –`;
  if (t) return `– ${fmt(t)}`;
  return placeholder;
}

// ---------- Cədvəl: səhifələmə və seçim ----------
export function usePagination<T>(rows: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const pageRows = useMemo(
    () => rows.slice((current - 1) * pageSize, current * pageSize),
    [rows, current, pageSize],
  );
  return { page: current, setPage, pageCount, pageRows, pageSize, total: rows.length };
}

export function useRowSelection(ids: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const visible = ids.filter((id) => selected.has(id));
  const all = ids.length > 0 && visible.length === ids.length;
  const some = visible.length > 0 && !all;
  return {
    selected,
    isSelected: (id: string) => selected.has(id),
    toggle: (id: string) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    toggleAll: () =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (all) ids.forEach((id) => next.delete(id));
        else ids.forEach((id) => next.add(id));
        return next;
      }),
    clear: () => setSelected(new Set()),
    headerState: (all ? true : some ? "indeterminate" : false) as boolean | "indeterminate",
  };
}
