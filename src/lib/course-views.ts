import { supabase } from "@/integrations/supabase/client";

// One row per user/course keeps popularity unique while refreshing personal recency.
export async function recordCourseView(userId: string, courseId: string) {
  try {
    const { error } = await supabase.from("course_views").upsert(
      { user_id: userId, course_id: courseId, viewed_at: new Date().toISOString() },
      { onConflict: "user_id,course_id" },
    );
    if (error) console.error("Unable to record course view", error.message);
  } catch {
    console.error("Unable to record course view");
  }
}