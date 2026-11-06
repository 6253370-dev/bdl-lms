import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  CalendarCheck,
  CalendarDays,
  Plus,
  Trash2,
  Loader2,
  Users,
  Search,
  UserPlus,
  ArrowLeft,
  Percent,
  CheckCircle2,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { StatCard } from "@/components/design/StatCard";
import { RowActions, TableCard } from "@/components/design/DataTable";
import { ExportButton } from "@/components/design/ExportButton";
import { PageHeader } from "@/components/design/PageHeader";
import { DateRangePicker } from "@/components/design/DateRangePicker";
import { DonutChart } from "@/components/design/DonutChart";
import { StatusChip } from "@/components/design/StatusChip";
import { UserAvatar } from "@/components/design/UserAvatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/attendance")({
  head: () => ({
    meta: [
      { title: "Davamiyyət · Baku Digital Lab" },
      { name: "description", content: "Offline dərslər üçün davamiyyət qeydiyyatı və hesabatı." },
      { property: "og:title", content: "Davamiyyət · Baku Digital Lab" },
      { property: "og:description", content: "Offline dərslər üçün davamiyyət qeydiyyatı." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ProtectedRoute requireAdmin>
      <AttendancePage />
    </ProtectedRoute>
  ),
});

type Lesson = {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  teacher_user_id: string | null;
  teacher_last_name: string | null;
  teacher_first_name: string | null;
  teacher_patronymic: string | null;
  exam_dates: string[] | null;
  created_by: string | null;
  created_at: string;
};

type Participant = {
  id: string;
  lesson_id: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  patronymic: string | null;
};

type Record = {
  id: string;
  lesson_id: string;
  participant_id: string;
  attendance_date: string;
  present: boolean;
};

type Profile = { id: string; employee_id: string; full_name: string; email: string };

const pad = (n: number) => n.toString().padStart(2, "0");
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const formatShort = (iso: string) => {
  const [y, m, d] = iso.split("-");
  const months = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];
  return `${d} ${months[Number(m) - 1]}`;
};
const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};

function generateDates(start: string, end: string): string[] {
  const arr: string[] = [];
  const s = new Date(start); const e = new Date(end);
  const d = new Date(s);
  while (d <= e) { arr.push(isoDate(d)); d.setDate(d.getDate() + 1); }
  return arr;
}

function participantName(p: Participant): string {
  return [p.last_name, p.first_name, p.patronymic].filter(Boolean).join(" ") || "—";
}

function AttendancePage() {
  const { isSuperAdmin, user } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [openLesson, setOpenLesson] = useState<Lesson | null>(null);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<{ from: string; to: string }>({ from: "", to: "" });

  // Maddə 54: axtarış və tarix aralığı (dərsin tarixləri aralıqla kəsişirsə göstərilir).
  const visibleLessons = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lessons.filter((l) => {
      if (q && !l.title.toLowerCase().includes(q)) return false;
      if (range.from && l.end_date < range.from) return false;
      if (range.to && l.start_date > range.to) return false;
      return true;
    });
  }, [lessons, search, range]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("attendance_lessons").select("*").order("created_at", { ascending: false });
    const list = (data as Lesson[]) ?? [];
    setLessons(list);
    const ids = Array.from(new Set(list.map((l) => l.created_by).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,employee_id,full_name,email").in("id", ids);
      const m = new Map<string, Profile>();
      (profs ?? []).forEach((p) => m.set(p.id, p as Profile));
      setProfiles(m);
    }
    // Load participant counts per lesson
    if (list.length) {
      const { data: parts } = await supabase
        .from("attendance_lesson_participants").select("lesson_id").in("lesson_id", list.map((l) => l.id));
      const c = new Map<string, number>();
      (parts ?? []).forEach((p: { lesson_id: string }) => c.set(p.lesson_id, (c.get(p.lesson_id) ?? 0) + 1));
      setCounts(c);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const remove = async (l: Lesson) => {
    if (!confirm(`"${l.title}" dərsini silmək istəyirsiniz?`)) return;
    const { error } = await supabase.from("attendance_lessons").delete().eq("id", l.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Silindi");
    load();
  };

  if (openLesson) {
    return <LessonDetail lesson={openLesson} onBack={() => { setOpenLesson(null); load(); }} />;
  }

  return (
    <div className="bento-page space-y-6">
      <PageHeader
        title="Davamiyyət"
        description="Offline dərslər üzrə iştirak qeydiyyatı."
        actions={
          <>
            {isSuperAdmin && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setCreatorOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Yeni dərs
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard icon={CalendarCheck} label="Offline dərslər" value={lessons.length} />
        <StatCard
          icon={Users}
          label="İştirak qeydiyyatları"
          value={Array.from(counts.values()).reduce((sum, count) => sum + count, 0)}
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Dərs adı üzrə axtar..."
            aria-label="Dərs adı üzrə axtar"
            className="pl-9"
          />
        </div>
        <div className="w-full sm:w-72">
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </div>
      <TableCard>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : visibleLessons.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <CalendarCheck className="h-12 w-12 mx-auto mb-3 opacity-40" />
            {lessons.length === 0 ? "Hələ dərs yoxdur." : "Nəticə tapılmadı."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dərs adı</TableHead>
                  <TableHead>Tarix aralığı</TableHead>
                  <TableHead className="text-center">İştirakçı sayı</TableHead>
                  <TableHead>Yaradan</TableHead>
                  <TableHead>Yaradılıb</TableHead>
                  <TableHead className="text-right">Əməliyyat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleLessons.map((l) => (
                  <TableRow key={l.id} className="cursor-pointer" onClick={() => setOpenLesson(l)}>
                    <TableCell className="font-medium">{l.title}</TableCell>
                    <TableCell>{formatDate(l.start_date)} — {formatDate(l.end_date)}</TableCell>
                    <TableCell className="text-center">{counts.get(l.id) ?? 0}</TableCell>
                    <TableCell>{profiles.get(l.created_by ?? "")?.full_name ?? "-"}</TableCell>
                    <TableCell>{formatDate(l.created_at.slice(0, 10))}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <RowActions
                        subject={l.title}
                        extra={
                          <Button variant="ghost" size="sm" onClick={() => setOpenLesson(l)}>
                            Aç
                          </Button>
                        }
                        edit={{
                          onClick: () => {
                            setEditing(l);
                            setCreatorOpen(true);
                          },
                        }}
                        remove={isSuperAdmin ? { onClick: () => remove(l) } : undefined}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TableCard>

      {creatorOpen && (
        <LessonEditor
          lesson={editing}
          userId={user?.id ?? null}
          onClose={() => setCreatorOpen(false)}
          onSaved={() => { setCreatorOpen(false); load(); }}
        />
      )}
    </div>
  );
}

function LessonEditor({
  lesson, userId, onClose, onSaved,
}: { lesson: Lesson | null; userId: string | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [description, setDescription] = useState(lesson?.description ?? "");
  const [startDate, setStartDate] = useState(lesson?.start_date ?? isoDate(new Date()));
  const [endDate, setEndDate] = useState(lesson?.end_date ?? isoDate(new Date()));
  const [teacherMode, setTeacherMode] = useState<"lms" | "manual">(lesson?.teacher_user_id ? "lms" : "manual");
  const [teacherUserId, setTeacherUserId] = useState<string | null>(lesson?.teacher_user_id ?? null);
  const [tLast, setTLast] = useState(lesson?.teacher_last_name ?? "");
  const [tFirst, setTFirst] = useState(lesson?.teacher_first_name ?? "");
  const [tPat, setTPat] = useState(lesson?.teacher_patronymic ?? "");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [teacherResults, setTeacherResults] = useState<Profile[]>([]);
  const [examDates, setExamDates] = useState<string[]>(lesson?.exam_dates ?? []);
  const [saving, setSaving] = useState(false);

  const allDates = useMemo(
    () => (startDate && endDate && new Date(endDate) >= new Date(startDate) ? generateDates(startDate, endDate) : []),
    [startDate, endDate],
  );

  useEffect(() => {
    const q = teacherSearch.trim();
    if (teacherMode !== "lms" || q.length < 2) { setTeacherResults([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,employee_id,full_name,email")
        .or(`full_name.ilike.%${q}%,employee_id.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(10);
      if (!cancelled) setTeacherResults((data as Profile[]) ?? []);
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [teacherSearch, teacherMode]);

  const toggleExamDate = (d: string) =>
    setExamDates((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const save = async () => {
    if (!title.trim()) { toast.error("Ad daxil edin"); return; }
    if (new Date(endDate) < new Date(startDate)) { toast.error("Son tarix başlanğıcdan əvvəl ola bilməz"); return; }
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      start_date: startDate,
      end_date: endDate,
      teacher_user_id: teacherMode === "lms" ? teacherUserId : null,
      teacher_last_name: teacherMode === "manual" ? (tLast.trim() || null) : null,
      teacher_first_name: teacherMode === "manual" ? (tFirst.trim() || null) : null,
      teacher_patronymic: teacherMode === "manual" ? (tPat.trim() || null) : null,
      exam_dates: examDates.filter((d) => allDates.includes(d)),
    };
    const { error } = lesson
      ? await supabase.from("attendance_lessons").update(payload).eq("id", lesson.id)
      : await supabase.from("attendance_lessons").insert({ ...payload, created_by: userId });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(lesson ? "Yeniləndi" : "Yaradıldı");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg w-full">
        <DialogHeader><DialogTitle>{lesson ? "Dərsi redaktə et" : "Yeni dərs"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Dərs adı *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Təsvir</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Başlanğıc tarixi *</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Son tarix *</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Müəllim</Label>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={teacherMode === "lms" ? "default" : "outline"} onClick={() => setTeacherMode("lms")}>LMS istifadəçisi</Button>
              <Button type="button" size="sm" variant={teacherMode === "manual" ? "default" : "outline"} onClick={() => setTeacherMode("manual")}>Əl ilə</Button>
            </div>
            {teacherMode === "lms" ? (
              <div className="space-y-2">
                <Input
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  placeholder="Ad, ID və ya e-mail üzrə axtar..."
                />
                {teacherUserId && (
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    Seçildi
                    <Button type="button" size="sm" variant="ghost" onClick={() => setTeacherUserId(null)}>Təmizlə</Button>
                  </div>
                )}
                {teacherResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
                    {teacherResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${teacherUserId === p.id ? "bg-muted" : ""}`}
                        onClick={() => { setTeacherUserId(p.id); setTeacherSearch(p.full_name); setTeacherResults([]); }}
                      >
                        {p.full_name} <span className="text-xs text-muted-foreground">· {p.employee_id}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <Input value={tLast} onChange={(e) => setTLast(e.target.value)} placeholder="Soyad" />
                <Input value={tFirst} onChange={(e) => setTFirst(e.target.value)} placeholder="Ad" />
                <Input value={tPat} onChange={(e) => setTPat(e.target.value)} placeholder="Ata adı" />
              </div>
            )}
          </div>

          {allDates.length > 0 && (
            <div className="space-y-2">
              <Label>İmtahan günləri</Label>
              <p className="text-xs text-muted-foreground">İmtahan olan günləri seç — cədvəldə və Excel-də yaşıl rənglə göstəriləcək.</p>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 rounded-md border">
                {allDates.map((d) => {
                  const on = examDates.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleExamDate(d)}
                      className={`px-2 py-1 rounded-md text-xs border transition-colors ${on ? "bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-400" : "hover:bg-muted"}`}
                    >
                      {formatShort(d)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Ləğv et</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Yadda saxla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LessonDetail({ lesson, onBack }: { lesson: Lesson; onBack: () => void }) {
  const dates = useMemo(() => generateDates(lesson.start_date, lesson.end_date), [lesson.start_date, lesson.end_date]);
  const examSet = useMemo(() => new Set(lesson.exam_dates ?? []), [lesson.exam_dates]);
  const isExamDate = (d: string) => examSet.has(d);
  const [teacherLabel, setTeacherLabel] = useState(
    [lesson.teacher_last_name, lesson.teacher_first_name, lesson.teacher_patronymic].filter(Boolean).join(" "),
  );

  useEffect(() => {
    if (!lesson.teacher_user_id) return;
    supabase.from("profiles").select("full_name").eq("id", lesson.teacher_user_id).maybeSingle()
      .then(({ data }) => { if (data) setTeacherLabel((data as { full_name: string }).full_name); });
  }, [lesson.teacher_user_id]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [records, setRecords] = useState<Map<string, boolean>>(new Map()); // key: `${participantId}|${date}`
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: parts }, { data: recs }] = await Promise.all([
      supabase.from("attendance_lesson_participants").select("*").eq("lesson_id", lesson.id),
      supabase.from("attendance_records").select("*").eq("lesson_id", lesson.id),
    ]);
    setParticipants(((parts as Participant[]) ?? []).sort((a, b) =>
      participantName(a).localeCompare(participantName(b))));
    const map = new Map<string, boolean>();
    ((recs as Record[]) ?? []).forEach((r) => map.set(`${r.participant_id}|${r.attendance_date}`, r.present));
    setRecords(map);
    setLoading(false);
  };
  useEffect(() => { load(); }, [lesson.id]);

  const toggle = async (participantId: string, date: string, present: boolean) => {
    const key = `${participantId}|${date}`;
    setRecords((prev) => { const n = new Map(prev); n.set(key, present); return n; });
    const { error } = await supabase.from("attendance_records").upsert(
      { lesson_id: lesson.id, participant_id: participantId, attendance_date: date, present },
      { onConflict: "participant_id,attendance_date" },
    );
    if (error) toast.error(error.message);
  };

  const removeParticipant = async (p: Participant) => {
    if (!confirm(`"${participantName(p)}" iştirakçısını silmək?`)) return;
    const { error } = await supabase.from("attendance_lesson_participants").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const stats = useMemo(() => {
    const totalCells = participants.length * dates.length;
    let present = 0;
    participants.forEach((p) => dates.forEach((d) => { if (records.get(`${p.id}|${d}`)) present++; }));
    const perParticipant = participants.map((p) => {
      const c = dates.reduce((s, d) => s + (records.get(`${p.id}|${d}`) ? 1 : 0), 0);
      return { p, count: c, pct: dates.length ? Math.round((c / dates.length) * 100) : 0 };
    });
    // Ekranda "Gəlmədi" yalnız keçmiş tarixlərdə göstərilir; statistikada da eyni qayda.
    const today = isoDate(new Date());
    const pastDates = dates.filter((d) => d < today);
    let absentPast = 0;
    participants.forEach((p) => pastDates.forEach((d) => { if (!records.get(`${p.id}|${d}`)) absentPast++; }));
    return {
      totalCells, present, absent: totalCells - present, absentPast,
      rate: totalCells ? Math.round((present / totalCells) * 100) : 0,
      perParticipant,
    };
  }, [participants, dates, records]);

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const infoRows: (string | number)[][] = [
      ["Dərs adı", lesson.title],
      ["Təsvir", lesson.description ?? ""],
      ["Müəllim", teacherLabel || "—"],
      ["Tarix aralığı", `${formatDate(lesson.start_date)} — ${formatDate(lesson.end_date)}`],
      ["İmtahan günləri", (lesson.exam_dates ?? []).map(formatDate).join(", ") || "—"],
      ["Export tarixi", formatDate(isoDate(new Date()))],
      ["Ümumi iştirakçı", participants.length],
      ["Dərs günləri", dates.length],
      ["Ümumi iştirak %", stats.rate],
    ];
    const infoWs = XLSX.utils.aoa_to_sheet(infoRows);
    infoWs["!cols"] = [{ wch: 22 }, { wch: 44 }];
    XLSX.utils.book_append_sheet(wb, infoWs, "Məlumat");

    const header = ["№", "İştirakçı", ...dates.map((d) => (isExamDate(d) ? `${formatShort(d)} (İmtahan)` : formatShort(d))), "Cəmi", "Faiz %"];
    const rows: (string | number)[][] = [header];
    participants.forEach((p, i) => {
      const rowCells: (string | number)[] = [i + 1, participantName(p)];
      let cnt = 0;
      dates.forEach((d) => { const on = records.get(`${p.id}|${d}`); if (on) cnt++; rowCells.push(on ? "✔" : ""); });
      rowCells.push(cnt, dates.length ? Math.round((cnt / dates.length) * 100) : 0);
      rows.push(rowCells);
    });
    const attWs = XLSX.utils.aoa_to_sheet(rows);
    attWs["!cols"] = [{ wch: 4 }, { wch: 32 }, ...dates.map(() => ({ wch: 8 })), { wch: 8 }, { wch: 8 }];
    // Freeze header row + first two columns
    (attWs as unknown as { "!freeze"?: unknown })["!freeze"] = { xSplit: 2, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, attWs, "Davamiyyət");

    XLSX.writeFile(wb, `davamiyyet_${lesson.title.replace(/[^a-zA-Z0-9]+/g, "_")}_${isoDate(new Date())}.xlsx`);
  };

  const todayIso = isoDate(new Date());

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Geri" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-display font-bold break-words">{lesson.title}</h1>
            <p className="text-sm text-muted-foreground">
              {formatDate(lesson.start_date)} — {formatDate(lesson.end_date)} · {dates.length} gün
              {teacherLabel && <> · Müəllim: {teacherLabel}</>}
            </p>
          </div>
        </div>
        <Button onClick={() => setAddOpen(true)}><UserPlus className="h-4 w-4 mr-2" />İştirakçı əlavə et</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard icon={Percent} label="İştirak %" value={`${stats.rate}%`} tone="success" />
        <StatCard icon={UserX} label="Gəlmədi (qeyd)" value={stats.absentPast} tone="error" />
        <StatCard icon={Users} label="İştirakçılar" value={participants.length} />
        <StatCard icon={CalendarDays} label="Dərs günləri" value={dates.length} />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-labelledby="att-table-title" className="min-w-0 rounded-2xl border border-border bg-card shadow-card">
          <h2 id="att-table-title" className="px-5 pt-5 font-display text-lg font-semibold">İştirakçılar üzrə davamiyyət</h2>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : participants.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
              Hələ iştirakçı yoxdur.
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 min-w-[220px] bg-card">İştirakçı</TableHead>
                    {dates.map((d) => (
                      <TableHead
                        key={d}
                        className={cn("text-center whitespace-nowrap", isExamDate(d) && "bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300")}
                        title={isExamDate(d) ? "İmtahan günü" : undefined}
                      >
                        {formatShort(d)}
                      </TableHead>
                    ))}
                    <TableHead className="text-center">Orta</TableHead>
                    <TableHead><span className="sr-only">Əməliyyat</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((p) => {
                    const c = dates.reduce((s, d) => s + (records.get(`${p.id}|${d}`) ? 1 : 0), 0);
                    const pct = dates.length ? Math.round((c / dates.length) * 100) : 0;
                    const name = participantName(p);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="sticky left-0 z-10 bg-card font-medium">
                          <span className="flex items-center gap-2">
                            <UserAvatar name={name} size="sm" />
                            <span className="min-w-0 flex-1 break-words">{name}</span>
                            {p.user_id && <StatusChip tone="gray" className="text-[10px]">LMS</StatusChip>}
                          </span>
                        </TableCell>
                        {dates.map((d) => {
                          const on = !!records.get(`${p.id}|${d}`);
                          const past = d < todayIso;
                          return (
                            <TableCell key={d} className={cn("text-center", isExamDate(d) && "bg-brand-25 dark:bg-brand-600/10")}>
                              <button
                                type="button"
                                aria-pressed={on}
                                aria-label={`${name}, ${formatShort(d)}: ${on ? "İştirak etdi" : past ? "Gəlmədi" : "Qeyd yoxdur"}`}
                                onClick={() => toggle(p.id, d, !on)}
                                className="rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/25"
                              >
                                <StatusChip tone={on ? "success" : past ? "error" : "gray"} className="cursor-pointer">
                                  {on ? "İştirak etdi" : past ? "Gəlmədi" : "—"}
                                </StatusChip>
                              </button>
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center font-semibold tabular-nums">{pct}%</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`${name}: iştirakçını sil`}
                            className="hover:bg-[var(--error-50)] hover:text-[var(--error-600)]"
                            onClick={() => removeParticipant(p)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <aside className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
          <section aria-labelledby="att-stats-title" className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 id="att-stats-title" className="mb-4 font-display text-base font-semibold">Davamiyyət statistikası</h2>
            <DonutChart
              ariaLabel={`İştirak etdi: ${stats.present}, Gəlmədi: ${stats.absentPast}`}
              centerValue={`${stats.rate}%`}
              centerLabel="ümumi iştirak"
              data={[
                { key: "present", label: "İştirak etdi", value: stats.present, color: "success" },
                { key: "absent", label: "Gəlmədi", value: stats.absentPast, color: "error" },
              ]}
            />
          </section>
          <section aria-labelledby="att-export-title" className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 id="att-export-title" className="font-display text-base font-semibold">Fayl ixracı</h2>
            <p className="mt-1 mb-4 text-sm text-muted-foreground">Davamiyyət siyahısını Excel formatında endirin.</p>
            <ExportButton format="excel" onExport={exportExcel} className="w-full">
              Excel ixrac
            </ExportButton>
          </section>
        </aside>
      </div>

      {addOpen && (
        <AddParticipantsDialog
          lessonId={lesson.id}
          existingUserIds={new Set(participants.map((p) => p.user_id).filter(Boolean) as string[])}
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); load(); }}
        />
      )}
    </div>
  );
}

function AddParticipantsDialog({
  lessonId, existingUserIds, onClose, onSaved,
}: { lessonId: string; existingUserIds: Set<string>; onClose: () => void; onSaved: () => void }) {
  const [tab, setTab] = useState<"lms" | "manual">("lms");
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // manual list
  const [manual, setManual] = useState<{ last_name: string; first_name: string; patronymic: string }[]>([
    { last_name: "", first_name: "", patronymic: "" },
  ]);

  useEffect(() => {
    supabase.from("profiles").select("id,employee_id,full_name,email").order("full_name").then(({ data }) => {
      setUsers(((data as Profile[]) ?? []).filter((u) => !existingUserIds.has(u.id)));
    });
  }, [existingUserIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      u.full_name.toLowerCase().includes(q) ||
      u.employee_id.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q));
  }, [users, search]);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => setSelected(new Set(filtered.map((u) => u.id)));
  const clearAll = () => setSelected(new Set());

  const save = async () => {
    setSaving(true);
    const rows: { lesson_id: string; user_id: string | null; first_name: string | null; last_name: string | null; patronymic: string | null }[] = [];
    if (tab === "lms") {
      selected.forEach((id) => {
        const u = users.find((x) => x.id === id);
        if (!u) return;
        // Split full_name into last/first
        const parts = u.full_name.trim().split(/\s+/);
        const last = parts[0] ?? null;
        const first = parts.slice(1).join(" ") || null;
        rows.push({ lesson_id: lessonId, user_id: id, last_name: last, first_name: first, patronymic: null });
      });
    } else {
      manual.filter((m) => m.last_name.trim() || m.first_name.trim()).forEach((m) => {
        rows.push({
          lesson_id: lessonId, user_id: null,
          last_name: m.last_name.trim() || null,
          first_name: m.first_name.trim() || null,
          patronymic: m.patronymic.trim() || null,
        });
      });
    }
    if (!rows.length) { toast.error("Ən azı bir iştirakçı seçin"); setSaving(false); return; }
    const { error } = await supabase.from("attendance_lesson_participants").insert(rows);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${rows.length} iştirakçı əlavə edildi`);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl w-full">
        <DialogHeader><DialogTitle>İştirakçı əlavə et</DialogTitle></DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "lms" | "manual")}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="lms">LMS istifadəçiləri</TabsTrigger>
            <TabsTrigger value="manual">Kənar iştirakçı</TabsTrigger>
          </TabsList>

          <TabsContent value="lms" className="space-y-3 mt-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Axtar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Button variant="outline" size="sm" onClick={selectAll}>Hamısı</Button>
              <Button variant="outline" size="sm" onClick={clearAll}>Təmizlə</Button>
            </div>
            <div className="max-h-[45vh] overflow-y-auto border rounded-md divide-y">
              {filtered.map((u) => (
                <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50">
                  <Checkbox checked={selected.has(u.id)} onCheckedChange={() => toggle(u.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{u.full_name}</div>
                    <div className="text-xs text-muted-foreground truncate">ID {u.employee_id} · {u.email}</div>
                  </div>
                </label>
              ))}
              {filtered.length === 0 && (<div className="p-6 text-center text-sm text-muted-foreground">Nəticə yoxdur.</div>)}
            </div>
            <div className="text-xs text-muted-foreground">Seçilib: {selected.size}</div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-3 mt-4">
            <div className="max-h-[45vh] overflow-y-auto space-y-2">
              {manual.map((m, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end p-2 border rounded-md">
                  <div className="space-y-1">
                    <Label className="text-xs">Soyadı</Label>
                    <Input value={m.last_name} onChange={(e) => setManual((arr) => arr.map((x, j) => j === i ? { ...x, last_name: e.target.value } : x))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Adı</Label>
                    <Input value={m.first_name} onChange={(e) => setManual((arr) => arr.map((x, j) => j === i ? { ...x, first_name: e.target.value } : x))} />
                  </div>
                  <div className="flex gap-1">
                    <div className="space-y-1 flex-1">
                      <Label className="text-xs">Ata adı</Label>
                      <Input value={m.patronymic} onChange={(e) => setManual((arr) => arr.map((x, j) => j === i ? { ...x, patronymic: e.target.value } : x))} />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setManual((arr) => arr.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => setManual((arr) => [...arr, { last_name: "", first_name: "", patronymic: "" }])}>
              <Plus className="h-4 w-4 mr-2" />Sətir əlavə et
            </Button>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Ləğv et</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Əlavə et
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
