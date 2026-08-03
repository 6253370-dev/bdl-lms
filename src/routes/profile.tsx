import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { BookOpen, ClipboardList, Loader2, Save, User as UserIcon, Award } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profilim — BE Academy" },
      { name: "description", content: "Şəxsi məlumatlar, kurs və imtahan nəticələri, 10 dərəcəlik qiymət sistemi." },
      { property: "og:title", content: "Profilim — BE Academy" },
      { property: "og:description", content: "Şəxsi məlumatlar, kurs və imtahan nəticələri, 10 dərəcəlik qiymət sistemi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <ProfilePage />
    </ProtectedRoute>
  ),
});

interface AttemptRow {
  id: string;
  title: string;
  score_percent: number;
  passed: boolean;
  created_at: string;
}

function toGrade(percent: number) {
  return Math.round((percent / 10) * 10) / 10; // 10 dərəcəlik sistem
}

function gradeTone(g: number) {
  if (g >= 8) return "text-emerald-600";
  if (g >= 5) return "text-amber-600";
  return "text-destructive";
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function ProfilePage() {
  const { user, profile, roles, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [courseRows, setCourseRows] = useState<AttemptRow[]>([]);
  const [examRows, setExamRows] = useState<AttemptRow[]>([]);
  const [certCount, setCertCount] = useState(0);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: blocks }, { data: exams }, { count }] = await Promise.all([
        supabase
          .from("block_attempts")
          .select("id, score_percent, passed, created_at, course_id, courses(title)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("standalone_exam_attempts")
          .select("id, score_percent, passed, created_at, standalone_exams(title)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("certificates")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);
      setCourseRows(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((blocks ?? []) as any[]).map((b) => ({
          id: b.id,
          title: b.courses?.title ?? "—",
          score_percent: Number(b.score_percent),
          passed: !!b.passed,
          created_at: b.created_at,
        })),
      );
      setExamRows(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((exams ?? []) as any[]).map((e) => ({
          id: e.id,
          title: e.standalone_exams?.title ?? "—",
          score_percent: Number(e.score_percent),
          passed: !!e.passed,
          created_at: e.created_at,
        })),
      );
      setCertCount(count ?? 0);
      setLoading(false);
    })();
  }, [user]);

  const all = useMemo(() => [...courseRows, ...examRows], [courseRows, examRows]);
  const avgGrade = useMemo(
    () => (all.length ? toGrade(all.reduce((s, r) => s + r.score_percent, 0) / all.length) : 0),
    [all],
  );

  const roleLabel = roles.includes("super_admin")
    ? "Super admin"
    : roles.includes("admin")
      ? "Admin"
      : "İstifadəçi";

  const save = async () => {
    if (!user) return;
    if (!fullName.trim()) return toast.error("Ad soyad boş ola bilməz");
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), phone: phone.trim() || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error("Yadda saxlanmadı");
    await refreshProfile();
    toast.success("Profil yeniləndi");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xl font-semibold">
          {profile?.full_name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-display font-bold truncate">{profile?.full_name ?? "Profil"}</h1>
          <p className="text-sm text-muted-foreground">
            ID {profile?.employee_id} · {roleLabel}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Ortalama qiymət (10 üzrə)</div>
          <div className={`text-3xl font-bold ${gradeTone(avgGrade)}`}>{avgGrade.toFixed(1)}</div>
          <Progress value={avgGrade * 10} className="mt-3 h-2" />
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Cəhdlər</div>
          <div className="text-3xl font-bold">{all.length}</div>
          <div className="text-xs text-muted-foreground mt-3">
            Uğurlu: {all.filter((a) => a.passed).length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Sertifikatlar</div>
          <div className="text-3xl font-bold flex items-center gap-2">
            <Award className="h-6 w-6 text-primary" /> {certCount}
          </div>
        </Card>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">
            <UserIcon className="h-4 w-4 mr-2" /> Şəxsi məlumatlar
          </TabsTrigger>
          <TabsTrigger value="courses">
            <BookOpen className="h-4 w-4 mr-2" /> Kurslarım
          </TabsTrigger>
          <TabsTrigger value="exams">
            <ClipboardList className="h-4 w-4 mr-2" /> İmtahanlarım
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card className="p-5 space-y-4 max-w-xl">
            <div className="space-y-2">
              <Label>Ad, soyad</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+994 ..." />
            </div>
            <div className="space-y-2">
              <Label>E-poçt</Label>
              <Input value={profile?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>İşçi ID</Label>
              <Input value={profile?.employee_id ?? ""} disabled />
            </div>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Yadda saxla
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="courses">
          <ResultList rows={courseRows} loading={loading} empty="Hələ kurs nəticəniz yoxdur" />
        </TabsContent>
        <TabsContent value="exams">
          <ResultList rows={examRows} loading={loading} empty="Hələ imtahan nəticəniz yoxdur" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ResultList({ rows, loading, empty }: { rows: AttemptRow[]; loading: boolean; empty: string }) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!rows.length) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">{empty}</Card>;
  }
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const g = toGrade(r.score_percent);
        return (
          <Card key={r.id} className="p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{r.title}</div>
              <div className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</div>
            </div>
            <Badge variant={r.passed ? "default" : "destructive"}>
              {r.passed ? "Uğurlu" : "Uğursuz"}
            </Badge>
            <div className="text-right w-24">
              <div className={`text-lg font-bold ${gradeTone(g)}`}>{g.toFixed(1)}</div>
              <div className="text-[11px] text-muted-foreground">{Math.round(r.score_percent)}%</div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
