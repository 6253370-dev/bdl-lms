import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import {
  BookOpen,
  ClipboardList,
  Trophy,
  Users,
  FileQuestion,
  TrendingUp,
  CheckCircle2,
  BarChart3,
  Clock,
  Loader2,
  ArrowUpRight,
  ArrowRight,
  Play,
  Award,
  FileCheck2,
  MapPin,
  ChevronRight,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/i18n";
import {
  countLessons,
  leaderboard,
  lessonProgress,
  monthShort,
  monthlyCounts,
  popularCourses,
  ratingsByCourse,
  recentAllowedCourses,
  type DashboardCourse,
  type LeaderboardPeriod,
  type RatingSummary,
} from "@/lib/dashboard-courses";
import { PageHeader } from "@/components/design/PageHeader";
import { MotivationStrip } from "@/components/design/MotivationStrip";
import { StatCard } from "@/components/design/StatCard";
import { IconChip } from "@/components/design/IconChip";
import { RingProgress } from "@/components/design/RingProgress";
import { DonutChart } from "@/components/design/DonutChart";
import { AreaChartCard } from "@/components/design/AreaChartCard";
import { BarChartCard } from "@/components/design/BarChartCard";
import { CourseCard } from "@/components/design/CourseCard";
import { LeaderboardCard, type LeaderRow } from "@/components/design/LeaderboardCard";
import summit from "@/assets/learning-summit.jpg";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Ana səhifə | Baku Digital Lab" },
      {
        name: "description",
        content: "Şəxsi təlim nəticələri, son baxılan və ən populyar icazəli kurslar.",
      },
      { property: "og:title", content: "Ana səhifə | Baku Digital Lab" },
      { property: "og:description", content: "Təlim nəticələriniz və sizin üçün əlçatan kurslar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  ),
});

interface AdminStats {
  courses: number;
  publishedCourses: number;
  exams: number;
  quizzes: number;
  users: number;
  certificates: number;
  attempts: number;
  passed: number;
  avgScore: number;
  monthly: { label: string; value: number }[];
  topCourses: { id: string; title: string; views: number }[];
  topUsers: { id: string; full_name: string; attempts: number }[];
}

interface UpcomingExam {
  id: string;
  title: string;
  location: string | null;
  starts_at: string;
  ends_at: string;
  exam: { title: string } | null;
}

interface ContinueCourse {
  course: DashboardCourse;
  completed: number;
  total: number;
  percent: number;
}

interface UserStats {
  certificates: number;
  attempts: number;
  passed: number;
  avgScore: number | null;
  recent: DashboardCourse[];
  popular: DashboardCourse[];
  continueCourse: ContinueCourse | null;
  lessons: Record<string, number>;
  ratings: Record<string, RatingSummary>;
  exam: UpcomingExam | null;
  xpEvents: { user_id: string; xp: number; created_at: string }[];
  people: Record<string, { name: string; avatar: string | null }>;
}

const MOTIVATION_TITLE = (
  <>
    Hər yeni bilik
    <br />
    səni daha güclü edir!
  </>
);
const MOTIVATION_TEXT = "Öyrənmək bir vərdişdir, həyat tərzidir.";

