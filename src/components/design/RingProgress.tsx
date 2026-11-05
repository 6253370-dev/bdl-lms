import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Dairəvi proqres (maddə 10): kurs faizi, taymer, səviyyə. */
export function RingProgress({
  value,
  size = 64,
  stroke = 6,
  label,
  children,
  tone = "brand",
  className,
}: {
  /** 0–100 */
  value: number;
  size?: number;
  stroke?: number;
  /** Ekran oxuyucu üçün ad. */
  label: string;
  children?: ReactNode;
  tone?: "brand" | "success" | "warning" | "error";
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const colors = {
    brand: "var(--brand-600)",
    success: "var(--success-500)",
    warning: "var(--warning-500)",
    error: "var(--error-500)",
  };
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--gray-200)"
          strokeWidth={stroke}
          className="dark:[stroke:var(--gray-700)]"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colors[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (v / 100) * c}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">
        {children ?? `${Math.round(v)}%`}
      </span>
    </div>
  );
}
