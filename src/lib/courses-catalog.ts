// Kurslar kataloqu üçün köməkçilər (Mərhələ 2, maddə 71, 73).

export type CourseStatusTab = "all" | "in_progress" | "completed";
export type CourseSort = "popular" | "newest" | "rating";

/** Kursun istifadəçi üçün vəziyyəti: sertifikat və ya 100% → tamamlanıb, 0-dan çox → davam edir. */
export function courseStatus(progress: number | undefined, hasCertificate: boolean) {
  if (hasCertificate || (progress ?? 0) >= 100) return "completed" as const;
  if ((progress ?? 0) > 0) return "in_progress" as const;
  return "not_started" as const;
}

export function matchesStatusTab(
  tab: CourseStatusTab,
  progress: number | undefined,
  hasCertificate: boolean,
) {
  if (tab === "all") return true;
  return courseStatus(progress, hasCertificate) === tab;
}

/** Hər kurs üzrə unikal baxan sayı (admin üçün `course_views` sətirlərindən). */
export function uniqueViewers(rows: { course_id: string; user_id: string }[]) {
  const sets = new Map<string, Set<string>>();
  for (const r of rows) {
    const s = sets.get(r.course_id) ?? new Set<string>();
    s.add(r.user_id);
    sets.set(r.course_id, s);
  }
  const out: Record<string, number> = {};
  sets.forEach((s, id) => (out[id] = s.size));
  return out;
}

/**
 * Sıralama. Giriş siyahısı artıq "ən yeni" sırasındadır (created_at desc), ona görə
 * bərabərlikdə ilkin sıra saxlanılır (stabil sort).
 */
export function sortCourses<T extends { id: string }>(
  list: T[],
  sort: CourseSort,
  viewers: Record<string, number>,
  ratings: Record<string, { avg: number; count: number }>,
) {
  if (sort === "newest") return list;
  const copy = [...list];
  if (sort === "popular") {
    copy.sort((a, b) => (viewers[b.id] ?? 0) - (viewers[a.id] ?? 0));
  } else {
    copy.sort((a, b) => {
      const ra = ratings[a.id];
      const rb = ratings[b.id];
      if (!ra && !rb) return 0;
      if (!ra) return 1;
      if (!rb) return -1;
      return rb.avg - ra.avg || rb.count - ra.count;
    });
  }
  return copy;
}

export interface SimilarCandidate {
  id: string;
  title: string;
  cover_image_url: string | null;
  teacher: string;
  viewers: number;
}

/**
 * Oxşar kurslar (maddə 79): əvvəlcə eyni qovluqdan, sonra ən populyar kurslarla
 * `limit`-ə qədər tamamlanır. `allowed` istifadəçinin baxa bildiyi kurslardır.
 */
export function similarCourses(
  currentId: string,
  allowed: SimilarCandidate[],
  sameFolderIds: Set<string>,
  limit = 3,
) {
  const others = allowed.filter((c) => c.id !== currentId);
  const byViewers = [...others].sort((a, b) => b.viewers - a.viewers);
  const same = byViewers.filter((c) => sameFolderIds.has(c.id));
  const rest = byViewers.filter((c) => !sameFolderIds.has(c.id));
  return [...same, ...rest].slice(0, limit);
}