function Dashboard() {
  const { profile, isAdmin, user } = useAuth();
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (isAdmin) {
        const [
          { count: courses },
          { count: publishedCourses },
          { count: exams },
          { count: quizzes },
          { count: users },
          { count: certificates },
          { data: attempts },
          { data: views },
          { data: profiles },
        ] = await Promise.all([
          supabase.from("courses").select("*", { count: "exact", head: true }),
          supabase
            .from("courses")
            .select("*", { count: "exact", head: true })
            .eq("is_published", true),
          supabase.from("standalone_exams").select("*", { count: "exact", head: true }),
          supabase.from("quizzes").select("*", { count: "exact", head: true }),
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase.from("certificates").select("*", { count: "exact", head: true }),
          supabase
            .from("block_attempts")
            .select("user_id,course_id,score_percent,passed,created_at"),
          supabase.from("course_views").select("course_id"),
          supabase.from("profiles").select("id,full_name"),
        ]);
        const all = attempts ?? [];
        const total = all.length;
        const passed = all.filter((a) => a.passed).length;
        const avg = total
          ? Math.round(all.reduce((s, a) => s + Number(a.score_percent), 0) / total)
          : 0;

        // Top courses by views
        const viewMap = new Map<string, number>();
        (views ?? []).forEach((v: any) =>
          viewMap.set(v.course_id, (viewMap.get(v.course_id) ?? 0) + 1),
        );
        const topCourseIds = [...viewMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
        const { data: topCourseRows } = topCourseIds.length
          ? await supabase
              .from("courses")
              .select("id,title")
              .in(
                "id",
                topCourseIds.map(([id]) => id),
              )
          : { data: [] as any[] };
        const topCourses = topCourseIds.map(([id, count]) => ({
          id,
          title: topCourseRows?.find((c: any) => c.id === id)?.title ?? "—",
          views: count,
        }));

        // Top users by attempts
        const userMap = new Map<string, number>();
        all.forEach((a) => userMap.set(a.user_id, (userMap.get(a.user_id) ?? 0) + 1));
        const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));
        const topUsers = [...userMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([id, n]) => ({ id, full_name: profileMap.get(id) ?? "—", attempts: n }));

        setAdminStats({
          courses: courses ?? 0,
          publishedCourses: publishedCourses ?? 0,
          exams: exams ?? 0,
          quizzes: quizzes ?? 0,
          users: users ?? 0,
          certificates: certificates ?? 0,
          attempts: total,
          passed,
          avgScore: avg,
          monthly: monthlyCounts(all.map((a) => a.created_at)),
          topCourses,
          topUsers,
        });
      } else if (user?.id) {
        const [
          { count: certificates },
          { data: attempts },
          { data: views },
          allowedResult,
          { data: xpEvents },
          { data: people },
          { data: exam },
        ] = await Promise.all([
          supabase
            .from("certificates")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id),
          supabase.from("block_attempts").select("score_percent,passed").eq("user_id", user.id),
          supabase
            .from("course_views")
            .select("course_id,viewed_at")
            .eq("user_id", user.id)
            .order("viewed_at", { ascending: false }),
          supabase.rpc("dashboard_allowed_courses"),
          supabase.from("gamification_xp_events").select("user_id,xp,created_at"),
          supabase.from("profiles").select("id,full_name,avatar_url"),
          // Təqvimdəki ən yaxın imtahan (görünürlüyü mövcud RLS müəyyən edir).
          supabase
            .from("exam_events")
            .select("id,title,location,starts_at,ends_at,exam:standalone_exams(title)")
            .eq("event_type", "exam")
            .gte("ends_at", new Date().toISOString())
            .order("starts_at")
            .limit(1)
            .maybeSingle(),
        ]);
        const total = attempts?.length ?? 0;
        const passed = (attempts ?? []).filter((a) => a.passed).length;
        const avgScore = total
          ? Math.round((attempts ?? []).reduce((s, a) => s + Number(a.score_percent), 0) / total)
          : null;
        if (allowedResult.error)
          console.error("Unable to load allowed dashboard courses", allowedResult.error.message);
        const allowed: DashboardCourse[] = (allowedResult.data ?? []).map((c) => ({
          ...c,
          viewers: Number(c.viewers),
        }));
        const recent = recentAllowedCourses(views ?? [], allowed);
        const popular = popularCourses(allowed).slice(0, 3);
        const current = recent[0] ?? null;

        // Dərs sayı, reytinq və "Davam et" proqresi.
        const ids = [...new Set([...(current ? [current.id] : []), ...popular.map((c) => c.id)])];
        const [{ data: blocks }, { data: reviews }, { data: done }] = await Promise.all([
          ids.length
            ? supabase.from("course_blocks").select("id,course_id,block_type").in("course_id", ids)
            : Promise.resolve({
                data: [] as { id: string; course_id: string; block_type: string }[],
              }),
          popular.length
            ? supabase
                .from("course_reviews")
                .select("course_id,rating")
                .in(
                  "course_id",
                  popular.map((c) => c.id),
                )
            : Promise.resolve({ data: [] as { course_id: string; rating: number }[] }),
          current
            ? supabase
                .from("block_progress")
                .select("block_id")
                .eq("user_id", user.id)
                .eq("course_id", current.id)
                .eq("completed", true)
            : Promise.resolve({ data: [] as { block_id: string }[] }),
        ]);
        const continueCourse = current
          ? {
              course: current,
              ...lessonProgress(
                (blocks ?? []).filter((b) => b.course_id === current.id),
                (done ?? []).map((d) => d.block_id),
              ),
            }
          : null;

        setUserStats({
          certificates: certificates ?? 0,
          attempts: total,
          passed,
          avgScore,
          recent,
          popular,
          continueCourse,
          lessons: Object.fromEntries(countLessons(blocks ?? [])),
          ratings: Object.fromEntries(ratingsByCourse(reviews ?? [])),
          exam: (exam as unknown as UpcomingExam | null) ?? null,
          xpEvents: xpEvents ?? [],
          people: Object.fromEntries(
            (people ?? []).map((p) => [p.id, { name: p.full_name, avatar: p.avatar_url }]),
          ),
        });
      }
      setLoading(false);
    })();
  }, [isAdmin, user?.id]);

  if (loading) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bento-page">
      <PageHeader
        title={
          <>
            {t.dashboard.title}, {profile?.full_name?.split(" ")[0]}
          </>
        }
        description={t.dashboard.subtitle}
        actions={
          <figure className="text-sm text-muted-foreground sm:text-right">
            <blockquote className="italic">“Kiçik addımlar, böyük nəticələr.”</blockquote>
            <figcaption className="mt-0.5 text-xs">— Baku Digital Lab</figcaption>
          </figure>
        }
      />

      {isAdmin && adminStats ? (
        <AdminDashboard stats={adminStats} />
      ) : userStats ? (
        <UserDashboard stats={userStats} meId={user?.id} />
      ) : null}
    </div>
  );
}

