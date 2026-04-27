import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Folder, BookOpen } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { t } from "@/lib/i18n";

interface Folder {
  id: string;
  name: string;
}
interface Course {
  id: string;
  title: string;
  folder_id: string | null;
}

export function CourseAccessEditor({ userId }: { userId: string }) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [folderIds, setFolderIds] = useState<Set<string>>(new Set());
  const [courseIds, setCourseIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [fRes, cRes, fAcc, cAcc] = await Promise.all([
        supabase.from("folders").select("id,name").order("name"),
        supabase.from("courses").select("id,title,folder_id").order("title"),
        supabase.from("user_folder_access").select("folder_id").eq("user_id", userId),
        supabase.from("user_course_access").select("course_id").eq("user_id", userId),
      ]);
      setFolders((fRes.data ?? []) as Folder[]);
      setCourses((cRes.data ?? []) as Course[]);
      setFolderIds(new Set((fAcc.data ?? []).map((r: { folder_id: string }) => r.folder_id)));
      setCourseIds(new Set((cAcc.data ?? []).map((r: { course_id: string }) => r.course_id)));
      setLoading(false);
    })();
  }, [userId]);

  const toggleFolder = (id: string) => {
    setFolderIds((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleCourse = (id: string) => {
    setCourseIds((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const save = async () => {
    setSaving(true);
    await supabase.from("user_folder_access").delete().eq("user_id", userId);
    await supabase.from("user_course_access").delete().eq("user_id", userId);
    if (folderIds.size > 0) {
      await supabase.from("user_folder_access").insert(
        Array.from(folderIds).map((folder_id) => ({ user_id: userId, folder_id })),
      );
    }
    if (courseIds.size > 0) {
      await supabase.from("user_course_access").insert(
        Array.from(courseIds).map((course_id) => ({ user_id: userId, course_id })),
      );
    }
    setSaving(false);
    return true;
  };

  // Expose save imperatively
  (CourseAccessEditor as unknown as { _save?: () => Promise<boolean> })._save = save;

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  // Group courses by folder
  const uncat = courses.filter((c) => !c.folder_id);

  return (
    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
      <p className="text-xs text-muted-foreground">{t.users.accessHint}</p>

      {folders.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2">{t.users.selectFolders}</div>
          <div className="space-y-1.5">
            {folders.map((f) => {
              const inFolder = courses.filter((c) => c.folder_id === f.id);
              const folderChecked = folderIds.has(f.id);
              return (
                <div key={f.id} className="border rounded-md p-2">
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <Checkbox checked={folderChecked} onCheckedChange={() => toggleFolder(f.id)} />
                    <Folder className="h-4 w-4" />
                    {f.name}
                    <span className="text-xs text-muted-foreground">({inFolder.length})</span>
                  </label>
                  {!folderChecked && inFolder.length > 0 && (
                    <div className="mt-2 ml-6 space-y-1">
                      {inFolder.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer">
                          <Checkbox checked={courseIds.has(c.id)} onCheckedChange={() => toggleCourse(c.id)} />
                          <BookOpen className="h-3 w-3" />
                          {c.title}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {uncat.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2">{t.users.selectCourses}</div>
          <div className="space-y-1 ml-1">
            {uncat.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={courseIds.has(c.id)} onCheckedChange={() => toggleCourse(c.id)} />
                <BookOpen className="h-3 w-3" />
                {c.title}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export async function saveCourseAccess(userId: string, folderIds: string[], courseIds: string[]) {
  await supabase.from("user_folder_access").delete().eq("user_id", userId);
  await supabase.from("user_course_access").delete().eq("user_id", userId);
  if (folderIds.length > 0) {
    await supabase.from("user_folder_access").insert(
      folderIds.map((folder_id) => ({ user_id: userId, folder_id })),
    );
  }
  if (courseIds.length > 0) {
    await supabase.from("user_course_access").insert(
      courseIds.map((course_id) => ({ user_id: userId, course_id })),
    );
  }
}
