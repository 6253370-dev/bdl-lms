import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Award,
  CalendarDays,
  ClipboardCheck,
  Download,
  Eye,
  FileText,
  Loader2,
  Share2,
  Target,
} from "lucide-react";
import { downloadCertificateSmart, previewCertificateSmart, type CertificateData } from "@/lib/certificate";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/design/PageHeader";
import { StatCard } from "@/components/design/StatCard";
import { StatusChip } from "@/components/design/StatusChip";

export const Route = createFileRoute("/certificates/my")({
  head: () => ({ meta: [
    { title: "Sertifikatlarım | Baku Digital Lab" },
    { name: "description", content: "Tamamladığınız təlimlər üzrə şəxsi sertifikatlarınız." },
    { property: "og:title", content: "Sertifikatlarım | Baku Digital Lab" },
    { property: "og:description", content: "Tamamladığınız təlimlər üzrə şəxsi sertifikatlarınız." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <ProtectedRoute>
      <MyCertificatesPage />
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

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

const errMsg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/** Kartlar üçün HTML ilə çəkilmiş kiçik sertifikat görünüşü (real fayl deyil). */
function CertificateThumb({ c }: { c: CertRow }) {
  return (
    <div
      aria-hidden="true"
      className="relative flex aspect-[1.414] flex-col items-center justify-center overflow-hidden rounded-xl border border-border bg-[var(--gray-25)] px-4 text-center dark:bg-muted/40"
    >
      <span className="absolute right-0 top-0 h-14 w-14 rounded-bl-[2.5rem] bg-brand-100 dark:bg-brand-600/30" />
      <Award className="mb-1 h-5 w-5 text-primary" />
      <span className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">SERTİFİKAT</span>
      <span className="mt-1 line-clamp-1 text-sm font-semibold">{c.full_name}</span>
      <span className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{c.course_title}</span>
    </div>
  );
}

function MyCertificatesPage() {
  const { user } = useAuth();
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [templates, setTemplates] = useState<Record<string, string | null>>({});
  const [passedExams, setPassedExams] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewData, setPreviewData] = useState<CertificateData | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [heroFailed, setHeroFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [sort, setSort] = useState<"new" | "old">("new");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data }, { count }] = await Promise.all([
        supabase
          .from("certificates")
          .select("id, serial, full_name, course_title, score_percent, issued_at, course_id")
          .eq("user_id", user.id)
          .order("issued_at", { ascending: false }),
        supabase
          .from("standalone_exam_attempts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("passed", true),
      ]);
      const rows = (data ?? []) as CertRow[];
      setCerts(rows);
      setPassedExams(count ?? 0);
      const ids = Array.from(new Set(rows.map((r) => r.course_id).filter(Boolean)));
      if (ids.length) {
        const { data: cs } = await supabase
          .from("courses")
          .select("id, certificate_template_url")
          .in("id", ids);
        const map: Record<string, string | null> = {};
        (cs ?? []).forEach((c: { id: string; certificate_template_url: string | null }) => (map[c.id] = c.certificate_template_url));
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

  const latest = certs[0];

  // Hero üçün yalnız ən son sertifikatın real önizləməsi yaradılır.
  useEffect(() => {
    if (loading || !latest) return;
    let url: string | null = null;
    let cancelled = false;
    previewCertificateSmart(toData(latest), templates[latest.course_id])
      .then((u) => {
        url = u;
        if (cancelled) URL.revokeObjectURL(u);
        else setHeroUrl(u);
      })
      .catch(() => !cancelled && setHeroFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, latest?.id]);

  const sorted = useMemo(
    () => (sort === "new" ? certs : [...certs].reverse()),
    [certs, sort],
  );

  const openPreview = async (c: CertRow) => {
    setBusy(c.id);
    try {
      const data = toData(c);
      const url = await previewCertificateSmart(data, templates[c.course_id]);
      setPreviewData(data);
      setPreviewUrl(url);
    } catch (e) {
      toast.error(errMsg(e, "Önizləmə alınmadı"));
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async (c: CertRow) => {
    setBusy(c.id);
    try {
      await downloadCertificateSmart(toData(c), templates[c.course_id]);
    } catch (e) {
      toast.error(errMsg(e, "Yükləmə alınmadı"));
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async (c: CertRow) => {
    const text = `${c.course_title} — sertifikat kodu: ${c.serial}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Sertifikat", text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.success("Sertifikat məlumatı kopyalandı");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast.error("Paylaşmaq alınmadı");
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewData(null);
  };

  return (
    <div className="bento-page space-y-6">
      <PageHeader title={t.cert.myCerts} description={t.cert.title} />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : certs.length === 0 ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="p-10 text-center border-dashed">
            <Award className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">{t.cert.noneYet}</p>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <StatCard icon={Award} label="Sertifikat" value={0} />
            <StatCard icon={ClipboardCheck} label="Keçilən imtahanlar" value={passedExams ?? 0} />
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            {latest && (
              <section
                aria-label={latest.course_title}
                className="grid gap-6 rounded-2xl border border-border bg-card p-5 shadow-card md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] sm:p-6"
              >
                <div className="flex items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40">
                  {heroUrl ? (
                    <img src={heroUrl} alt={`Sertifikat önizləməsi — ${latest.course_title}`} className="h-auto w-full object-contain" />
                  ) : heroFailed ? (
                    <div className="w-full p-4"><CertificateThumb c={latest} /></div>
                  ) : (
                    <div className="flex aspect-[1.414] w-full items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-4">
                  <StatusChip tone="success" dot className="w-fit">Etibarlı sertifikat</StatusChip>
                  <h2 className="font-display text-xl font-bold break-words sm:text-2xl">{latest.course_title}</h2>
                  <dl className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="h-4 w-4 shrink-0" />
                      <dt>Tamamlanma tarixi:</dt>
                      <dd className="text-foreground tabular-nums">{fmtDate(latest.issued_at)}</dd>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Target className="h-4 w-4 shrink-0" />
                      <dt>{t.cert.score}:</dt>
                      <dd className="text-foreground tabular-nums">{Math.round(latest.score_percent)}%</dd>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText className="h-4 w-4 shrink-0" />
                      <dt>Sertifikat kodu:</dt>
                      <dd className="min-w-0 break-all font-mono text-xs text-foreground">{latest.serial}</dd>
                    </div>
                  </dl>
                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button disabled={busy === latest.id} onClick={() => handleDownload(latest)}>
                      {busy === latest.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                      PDF yüklə
                    </Button>
                    <Button variant="outline" onClick={() => handleShare(latest)}>
                      <Share2 className="h-4 w-4 mr-2" /> Paylaş
                    </Button>
                  </div>
                </div>
              </section>
            )}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <StatCard icon={Award} label="Sertifikat" value={certs.length} hint="Tamamladığınız kurslar" />
              <StatCard icon={ClipboardCheck} label="Keçilən imtahanlar" value={passedExams ?? "—"} />
            </div>
          </div>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold sm:text-xl">Bütün sertifikatlar</h2>
              <Select value={sort} onValueChange={(v) => setSort(v as "new" | "old")}>
                <SelectTrigger className="w-48" aria-label="Sıralama">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Ən yeni əvvəl</SelectItem>
                  <SelectItem value="old">Ən köhnə əvvəl</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {sorted.map((c) => (
                <article key={c.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
                  <CertificateThumb c={c} />
                  <h3 className="font-semibold leading-snug break-words">{c.course_title}</h3>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2 tabular-nums">
                      <CalendarDays className="h-4 w-4 shrink-0" /> {fmtDate(c.issued_at)}
                      <span className="ml-auto font-semibold text-primary">{Math.round(c.score_percent)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 break-all font-mono text-xs">{c.serial}</span>
                    </div>
                  </div>
                  <div className="mt-auto flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" disabled={busy === c.id} onClick={() => openPreview(c)}>
                      {busy === c.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
                      {t.commonExtras.preview}
                    </Button>
                    <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" aria-label={t.cert.download} disabled={busy === c.id} onClick={() => handleDownload(c)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" aria-label="Paylaş" onClick={() => handleShare(c)}>
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      <Dialog open={!!previewUrl} onOpenChange={(o) => !o && closePreview()}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{t.commonExtras.preview} — {previewData?.courseTitle}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Sertifikat önizləməsi"
              className="w-full max-h-[70vh] object-contain rounded-md border bg-muted"
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
