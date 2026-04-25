import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card } from "@/components/ui/card";
import { Trophy, Loader2, Medal, Crown } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/champions")({
  component: () => (
    <ProtectedRoute>
      <ChampionsPage />
    </ProtectedRoute>
  ),
});

interface CourseOpt { id: string; title: string }
interface Row {
  user_id: string;
  full_name: string;
  score_percent: number;
  duration_seconds: number;
  created_at: string;
}

function ChampionsPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("courses").select("id,title").order("title");
      const list = (data ?? []) as CourseOpt[];
      setCourses(list);
      if (list.length) setCourseId(list[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!courseId) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      // Get final-exam blocks of course
      const { data: blocks } = await supabase
        .from("course_blocks")
        .select("id")
        .eq("course_id", courseId)
        .eq("block_type", "final_exam");
      const blockIds = (blocks ?? []).map((b) => b.id);
      if (!blockIds.length) {
        if (!cancel) { setRows([]); setLoading(false); }
        return;
      }
      const { data: attempts } = await supabase
        .from("block_attempts")
        .select("user_id, score_percent, duration_seconds, created_at, passed")
        .in("block_id", blockIds)
        .eq("passed", true)
        .order("score_percent", { ascending: false })
        .order("duration_seconds", { ascending: true });

      // Best attempt per user
      const best = new Map<string, Row>();
      ((attempts ?? []) as Array<{ user_id: string; score_percent: number; duration_seconds: number; created_at: string }>)
        .forEach((a) => {
          const cur = best.get(a.user_id);
          if (!cur || a.score_percent > cur.score_percent ||
              (a.score_percent === cur.score_percent && a.duration_seconds < cur.duration_seconds)) {
            best.set(a.user_id, {
              user_id: a.user_id,
              full_name: "",
              score_percent: a.score_percent,
              duration_seconds: a.duration_seconds,
              created_at: a.created_at,
            });
          }
        });

      const top = Array.from(best.values())
        .sort((a, b) => b.score_percent - a.score_percent || a.duration_seconds - b.duration_seconds)
        .slice(0, 5);

      if (top.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", top.map((r) => r.user_id));
        const nameMap = new Map(((profs ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));
        top.forEach((r) => { r.full_name = nameMap.get(r.user_id) ?? "—"; });
      }
      if (!cancel) { setRows(top); setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [courseId]);

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  };

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Trophy className="h-7 w-7 text-warning" />
        <h1 className="font-display text-3xl font-bold">{t.champions.title}</h1>
      </div>
      <p className="text-muted-foreground mb-6">{t.champions.subtitle}</p>

      <Card className="p-4 mb-6">
        <label className="text-xs font-medium text-muted-foreground mb-2 block">{t.champions.selectCourse}</label>
        <Select value={courseId ?? undefined} onValueChange={setCourseId}>
          <SelectTrigger className="w-full sm:w-96">
            <SelectValue placeholder={t.champions.selectCourse} />
          </SelectTrigger>
          <SelectContent>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Trophy className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t.champions.noResults}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r, i) => {
            const isYou = r.user_id === user?.id;
            const rankColors = [
              "bg-warning text-warning-foreground",
              "bg-muted text-muted-foreground",
              "bg-accent text-accent-foreground",
            ];
            const RankIcon = i === 0 ? Crown : i < 3 ? Medal : Trophy;
            return (
              <Card
                key={r.user_id}
                className={cn(
                  "p-4 flex items-center gap-4 transition-all",
                  isYou && "border-primary border-2 bg-primary/5",
                )}
              >
                <div className={cn(
                  "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
                  i < 3 ? rankColors[i] : "bg-muted text-muted-foreground",
                )}>
                  <RankIcon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold truncate">
                    {r.full_name}
                    {isYou && <span className="ml-2 text-xs font-normal text-primary">({t.champions.you})</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    #{i + 1} · {t.champions.time}: {fmtTime(r.duration_seconds)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-2xl font-bold text-primary">{r.score_percent}%</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.champions.score}</div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
