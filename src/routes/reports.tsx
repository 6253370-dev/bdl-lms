import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3,
  Download,
  Eye,
  FileText,
  Loader2,
  TrendingUp,
  Users as UsersIcon,
  CheckCircle2,
  XCircle,
  BookOpen,
  ClipboardList,
} from "lucide-react";
import { t } from "@/lib/i18n";
import { jsPDF } from "jspdf";
import { applyAzerbaijaniFont } from "@/lib/pdfFont";
import { toast } from "sonner";
import { StatCard, type StatTrend } from "@/components/design/StatCard";
import { StatusChip } from "@/components/design/StatusChip";
import { DateRangePicker } from "@/components/design/DateRangePicker";
import { ExportButton } from "@/components/design/ExportButton";
import { AreaChartCard } from "@/components/design/AreaChartCard";
import { DonutChart } from "@/components/design/DonutChart";
import { isoToDate } from "@/lib/design";
import { PageHeader } from "@/components/design/PageHeader";
import { UserAvatar } from "@/components/design/UserAvatar";
import { cn } from "@/lib/utils";
import { AZ_MONTHS_SHORT } from "@/lib/az-date";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [
    { title: "Hesabatlar | Baku Digital Lab" },
    { name: "description", content: "Kurs və imtahan nəticələri üzrə təlim hesabatları." },
    { property: "og:title", content: "Hesabatlar | Baku Digital Lab" },
    { property: "og:description", content: "Kurs və imtahan nəticələri üzrə təlim hesabatları." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <ProtectedRoute requireAdmin>
      <ReportsPage />
    </ProtectedRoute>
  ),
});

type Profile = { id: string; full_name: string; employee_id: string };
type Course = { id: string; title: string };
type StandaloneExam = { id: string; title: string; passing_score: number };

type CourseAttempt = {
  id: string;
  user_id: string;
  course_id: string;
  block_id: string;
  score_percent: number;
  passed: boolean;
  duration_seconds: number;
  created_at: string;
};

type ExamAttempt = {
  id: string;
  user_id: string;
  exam_id: string;
  score_percent: number;
  passed: boolean;
  duration_seconds: number;
  created_at: string;
};

type AttemptKind = "course" | "exam";

export interface AttemptDetailRef {
  kind: AttemptKind;
  attemptId: string;
  title: string;
  user?: Profile;
  score: number;
  passed: boolean;
  duration: number;
  date: string;
  // For course: block_id; for exam: exam_id
  parentId: string;
}