// ---------- Admin (maddə 70) ----------
function AdminDashboard({ stats }: { stats: AdminStats }) {
  const failed = stats.attempts - stats.passed;
  const passRate = stats.attempts ? Math.round((stats.passed / stats.attempts) * 100) : 0;
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={BookOpen}
          label={t.dashboard.courses}
          value={`${stats.publishedCourses}/${stats.courses}`}
        />
        <StatCard icon={ClipboardList} label={t.dashboard.exams} value={stats.exams} />
        <StatCard icon={FileQuestion} label={t.dashboard.quizzes} value={stats.quizzes} />
        <StatCard icon={Users} label={t.dashboard.totalUsers} value={stats.users} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-4">
        <StatCard icon={TrendingUp} label={t.dashboard.attempts} value={stats.attempts} />
        <StatCard
          icon={CheckCircle2}
          label={t.reports.passed}
          value={stats.passed}
          tone="success"
        />
        <StatCard icon={BarChart3} label={t.dashboard.avgScore} value={`${stats.avgScore}%`} />
        <StatCard icon={Trophy} label={t.dashboard.certificates} value={stats.certificates} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <AreaChartCard
          className="lg:col-span-2"
          title="Aylıq cəhdlər"
          description="Son 6 ay"
          data={stats.monthly}
          valueLabel={t.dashboard.attempts}
        />
        <section className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-4 font-display text-base font-semibold">{t.dashboard.passRate}</h2>
          <DonutChart
            ariaLabel={`${t.dashboard.passRate}: ${passRate}%`}
            centerValue={`${passRate}%`}
            centerLabel={t.reports.passed}
            size={170}
            data={[
              { key: "passed", label: t.reports.passed, value: stats.passed, color: "success" },
              { key: "failed", label: "Keçmədi", value: failed, color: "error" },
            ]}
          />
        </section>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <BarChartCard
          title={t.dashboard.topCourses}
          icon={<BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />}
          data={stats.topCourses.map((c) => ({ label: c.title, value: c.views }))}
          valueLabel="Baxış"
        />
        <BarChartCard
          title={t.dashboard.topUsers}
          icon={<Users className="h-4 w-4 text-primary" aria-hidden="true" />}
          data={stats.topUsers.map((u) => ({ label: u.full_name, value: u.attempts }))}
          valueLabel={t.dashboard.attempts}
        />
      </div>

      <MotivationStrip
        className="mt-5"
        image={summit}
        title={MOTIVATION_TITLE}
        text={MOTIVATION_TEXT}
      />
    </>
  );
}

