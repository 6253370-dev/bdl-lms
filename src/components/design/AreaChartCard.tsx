import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { SERIES } from "./DonutChart";

/** Area diaqram kartı (maddə 12), məsələn aylıq aktivlik. */
export function AreaChartCard({
  title,
  description,
  data,
  valueLabel,
  action,
  height = 260,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  data: { label: string; value: number }[];
  /** Tooltip-də dəyərin adı, məsələn "Cəhd". */
  valueLabel: string;
  action?: ReactNode;
  height?: number;
  className?: string;
}) {
  const empty = data.every((d) => d.value === 0);
  return (
    <section
      className={cn("min-w-0 rounded-xl border border-border bg-card p-5 shadow-card", className)}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      <div
        style={{ height }}
        role="img"
        aria-label={`${typeof title === "string" ? title : valueLabel}: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`}
      >
        {empty ? (
          <div className="flex h-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
            —
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                width={48}
              />
              <Tooltip
                cursor={{ stroke: "var(--brand-200)" }}
                content={({ active, payload, label }) =>
                  active && payload?.[0] ? (
                    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                      <div className="font-semibold">{label}</div>
                      <div className="text-muted-foreground">
                        {valueLabel}:{" "}
                        <span className="font-semibold text-foreground tabular-nums">
                          {Number(payload[0].value).toLocaleString("az-AZ")}
                        </span>
                      </div>
                    </div>
                  ) : null
                }
              />
              <Area
                type="monotone"
                dataKey="value"
                name={valueLabel}
                stroke={SERIES.primary}
                strokeWidth={2}
                fill={SERIES.primary}
                fillOpacity={0.08}
                dot={{ r: 3, fill: SERIES.primary, strokeWidth: 0 }}
                activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
