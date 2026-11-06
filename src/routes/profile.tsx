import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  ClipboardList,
  Loader2,
  Save,
  User as UserIcon,
  Camera,
  KeyRound,
  Grid3x3,
  PlayCircle,
  Lock,
  Footprints,
  GraduationCap,
  Trophy,
  Puzzle,
  Target,
  Zap,
  Award,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profil — Baku Digital Lab" },
      { name: "description", content: "Şəxsi məlumatlar, kurs proqresi və iştirak etdiyin imtahanların tarixçəsi." },
      { property: "og:title", content: "Profil — Baku Digital Lab" },
      { property: "og:description", content: "Şəxsi məlumatlar, kurs proqresi və iştirak etdiyin imtahanların tarixçəsi." },
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

export const RANKS = [
  "Yeni Başlayan",
  "Bilik Toplayıcısı",
  "Araşdırmaçı",
  "Bacarıq Ovçusu",
  "Peşəkar Namizəd",
  "Usta Tələbə",
  "Akademiya Lideri",
  "Bilik Arxitektoru",
  "Master Mentor",
  "Grand Master",
];

export function rankFor(completedCourses: number) {
  const idx = Math.min(RANKS.length - 1, Math.floor(completedCourses / 2));
  return RANKS[idx];
}

interface CourseProgress {
  id: string;
  title: string;
  total: number;
  done: number;
  completed: boolean;
}

interface ExamHistoryRow {
  id: string;
  title: string;
  created_at: string;
  score_percent: number;
  passed: boolean;
}

interface CrosswordAttemptRow {
  id: string;
  crossword_id: string;
  title: string;
  correct_count: number;
  total_words: number;
  score_percent: number;
  duration_seconds: number;
  xp_earned: number;
  completed_at: string;
}

interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  earned: boolean;
  progress: string;
  hidden?: boolean;
}