// ---------- İstifadəçi (maddə 62, 65–69) ----------
function UserDashboard({ stats, meId }: { stats: UserStats; meId?: string }) {
  const [period, setPeriod] = useState<LeaderboardPeriod>("month");
  const { top, me } = useMemo(() => {
    const ranked: LeaderRow[] = leaderboard(stats.xpEvents, period).map((r, i) => ({
      id: r.user_id,
      name: stats.people[r.user_id]?.name ?? "—",
      avatar: stats.people[r.user_id]?.avatar ?? null,
      xp: r.xp,
      rank: i + 1,
    }));
    return { top: ranked.slice(0, 5), me: ranked.find((r) => r.id === meId) ?? null };
  }, [stats.xpEvents, stats.people, period, meId]);

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <ContinueCard data={stats.continueCourse} className="lg:col-span-2" />

      {/* Maddə 65: üç mini göstərici */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:grid-cols-1 [&_article]:max-sm:p-3">
        <StatCard icon={Award} label={t.dashboard.certificates} value={stats.certificates} />
        <StatCard
          icon={FileCheck2}
          label="Keçilən imtahanlar"
          value={stats.passed}
          tone="success"
        />
        <StatCard
          icon={BarChart3}
          label={t.dashboard.avgScore}
          value={stats.avgScore === null ? "—" : `${stats.avgScore}%`}
        />
      </div>

      <UpcomingExamCard exam={stats.exam} />
      <MotivationStrip
        className="min-h-36 lg:col-span-2"
        image={summit}
        title={MOTIVATION_TITLE}
        text={MOTIVATION_TEXT}
      />

      <section
        className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-card lg:col-span-2"
        aria-labelledby="popular-title"
      >
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 id="popular-title" className="font-display text-base font-semibold">
            {t.dashboard.popularCourses}
          </h2>
          <Link
            to="/courses"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-[var(--primary-hover)]"
          >
            Hamısına bax <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </header>
        {stats.popular.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.dashboard.noPopularCourses}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {stats.popular.map((c, i) => (
              <CourseCard
                key={c.id}
                id={c.id}
                title={c.title}
                cover={c.cover_image_url}
                teacher={c.teacher}
                rating={stats.ratings[c.id]}
                lessons={stats.lessons[c.id] ?? 0}
                popular={i === 0 && c.viewers > 0}
              />
            ))}
          </div>
        )}
      </section>

      <LeaderboardCard rows={top} me={me} meId={meId} period={period} onPeriodChange={setPeriod} />

      <RecentList courses={stats.recent} className="lg:col-span-3" />
    </div>
  );
}

