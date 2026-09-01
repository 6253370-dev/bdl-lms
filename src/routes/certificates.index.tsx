import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileUpload } from "@/components/FileUpload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Award, Eye, FileText, Loader2, Plus, Trash2, Pencil } from "lucide-react";
import { previewCertificateSmart } from "@/lib/certificate";
import { toast } from "sonner";

export const Route = createFileRoute("/certificates/")({
  head: () => ({
    meta: [
      { title: "Sertifikat Şablonları — Baku Digital Lab" },
      { name: "description", content: "Sertifikat şablonlarını yüklə, redaktə et və kurs/imtahanlarda istifadə et." },
      { property: "og:title", content: "Sertifikat Şablonları — Baku Digital Lab" },
      { property: "og:description", content: "Sertifikat şablonlarını yüklə, redaktə et və kurs/imtahanlarda istifadə et." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <TemplatesPage />
    </ProtectedRoute>
  ),
});

interface Tpl {
  id: string;
  name: string;
  file_url: string;
  file_type: string;
  is_active: boolean;
  created_at: string;
}

function TemplatesPage() {
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<{ id?: string; name: string; file_url: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) navigate({ to: "/certificates/my" });
  }, [isAdmin, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("certificate_templates")
      .select("id,name,file_url,file_type,is_active,created_at")
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Tpl[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const save = async () => {
    if (!editor) return;
    if (!editor.name.trim()) return toast.error("Şablon adı yazın");
    if (!editor.file_url) return toast.error("Şablon faylı yükləyin");
    setSaving(true);
    const payload = {
      name: editor.name.trim(),
      file_url: editor.file_url,
      file_type: editor.file_url.toLowerCase().endsWith(".pptx") ? "pptx" : "pdf",
      is_active: true,
      uploaded_by: user?.id ?? null,
    };
    const { error } = editor.id
      ? await supabase.from("certificate_templates").update(payload).eq("id", editor.id)
      : await supabase.from("certificate_templates").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editor.id ? "Şablon yeniləndi" : "Şablon əlavə edildi");
    setEditor(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Şablon silinsin?")) return;
    const { error } = await supabase.from("certificate_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Şablon silindi");
    load();
  };

  const preview = async (tpl: Tpl) => {
    setBusy(tpl.id);
    try {
      const url = await previewCertificateSmart(
        {
          fullName: "Ad Soyad",
          courseTitle: "Nümunə Kurs",
          scorePercent: 95,
          serial: "000001",
          issuedAt: new Date().toISOString(),
        },
        tpl.file_url,
      );
      setPreviewUrl(url);
      setPreviewName(tpl.name);
    } catch (e) {
      toast.error((e as Error).message ?? "Önizləmə alınmadı");
    } finally {
      setBusy(null);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Award className="h-7 w-7 text-primary" /> Sertifikat Şablonları
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Şablonlar kurs imtahanlarında və müstəqil imtahanlarda istifadə oluna bilər.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/certificates/my">
              <Award className="h-4 w-4" /> Sertifikatlarım
            </Link>
          </Button>
          <Button onClick={() => setEditor({ name: "", file_url: null })}>
            <Plus className="h-4 w-4" /> Yeni şablon
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Yüklənir…</p>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Hələ şablon yoxdur.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((tpl) => (
            <Card key={tpl.id} className="p-4 flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{tpl.name}</div>
                <div className="text-xs text-muted-foreground truncate">{tpl.file_url}</div>
              </div>
              <Badge variant="secondary" className="uppercase">{tpl.file_type}</Badge>
              <Button size="sm" variant="outline" disabled={busy === tpl.id} onClick={() => preview(tpl)}>
                {busy === tpl.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditor({ id: tpl.id, name: tpl.name, file_url: tpl.file_url })}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="destructive" onClick={() => remove(tpl.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editor?.id ? "Şablonu redaktə et" : "Yeni şablon"}</DialogTitle>
          </DialogHeader>
          {editor && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Şablon adı</Label>
                <Input
                  value={editor.name}
                  onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                  placeholder="məs. Rəsmi Baku Digital Lab"
                />
              </div>
              <FileUpload
                label="Şablon faylı (PDF tövsiyə olunur)"
                icon={FileText}
                value={editor.file_url}
                onChange={(v) => setEditor({ ...editor, file_url: v })}
                accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                folder="certificate-templates"
              />
              <p className="text-xs text-muted-foreground">
                Ad, kurs, nəticə, tarix və seriya avtomatik PDF şablonun üzərinə yazılır.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)}>Ləğv</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Yadda saxla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewUrl} onOpenChange={(o) => { if (!o) { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); } }}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Önizləmə — {previewName}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <img src={previewUrl} alt="Sertifikat şablonu önizləməsi" className="w-full max-h-[70vh] object-contain rounded-md border bg-muted" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
