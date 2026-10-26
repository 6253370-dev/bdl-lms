export type CourseView = "list" | "cards";
export const DEFAULT_COURSE_VIEW: CourseView = "cards";

export interface DashboardCourse {
  id: string;
  title: string;
  cover_image_url: string | null;
  teacher: string;
  viewers: number;
  viewed_at?: string;
}

// The allowed list comes from the caller-scoped database function.
export function popularCourses(allowed: DashboardCourse[]) {
  return [...allowed].sort((a, b) => b.viewers - a.viewers || a.title.localeCompare(b.title, "az") || a.id.localeCompare(b.id)).slice(0, 5);
}

export function recentAllowedCourses(views: { course_id: string; viewed_at: string }[], allowed: DashboardCourse[]) {
  const byId = new Map(allowed.map((course) => [course.id, course]));
  const seen = new Set<string>();
  const recent: DashboardCourse[] = [];
  for (const view of views) {
    const course = byId.get(view.course_id);
    if (!course || seen.has(course.id)) continue;
    seen.add(course.id);
    recent.push({ ...course, viewed_at: view.viewed_at });
    if (recent.length === 5) break;
  }
  return recent;
}