function AchievementsCard({ items }: { items: Achievement[] }) {
  const earned = items.filter((a) => a.earned).length;
  const total = items.filter((a) => !a.hidden).length;
  return (
    <section aria-labelledby="achievements-title" className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="achievements-title" className="font-display text-lg font-semibold">Uğurlarım</h2>
        <span className="text-sm text-muted-foreground tabular-nums">{earned} / {total} qazanılıb</span>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-x-3 gap-y-5">
        {items.map((a) => {
          const Icon = a.hidden ? Lock : a.icon;
          return (
            <li key={a.id} className="flex flex-col items-center gap-1.5 text-center">
              <span
                className={cn(
                  "relative mb-1 flex h-14 w-14 items-center justify-center rounded-2xl",
                  a.earned
                    ? "bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-300"
                    : "bg-muted text-muted-foreground",
                )}
                aria-hidden="true"
              >
                <Icon className="h-6 w-6" />
                {!a.earned && !a.hidden && (
                  <Lock className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border border-border bg-card p-0.5 text-muted-foreground" />
                )}
              </span>
              <span className={cn("text-sm font-semibold leading-tight", !a.earned && "text-muted-foreground")}>{a.title}</span>
              <span className="text-xs text-muted-foreground">{a.earned ? a.desc : a.progress}</span>
              <span className="sr-only">{a.earned ? "Qazanılıb" : "Kilidli"}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function resultTone(pct: number) {
  if (pct >= 80) return "text-[var(--success-700)] dark:text-[var(--success-500)]";
  if (pct >= 50) return "text-[var(--warning-700)] dark:text-[var(--warning-500)]";
  return "text-[var(--error-700)] dark:text-[var(--error-500)]";
}

function fmtDur(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function ProfilePage() {
  const { user, profile, roles, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [team, setTeam] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CourseProgress[]>([]);
  const [exams, setExams] = useState<ExamHistoryRow[]>([]);
  const [cwAttempts, setCwAttempts] = useState<CrosswordAttemptRow[]>([]);
  const [certCount, setCertCount] = useState(0);
  const [cwDrafts, setCwDrafts] = useState<{ crossword_id: string; title: string; filled: number; elapsed_seconds: number; updated_at: string }[]>([]);

  useEffect(() => {
    if (!profile) return;
    const parts = (profile.full_name ?? "").trim().split(/\s+/);
    setFirstName(profile.first_name ?? parts[0] ?? "");
    setLastName(profile.last_name ?? parts.slice(1).join(" ") ?? "");
    setEmail(profile.email ?? "");
    setPhone(profile.phone ?? "");
    setTeam(profile.team ?? "");
    setHeadline((profile as { headline?: string | null }).headline ?? "");
    setBio((profile as { bio?: string | null }).bio ?? "");
    setAvatarUrl(profile.avatar_url ?? null);
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: attempts }, { data: examAttempts }, { data: certs }, { data: cwRows }, { data: draftRows }] = await Promise.all([
        supabase
          .from("block_attempts")
          .select("id,course_id,block_id,passed,score_percent,created_at,courses(title)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("standalone_exam_attempts")
          .select("id,score_percent,passed,created_at,standalone_exams(title)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("certificates").select("course_id").eq("user_id", user.id),
        supabase
          .from("crossword_completions")
          .select("id,crossword_id,correct_count,total_words,score_percent,duration_seconds,xp_earned,completed_at,crosswords(title)")
          .eq("user_id", user.id)
          .order("completed_at", { ascending: false }),
        supabase
          .from("crossword_progress")
          .select("crossword_id,cell_values,elapsed_seconds,updated_at,crosswords(title)")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setCwAttempts(((cwRows ?? []) as any[]).map((r) => ({ ...r, title: r.crosswords?.title ?? "—", score_percent: Number(r.score_percent) })));
      setCwDrafts(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((draftRows ?? []) as any[])
          .map((r) => ({
            crossword_id: r.crossword_id as string,
            title: (r.crosswords?.title ?? "—") as string,
            filled: Object.values((r.cell_values ?? {}) as Record<string, string>).filter(Boolean).length,
            elapsed_seconds: r.elapsed_seconds as number,
            updated_at: r.updated_at as string,
          }))
          .filter((r) => r.filled > 0),
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (attempts ?? []) as any[];
      const courseIds = Array.from(new Set(rows.map((r) => r.course_id)));
      let blockCounts: Record<string, number> = {};
      if (courseIds.length) {
        const { data: blocks } = await supabase
          .from("course_blocks")
          .select("id,course_id")
          .in("course_id", courseIds);
        blockCounts = (blocks ?? []).reduce<Record<string, number>>((acc, b) => {
          acc[b.course_id] = (acc[b.course_id] ?? 0) + 1;
          return acc;
        }, {});
      }
      const certSet = new Set(((certs ?? []) as { course_id: string }[]).map((c) => c.course_id));
      setCertCount((certs ?? []).length);
      setCertCount((certs ?? []).length);
      const byCourse = new Map<string, CourseProgress>();
      rows.forEach((r) => {
        const cur = byCourse.get(r.course_id) ?? {
          id: r.course_id,
          title: r.courses?.title ?? "—",
          total: blockCounts[r.course_id] ?? 0,
          done: 0,
          completed: certSet.has(r.course_id),
        };
        byCourse.set(r.course_id, cur);
      });
      // count distinct passed blocks per course
      const passedBlocks = new Map<string, Set<string>>();
      rows.filter((r) => r.passed).forEach((r) => {
        const set = passedBlocks.get(r.course_id) ?? new Set<string>();
        set.add(r.block_id);
        passedBlocks.set(r.course_id, set);
      });
      byCourse.forEach((c, id) => {
        c.done = passedBlocks.get(id)?.size ?? 0;
        if (c.total && c.done >= c.total) c.completed = true;
      });
      setCourses(Array.from(byCourse.values()));

      setExams(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((examAttempts ?? []) as any[]).map((e) => ({
          id: e.id,
          title: e.standalone_exams?.title ?? "—",
          created_at: e.created_at,
          score_percent: Number(e.score_percent),
          passed: !!e.passed,
        })),
      );
      setLoading(false);
    })();
  }, [user]);

  const completedCourses = useMemo(() => courses.filter((c) => c.completed), [courses]);
  const ongoingCourses = useMemo(() => courses.filter((c) => !c.completed), [courses]);
  const rank = rankFor(completedCourses.length);

  // Uğurlar (maddə 43): bazada saxlanmır, artıq yüklənmiş məlumatdan hesablanır.
  const achievements = useMemo<Achievement[]>(() => {
    const done = completedCourses.length;
    const distinctCw = new Set(cwAttempts.map((a) => a.crossword_id)).size;
    return [
      { id: "first", title: "İlk addım", desc: "1 kurs tamamlandı", icon: Footprints, earned: done >= 1, progress: `${Math.min(done, 1)} / 1 kurs` },
      { id: "student", title: "Tələbə ruhu", desc: "5 kurs tamamlandı", icon: GraduationCap, earned: done >= 5, progress: `${Math.min(done, 5)} / 5 kurs` },
      { id: "exam", title: "İmtahan qəhrəmanı", desc: "İmtahandan keçdi", icon: Trophy, earned: exams.some((e) => e.passed), progress: "İmtahandan keçin" },
      { id: "cw-fan", title: "Krossvord həvəskarı", desc: "5 krossvord həll edildi", icon: Puzzle, earned: distinctCw >= 5, progress: `${Math.min(distinctCw, 5)} / 5 krossvord` },
      { id: "perfect", title: "Dəqiqlik ustası", desc: "Krossvordda 100% nəticə", icon: Target, earned: cwAttempts.some((a) => a.score_percent >= 100), progress: "Krossvordda 100% toplayın" },
      { id: "fast", title: "Sürətli ağıl", desc: "Krossvord 3 dəqiqədən tez", icon: Zap, earned: cwAttempts.some((a) => a.duration_seconds < 180), progress: "3 dəqiqədən tez həll edin" },
      { id: "cert", title: "Sertifikat sahibi", desc: "İlk sertifikat alındı", icon: Award, earned: certCount >= 1, progress: "Kursu sertifikatla bitirin" },
      { id: "secret", title: "Gizli uğur", desc: "", icon: Sparkles, earned: false, progress: "Tezliklə…", hidden: true },
    ];
  }, [completedCourses.length, cwAttempts, exams, certCount]);

  const cwSummary = useMemo(() => {
    const groups = new Map<string, CrosswordAttemptRow[]>();
    cwAttempts.forEach((a) => groups.set(a.crossword_id, [...(groups.get(a.crossword_id) ?? []), a]));
    return [...groups.values()].map((list) => {
      const best = list.reduce((b, a) =>
        a.score_percent > b.score_percent || (a.score_percent === b.score_percent && a.duration_seconds < b.duration_seconds) ? a : b,
      );
      const last = list.reduce((l, a) => (a.completed_at > l ? a.completed_at : l), list[0].completed_at);
      const xp = list.reduce((s, a) => s + (a.xp_earned ?? 0), 0);
      return { best, attempts: list.length, last, xp };
    });
  }, [cwAttempts]);

  const roleLabel = roles.includes("super_admin")
    ? "Super admin"
    : roles.includes("admin")
      ? "Admin"
      : "İstifadəçi";

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `avatars/${user.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("course-media").upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
    if (error) {
      setUploading(false);
      return toast.error(error.message);
    }
    const { data } = supabase.storage.from("course-media").getPublicUrl(path);
    const { error: upErr } = await supabase
      .from("profiles")
      .update({ avatar_url: data.publicUrl })
      .eq("id", user.id);
    setUploading(false);
    if (upErr) return toast.error(upErr.message);
    setAvatarUrl(data.publicUrl);
    await refreshProfile();
    toast.success("Profil şəkli yeniləndi");
  };

  const save = async () => {
    if (!user) return;
    if (!firstName.trim()) return toast.error("Ad boş ola bilməz");
    if (password && password.length < 6) return toast.error("Şifrə ən azı 6 simvol olmalıdır");
    if (password && password !== password2) return toast.error("Şifrələr uyğun gəlmir");
    setSaving(true);
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        full_name: fullName,
        phone: phone.trim() || null,
        email: email.trim(),
        headline: headline.trim() || null,
        bio: bio.trim() || null,
      })
      .eq("id", user.id);
    if (error) {
      setSaving(false);
      return toast.error("Yadda saxlanmadı");
    }
    if (email.trim() && email.trim() !== profile?.email) {
      const { error: mailErr } = await supabase.auth.updateUser({ email: email.trim() });
      if (mailErr) toast.error(`E-poçt dəyişmədi: ${mailErr.message}`);
      else toast.info("E-poçtu təsdiqləmək üçün yeni ünvana məktub göndərildi");
    }
    if (password) {
      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) toast.error(`Şifrə dəyişmədi: ${pwErr.message}`);
      else toast.success("Şifrə yeniləndi");
      setPassword("");
      setPassword2("");
    }
    setSaving(false);
    await refreshProfile();
    toast.success("Profil yeniləndi");
  };

  return (
    <div className="bento-page profile-workspace">
      <div className="profile-identity bento-panel">
        <div className="relative">
          <div className="h-16 w-16 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xl font-semibold overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profil şəkli" className="h-full w-full object-cover" />
            ) : (
              (profile?.full_name?.[0]?.toUpperCase() ?? "?")
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadAvatar(f);
              e.target.value = "";
            }}
          />
          <Button
            size="icon"
            variant="secondary"
            className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full shadow"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="Profil şəkli yüklə"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <h1 className="text-2xl font-display font-bold truncate">{profile?.full_name ?? "Profil"}</h1>
            <Badge variant="secondary">{rank}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            ID {profile?.employee_id} · {roleLabel} · Bitirilmiş kurs: {completedCourses.length}
          </p>
        </div>
      </div>

      <div className="min-w-0 space-y-6">
      {!loading && <AchievementsCard items={achievements} />}

      <Tabs defaultValue="info" className="min-w-0">
        <TabsList className="module-tabs">
          <TabsTrigger value="info">
            <UserIcon className="h-4 w-4 mr-2" /> Şəxsi məlumatlarım
          </TabsTrigger>
          <TabsTrigger value="courses">
            <BookOpen className="h-4 w-4 mr-2" /> Kurslarım
          </TabsTrigger>
          <TabsTrigger value="exams">
            <ClipboardList className="h-4 w-4 mr-2" /> İştirak etdiyim imtahanlar
          </TabsTrigger>
          <TabsTrigger value="crosswords">
            <Grid3x3 className="h-4 w-4 mr-2" /> Krossvordlarım
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card className="p-6 space-y-5 border-0">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Ad</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Soyad</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>E-poçt</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </div>
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+994 ..." />
            </div>
            <div className="space-y-2">
              <Label>Komanda (Team Battle)</Label>
              <Input value={team || "—"} disabled readOnly />
              <p className="text-xs text-muted-foreground">Komandanı yalnız admin dəyişə bilər.</p>
            </div>
            <div className="space-y-2 border-t pt-4">
              <Label>Vəzifə / Uzmanlıq sahəsi</Label>
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="məs. Satış üzrə baş mütəxəssis"
              />
            </div>
            <div className="space-y-2">
              <Label>Haqqımda</Label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                placeholder="Təcrübəniz və ixtisasınız haqqında qısa məlumat"
              />
              <p className="text-xs text-muted-foreground">
                Bu məlumatlar müəllim kimi göstərildiyiniz kurs səhifələrində görünür.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 border-t pt-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> Yeni şifrə</Label>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••" />
              </div>
              <div className="space-y-2">
                <Label>Şifrəni təkrarla</Label>
                <Input value={password2} onChange={(e) => setPassword2(e.target.value)} type="password" placeholder="••••••" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 border-t pt-4">
              <div className="space-y-2">
                <Label>İstifadəçi ID</Label>
                <Input value={profile?.employee_id ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <Input value={roleLabel} disabled />
              </div>
            </div>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Yadda saxla
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="courses" className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground">Davam edən kurslar</h2>
                {ongoingCourses.length ? (
                  ongoingCourses.map((c) => <CourseProgressCard key={c.id} course={c} />)
                ) : (
                  <Card className="p-6 text-center text-sm text-muted-foreground">Davam edən kurs yoxdur</Card>
                )}
              </section>
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground">Bitirdiyim kurslar</h2>
                {completedCourses.length ? (
                  completedCourses.map((c) => <CourseProgressCard key={c.id} course={c} />)
                ) : (
                  <Card className="p-6 text-center text-sm text-muted-foreground">Hələ bitirilmiş kurs yoxdur</Card>
                )}
              </section>
            </>
          )}
        </TabsContent>

        <TabsContent value="exams">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : exams.length ? (
            <div className="space-y-2">
              {exams.map((e) => (
                <Card key={e.id} className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{e.title}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(e.created_at)}</div>
                  </div>
                  <Badge variant={e.passed ? "default" : "destructive"}>
                    {e.passed ? "Uğurlu" : "Uğursuz"}
                  </Badge>
                  <div className="w-16 text-right font-semibold">{Math.round(e.score_percent)}%</div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Hələ imtahanda iştirak etməmisiniz
            </Card>
          )}
        </TabsContent>

        <TabsContent value="crosswords" className="space-y-4">
          {!loading && cwDrafts.length > 0 && (
            <Card className="p-4 space-y-3 border border-[var(--warning-200)] bg-[var(--warning-50)] dark:border-transparent dark:bg-[var(--warning-600)]/15">
              <div className="flex items-center gap-2 font-semibold">
                <PlayCircle className="h-5 w-5 text-[var(--warning-600)]" /> Yarımçıq qalmış krossvordlar
              </div>
              {cwDrafts.map((d) => (
                <div key={d.crossword_id} className="flex flex-wrap items-center gap-3 rounded-md bg-background p-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{d.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.filled} xana doldurulub · {fmtDur(d.elapsed_seconds)} · {fmtDate(d.updated_at)}
                    </div>
                  </div>
                  <Button size="sm" asChild>
                    <Link to="/crosswords" search={{ resume: d.crossword_id }}>
                      <PlayCircle className="h-4 w-4 mr-2" /> Davam et
                    </Link>
                  </Button>
                </div>
              ))}
            </Card>
          )}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : cwSummary.length ? (
            <Card className="overflow-hidden border-0 p-0">
              <table className="hidden w-full text-sm xl:table">
                <thead className="bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="h-11 px-4 font-medium">Krossvord</th>
                    <th className="h-11 px-4 font-medium">Nəticə</th>
                    <th className="h-11 px-4 font-medium">Vaxt</th>
                    <th className="h-11 px-4 font-medium">XP</th>
                    <th className="h-11 px-4 font-medium">Cəhd</th>
                    <th className="h-11 px-4 font-medium">Tarix</th>
                  </tr>
                </thead>
                <tbody>
                  {cwSummary.map(({ best, attempts, last, xp }) => (
                    <tr key={best.crossword_id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2 font-medium">
                          <Grid3x3 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <span className="min-w-0 break-words">{best.title}</span>
                        </span>
                      </td>
                      <td className={cn("px-4 py-3 font-semibold tabular-nums whitespace-nowrap", resultTone(best.score_percent))}>
                        {best.correct_count} / {best.total_words}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{fmtDur(best.duration_seconds)}</td>
                      <td className="px-4 py-3 tabular-nums">{xp ? `+${xp}` : "—"}</td>
                      <td className="px-4 py-3 tabular-nums">{attempts}</td>
                      <td className="px-4 py-3 tabular-nums whitespace-nowrap">{fmtDate(last)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="divide-y divide-border xl:hidden">
                {cwSummary.map(({ best, attempts, last, xp }) => (
                  <li key={best.crossword_id} className="space-y-2 p-4">
                    <div className="flex items-start gap-2 font-medium">
                      <Grid3x3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0 flex-1 break-words">{best.title}</span>
                      <span className={cn("shrink-0 font-semibold tabular-nums whitespace-nowrap", resultTone(best.score_percent))}>
                        {best.correct_count} / {best.total_words}
                      </span>
                    </div>
                    <dl className="grid grid-cols-4 gap-2 text-xs">
                      <div><dt className="text-muted-foreground">Vaxt</dt><dd className="tabular-nums">{fmtDur(best.duration_seconds)}</dd></div>
                      <div><dt className="text-muted-foreground">XP</dt><dd className="tabular-nums">{xp ? `+${xp}` : "—"}</dd></div>
                      <div><dt className="text-muted-foreground">Cəhd</dt><dd className="tabular-nums">{attempts}</dd></div>
                      <div><dt className="text-muted-foreground">Tarix</dt><dd className="tabular-nums">{fmtDate(last)}</dd></div>
                    </dl>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <Card className="p-8 text-center text-sm text-muted-foreground">Hələ krossvord həll etməmisiniz</Card>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}

function CourseProgressCard({ course }: { course: CourseProgress }) {
  const pct = course.total ? Math.min(100, Math.round((course.done / course.total) * 100)) : course.completed ? 100 : 0;
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0 font-medium truncate">{course.title}</div>
        <span className="text-sm text-muted-foreground">{pct}%</span>
      </div>
      <Progress value={pct} className="h-2" />
      <div className="text-xs text-muted-foreground">
        {course.done}/{course.total || "?"} bölmə tamamlanıb
      </div>
    </Card>
  );
}
