import { describe, expect, it } from "vitest";
import {
  DEFAULT_COURSE_VIEW,
  countLessons,
  leaderboard,
  lessonProgress,
  monthlyCounts,
  popularCourses,
  ratingsByCourse,
  recentAllowedCourses,
  type DashboardCourse,
} from "./dashboard-courses";

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
    expect(
      recentAllowedCourses(
        [
          { course_id: "restricted", viewed_at: "2026-10-26" },
          { course_id: "a", viewed_at: "2026-10-25" },
        ],
        allowed,
      ).map((c) => c.id),
    ).toEqual(["a"]);
  });
});
describe("lessonProgress", () => {
  it("quiz bloklarını saymır", () => {
    const blocks = [
      { id: "a", block_type: "video" },
      { id: "b", block_type: "quiz" },
      { id: "c", block_type: "final_exam" },
    ];
    expect(lessonProgress(blocks, ["a", "b"])).toEqual({ completed: 1, total: 2, percent: 50 });
  });
  it("boş kursda 0 qaytarır", () => {
    expect(lessonProgress([], [])).toEqual({ completed: 0, total: 0, percent: 0 });
  });
});

describe("countLessons", () => {
  it("kurs üzrə quiz-siz sayır", () => {
    const m = countLessons([
      { course_id: "x", block_type: "video" },
      { course_id: "x", block_type: "quiz" },
      { course_id: "y", block_type: "pdf" },
    ]);
    expect(m.get("x")).toBe(1);
    expect(m.get("y")).toBe(1);
  });
});

describe("ratingsByCourse", () => {
  it("orta və sayı hesablayır", () => {
    const m = ratingsByCourse([
      { course_id: "x", rating: 5 },
      { course_id: "x", rating: 4 },
      { course_id: "x", rating: 4 },
    ]);
    expect(m.get("x")).toEqual({ average: 4.3, count: 3 });
  });
});

describe("leaderboard", () => {
  const now = new Date("2026-11-05T12:00:00Z");
  const events = [
    { user_id: "a", xp: 10, created_at: "2026-11-04T00:00:00Z" },
    { user_id: "b", xp: 50, created_at: "2026-10-20T00:00:00Z" },
    { user_id: "a", xp: 5, created_at: "2026-01-01T00:00:00Z" },
  ];
  it("həftə üzrə süzür", () => {
    expect(leaderboard(events, "week", now)).toEqual([{ user_id: "a", xp: 10 }]);
  });
  it("ay üzrə sıralayır", () => {
    expect(leaderboard(events, "month", now)).toEqual([
      { user_id: "b", xp: 50 },
      { user_id: "a", xp: 10 },
    ]);
  });
  it("ümumi cəmləyir", () => {
    expect(leaderboard(events, "all", now)[1]).toEqual({ user_id: "a", xp: 15 });
  });
});

describe("monthlyCounts", () => {
  it("son 6 ayı sayır", () => {
    const now = new Date(2026, 10, 5);
    const out = monthlyCounts(
      [
        new Date(2026, 10, 1).toISOString(),
        new Date(2026, 5, 3).toISOString(),
        new Date(2026, 4, 30).toISOString(),
      ],
      6,
      now,
    );
    expect(out.map((b) => b.label)).toEqual(["İyn", "İyl", "Avq", "Sen", "Okt", "Noy"]);
    expect(out[0].value).toBe(1);
    expect(out[5].value).toBe(1);
  });
});
