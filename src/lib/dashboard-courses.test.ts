import { describe, expect, it } from "vitest";
import { DEFAULT_COURSE_VIEW, popularCourses, recentAllowedCourses, type DashboardCourse } from "./dashboard-courses";

const allowed: DashboardCourse[] = [
  { id: "a", title: "A", teacher: "Teacher", cover_image_url: null, viewers: 2 },
  { id: "b", title: "B", teacher: "Teacher", cover_image_url: null, viewers: 8 },
];

describe("dashboard course rules", () => {
  it("defaults to cards", () => {
    expect(DEFAULT_COURSE_VIEW).toBe("cards");
  });
  it("ranks only the allowed courses by unique viewers", () => {
    expect(popularCourses(allowed).map((c) => c.id)).toEqual(["b", "a"]);
  });
  it("does not restore a recently viewed course after access was removed", () => {
    expect(recentAllowedCourses([
      { course_id: "restricted", viewed_at: "2026-10-26" },
      { course_id: "a", viewed_at: "2026-10-25" },
    ], allowed).map((c) => c.id)).toEqual(["a"]);
  });
});