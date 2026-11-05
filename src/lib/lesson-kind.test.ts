import { describe, expect, it } from "vitest";
import { formatMinutes, lessonKind } from "./lesson-kind";

describe("lessonKind", () => {
  it("qiymətləndirmə blokları öz növünü qaytarır", () => {
    expect(lessonKind({ block_type: "final_exam", video_url: "x" })).toBe("final_exam");
    expect(lessonKind({ block_type: "practice" })).toBe("practice");
  });
  it("dərsdə əsas material sırası: video, xarici video, PDF, PPTX, DOCX", () => {
    expect(lessonKind({ block_type: "lesson", pdf_url: "a", video_url: "b" })).toBe("video");
    expect(lessonKind({ block_type: "lesson", pdf_url: "a", external_video_url: "b" })).toBe(
      "external",
    );
    expect(lessonKind({ block_type: "lesson", docx_url: "a", pptx_url: "b" })).toBe("pptx");
    expect(lessonKind({ block_type: "lesson" })).toBe("lesson");
  });
});

describe("formatMinutes", () => {
  it("boş və ya 0 üçün null", () => {
    expect(formatMinutes(null)).toBeNull();
    expect(formatMinutes(0)).toBeNull();
  });
  it("yuxarı yuvarlaqlaşdırır, ən az 1 dəq", () => {
    expect(formatMinutes(20)).toBe("1 dəq");
    expect(formatMinutes(600)).toBe("10 dəq");
    expect(formatMinutes(601)).toBe("11 dəq");
  });
});