function ContinueCard({ data, className }: { data: ContinueCourse | null; className?: string }) {
  return (
    <section
      className={`flex min-w-0 flex-col rounded-xl border border-border bg-card p-5 shadow-card ${className ?? ""}`}
      aria-labelledby="continue-title"
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 id="continue-title" className="font-display text-base font-semibold">
          Öyrənməyə davam et
        </h2>
        <Button asChild variant="ghost" size="sm">
          <Link to="/courses">
            Kurslar <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </header>
      {data ? (
        <div className="flex flex-col gap-5 sm:flex-row">
          <Link
            to="/courses/$courseId"
            params={{ courseId: data.course.id }}
            className="block aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-muted sm:w-52"
            tabIndex={-1}
            aria-hidden="true"
          >
            {data.course.cover_image_url ? (
              <img
                src={data.course.cover_image_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full items-center justify-center text-primary">
                <BookOpen className="h-10 w-10" />
              </span>
            )}
          </Link>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-display text-lg font-semibold leading-snug break-words">
                  <Link
                    to="/courses/$courseId"
                    params={{ courseId: data.course.id }}
                    className="hover:text-primary"
                  >
                    {data.course.title}
                  </Link>
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {data.course.teacher}
                  {data.course.teacher && data.total > 0 && " · "}
                  {data.total > 0 && `${data.total} dərs`}
                </p>
              </div>
              <RingProgress value={data.percent} size={72} stroke={7} label="Kurs proqresi" />
            </div>
            <Progress value={data.percent} className="mt-4" aria-label="Tamamlanan dərslər" />
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
              {data.completed} / {data.total} dərs tamamlanıb
            </p>
            <Button asChild className="mt-4 w-full sm:w-auto sm:self-start">
              <Link to="/courses/$courseId/play" params={{ courseId: data.course.id }}>
                <Play className="h-4 w-4" aria-hidden="true" /> Kursa davam et
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg bg-muted/60 px-4 py-8 text-center">
          <IconChip icon={BookOpen} />
          <p className="text-sm text-muted-foreground">{t.dashboard.noRecent}</p>
          <Button asChild variant="outline">
            <Link to="/courses">{t.nav.courses}</Link>
          </Button>
        </div>
      )}
    </section>
  );
}

function UpcomingExamCard({ exam }: { exam: UpcomingExam | null }) {
  const start = exam ? new Date(exam.starts_at) : null;
  const end = exam ? new Date(exam.ends_at) : null;
  const subtitle =
    exam?.exam?.title && exam.exam.title !== exam.title ? exam.exam.title : "Müstəqil imtahan";
  return (
    <section
      className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-card"
      aria-labelledby="exam-title"
    >
      <header className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 id="exam-title" className="whitespace-nowrap font-display text-base font-semibold">
          Yaxınlaşan imtahan
        </h2>
        <Link
          to="/calendar"
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-primary hover:text-[var(--primary-hover)]"
        >
          Hamısına bax <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </header>
      {exam && start && end ? (
        <Link
          to="/calendar"
          className="group flex items-center gap-4 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-200">
            <span className="font-display text-2xl font-semibold leading-none tabular-nums">
              {start.getDate()}
            </span>
            <span className="mt-1 text-xs font-medium">{monthShort(start)}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold group-hover:text-primary">
              {exam.title}
            </span>
            <span className="block truncate text-sm text-muted-foreground">{subtitle}</span>
            <span className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-secondary-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {format(start, "HH:mm")} – {format(end, "HH:mm")}
              </span>
              {exam.location && (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{exam.location}</span>
                </span>
              )}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
      ) : (
        <p className="py-4 text-sm text-muted-foreground">Yaxın imtahan yoxdur.</p>
      )}
    </section>
  );
}

function RecentList({ courses, className }: { courses: DashboardCourse[]; className?: string }) {
  return (
    <section
      className={`min-w-0 rounded-xl border border-border bg-card p-5 shadow-card ${className ?? ""}`}
      aria-labelledby="recent-title"
    >
      <h2
        id="recent-title"
        className="mb-3 flex items-center gap-2 font-display text-base font-semibold"
      >
        <Clock className="h-4 w-4 text-primary" aria-hidden="true" /> {t.dashboard.recentlyViewed}
      </h2>
      {courses.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.dashboard.noRecent}</p>
      ) : (
        <ul className="divide-y divide-border">
          {courses.map((course) => (
            <li key={course.id}>
              <Link
                to="/courses/$courseId"
                params={{ courseId: course.id }}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md px-2 py-3 hover:bg-muted"
              >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <BookOpen className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-medium">{course.title}</span>
                    {course.teacher && (
                      <span className="block break-words text-xs text-muted-foreground">
                        Müəllim: {course.teacher}
                      </span>
                    )}
                  </span>
                </span>
                {course.viewed_at && (
                  <span className="text-xs text-muted-foreground">
                    {t.dashboard.lastViewed}:{" "}
                    {new Date(course.viewed_at).toLocaleDateString("az-AZ")}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
