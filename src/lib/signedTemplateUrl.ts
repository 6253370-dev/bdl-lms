import { supabase } from "@/integrations/supabase/client";

// Converts a (possibly public) URL pointing at the private
// "certificate-templates" bucket into a short-lived signed URL.
// If the URL isn't from that bucket, returns it unchanged.
export async function getSignedTemplateUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  const marker = "/certificate-templates/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  const path = url.substring(idx + marker.length).split("?")[0];
  const { data, error } = await supabase.storage
    .from("certificate-templates")
    .createSignedUrl(path, 60 * 10);
  if (error || !data) return url;
  return data.signedUrl;
}
