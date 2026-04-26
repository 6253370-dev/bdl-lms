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
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3,
  Download,
  Loader2,
  TrendingUp,
  Users as UsersIcon,
  CheckCircle2,
  XCircle,
  BookOpen,
  ClipboardList,
} from "lucide-react";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/reports")({
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

function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [exams, setExams] = useState<StandaloneExam[]>([]);
  const [courseAttempts, setCourseAttempts] = useState<CourseAttempt[]>([]);
  const [examAttempts, setExamAttempts] = useState<ExamAttempt[]>([]);

  // Filters
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [userFilter, setUserFilter] = useState<string>("all");
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

  const exportCSV = () => {
    const rows: (string | number)[][] = [
      ["Type", "Title", "Employee ID", "Name", "Score %", "Status", "Duration (s)", "Date"],
    ];
    filteredCourseAttempts.forEach((a) => {
      const p = profileMap.get(a.user_id);
      const c = courses.find((x) => x.id === a.course_id);
      rows.push([
        "Course",
        c?.title ?? "",
        p?.employee_id ?? "",
        p?.full_name ?? "",
        Number(a.score_percent),
        a.passed ? "Passed" : "Failed",
        a.duration_seconds,
        new Date(a.created_at).toISOString(),
      ]);
    });
    filteredExamAttempts.forEach((a) => {
      const p = profileMap.get(a.user_id);
      const e = exams.find((x) => x.id === a.exam_id);
      rows.push([
        "Exam",
        e?.title ?? "",
        p?.employee_id ?? "",
        p?.full_name ?? "",
        Number(a.score_percent),
        a.passed ? "Passed" : "Failed",
        a.duration_seconds,
        new Date(a.created_at).toISOString(),
      ]);
    });
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `be_academy_report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold mb-1 flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" /> {t.reports.title}
          </h1>
          <p className="text-muted-foreground">
            {t.reports.subtitle}
          </p>
        </div>
        <Button onClick={exportCSV}>
          <Download className="h-4 w-4" /> {t.reports.exportCsv}
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="grid gap-1.5">
            <Label className="text-xs">{t.reports.from}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">{t.reports.to}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">{t.reports.user}</Label>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.reports.allUsers}</SelectItem>
                {profiles.map((p) => (
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

      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={TrendingUp} label={t.reports.attempts} value={totals.total} tone="primary" />
        <Kpi icon={CheckCircle2} label={t.reports.passed} value={totals.passed} tone="success" />
        <Kpi icon={XCircle} label={t.reports.failed} value={totals.failed} tone="destructive" />
        <Kpi icon={BarChart3} label={t.reports.avgScore} value={`${totals.avg}%`} tone="accent" />
      </div>

      {/* Per-course accordion */}
      <Card className="p-4">
        <h2 className="font-display font-semibold flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-primary" /> Courses
        </h2>
        {courses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No courses yet.</p>
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
                />
              );
            })}
          </Accordion>
        )}
      </Card>

      {/* Per-exam accordion */}
      <Card className="p-4">
        <h2 className="font-display font-semibold flex items-center gap-2 mb-3">
          <ClipboardList className="h-4 w-4 text-primary" /> Standalone Exams
        </h2>
        {exams.length === 0 ? (
          <p className="text-sm text-muted-foreground">No exams yet.</p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {exams.map((e) => {
              const ats = filteredExamAttempts.filter((a) => a.exam_id === e.id);
              return (
                <ExamRow key={e.id} exam={e} attempts={ats} profileMap={profileMap} />
              );
            })}
          </Accordion>
        )}
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof BarChart3;
  label: string;
  value: number | string;
  tone: "primary" | "success" | "destructive" | "accent";
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    accent: "bg-accent/15 text-accent-foreground",
  };
  return (
    <Card className="p-5">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${toneMap[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 text-3xl font-display font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </Card>
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
}: {
  course: Course;
  attempts: CourseAttempt[];
  profileMap: Map<string, Profile>;
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
            {attempts.length} attempts · {passed} passed
          </div>
          <div className="text-xs font-medium">Avg {stats.avg}%</div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        {attempts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No attempts in current filter.</p>
        ) : (
          <AttemptsTable
            rows={attempts.map((a) => ({
              user: profileMap.get(a.user_id),
              score: Number(a.score_percent),
              passed: a.passed,
              duration: a.duration_seconds,
              date: a.created_at,
            }))}
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
}: {
  exam: StandaloneExam;
  attempts: ExamAttempt[];
  profileMap: Map<string, Profile>;
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
            {attempts.length} attempts · {passed} passed
          </div>
          <div className="text-xs font-medium">Avg {stats.avg}%</div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        {attempts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No attempts in current filter.</p>
        ) : (
          <AttemptsTable
            rows={attempts.map((a) => ({
              user: profileMap.get(a.user_id),
              score: Number(a.score_percent),
              passed: a.passed,
              duration: a.duration_seconds,
              date: a.created_at,
            }))}
          />
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

function AttemptsTable({
  rows,
}: {
  rows: { user?: Profile; score: number; passed: boolean; duration: number; date: string }[];
}) {
  return (
    <div className="border rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr className="text-left">
            <th className="p-2">Employee</th>
            <th className="p-2">Name</th>
            <th className="p-2 text-right">Score</th>
            <th className="p-2">Status</th>
            <th className="p-2 text-right">Time</th>
            <th className="p-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              <td className="p-2 font-mono text-xs">{r.user?.employee_id ?? "—"}</td>
              <td className="p-2">{r.user?.full_name ?? "—"}</td>
              <td className="p-2 text-right font-medium">{r.score}%</td>
              <td className="p-2">
                <Badge variant={r.passed ? "default" : "destructive"}>
                  {r.passed ? "Passed" : "Failed"}
                </Badge>
              </td>
              <td className="p-2 text-right text-xs text-muted-foreground">
                {Math.round(r.duration / 60)}m
              </td>
              <td className="p-2 text-xs text-muted-foreground">
                {new Date(r.date).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
