import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "course-media";
const MAX_BYTES = 200 * 1024 * 1024;

/**
 * Faylı `course-media` bucket-ına yükləyir və ictimai URL qaytarır.
 * Xəta olarsa toast göstərir və `null` qaytarır. (FileUpload və ImageDropzone ortaq istifadə edir.)
 */
export async function uploadCourseMedia(file: File, folder: string): Promise<string | null> {
  if (file.size > MAX_BYTES) {
    toast.error("Fayl 200MB-dan kiçik olmalıdır");
    return null;
  }
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    toast.error(error.message);
    return null;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
