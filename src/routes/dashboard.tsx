import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen, ClipboardList, Trophy, Users, FileQuestion, TrendingUp,
  CheckCircle2, BarChart3, Clock, Loader2, LayoutGrid, List,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/i18n";
import { DEFAULT_COURSE_VIEW, popularCourses, recentAllowedCourses, type CourseView, type DashboardCourse } from "@/lib/dashboard-courses";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [
    { title: "Ana səhifə | Baku Digital Lab" },
    { name: "description", content: "Şəxsi təlim nəticələri, son baxılan və ən populyar icazəli kurslar." },
    { property: "og:title", content: "Ana səhifə | Baku Digital Lab" },
    { property: "og:description", content: "Təlim nəticələriniz və sizin üçün əlçatan kurslar." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
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
  topCourses: { id: string; title: string; views: number }[];
  topUsers: { id: string; full_name: string; attempts: number }[];
}

interface UserStats {
  certificates: number;
  attempts: number;
  passed: number;
  recent: DashboardCourse[];
  popular: DashboardCourse[];
}

const RECENT_VIEW_KEY = "bdl-dashboard-recent-view-v2";
const POPULAR_VIEW_KEY = "bdl-dashboard-popular-view";

function Dashboard() {
  const { profile, isAdmin, user } = useAuth();
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentView, setRecentView] = useState<CourseView>(DEFAULT_COURSE_VIEW);
  const [popularView, setPopularView] = useState<CourseView>(DEFAULT_COURSE_VIEW);

  useEffect(() => {
    try {
      const recent = window.localStorage.getItem(RECENT_VIEW_KEY);
      const popular = window.localStorage.getItem(POPULAR_VIEW_KEY);
      if (recent === "list" || recent === "cards") setRecentView(recent);
      if (popular === "list" || popular === "cards") setPopularView(popular);
    } catch { /* Storage may be unavailable. */ }
  }, []);

  const changeView = (key: string, v: CourseView, setter: (view: CourseView) => void) => {
    setter(v);
    try { window.localStorage.setItem(key, v); } catch { /* skip */ }
  };

  useEffect(() => {
    (async () => {
      if (isAdmin) {
        const [
          { count: courses }, { count: publishedCourses },
          { count: exams }, { count: quizzes }, { count: users },
          { count: certificates },
          { data: attempts },
          { data: views },
          { data: profiles },
        ] = await Promise.all([
          supabase.from("courses").select("*", { count: "exact", head: true }),
          supabase.from("courses").select("*", { count: "exact", head: true }).eq("is_published", true),
          supabase.from("standalone_exams").select("*", { count: "exact", head: true }),
          supabase.from("quizzes").select("*", { count: "exact", head: true }),
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase.from("certificates").select("*", { count: "exact", head: true }),
          supabase.from("block_attempts").select("user_id,course_id,score_percent,passed"),
          supabase.from("course_views").select("course_id"),
          supabase.from("profiles").select("id,full_name"),
        ]);
        const all = attempts ?? [];
        const total = all.length;
        const passed = all.filter((a) => a.passed).length;
        const avg = total ? Math.round(all.reduce((s, a) => s + Number(a.score_percent), 0) / total) : 0;

        // Top courses by views
        const viewMap = new Map<string, number>();
        (views ?? []).forEach((v: any) => viewMap.set(v.course_id, (viewMap.get(v.course_id) ?? 0) + 1));
        const topCourseIds = [...viewMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
        const { data: topCourseRows } = topCourseIds.length
          ? await supabase.from("courses").select("id,title").in("id", topCourseIds.map(([id]) => id))
          : { data: [] as any[] };
        const topCourses = topCourseIds.map(([id, count]) => ({
          id, title: topCourseRows?.find((c: any) => c.id === id)?.title ?? "—", views: count,
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
          courses: courses ?? 0, publishedCourses: publishedCourses ?? 0,
          exams: exams ?? 0, quizzes: quizzes ?? 0, users: users ?? 0,
          certificates: certificates ?? 0, attempts: total, passed, avgScore: avg,
          topCourses, topUsers,
        });
      } else if (user?.id) {
        const [
          { count: certificates },
          { data: attempts },
          { data: views },
          allowedResult,
        ] = await Promise.all([
          supabase.from("certificates").select("*", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("block_attempts").select("score_percent,passed").eq("user_id", user.id),
          supabase.from("course_views").select("course_id,viewed_at").eq("user_id", user.id).order("viewed_at", { ascending: false }),
          supabase.rpc("dashboard_allowed_courses"),
        ]);
        const total = attempts?.length ?? 0;
        const passed = (attempts ?? []).filter((a) => a.passed).length;
        if (allowedResult.error) console.error("Unable to load allowed dashboard courses", allowedResult.error.message);
        const allowed: DashboardCourse[] = (allowedResult.data ?? []).map((c) => ({ ...c, viewers: Number(c.viewers) }));
        const recent = recentAllowedCourses(views ?? [], allowed);
        setUserStats({ certificates: certificates ?? 0, attempts: total, passed, recent, popular: popularCourses(allowed) });
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
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">{t.dashboard.title}, {profile?.full_name?.split(" ")[0]}</h1>
        <p className="text-muted-foreground mt-1">{t.dashboard.subtitle}</p>
      </div>

      {isAdmin && adminStats ? (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={BookOpen} label={t.dashboard.courses} value={`${adminStats.publishedCourses}/${adminStats.courses}`} tone="primary" />
            <StatCard icon={ClipboardList} label={t.dashboard.exams} value={adminStats.exams} tone="accent" />
            <StatCard icon={FileQuestion} label={t.dashboard.quizzes} value={adminStats.quizzes} tone="primary" />
            <StatCard icon={Users} label={t.dashboard.totalUsers} value={adminStats.users} tone="success" />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <StatCard icon={TrendingUp} label={t.dashboard.attempts} value={adminStats.attempts} tone="primary" />
            <StatCard icon={CheckCircle2} label={t.reports.passed} value={adminStats.passed} tone="success" />
            <StatCard icon={BarChart3} label={t.dashboard.avgScore} value={`${adminStats.avgScore}%`} tone="accent" />
            <StatCard icon={Trophy} label={t.dashboard.certificates} value={adminStats.certificates} tone="success" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4 mt-6">
            <Card className="p-5">
              <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" /> {t.dashboard.topCourses}
              </h3>
              {adminStats.topCourses.length === 0 ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                <ul className="space-y-2">
                  {adminStats.topCourses.map((c, i) => (
                    <li key={c.id} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Badge variant="secondary" className="h-5 w-5 p-0 justify-center">{i + 1}</Badge>
                        {c.title}
                      </span>
                      <span className="text-muted-foreground">{c.views}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="p-5">
              <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> {t.dashboard.topUsers}
              </h3>
              {adminStats.topUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                <ul className="space-y-2">
                  {adminStats.topUsers.map((u, i) => (
                    <li key={u.id} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Badge variant="secondary" className="h-5 w-5 p-0 justify-center">{i + 1}</Badge>
                        {u.full_name}
                      </span>
                      <span className="text-muted-foreground">{u.attempts}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      ) : userStats ? (
        <>
          <div className="grid sm:grid-cols-3 gap-4">
            <StatCard icon={TrendingUp} label={t.dashboard.attempts} value={userStats.attempts} tone="primary" />
            <StatCard icon={CheckCircle2} label={t.reports.passed} value={userStats.passed} tone="success" />
            <StatCard icon={Trophy} label={t.dashboard.certificates} value={userStats.certificates} tone="accent" />
          </div>

          <CourseSection
            title={t.dashboard.recentlyViewed} icon={Clock} courses={userStats.recent}
            view={recentView} onViewChange={(v) => changeView(RECENT_VIEW_KEY, v, setRecentView)}
            emptyText={t.dashboard.noRecent} recent
          />
          <CourseSection
            title={t.dashboard.popularCourses} icon={TrendingUp} courses={userStats.popular}
            view={popularView} onViewChange={(v) => changeView(POPULAR_VIEW_KEY, v, setPopularView)}
            emptyText={t.dashboard.noPopularCourses}
          />
        </>
      ) : null}
    </div>
  );
}

function CourseSection({ title, icon: Icon, courses, view, onViewChange, emptyText, recent = false }: {
  title: string; icon: typeof BookOpen; courses: DashboardCourse[]; view: CourseView;
  onViewChange: (view: CourseView) => void; emptyText: string; recent?: boolean;
}) {
  const metadata = (course: DashboardCourse) => recent && course.viewed_at
    ? `${t.dashboard.lastViewed}: ${new Date(course.viewed_at).toLocaleDateString("az-AZ")}`
    : `${course.viewers} ${t.dashboard.courseViewers}`;
  return (
    <section className="mt-8" aria-label={title}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </h3>
        {courses.length > 0 && (
          <Tabs value={view} onValueChange={(v) => { if (v === "list" || v === "cards") onViewChange(v); }}>
            <TabsList aria-label={`${title} görünüşü`}>
              <TabsTrigger value="list"><List className="h-4 w-4 mr-2" />{t.dashboard.viewList}</TabsTrigger>
              <TabsTrigger value="cards"><LayoutGrid className="h-4 w-4 mr-2" />{t.dashboard.viewCards}</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>
      {courses.length === 0 ? <p className="text-sm text-muted-foreground">{emptyText}</p> : view === "list" ? (
        <ul className="divide-y divide-border">
          {courses.map((course) => (
            <li key={course.id}>
              <Link to="/courses/$courseId" params={{ courseId: course.id }} className="flex flex-wrap items-center justify-between gap-3 py-3 px-2 rounded-md hover:bg-muted">
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <BookOpen className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-medium">{course.title}</span>
                    {course.teacher && <span className="block break-words text-xs text-muted-foreground">Müəllim: {course.teacher}</span>}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">{metadata(course)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-4">
          {courses.map((course) => (
            <article key={course.id} className="group relative flex min-w-0 flex-col rounded-lg border border-border bg-card p-3 text-card-foreground transition-shadow hover:shadow-[var(--shadow-card)] focus-within:ring-2 focus-within:ring-ring">
              <div className="relative mb-3 aspect-video overflow-hidden rounded-md bg-muted">
                {course.cover_image_url ? <img src={course.cover_image_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-105" /> : (
                  <div className="flex h-full items-center justify-center text-muted-foreground"><BookOpen className="h-8 w-8" /></div>
                )}
              </div>
              <h4 className="font-display text-sm font-semibold leading-snug break-words">
                <Link to="/courses/$courseId" params={{ courseId: course.id }} className="after:absolute after:inset-0 after:z-10 after:rounded-lg hover:text-primary focus:outline-none">{course.title}</Link>
              </h4>
              {course.teacher && <p className="mt-1 break-words text-xs text-muted-foreground">Müəllim: {course.teacher}</p>}
              <p className="mt-auto pt-2 text-xs text-muted-foreground">{metadata(course)}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function StatCard({
  icon: Icon, label, value, tone,
}: { icon: typeof BookOpen; label: string; value: number | string; tone: "primary" | "accent" | "success" }) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/15 text-accent-foreground",
    success: "bg-success/10 text-success",
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
