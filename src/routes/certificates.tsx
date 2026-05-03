import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Award, Download, Eye, Loader2 } from "lucide-react";
import { downloadCertificateSmart, previewCertificateSmart, type CertificateData } from "@/lib/certificate";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/certificates")({
  component: () => (
    <ProtectedRoute>
      <CertificatesPage />
    </ProtectedRoute>
  ),
});

interface CertRow {
  id: string;
  serial: string;
  full_name: string;
  course_title: string;
  score_percent: number;
  issued_at: string;
  course_id: string;
}

function CertificatesPage() {
  const { user } = useAuth();
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [templates, setTemplates] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [previewData, setPreviewData] = useState<CertificateData | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("certificates")
        .select("id, serial, full_name, course_title, score_percent, issued_at, course_id")
        .eq("user_id", user.id)
        .order("issued_at", { ascending: false });
      const rows = (data ?? []) as CertRow[];
      setCerts(rows);
      const ids = Array.from(new Set(rows.map((r) => r.course_id).filter(Boolean)));
      if (ids.length) {
        const { data: cs } = await supabase
          .from("courses")
          .select("id, certificate_template_url")
          .in("id", ids);
        const map: Record<string, string | null> = {};
        (cs ?? []).forEach((c: any) => (map[c.id] = c.certificate_template_url));
        setTemplates(map);
      }
      setLoading(false);
    })();
  }, [user]);

  const toData = (c: CertRow): CertificateData => ({
    fullName: c.full_name,
    courseTitle: c.course_title,
    scorePercent: Math.round(c.score_percent),
    serial: c.serial,
    issuedAt: c.issued_at,
  });

  const openPreview = async (c: CertRow) => {
    setBusy(c.id);
    try {
      const data = toData(c);
      const url = await previewCertificateSmart(data, templates[c.course_id]);
      setPreviewData(data);
      setPreviewUrl(url);
    } catch (e: any) {
      toast.error(e.message ?? "Önizləmə alınmadı");
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async (c: CertRow) => {
    setBusy(c.id);
    try {
      await downloadCertificateSmart(toData(c), templates[c.course_id]);
    } catch (e: any) {
      toast.error(e.message ?? "Yükləmə alınmadı");
    } finally {
      setBusy(null);
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewData(null);
  };

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">{t.cert.myCerts}</h1>
        <p className="text-muted-foreground mt-1">{t.cert.title}</p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">{t.common.loading}</p>
      ) : certs.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <Award className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t.cert.noneYet}</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {certs.map((c) => (
            <Card key={c.id} className="p-5 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Award className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-display font-semibold leading-tight truncate">
                    {c.course_title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t.cert.serial}: {c.serial}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {new Date(c.issued_at).toLocaleDateString("az-AZ", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                <span className="font-semibold text-primary">{Math.round(c.score_percent)}%</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" disabled={busy === c.id} onClick={() => openPreview(c)}>
                  {busy === c.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
                  {t.commonExtras.preview}
                </Button>
                <Button size="sm" className="flex-1" disabled={busy === c.id} onClick={() => handleDownload(c)}>
                  {busy === c.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  {t.cert.download}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!previewUrl} onOpenChange={(o) => !o && closePreview()}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{t.commonExtras.preview} — {previewData?.courseTitle}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe
              src={previewUrl}
              title="Sertifikat önizləməsi"
              className="w-full h-[70vh] rounded-md border"
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closePreview}>{t.commonExtras.close}</Button>
            {previewData && (
              <Button onClick={() => {
                const c = certs.find((x) => x.serial === previewData.serial);
                if (c) handleDownload(c);
              }}>
                <Download className="h-4 w-4 mr-2" /> {t.cert.download}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
