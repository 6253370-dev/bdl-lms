import type { ReactNode } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

/** Diaqram paleti (DESIGN-BRIEF 3.1). Rəng həmişə tokendən gəlir. */
export const SERIES = {
  primary: "var(--brand-600)",
  secondary: "var(--brand-300)",
  tertiary: "var(--brand-100)",
  track: "var(--gray-200)",
  success: "var(--success-500)",
  warning: "var(--warning-500)",
  error: "var(--error-500)",
} as const;
export type SeriesColor = keyof typeof SERIES;

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: SeriesColor;
}

/** Donut diaqram + leyend (maddə 11). */
export function DonutChart({
  data,
  centerValue,
  centerLabel,
  size = 180,
  ariaLabel,
  className,
}: {
  data: DonutSlice[];
  centerValue?: ReactNode;
  centerLabel?: ReactNode;
  size?: number;
  ariaLabel: string;
  className?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  const chartData = total ? data : [{ key: "empty", label: "", value: 1, color: "track" as const }];
  return (
    <div className={cn("flex flex-col items-center gap-5", className)}>
      <div
        className="relative"
        style={{ width: size, height: size }}
        role="img"
        aria-label={ariaLabel}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="label"
              innerRadius="72%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {chartData.map((d) => (
                <Cell key={d.key} fill={SERIES[d.color]} />
              ))}
            </Pie>
            {total > 0 && (
              <Tooltip
                cursor={false}
                content={({ active, payload }) =>
                  active && payload?.[0] ? (
                    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                      <span className="font-semibold">{payload[0].name}</span>:{" "}
                      {Number(payload[0].value).toLocaleString("az-AZ")}
                    </div>
                  ) : null
                }
              />
            )}
          </PieChart>
        </ResponsiveContainer>
        {(centerValue !== undefined || centerLabel) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {centerValue !== undefined && (
              <span className="font-display text-2xl font-semibold tabular-nums">
                {centerValue}
              </span>
            )}
            {centerLabel && <span className="text-xs text-muted-foreground">{centerLabel}</span>}
          </div>
        )}
      </div>
      <ul className="w-full space-y-2 text-sm">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: SERIES[d.color] }}
            />
            <span className="min-w-0 flex-1 truncate text-secondary-foreground">{d.label}</span>
            <span className="tabular-nums font-medium">
              {pct(d.value)}%{" "}
              <span className="text-muted-foreground">({d.value.toLocaleString("az-AZ")})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
