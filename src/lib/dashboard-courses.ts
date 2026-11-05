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
  return [...allowed]
    .sort(
      (a, b) =>
        b.viewers - a.viewers || a.title.localeCompare(b.title, "az") || a.id.localeCompare(b.id),
    )
    .slice(0, 5);
}

export function recentAllowedCourses(
  views: { course_id: string; viewed_at: string }[],
  allowed: DashboardCourse[],
) {
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

// ---------- Ana səhifə köməkçiləri (Mərhələ 2) ----------

/** Pleyerdə göstərilən dərslər: müstəqil "quiz" blokları sayılmır. */
export function countLessons(blocks: { course_id: string; block_type: string }[]) {
  const map = new Map<string, number>();
  for (const b of blocks) {
    if (b.block_type === "quiz") continue;
    map.set(b.course_id, (map.get(b.course_id) ?? 0) + 1);
  }
  return map;
}

/** Tamamlanan dərs sayı və faiz. Yalnız pleyerdə görünən bloklar sayılır. */
export function lessonProgress(
  blocks: { id: string; block_type: string }[],
  completedBlockIds: Iterable<string>,
) {
  const lessons = blocks.filter((b) => b.block_type !== "quiz");
  const done = new Set(completedBlockIds);
  const completed = lessons.filter((b) => done.has(b.id)).length;
  const total = lessons.length;
  return { completed, total, percent: total ? Math.round((completed / total) * 100) : 0 };
}

export interface RatingSummary {
  average: number;
  count: number;
}

/** Kurs üzrə orta reytinq (1 onluq dəqiqliklə) və rəy sayı. */
export function ratingsByCourse(reviews: { course_id: string; rating: number }[]) {
  const sums = new Map<string, { sum: number; count: number }>();
  for (const r of reviews) {
    const s = sums.get(r.course_id) ?? { sum: 0, count: 0 };
    s.sum += Number(r.rating);
    s.count += 1;
    sums.set(r.course_id, s);
  }
  const out = new Map<string, RatingSummary>();
  sums.forEach((s, id) =>
    out.set(id, { average: Math.round((s.sum / s.count) * 10) / 10, count: s.count }),
  );
  return out;
}

export type LeaderboardPeriod = "week" | "month" | "all";

/** XP cədvəli: Çempionlar səhifəsi ilə eyni hesablama (həftə = 7 gün, ay = 30 gün). */
export function leaderboard(
  events: { user_id: string; xp: number; created_at: string }[],
  period: LeaderboardPeriod,
  now: Date = new Date(),
) {
  const cutoff =
    period === "week"
      ? now.getTime() - 7 * 864e5
      : period === "month"
        ? now.getTime() - 30 * 864e5
        : null;
  const map = new Map<string, number>();
  for (const e of events) {
    if (cutoff !== null && new Date(e.created_at).getTime() < cutoff) continue;
    map.set(e.user_id, (map.get(e.user_id) ?? 0) + e.xp);
  }
  return [...map.entries()]
    .map(([user_id, xp]) => ({ user_id, xp }))
    .sort((a, b) => b.xp - a.xp || a.user_id.localeCompare(b.user_id));
}

const AZ_MONTHS = [
  "Yan",
  "Fev",
  "Mar",
  "Apr",
  "May",
  "İyn",
  "İyl",
  "Avq",
  "Sen",
  "Okt",
  "Noy",
  "Dek",
];

/** Son `months` ay üzrə say (cari ay daxil), köhnədən yeniyə. */
export function monthlyCounts(dates: string[], months = 6, now: Date = new Date()) {
  const buckets: { key: string; label: string; value: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: AZ_MONTHS[d.getMonth()],
      value: 0,
    });
  }
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  for (const s of dates) {
    const d = new Date(s);
    const i = index.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (i !== undefined) buckets[i].value += 1;
  }
  return buckets.map(({ label, value }) => ({ label, value }));
}

export function monthShort(date: Date) {
  return AZ_MONTHS[date.getMonth()];
}
