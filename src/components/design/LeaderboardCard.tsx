import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LeaderboardPeriod } from "@/lib/dashboard-courses";
import { UserAvatar } from "./UserAvatar";

const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
  { value: "week", label: "Bu həftə" },
  { value: "month", label: "Bu ay" },
  { value: "all", label: "Bütün zamanlar" },
];

export interface LeaderRow {
  id: string;
  name: string;
  avatar?: string | null;
  xp: number;
  rank: number;
}

/**
 * Liderlər cədvəli vidceti (maddə 69): dövr seçimi, top sətirlər,
 * istifadəçinin öz sətri vurğulanır (top siyahıda yoxdursa, altda ayrıca göstərilir).
 */
export function LeaderboardCard({
  rows,
  me,
  meId,
  period,
  onPeriodChange,
  className,
}: {
  rows: LeaderRow[];
  me?: LeaderRow | null;
  meId?: string;
  period: LeaderboardPeriod;
  onPeriodChange: (p: LeaderboardPeriod) => void;
  className?: string;
}) {
  const meInTop = rows.some((r) => r.id === meId);
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-xl border border-border bg-card p-5 shadow-card",
        className,
      )}
      aria-labelledby="leaderboard-title"
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 id="leaderboard-title" className="font-display text-base font-semibold">
          Liderlər cədvəli
        </h2>
        <Select value={period} onValueChange={(v) => onPeriodChange(v as LeaderboardPeriod)}>
          <SelectTrigger className="h-8 w-auto gap-1.5 rounded-full px-3 text-xs" aria-label="Dövr">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {PERIODS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>
      {rows.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">Hələ məlumat yoxdur</p>
      ) : (
        <ol className="space-y-1">
          {rows.map((r) => (
            <Row key={r.id} row={r} isMe={r.id === meId} />
          ))}
          {!meInTop && me && (
            <>
              <li aria-hidden="true" className="px-3 text-center text-xs text-muted-foreground">
                ⋯
              </li>
              <Row row={me} isMe />
            </>
          )}
        </ol>
      )}
      <Link
        to="/champions"
        className="mt-auto inline-flex items-center gap-1 self-end pt-3 text-sm font-semibold text-primary hover:text-[var(--primary-hover)]"
      >
        Hamısına bax <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

function Row({ row, isMe }: { row: LeaderRow; isMe: boolean }) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
        isMe && "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-600/15 dark:text-brand-200",
      )}
      aria-current={isMe ? "true" : undefined}
    >
      <span className={cn("w-5 text-center tabular-nums", !isMe && "text-muted-foreground")}>
        {row.rank}
      </span>
      <UserAvatar name={row.name} src={row.avatar} size="sm" />
      <span className="min-w-0 flex-1 truncate">
        {row.name}
        {isMe && <span className="sr-only"> (Sən)</span>}
      </span>
      <span className={cn("tabular-nums", !isMe && "text-secondary-foreground")}>
        {row.xp.toLocaleString("az-AZ")} XP
      </span>
    </li>
  );
}
