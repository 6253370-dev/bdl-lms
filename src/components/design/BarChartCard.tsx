import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Üfüqi sütun diaqramı kartı (top-N siyahıların əvəzi, maddə 70).
 * Ad zolağın üstündə tam göstərilir, ona görə uzun kurs adları kəsilmir.
 */
export function BarChartCard({
  title,
  icon,
  data,
  valueLabel,
  className,
}: {
  title: string;
  icon?: ReactNode;
  data: { label: string; value: number }[];
  /** Dəyərin adı, məsələn "Baxış". */
  valueLabel: string;
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <section
      className={cn("min-w-0 rounded-xl border border-border bg-card p-5 shadow-card", className)}
    >
      <h2 className="mb-4 flex items-center gap-2 font-display text-base font-semibold">
        {icon}
        {title}
      </h2>
      {data.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
          —
        </div>
      ) : (
        <ol className="space-y-3.5">
          {data.map((d, i) => (
            <li key={`${d.label}-${i}`}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-secondary-foreground" title={d.label}>
                  {d.label}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {d.value.toLocaleString("az-AZ")}
                  <span className="sr-only"> {valueLabel}</span>
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-[var(--gray-200)] dark:bg-[var(--gray-700)]"
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(d.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
