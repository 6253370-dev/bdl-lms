import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconChip, type Tone } from "./IconChip";

export interface StatTrend {
  /** Faiz dəyişikliyi, məsələn 12 və ya -4. */
  value: number;
  /** Trendin yanındakı izah. */
  label?: string;
}

/** KPI kartı + trend göstəricisi (maddə 6). Trend yalnız real məlumat olanda ötürülür. */
export function StatCard({
  icon,
  label,
  value,
  tone = "brand",
  hint,
  trend,
  aside,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  tone?: Tone;
  hint?: ReactNode;
  trend?: StatTrend | null;
  aside?: ReactNode;
  className?: string;
}) {
  const up = trend ? trend.value >= 0 : false;
  return (
    <article
      className={cn(
        // Mobildə (sm-dən kiçik) yığcam: ikon yuxarıda, kartlar 2 sütuna sığır.
        "relative flex min-w-0 flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-card sm:flex-row sm:gap-4 sm:p-5",
        className,
      )}
    >
      <IconChip
        icon={icon}
        tone={tone}
        size="lg"
        className="max-sm:h-10 max-sm:w-10 max-sm:[&_svg]:size-5"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-muted-foreground break-words">{label}</p>
        <p className="mt-1 font-display text-2xl font-semibold leading-8 tabular-nums tracking-tight">
          {value}
        </p>
        {trend && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium tabular-nums",
                up
                  ? "bg-[var(--success-50)] text-[var(--success-700)]"
                  : "bg-[var(--error-50)] text-[var(--error-700)]",
              )}
            >
              {up ? (
                <ArrowUp className="h-3 w-3" aria-hidden="true" />
              ) : (
                <ArrowDown className="h-3 w-3" aria-hidden="true" />
              )}
              {up ? "+" : ""}
              {trend.value}%
            </span>
            {trend.label ?? "keçən dövrlə müqayisədə"}
          </p>
        )}
        {hint && !trend && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {aside && (
        <div className="shrink-0 self-center max-sm:absolute max-sm:right-4 max-sm:top-4">
          {aside}
        </div>
      )}
    </article>
  );
}
