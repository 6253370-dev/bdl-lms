import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tone = "brand" | "success" | "warning" | "error" | "gray";

const TONES: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-400",
  success:
    "bg-[var(--success-50)] text-[var(--success-600)] dark:bg-[var(--success-600)]/15 dark:text-[var(--success-500)]",
  warning:
    "bg-[var(--warning-50)] text-[var(--warning-600)] dark:bg-[var(--warning-600)]/15 dark:text-[var(--warning-500)]",
  error:
    "bg-[var(--error-50)] text-[var(--error-600)] dark:bg-[var(--error-600)]/15 dark:text-[var(--error-500)]",
  gray: "bg-muted text-muted-foreground",
};

const SIZES = {
  sm: "h-8 w-8 rounded-[10px] [&_svg]:size-4",
  md: "h-10 w-10 rounded-[12px] [&_svg]:size-5",
  lg: "h-12 w-12 rounded-[14px] [&_svg]:size-6",
};

/** Pastel ikon çipi (DESIGN-BRIEF 3.3, maddə 20): 40×40, radius 12px. */
export function IconChip({
  icon: Icon,
  tone = "brand",
  size = "md",
  className,
}: {
  icon: LucideIcon;
  tone?: Tone;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        SIZES[size],
        TONES[tone],
        className,
      )}
    >
      <Icon />
    </span>
  );
}
