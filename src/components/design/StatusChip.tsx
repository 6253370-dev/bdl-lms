import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "error" | "brand" | "gray" | "live";

const TONES: Record<StatusTone, string> = {
  success:
    "border-[var(--success-200)] bg-[var(--success-50)] text-[var(--success-700)] dark:border-transparent dark:bg-[var(--success-600)]/15 dark:text-[var(--success-500)]",
  warning:
    "border-[var(--warning-200)] bg-[var(--warning-50)] text-[var(--warning-700)] dark:border-transparent dark:bg-[var(--warning-600)]/15 dark:text-[var(--warning-500)]",
  error:
    "border-[var(--error-200)] bg-[var(--error-50)] text-[var(--error-700)] dark:border-transparent dark:bg-[var(--error-600)]/15 dark:text-[var(--error-500)]",
  brand:
    "border-brand-200 bg-brand-50 text-brand-700 dark:border-transparent dark:bg-brand-600/15 dark:text-brand-400",
  gray: "border-border bg-muted text-secondary-foreground",
  live: "border-transparent bg-[var(--error-600)] text-white",
};

const DOTS: Record<StatusTone, string> = {
  success: "bg-[var(--success-500)]",
  warning: "bg-[var(--warning-500)]",
  error: "bg-[var(--error-500)]",
  brand: "bg-brand-600",
  gray: "bg-[var(--gray-400)]",
  live: "bg-white motion-safe:animate-pulse",
};

/**
 * Vahid status çipi (maddə 8): Aktiv/Qeyri-aktiv, Keçdi/Keçmədi, Asan/Orta/Çətin, Yarımçıq, LIVE.
 * Qırmızı yalnız mənfi status və LIVE üçündür.
 */
export function StatusChip({
  tone = "gray",
  dot = false,
  children,
  className,
}: {
  tone?: StatusTone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {(dot || tone === "live") && (
        <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone])} />
      )}
      {children}
    </span>
  );
}
