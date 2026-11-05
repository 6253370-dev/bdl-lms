import { describe, expect, it } from "vitest";
import {
  courseStatus,
  matchesStatusTab,
  similarCourses,
  sortCourses,
  uniqueViewers,
} from "./courses-catalog";

describe("courseStatus", () => {
  it("sertifikat varsa tamamlanıb sayılır", () => {
    expect(courseStatus(10, true)).toBe("completed");
  });
  it("100% tamamlanıb, 0-dan çox davam edir, 0 başlanmayıb", () => {
    expect(courseStatus(100, false)).toBe("completed");
    expect(courseStatus(40, false)).toBe("in_progress");
    expect(courseStatus(0, false)).toBe("not_started");
    expect(courseStatus(undefined, false)).toBe("not_started");
  });
  it("tab süzgəci", () => {
    expect(matchesStatusTab("all", 0, false)).toBe(true);
    expect(matchesStatusTab("in_progress", 0, false)).toBe(false);
    expect(matchesStatusTab("completed", 50, true)).toBe(true);
  });
});

describe("uniqueViewers", () => {
  it("eyni istifadəçini bir dəfə sayır", () => {
    expect(
      uniqueViewers([
        { course_id: "a", user_id: "u1" },
        { course_id: "a", user_id: "u1" },
        { course_id: "a", user_id: "u2" },
        { course_id: "b", user_id: "u1" },
      ]),
    ).toEqual({ a: 2, b: 1 });
  });
});

describe("sortCourses", () => {
  const list = [{ id: "new" }, { id: "mid" }, { id: "old" }];
  it("ən yeni sıranı dəyişmir", () => {
    expect(sortCourses(list, "newest", {}, {})).toBe(list);
  });
  it("populyarlığa görə, bərabərlikdə ilkin sıra", () => {
    expect(sortCourses(list, "popular", { old: 5, mid: 5 }, {}).map((c) => c.id)).toEqual([
      "mid",
      "old",
      "new",
    ]);
  });
  it("reytinqə görə, reytinqsizlər sonda", () => {
    const r = { old: { avg: 4.5, count: 2 }, mid: { avg: 4.5, count: 9 } };
    expect(sortCourses(list, "rating", {}, r).map((c) => c.id)).toEqual(["mid", "old", "new"]);
  });
});

describe("similarCourses", () => {
  const mk = (id: string, viewers: number) => ({
    id,
    title: id,
    cover_image_url: null,
    teacher: "",
    viewers,
  });
  const allowed = [mk("cur", 99), mk("a", 1), mk("b", 50), mk("c", 10), mk("d", 30)];
  it("cari kursu çıxarır, eyni qovluğu öndə saxlayır, populyarla tamamlayır", () => {
    expect(similarCourses("cur", allowed, new Set(["a", "c"])).map((c) => c.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });
  it("icazəli siyahıda olmayan kurs gəlmir", () => {
    expect(similarCourses("cur", [mk("cur", 1)], new Set(["x"]))).toEqual([]);
  });
});
