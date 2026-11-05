import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Copy, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Cədvəl əlavələri (maddə 17): səhifələmə, sətir ikonları, seçim vəziyyəti. */

function pageList(page: number, count: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(count - 1, page + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < count - 1) out.push("…");
  out.push(count);
  return out;
}

/** "1–8 / 1 240 nəticə" + nömrəli səhifələr. */
export function TablePagination({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
  className,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const fmt = (n: number) => n.toLocaleString("az-AZ");
  return (
    <nav
      aria-label="Səhifələmə"
      className={cn("flex flex-wrap items-center justify-between gap-3 px-1 pt-4", className)}
    >
      <p className="text-sm text-muted-foreground tabular-nums">
        {fmt(from)}–{fmt(to)} / {fmt(total)} nəticə
      </p>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Əvvəlki səhifə"
          >
            <ChevronLeft />
          </Button>
          {pageList(page, pageCount).map((p, i) =>
            p === "…" ? (
              <span
                key={`e${i}`}
                className="px-1.5 text-sm text-muted-foreground"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === page ? "default" : "ghost"}
                size="icon"
                className="h-9 w-9 tabular-nums"
                aria-label={`Səhifə ${p}`}
                aria-current={p === page ? "page" : undefined}
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            ),
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
            aria-label="Növbəti səhifə"
          >
            <ChevronRight />
          </Button>
        </div>
      )}
    </nav>
  );
}

type RowAction = { onClick: () => void; label?: string; disabled?: boolean };

/** Sətirdə redaktə/kopya/sil ikon düymələri. Hər düymənin `aria-label`-i var. */
export function RowActions({
  subject,
  edit,
  copy,
  remove,
  extra,
}: {
  /** Ekran oxuyucu üçün sətrin adı, məsələn istifadəçinin adı. */
  subject: string;
  edit?: RowAction;
  copy?: RowAction;
  remove?: RowAction;
  /** Standart ikonlardan əvvəl göstərilən əlavə düymələr. */
  extra?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {extra}
      {edit && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={edit.onClick}
          disabled={edit.disabled}
          aria-label={`${edit.label ?? "Redaktə et"}: ${subject}`}
        >
          <Pencil />
        </Button>
      )}
      {copy && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={copy.onClick}
          disabled={copy.disabled}
          aria-label={`${copy.label ?? "Kopyala"}: ${subject}`}
        >
          <Copy />
        </Button>
      )}
      {remove && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 hover:bg-[var(--error-50)] hover:text-[var(--error-600)]"
          onClick={remove.onClick}
          disabled={remove.disabled}
          aria-label={`${remove.label ?? "Sil"}: ${subject}`}
        >
          <Trash2 />
        </Button>
      )}
    </div>
  );
}

/** Cədvəl kartı çərçivəsi (köhnə `.bento-table` əvəzinə). */
export function TableCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card",
        className,
      )}
    >
      {children}
    </div>
  );
}