function formatDate(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
function formatDateTime(d: Date) {
  return `${formatDate(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [exams, setExams] = useState<StandaloneExam[]>([]);
  const [courseAttempts, setCourseAttempts] = useState<CourseAttempt[]>([]);
  const [examAttempts, setExamAttempts] = useState<ExamAttempt[]>([]);
  const [detail, setDetail] = useState<AttemptDetailRef | null>(null);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [userSearch, setUserSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const [pRes, cRes, eRes, caRes, eaRes] = await Promise.all([
        supabase.from("profiles").select("id,full_name,employee_id"),
        supabase.from("courses").select("id,title").order("title"),
        supabase.from("standalone_exams").select("id,title,passing_score").order("title"),
        supabase
          .from("block_attempts")
          .select("id,user_id,course_id,block_id,score_percent,passed,duration_seconds,created_at"),
        supabase
          .from("standalone_exam_attempts")
          .select("id,user_id,exam_id,score_percent,passed,duration_seconds,created_at"),
      ]);
      setProfiles((pRes.data ?? []) as Profile[]);
      setCourses((cRes.data ?? []) as Course[]);
      setExams((eRes.data ?? []) as StandaloneExam[]);
      setCourseAttempts((caRes.data ?? []) as CourseAttempt[]);
      setExamAttempts((eaRes.data ?? []) as ExamAttempt[]);
      setLoading(false);
    })();
  }, []);

  const profileMap = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles],
  );

  const filterAttempt = (a: { user_id: string; passed: boolean; created_at: string }) => {
    if (userFilter !== "all" && a.user_id !== userFilter) return false;
    if (statusFilter === "passed" && !a.passed) return false;
    if (statusFilter === "failed" && a.passed) return false;
    if (from && new Date(a.created_at) < new Date(from)) return false;
    if (to && new Date(a.created_at) > new Date(to + "T23:59:59")) return false;
    return true;
  };

  const filteredCourseAttempts = useMemo(
    () => courseAttempts.filter(filterAttempt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [courseAttempts, userFilter, statusFilter, from, to],
  );
  const filteredExamAttempts = useMemo(
    () => examAttempts.filter(filterAttempt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [examAttempts, userFilter, statusFilter, from, to],
  );

  const totals = useMemo(() => {
    const all = [
      ...filteredCourseAttempts.map((a) => ({ s: Number(a.score_percent), p: a.passed })),
      ...filteredExamAttempts.map((a) => ({ s: Number(a.score_percent), p: a.passed })),
    ];
    const passed = all.filter((x) => x.p).length;
    const avg = all.length ? Math.round(all.reduce((s, x) => s + x.s, 0) / all.length) : 0;
    return { total: all.length, passed, failed: all.length - passed, avg };
  }, [filteredCourseAttempts, filteredExamAttempts]);

  // Trend: hər iki tarix seçiləndə eyni uzunluqlu əvvəlki dövrlə müqayisə (yalnız mövcud məlumatla, müştəri tərəfində).
  const trends = useMemo(() => {
    const f = isoToDate(from);
    const tt = isoToDate(to);
    if (!f || !tt || tt < f) return null;
    const days = Math.round((tt.getTime() - f.getTime()) / 86400000) + 1;
    const prevTo = new Date(f.getFullYear(), f.getMonth(), f.getDate() - 1, 23, 59, 59);
    const prevFrom = new Date(f.getFullYear(), f.getMonth(), f.getDate() - days);
    const inPrev = (a: { user_id: string; passed: boolean; created_at: string }) => {
      if (userFilter !== "all" && a.user_id !== userFilter) return false;
      if (statusFilter === "passed" && !a.passed) return false;
      if (statusFilter === "failed" && a.passed) return false;
      const d = new Date(a.created_at);
      return d >= prevFrom && d <= prevTo;
    };
    const prev = [...courseAttempts.filter(inPrev), ...examAttempts.filter(inPrev)];
    const pct = (now: number, before: number): StatTrend | null =>
      before > 0 ? { value: Math.round(((now - before) / before) * 100) } : null;
    return {
      total: pct(totals.total, prev.length),
      passed: pct(totals.passed, prev.filter((a) => a.passed).length),
    };
  }, [from, to, userFilter, statusFilter, courseAttempts, examAttempts, totals]);

  // Aylıq aktivlik: seçilmiş aralıqdakı (yoxdursa son 12 ay) ayların cəhd sayı.
  const monthly = useMemo(() => {
    const all = [...filteredCourseAttempts, ...filteredExamAttempts];
    const end = isoToDate(to) ?? new Date();
    const startRaw = isoToDate(from) ?? new Date(end.getFullYear(), end.getMonth() - 11, 1);
    let cur = new Date(startRaw.getFullYear(), startRaw.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    const months: { key: string; label: string; value: number }[] = [];
    while (cur <= last && months.length < 36) {
      months.push({
        key: `${cur.getFullYear()}-${cur.getMonth()}`,
        label: `${AZ_MONTHS_SHORT[cur.getMonth()]} ${String(cur.getFullYear()).slice(2)}`,
        value: 0,
      });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    const idx = new Map(months.map((m, i) => [m.key, i]));
    for (const a of all) {
      const d = new Date(a.created_at);
      const i = idx.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (i !== undefined) months[i].value++;
    }
    return months.map(({ label, value }) => ({ label, value }));
  }, [filteredCourseAttempts, filteredExamAttempts, from, to]);

  // Maddə 48: mövcud (filtrlənmiş) cəhdlərdən reytinqlər və son nəticələr.
  const topCourses = useMemo(() => {
    const m = new Map<string, number>();
    filteredCourseAttempts.forEach((a) => m.set(a.course_id, (m.get(a.course_id) ?? 0) + 1));
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ id, title: courses.find((c) => c.id === id)?.title ?? "—", count }));
  }, [filteredCourseAttempts, courses]);

  const topUsers = useMemo(() => {
    const m = new Map<string, number>();
    [...filteredCourseAttempts, ...filteredExamAttempts].forEach((a) => m.set(a.user_id, (m.get(a.user_id) ?? 0) + 1));
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ id, name: profileMap.get(id)?.full_name ?? "—", count }));
  }, [filteredCourseAttempts, filteredExamAttempts, profileMap]);

  const recentResults = useMemo(() => {
    const rows = [
      ...filteredCourseAttempts.map((a) => ({
        id: a.id, user_id: a.user_id, created_at: a.created_at, score: Number(a.score_percent), passed: a.passed,
        title: courses.find((c) => c.id === a.course_id)?.title ?? "—", kind: t.reports.courses,
      })),
      ...filteredExamAttempts.map((a) => ({
        id: a.id, user_id: a.user_id, created_at: a.created_at, score: Number(a.score_percent), passed: a.passed,
        title: exams.find((e) => e.id === a.exam_id)?.title ?? "—", kind: t.reports.standaloneExams,
      })),
    ];
    return rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 5);
  }, [filteredCourseAttempts, filteredExamAttempts, courses, exams]);

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const header = ["Tip", "Başlıq", "Əməkdaş ID", "Ad", "Bal %", "Status", "Müddət (san)", "Tarix"];
    const rows: (string | number)[][] = [header];
    filteredCourseAttempts.forEach((a) => {
      const p = profileMap.get(a.user_id);
      const c = courses.find((x) => x.id === a.course_id);
      rows.push([
        "Kurs",
        c?.title ?? "",
        p?.employee_id ?? "",
        p?.full_name ?? "",
        Number(a.score_percent),
        a.passed ? "Keçib" : "Keçməyib",
        a.duration_seconds,
        formatDateTime(new Date(a.created_at)),
      ]);
    });
    filteredExamAttempts.forEach((a) => {
      const p = profileMap.get(a.user_id);
      const e = exams.find((x) => x.id === a.exam_id);
      rows.push([
        "İmtahan",
        e?.title ?? "",
        p?.employee_id ?? "",
        p?.full_name ?? "",
        Number(a.score_percent),
        a.passed ? "Keçib" : "Keçməyib",
        a.duration_seconds,
        formatDateTime(new Date(a.created_at)),
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 10 }, { wch: 30 }, { wch: 14 }, { wch: 22 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hesabat");
    XLSX.writeFile(wb, `Hesabat_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bento-page space-y-6">
      <PageHeader
        title={t.reports.title}
        description={t.reports.subtitle}
        actions={
          <>
            <ExportButton format="excel" variant="default" onExport={exportExcel}>
              {t.reports.exportCsv}
            </ExportButton>
          </>
        }
      />

      <Card className="p-5">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="grid gap-1.5">
            <Label className="text-xs" htmlFor="reports-range">
              {t.reports.from} – {t.reports.to}
            </Label>
            <DateRangePicker
              id="reports-range"
              value={{ from, to }}
              onChange={(v) => {
                setFrom(v.from);
                setTo(v.to);
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">{t.reports.user}</Label>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <div className="p-2 sticky top-0 bg-popover z-10">
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="Axtar (ad və ya ID)"
                    className="h-8"
                  />
                </div>
                <SelectItem value="all">{t.reports.allUsers}</SelectItem>
                {profiles
                  .filter((p) => {
                    const q = userSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      p.full_name.toLowerCase().includes(q) ||
                      String(p.employee_id).toLowerCase().includes(q)
                    );
                  })
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name} ({p.employee_id})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">{t.reports.status}</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.reports.all}</SelectItem>
                <SelectItem value="passed">{t.reports.passed}</SelectItem>
                <SelectItem value="failed">{t.reports.failed}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={TrendingUp}
          label={t.reports.attempts}
          value={totals.total.toLocaleString("az-AZ")}
          trend={trends?.total}
        />
        <StatCard
          icon={CheckCircle2}
          label={t.reports.passed}
          value={totals.passed.toLocaleString("az-AZ")}
          tone="success"
          trend={trends?.passed}
        />
        <StatCard
          icon={XCircle}
          label={t.reports.failed}
          value={totals.failed.toLocaleString("az-AZ")}
          tone="error"
        />
        <StatCard icon={BarChart3} label={t.reports.avgScore} value={`${totals.avg}%`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <AreaChartCard
          title="Aylıq aktivlik"
          description="Hər ay edilən kurs və imtahan cəhdlərinin sayı"
          data={monthly}
          valueLabel={t.reports.attempts}
        />
        <section className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-4 font-display text-base font-semibold">Nəticələrin paylanması</h2>
          <DonutChart
            ariaLabel={`${t.reports.passed}: ${totals.passed}, ${t.reports.failed}: ${totals.failed}`}
            centerValue={`${totals.total ? Math.round((totals.passed / totals.total) * 100) : 0}%`}
            centerLabel="keçmə faizi"
            data={[
              { key: "passed", label: t.reports.passed, value: totals.passed, color: "success" },
              { key: "failed", label: t.reports.failed, value: totals.failed, color: "error" },
            ]}
          />
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <RankCard
          title="Ən aktiv kurslar"
          empty="Cəhd yoxdur"
          items={topCourses.map((c) => ({ id: c.id, label: c.title, value: c.count }))}
        />
        <RankCard
          title="Ən aktiv istifadəçilər"
          empty="Cəhd yoxdur"
          withAvatar
          items={topUsers.map((u) => ({ id: u.id, label: u.name, value: u.count }))}
        />
        <section className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-card lg:col-span-2">
          <h2 className="mb-3 font-display text-base font-semibold">Son nəticələr</h2>
          {recentResults.length === 0 ? (
            <p className="text-sm text-muted-foreground">Cəhd yoxdur</p>
          ) : (
            <>
              <table className="hidden w-full text-sm md:table">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-2 pr-3 font-medium">{t.reports.user}</th>
                    <th className="pb-2 pr-3 font-medium">Kurs / imtahan</th>
                    <th className="pb-2 pr-3 font-medium">Bal</th>
                    <th className="pb-2 pr-3 font-medium">{t.reports.status}</th>
                    <th className="pb-2 font-medium">Tarix</th>
                  </tr>
                </thead>
                <tbody>
                  {recentResults.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="py-2.5 pr-3">
                        <span className="flex items-center gap-2">
                          <UserAvatar name={profileMap.get(r.user_id)?.full_name} size="xs" />
                          <span className="min-w-0 break-words">{profileMap.get(r.user_id)?.full_name ?? "—"}</span>
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="block break-words">{r.title}</span>
                        <span className="block text-xs text-muted-foreground">{r.kind}</span>
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums">{Math.round(r.score)}</td>
                      <td className="py-2.5 pr-3">
                        <StatusChip tone={r.passed ? "success" : "error"}>{r.passed ? t.reports.passed : t.reports.failed}</StatusChip>
                      </td>
                      <td className="py-2.5 whitespace-nowrap tabular-nums">{formatDate(new Date(r.created_at))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="divide-y divide-border md:hidden">
                {recentResults.map((r) => (
                  <li key={r.id} className="flex items-start gap-3 py-3">
                    <UserAvatar name={profileMap.get(r.user_id)?.full_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium break-words">{profileMap.get(r.user_id)?.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground break-words">{r.title} · {formatDate(new Date(r.created_at))}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums">{Math.round(r.score)}</span>
                      <StatusChip tone={r.passed ? "success" : "error"}>{r.passed ? t.reports.passed : t.reports.failed}</StatusChip>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <div className="grid xl:grid-cols-2 gap-5 items-start">
        <Card className="p-5">
        <h2 className="font-display font-semibold flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-primary" /> {t.reports.courses}
        </h2>
        {courses.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.reports.noCourses}</p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {courses.map((c) => {
              const ats = filteredCourseAttempts.filter((a) => a.course_id === c.id);
              return (
                <CourseRow
                  key={c.id}
                  course={c}
                  attempts={ats}
                  profileMap={profileMap}
                  onOpenDetail={setDetail}
                />
              );
            })}
          </Accordion>
        )}
      </Card>

        <Card className="p-5">
        <h2 className="font-display font-semibold flex items-center gap-2 mb-3">
          <ClipboardList className="h-4 w-4 text-primary" /> {t.reports.standaloneExams}
        </h2>
        {exams.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.reports.noExams}</p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {exams.map((e) => {
              const ats = filteredExamAttempts.filter((a) => a.exam_id === e.id);
              return (
                <ExamRow
                  key={e.id}
                  exam={e}
                  attempts={ats}
                  profileMap={profileMap}
                  onOpenDetail={setDetail}
                />
              );
            })}
          </Accordion>
        )}
      </Card>

      </div>
      {detail && (
        <AttemptDetailDialog detailRef={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}

function RankCard({
  title,
  items,
  empty,
  withAvatar,
}: {
  title: string;
  items: { id: string; label: string; value: number }[];
  empty: string;
  withAvatar?: boolean;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-card">
      <h2 className="mb-3 font-display text-base font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ol className="divide-y divide-border">
          {items.map((it, i) => (
            <li key={it.id} className="flex items-center gap-3 py-2.5">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                  i === 0 ? "bg-brand-600 text-white" : i < 3 ? "bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300" : "bg-muted text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              {withAvatar && <UserAvatar name={it.label} size="sm" />}
              <span className="min-w-0 flex-1 text-sm font-medium break-words">{it.label}</span>
              <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{it.value.toLocaleString("az-AZ")} cəhd</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function summarize(scores: number[]) {
  if (!scores.length) return { avg: 0, min: 0, max: 0 };
  return {
    avg: Math.round(scores.reduce((s, x) => s + x, 0) / scores.length),
    min: Math.round(Math.min(...scores)),
    max: Math.round(Math.max(...scores)),
  };
}

function CourseRow({
  course,
  attempts,
  profileMap,
  onOpenDetail,
}: {
  course: Course;
  attempts: CourseAttempt[];
  profileMap: Map<string, Profile>;
  onOpenDetail: (d: AttemptDetailRef) => void;
}) {
  const passed = attempts.filter((a) => a.passed).length;
  const stats = summarize(attempts.map((a) => Number(a.score_percent)));
  const uniqueUsers = new Set(attempts.map((a) => a.user_id)).size;

  return (
    <AccordionItem value={course.id}>
      <AccordionTrigger className="hover:no-underline">
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-2 text-left">
          <div className="font-medium col-span-2 sm:col-span-2">{course.title}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <UsersIcon className="h-3 w-3" /> {uniqueUsers}
          </div>
          <div className="text-xs text-muted-foreground">
            {attempts.length} {t.reports.inAttempts} · {passed} {t.reports.inPassed}
          </div>
          <div className="text-xs font-medium">{t.reports.avgScore} {stats.avg}%</div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        {attempts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">{t.reports.noAttemptsFilter}</p>
        ) : (
          <AttemptsTable
            rows={attempts.map((a) => ({
              kind: "course" as const,
              attemptId: a.id,
              title: course.title,
              user: profileMap.get(a.user_id),
              score: Number(a.score_percent),
              passed: a.passed,
              duration: a.duration_seconds,
              date: a.created_at,
              parentId: a.block_id,
            }))}
            onOpenDetail={onOpenDetail}
          />
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

function ExamRow({
  exam,
  attempts,
  profileMap,
  onOpenDetail,
}: {
  exam: StandaloneExam;
  attempts: ExamAttempt[];
  profileMap: Map<string, Profile>;
  onOpenDetail: (d: AttemptDetailRef) => void;
}) {
  const passed = attempts.filter((a) => a.passed).length;
  const stats = summarize(attempts.map((a) => Number(a.score_percent)));
  const uniqueUsers = new Set(attempts.map((a) => a.user_id)).size;

  return (
    <AccordionItem value={exam.id}>
      <AccordionTrigger className="hover:no-underline">
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-2 text-left">
          <div className="font-medium col-span-2 sm:col-span-2">{exam.title}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <UsersIcon className="h-3 w-3" /> {uniqueUsers}
          </div>
          <div className="text-xs text-muted-foreground">
            {attempts.length} {t.reports.inAttempts} · {passed} {t.reports.inPassed}
          </div>
          <div className="text-xs font-medium">{t.reports.avgScore} {stats.avg}%</div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        {attempts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">{t.reports.noAttemptsFilter}</p>
        ) : (
          <AttemptsTable
            rows={attempts.map((a) => ({
              kind: "exam" as const,
              attemptId: a.id,
              title: exam.title,
              user: profileMap.get(a.user_id),
              score: Number(a.score_percent),
              passed: a.passed,
              duration: a.duration_seconds,
              date: a.created_at,
              parentId: a.exam_id,
            }))}
            onOpenDetail={onOpenDetail}
          />
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

function AttemptsTable({
  rows,
  onOpenDetail,
}: {
  rows: AttemptDetailRef[];
  onOpenDetail: (d: AttemptDetailRef) => void;
}) {
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);

  const downloadPdf = async (row: AttemptDetailRef) => {
    setPdfBusy(row.attemptId);
    try {
      const detail = await fetchAttemptDetail(row);
      const doc = await buildAttemptPdf(row, detail);
      doc.save(
        `Hesabat_${new Date().toISOString().slice(0, 10)}.pdf`,
      );
    } catch (e: any) {
      toast.error(e.message ?? "PDF yaradıla bilmədi");
    } finally {
      setPdfBusy(null);
    }
  };

  return (
    <div className="border rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr className="text-left">
            <th className="p-2">{t.reports.employee}</th>
            <th className="p-2">{t.reports.name}</th>
            <th className="p-2 text-right">{t.reports.score}</th>
            <th className="p-2">{t.reports.status}</th>
            <th className="p-2 text-right">{t.reports.time}</th>
            <th className="p-2">{t.reports.date}</th>
            <th className="p-2 text-right">Əməliyyat</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.attemptId} className="border-t">
              <td className="p-2 font-mono text-xs">{r.user?.employee_id ?? "—"}</td>
              <td className="p-2">{r.user?.full_name ?? "—"}</td>
              <td className="p-2 text-right font-medium">{r.score}%</td>
              <td className="p-2">
                <StatusChip tone={r.passed ? "success" : "error"}>
                  {r.passed ? t.reports.passed : t.reports.failed}
                </StatusChip>
              </td>
              <td className="p-2 text-right text-xs text-muted-foreground">
                {Math.round(r.duration / 60)}d
              </td>
              <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">
                {formatDateTime(new Date(r.date))}
              </td>
              <td className="p-2 text-right whitespace-nowrap">
                <Button
                  size="icon"
                  variant="ghost"
                  title="Bax"
                  onClick={() => onOpenDetail(r)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  title="PDF yüklə"
                  disabled={pdfBusy === r.attemptId}
                  onClick={() => downloadPdf(r)}
                >
                  {pdfBusy === r.attemptId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Detail fetching ----------

interface AnswerRow {
  id: string;
  text: string;
  is_correct: boolean;
}
interface QuestionDetail {
  id: string;
  text: string;
  answers: AnswerRow[];
  selectedAnswerId: string | null;
  isCorrect: boolean;
  isOpenEnded: boolean;
  answerText: string | null;
  grade: number | null;
}

async function fetchAttemptDetail(ref: AttemptDetailRef): Promise<QuestionDetail[]> {
  const isCourse = ref.kind === "course";
  const qTable = isCourse ? "questions" : "standalone_exam_questions";
  const rTable = isCourse ? "attempt_responses" : "standalone_exam_responses";
  const aTable = isCourse ? "answers" : "standalone_exam_answers";
  const parentCol = isCourse ? "block_id" : "exam_id";

  const [qRes, rRes] = await Promise.all([
    supabase
      .from(qTable as any)
      .select("id,text,position,is_open_ended")
      .eq(parentCol, ref.parentId)
      .order("position"),
    supabase
      .from(rTable as any)
      .select("question_id,answer_id,is_correct,answer_text,grade")
      .eq("attempt_id", ref.attemptId),
  ]);

  const qs = ((qRes.data ?? []) as any[]) as { id: string; text: string; is_open_ended: boolean }[];
  const ids = qs.map((q) => q.id);
  const aRes = ids.length
    ? await supabase
        .from(aTable as any)
        .select("id,question_id,text,is_correct,position")
        .in("question_id", ids)
        .order("position")
    : { data: [] as any[] };

  const responses = (rRes.data ?? []) as any[];
  return qs.map((q) => {
    const r = responses.find((x) => x.question_id === q.id);
    return {
      id: q.id,
      text: q.text,
      answers: ((aRes.data ?? []) as any[])
        .filter((a) => a.question_id === q.id)
        .map((a) => ({ id: a.id, text: a.text, is_correct: a.is_correct })),
      selectedAnswerId: r?.answer_id ?? null,
      isCorrect: r?.is_correct ?? false,
      isOpenEnded: !!q.is_open_ended,
      answerText: r?.answer_text ?? null,
      grade: r?.grade === null || r?.grade === undefined ? null : Number(r.grade),
    };
  });
}


export function AttemptDetailDialog({
  detailRef: ref,
  onClose,
}: {
  detailRef: AttemptDetailRef;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<QuestionDetail[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const qs = await fetchAttemptDetail(ref);
        setQuestions(qs);
      } catch {
        setQuestions([]);
      }
      setLoading(false);
    })();
  }, [ref]);

  const downloadPdf = async () => {
    const doc = await buildAttemptPdf(ref, questions);
    doc.save(
      `Hesabat_${new Date().toISOString().slice(0, 10)}.pdf`,
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-6">
            <span>{ref.title}</span>
            <StatusChip tone={ref.passed ? "success" : "error"}>
              {ref.passed ? t.reports.passed : t.reports.failed} · {ref.score}%
            </StatusChip>
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
          <span><strong>{ref.user?.full_name ?? "—"}</strong> ({ref.user?.employee_id ?? "—"})</span>
          <span>{formatDateTime(new Date(ref.date))}</span>
          <span>{Math.round(ref.duration / 60)} dəq</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : questions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Bu cəhd üçün sual təfərrüatı yoxdur.
          </p>
        ) : (
          <div className="space-y-3 mt-3">
            {questions.map((q, idx) => (
              <Card key={q.id} className="p-4">
                <div className="flex items-start gap-2 mb-3">
                  <span className="text-xs font-mono text-muted-foreground mt-1">
                    {idx + 1}.
                  </span>
                  <div className="flex-1 font-medium">
                    {q.text}
                    {q.isOpenEnded && (
                      <Badge variant="secondary" className="ml-2 align-middle">Açıq sual</Badge>
                    )}
                  </div>
                  {q.isOpenEnded ? (
                    <span className="text-xs font-medium shrink-0 mt-1">
                      {q.grade === null ? "Yoxlanılmayıb" : `Qiymət: ${q.grade.toFixed(1)}`}
                    </span>
                  ) : q.isCorrect ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive shrink-0" />
                  )}
                </div>
                <div className="space-y-1.5 pl-6">
                  {q.isOpenEnded ? (
                    <div className="text-sm rounded-md border border-input px-3 py-2 whitespace-pre-wrap">
                      <div className="text-xs text-muted-foreground mb-1">İstifadəçinin cavabı</div>
                      {q.answerText?.trim() ? q.answerText : <span className="italic text-muted-foreground">(cavab yazılmayıb)</span>}
                    </div>
                  ) : (
                    <>
                      {q.answers.map((a) => {
                        const selected = a.id === q.selectedAnswerId;
                        const correct = a.is_correct;
                        const cls = correct
                          ? "border-emerald-500/60 bg-emerald-500/5"
                          : selected
                          ? "border-destructive/60 bg-destructive/5"
                          : "border-input";
                        return (
                          <div
                            key={a.id}
                            className={`text-sm rounded-md border px-3 py-2 flex items-center justify-between gap-2 ${cls}`}
                          >
                            <span>{a.text}</span>
                            <span className="text-xs text-muted-foreground flex gap-2">
                              {selected && <span className="font-medium">Seçilib</span>}
                              {correct && <span className="font-medium text-emerald-600">Doğru</span>}
                            </span>
                          </div>
                        );
                      })}
                      {q.answers.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">Cavab variantı yoxdur.</p>
                      )}
                    </>
                  )}
                </div>

              </Card>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bağla</Button>
          <Button onClick={downloadPdf} disabled={loading || questions.length === 0}>
            <Download className="h-4 w-4 mr-2" /> PDF yüklə
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- PDF ----------

async function buildAttemptPdf(
  ref: AttemptDetailRef,
  questions: QuestionDetail[],
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await applyAzerbaijaniFont(doc);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  const ensureSpace = (need: number) => {
    if (y + need > H - margin) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFont("NotoSans", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 40, 65);
  doc.text("Baku Digital Lab — Cəhd hesabatı", margin, y);
  y += 24;

  doc.setFont("NotoSans", "bold");
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  const titleLines = doc.splitTextToSize(ref.title, W - margin * 2);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 16 + 6;

  doc.setFont("NotoSans", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  const meta = [
    `İstifadəçi: ${ref.user?.full_name ?? "—"} (${ref.user?.employee_id ?? "—"})`,
    `Tarix: ${formatDateTime(new Date(ref.date))}`,
    `Bal: ${ref.score}%   Status: ${ref.passed ? "Keçib" : "Keçməyib"}   Müddət: ${Math.round(ref.duration / 60)} dəq`,
  ];
  meta.forEach((line) => {
    doc.text(line, margin, y);
    y += 14;
  });
  y += 8;
  doc.setDrawColor(210);
  doc.line(margin, y, W - margin, y);
  y += 16;

  doc.setFont("NotoSans", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20, 40, 65);
  doc.text("Suallar və cavablar", margin, y);
  y += 20;

  questions.forEach((q, idx) => {
    ensureSpace(60);
    doc.setFont("NotoSans", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    const qLines = doc.splitTextToSize(`${idx + 1}. ${q.text}`, W - margin * 2);
    qLines.forEach((line: string) => {
      ensureSpace(16);
      doc.text(line, margin, y);
      y += 15;
    });
    y += 2;

    doc.setFont("NotoSans", "normal");
    doc.setFontSize(10);

    if (q.isOpenEnded) {
      doc.setTextColor(70, 70, 70);
      const label = `   Cavab (açıq sual):`;
      ensureSpace(14);
      doc.text(label, margin + 12, y);
      y += 14;
      const body = q.answerText?.trim() || "(cavab yazılmayıb)";
      const bLines = doc.splitTextToSize(body, W - margin * 2 - 24);
      bLines.forEach((line: string) => {
        ensureSpace(14);
        doc.text(line, margin + 24, y);
        y += 14;
      });
      doc.setTextColor(20, 40, 65);
      ensureSpace(14);
      doc.text(
        `   Qiymət: ${q.grade === null ? "yoxlanılmayıb" : q.grade.toFixed(1)}`,
        margin + 12,
        y,
      );
      y += 14;
    } else {
      q.answers.forEach((a) => {
        const selected = a.id === q.selectedAnswerId;
        const correct = a.is_correct;
        let prefix = "•";
        if (correct && selected) prefix = "✓✓";
        else if (correct) prefix = "✓";
        else if (selected) prefix = "✗";

        if (correct) doc.setTextColor(20, 120, 60);
        else if (selected) doc.setTextColor(180, 35, 35);
        else doc.setTextColor(70, 70, 70);

        const aLines = doc.splitTextToSize(`   ${prefix}  ${a.text}`, W - margin * 2 - 12);
        aLines.forEach((line: string) => {
          ensureSpace(14);
          doc.text(line, margin + 12, y);
          y += 14;
        });
      });
    }

    y += 10;
  });

  return doc;
}
