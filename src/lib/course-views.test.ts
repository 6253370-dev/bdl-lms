import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, upsert } = vi.hoisted(() => ({ from: vi.fn(), upsert: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
import { recordCourseView } from "./course-views";

describe("personal course viewing history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    from.mockReturnValue({ upsert });
    upsert.mockResolvedValue({ error: null });
  });

  it("records only the current user's course", async () => {
    await recordCourseView("current-user", "opened-course");
    expect(from).toHaveBeenCalledWith("course_views");
    expect(upsert).toHaveBeenCalledWith(
      { user_id: "current-user", course_id: "opened-course", viewed_at: expect.any(String) },
      { onConflict: "user_id,course_id" },
    );
  });

  it("refreshes the timestamp on repeat visits without creating duplicate viewers", async () => {
    const clock = vi.spyOn(Date.prototype, "toISOString");
    clock.mockReturnValueOnce("2026-10-26T08:07:00.000Z").mockReturnValueOnce("2026-10-26T08:10:00.000Z");
    await recordCourseView("current-user", "opened-course");
    await recordCourseView("current-user", "opened-course");
    expect(upsert.mock.calls.map(([row]) => row.viewed_at)).toEqual([
      "2026-10-26T08:07:00.000Z", "2026-10-26T08:10:00.000Z",
    ]);
    expect(upsert.mock.calls.map(([, options]) => options.onConflict)).toEqual([
      "user_id,course_id", "user_id,course_id",
    ]);
    clock.mockRestore();
  });
});