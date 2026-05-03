import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Award, Upload, Loader2, Trash2, CheckCircle2, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/certificate-templates")({
  component: () => (
    <ProtectedRoute requireAdmin>
      <CertificateTemplatesPage />
    </ProtectedRoute>
  ),
});

interface TemplateRow {
  id: string;
  name: string;
  file_url: string;
  file_type: "pdf" | "pptx";
  is_active: boolean;
  created_at: string;
}

const BUCKET = "certificate-templates";

function CertificateTemplatesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("certificate_templates")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data ?? []) as TemplateRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (file: File) => {
    if (!name.trim()) { toast.error("Şablon adını daxil edin"); return; }
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "pptx") { toast.error("Yalnız PDF və ya PPTX"); return; }
    if (file.size > 25 * 1024 * 1024) { toast.error("Fayl 25MB-dan kiçik olmalıdır"); return; }
    setUploading(true);
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type, upsert: false,
    });
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const { error } = await supabase.from("certificate_templates").insert({
      name: name.trim(),
      file_url: pub.publicUrl,
      file_type: ext,
      uploaded_by: user?.id,
      is_active: items.length === 0,
    });
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Şablon yükləndi");
    setName("");
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  const setActive = async (id: string) => {
    await supabase.from("certificate_templates").update({ is_active: false }).neq("id", id);
    const { error } = await supabase.from("certificate_templates").update({ is_active: true }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Aktiv şablon yeniləndi");
    load();
  };

  const remove = async (row: TemplateRow) => {
    if (!confirm(`"${row.name}" silinsin?`)) return;
    // Try removing storage file
    try {
      const path = row.file_url.split(`/${BUCKET}/`)[1];
      if (path) await supabase.storage.from(BUCKET).remove([path]);
    } catch {}
    const { error } = await supabase.from("certificate_templates").delete().eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Silindi");
    load();
  };

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Award className="h-7 w-7 text-primary" /> Sertifikat şablonları
        </h1>
        <p className="text-muted-foreground mt-1">
          PDF və ya PPTX şablon yükləyin. Növbəti versiyada ad, kurs və tarix avtomatik yerləşdiriləcək.
        </p>
      </div>

      <Card className="p-5 mb-6">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-end">
          <div>
            <Label>Şablon adı</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="məs. Klassik Şablon"
              className="mt-1"
            />
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              PDF / PPTX yüklə
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Tip: şablonda dəyişdiriləcək sahələri <code>{"{{FULL_NAME}}"}</code>,{" "}
          <code>{"{{COURSE_TITLE}}"}</code>, <code>{"{{SCORE}}"}</code>,{" "}
          <code>{"{{ISSUE_DATE}}"}</code>, <code>{"{{SERIAL}}"}</code> kimi yer tutucu kimi qoyun.
        </p>
      </Card>

      {loading ? (
        <p className="text-muted-foreground">Yüklənir…</p>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Hələ şablon yoxdur</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((t) => (
            <Card key={t.id} className="p-4 flex items-center gap-4">
              <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{t.name}</span>
                  <Badge variant="outline" className="uppercase text-[10px]">{t.file_type}</Badge>
                  {t.is_active && (
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Aktiv
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {new Date(t.created_at).toLocaleString("az-AZ")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={t.file_url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" /> Aç
                  </a>
                </Button>
                {!t.is_active && (
                  <Button variant="outline" size="sm" onClick={() => setActive(t.id)}>
                    Aktiv et
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => remove(t)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
