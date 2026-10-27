import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetricTile({ icon: Icon, label, value, tone = "primary" }: {
  icon: LucideIcon; label: string; value: number | string;
  tone?: "primary" | "success" | "warning" | "info";
}) {
  const tones = { primary: "bg-accent text-accent-foreground", success: "bg-success/10 text-success", warning: "bg-warning/15 text-warning-foreground", info: "bg-info/10 text-info" };
  return (
    <article className="metric-tile flex min-w-0 items-center gap-3 rounded-lg bg-card p-4 shadow-card">
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg", tones[tone])}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</p></div>
    </article>
  );
}