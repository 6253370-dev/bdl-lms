import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, Download } from "lucide-react";
import { downloadCertificate } from "@/lib/certificate";
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
}

function CertificatesPage() {
  const { user } = useAuth();
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("certificates")
        .select("id, serial, full_name, course_title, score_percent, issued_at")
        .eq("user_id", user.id)
        .order("issued_at", { ascending: false });
      setCerts((data ?? []) as CertRow[]);
      setLoading(false);
    })();
  }, [user]);

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
              <Button
                size="sm"
                onClick={() =>
                  downloadCertificate({
                    fullName: c.full_name,
                    courseTitle: c.course_title,
                    scorePercent: Math.round(c.score_percent),
                    serial: c.serial,
                    issuedAt: c.issued_at,
                  })
                }
              >
                <Download className="h-4 w-4 mr-2" /> {t.cert.download}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
