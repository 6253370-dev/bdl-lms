import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Pencil,
  Clock,
  Users as UsersIcon,
  MapPin,
  Play,
  Check,
  X,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { azDateLong, azDayMonthShort, azMonthYear, azTime, azWeekdayShort } from "@/lib/az-date";
import { PageHeader } from "@/components/design/PageHeader";

export const Route = createFileRoute("/calendar")({
  head: () => ({ meta: [
    { title: "Təqvim | Baku Digital Lab" },
    { name: "description", content: "Kurs, imtahan və dərs dəvətlərinizin təqvimi." },
    { property: "og:title", content: "Təqvim | Baku Digital Lab" },
    { property: "og:description", content: "Kurs, imtahan və dərs dəvətlərinizin təqvimi." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <ProtectedRoute>
      <CalendarPage />
    </ProtectedRoute>
  ),
});

type ViewMode = "month" | "week" | "day";

type ExamLite = { id: string; title: string };
type CourseLite = { id: string; title: string };
type OfflineLessonLite = { id: string; title: string; start_date: string; end_date: string };
type EventType = "exam" | "online_course" | "offline_course";
const EVENT_TYPE_LABEL: Record<EventType, string> = {
  exam: "Müstəqil imtahan",
  online_course: "Online kurs",
  offline_course: "Offline kurs",
};
/** Növ rəngləri (maddə 46): yalnız brand tonları və boz; yaşıl/qırmızı/kəhrəba status üçündür. */
const EVENT_TYPE_STYLE: Record<EventType, { chip: string; block: string; dot: string }> = {
  exam: {
    chip: "bg-brand-600 text-white hover:bg-brand-700",
    block: "bg-brand-600 text-white",
    dot: "bg-brand-600",
  },
  online_course: {
    chip: "bg-brand-100 text-brand-800 hover:bg-brand-200 dark:bg-brand-600/30 dark:text-brand-100",
    block: "bg-brand-100 text-brand-800 dark:bg-brand-600/40 dark:text-brand-50",
    dot: "bg-brand-300",
  },
  offline_course: {
    chip: "border border-border bg-muted text-foreground hover:bg-[var(--gray-200)] dark:hover:bg-[var(--gray-700)]",
    block: "border border-border bg-muted text-foreground",
    dot: "bg-[var(--gray-400)]",
  },
};
const EVENT_SELECT =
  "id,event_type,exam_id,course_id,attendance_lesson_id,notes,title,description,location,starts_at,ends_at,exam:standalone_exams(title),course:courses(title),offline_lesson:attendance_lessons(title),invitees:exam_event_invitees(id,user_id,status)";
type ProfileLite = { id: string; full_name: string; employee_id: string };
type Invitee = { id: string; user_id: string; status: string; full_name?: string; employee_id?: string };
type EventRow = {
  id: string;
  event_type: EventType;
  exam_id: string | null;
  course_id: string | null;
  attendance_lesson_id: string | null;
  notes: string | null;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  exam?: { title: string } | null;
  course?: { title: string } | null;
  offline_lesson?: { title: string } | null;
  invitees?: Invitee[];
};

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7..20

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // Monday=0
  x.setDate(x.getDate() - day);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function addMonths(d: Date, n: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmtTime(d: Date) {
  return azTime(d);
}
function fmtDate(d: Date) {
  return azDateLong(d);
}
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function eventStatus(ev: EventRow): "upcoming" | "ongoing" | "completed" {
  const now = Date.now();
  const s = new Date(ev.starts_at).getTime();
  const e = new Date(ev.ends_at).getTime();
  if (now < s) return "upcoming";
  if (now > e) return "completed";
  return "ongoing";
}

function icsDate(d: Date) {
  return `${d.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function escapeIcs(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function downloadIcs(ev: EventRow) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Baku Digital Lab LMS//AZ",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ev.id}@lms`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(new Date(ev.starts_at))}`,
    `DTEND:${icsDate(new Date(ev.ends_at))}`,
    `SUMMARY:${escapeIcs(ev.title)}`,
    ev.location ? `LOCATION:${escapeIcs(ev.location)}` : "",
    ev.description ? `DESCRIPTION:${escapeIcs(ev.description)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${ev.title.replace(/[^\p{L}\p{N}]+/gu, "_")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

const rsvpLabel: Record<string, string> = {
  invited: "Cavab gözlənilir",
  accepted: "Qəbul edildi",
  declined: "İmtina edildi",
};

function CalendarPage() {
  const { isAdmin, user } = useAuth();
  const [view, setView] = useState<ViewMode>("week");
  const [cursor, setCursor] = useState<Date>(startOfDay(new Date()));
  const [events, setEvents] = useState<EventRow[]>([]);
  const [exams, setExams] = useState<ExamLite[]>([]);
  const [courses, setCourses] = useState<CourseLite[]>([]);
  const [offlineLessons, setOfflineLessons] = useState<OfflineLessonLite[]>([]);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState<EventRow | null>(null);
  const [details, setDetails] = useState<EventRow | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | EventType>("all");
  const [todayEvents, setTodayEvents] = useState<EventRow[]>([]);

  const range = useMemo(() => {
    if (view === "month") {
      const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      return { from: addDays(startOfWeek(start), 0), to: addDays(end, 14) };
    }
    if (view === "week") {
      const from = startOfWeek(cursor);
      return { from, to: addDays(from, 7) };
    }
    return { from: startOfDay(cursor), to: addDays(cursor, 1) };
  }, [view, cursor]);

  const load = async () => {
    const dayStart = startOfDay(new Date());
    const [{ data }, { data: today }] = await Promise.all([
      supabase
        .from("exam_events")
        .select(EVENT_SELECT)
        .gte("starts_at", range.from.toISOString())
        .lt("starts_at", range.to.toISOString())
        .order("starts_at"),
      // "Bu gün" paneli (maddə 47) görünən aralıqdan asılı olmasın deyə bugünkü hadisələr ayrıca oxunur.
      supabase
        .from("exam_events")
        .select(EVENT_SELECT)
        .gte("starts_at", dayStart.toISOString())
        .lt("starts_at", addDays(dayStart, 1).toISOString())
        .order("starts_at"),
    ]);
    setTodayEvents((today ?? []) as unknown as EventRow[]);
    let rows = (data ?? []) as unknown as EventRow[];

    // For non-admins, the SELECT policy already filters; but enrich invitee names for admin
    if (isAdmin && rows.length) {
      const userIds = Array.from(new Set(rows.flatMap((r) => (r.invitees ?? []).map((i) => i.user_id))));
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,full_name,employee_id")
          .in("id", userIds);
        const map = new Map((profs ?? []).map((p) => [p.id, p]));
        rows = rows.map((r) => ({
          ...r,
          invitees: (r.invitees ?? []).map((i) => ({
            ...i,
            full_name: map.get(i.user_id)?.full_name,
            employee_id: map.get(i.user_id)?.employee_id,
          })),
        }));
      }
    }
    setEvents(rows);
  };

  const myInvite = (ev: EventRow) => (ev.invitees ?? []).find((i) => i.user_id === user?.id) ?? null;

  const respond = async (ev: EventRow, status: "accepted" | "declined") => {
    const inv = myInvite(ev);
    if (!inv) return;
    const { error } = await supabase
      .from("exam_event_invitees")
      .update({ status })
      .eq("id", inv.id);
    if (error) { toast.error(error.message); return; }
    const updated: EventRow = {
      ...ev,
      invitees: (ev.invitees ?? []).map((i) => (i.id === inv.id ? { ...i, status } : i)),
    };
    setDetails(updated);
    setEvents((prev) => prev.map((e) => (e.id === ev.id ? updated : e)));
    toast.success(status === "accepted" ? "Dəvət qəbul edildi" : "Dəvətdən imtina edildi");
  };



  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, cursor.getTime(), isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([
      supabase.from("standalone_exams").select("id,title").eq("is_published", true).order("title"),
      supabase.from("profiles").select("id,full_name,employee_id").order("full_name"),
      supabase.from("courses").select("id,title").order("title"),
      supabase.from("attendance_lessons").select("id,title,start_date,end_date").order("start_date", { ascending: false }),
    ]).then(([e, p, c, l]) => {
      setExams((e.data ?? []) as ExamLite[]);
      setProfiles((p.data ?? []) as ProfileLite[]);
      setCourses((c.data ?? []) as CourseLite[]);
      setOfflineLessons((l.data ?? []) as OfflineLessonLite[]);
    });
  }, [isAdmin]);

  const openCreate = (preset?: Date) => {
    const start = preset ?? new Date();
    if (preset) start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);
    setActiveEvent({
      id: "",
      event_type: "exam",
      exam_id: null,
      course_id: null,
      attendance_lesson_id: null,
      notes: null,
      title: "",
      description: "",
      location: "",
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      invitees: [],
    });
    setEditorOpen(true);
  };

  const openEdit = (ev: EventRow) => {
    setActiveEvent({ ...ev });
    setEditorOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu hadisəni silmək istədiyinizə əminsiniz?")) return;
    const { error } = await supabase.from("exam_events").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Hadisə silindi");
    setDetails(null);
    load();
  };

  const visibleEvents = useMemo(
    () => (typeFilter === "all" ? events : events.filter((e) => e.event_type === typeFilter)),
    [events, typeFilter],
  );
  const visibleToday = useMemo(
    () => (typeFilter === "all" ? todayEvents : todayEvents.filter((e) => e.event_type === typeFilter)),
    [todayEvents, typeFilter],
  );

  const navTitle = useMemo(() => {
    if (view === "month") return azMonthYear(cursor);
    if (view === "week") {
      const s = startOfWeek(cursor);
      const e = addDays(s, 6);
      return `${azDayMonthShort(s)} – ${azDayMonthShort(e)} ${e.getFullYear()}`;
    }
    return fmtDate(cursor);
  }, [view, cursor]);

  const navigate = (dir: -1 | 1) => {
    if (view === "month") setCursor(addMonths(cursor, dir));
    else if (view === "week") setCursor(addDays(cursor, dir * 7));
    else setCursor(addDays(cursor, dir));
  };

  // Drag & drop handlers (admin only)
  const handleDropOnDate = async (target: Date, eventId: string, hour?: number) => {
    if (!isAdmin) return;
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;
    const oldStart = new Date(ev.starts_at);
    const oldEnd = new Date(ev.ends_at);
    const duration = oldEnd.getTime() - oldStart.getTime();
    const newStart = new Date(target);
    if (hour !== undefined) newStart.setHours(hour, 0, 0, 0);
    else newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);
    const newEnd = new Date(newStart.getTime() + duration);
    const { error } = await supabase
      .from("exam_events")
      .update({ starts_at: newStart.toISOString(), ends_at: newEnd.toISOString() })
      .eq("id", eventId);
    if (error) return toast.error(error.message);
    toast.success("Hadisə köçürüldü");
    load();
  };

  return (
    <div className="bento-page">
      <PageHeader
        title="Təqvim"
        description="İmtahan tədbirlərini planlaşdır və idarə et."
        actions={
          <>
            {isAdmin && (
              <Button onClick={() => openCreate()}>
                <Plus className="h-4 w-4" /> Yeni hadisə
              </Button>
            )}
          </>
        }
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-card [&>[data-slot=card]]:rounded-none [&>[data-slot=card]]:border-0 [&>[data-slot=card]]:shadow-none">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-[10rem] font-display text-lg font-bold capitalize sm:text-xl">{navTitle}</h2>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" aria-label="Əvvəlki" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" aria-label="Növbəti" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCursor(startOfDay(new Date()))}>
            Bu gün
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as "all" | EventType)}>
            <SelectTrigger className="h-9 w-44" aria-label="Tədbir növü">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün tədbirlər</SelectItem>
              {(Object.keys(EVENT_TYPE_LABEL) as EventType[]).map((k) => (
                <SelectItem key={k} value={k}>{EVENT_TYPE_LABEL[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="inline-flex rounded-full border border-border bg-background p-0.5" role="group" aria-label="Görünüş">
            {(["day", "week", "month"] as ViewMode[]).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/25",
                  view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v === "day" ? "Gün" : v === "week" ? "Həftə" : "Ay"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "month" && (
        <MonthView
          cursor={cursor}
          events={visibleEvents}
          isAdmin={isAdmin}
          onSelectDay={(d) => isAdmin && openCreate(d)}
          onSelectEvent={(e) => setDetails(e)}
          onDropEvent={handleDropOnDate}
        />
      )}
      {view === "week" && (
        <TimeView
          days={Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i))}
          events={visibleEvents}
          isAdmin={isAdmin}
          onSelectSlot={(d) => isAdmin && openCreate(d)}
          onSelectEvent={(e) => setDetails(e)}
          onDropEvent={handleDropOnDate}
        />
      )}
      {view === "day" && (
        <TimeView
          days={[startOfDay(cursor)]}
          events={visibleEvents}
          isAdmin={isAdmin}
          onSelectSlot={(d) => isAdmin && openCreate(d)}
          onSelectEvent={(e) => setDetails(e)}
          onDropEvent={handleDropOnDate}
        />
      )}

      <ul className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border px-4 py-3 text-sm text-muted-foreground" aria-label="Növlər">
        {(Object.keys(EVENT_TYPE_LABEL) as EventType[]).map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-full", EVENT_TYPE_STYLE[k].dot)} />
            {EVENT_TYPE_LABEL[k]}
          </li>
        ))}
      </ul>
      </div>

      <aside className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-1">
        <section aria-labelledby="today-title" className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="today-title" className="font-display text-lg font-bold">Bu gün</h2>
            <span className="text-sm text-muted-foreground tabular-nums">{fmtDate(new Date())}</span>
          </div>
          {visibleToday.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bu gün üçün hadisə yoxdur.</p>
          ) : (
            <ol className="relative space-y-1 before:absolute before:bottom-3 before:left-[5px] before:top-3 before:w-px before:bg-border">
              {visibleToday.map((ev) => {
                const s = new Date(ev.starts_at);
                const e = new Date(ev.ends_at);
                return (
                  <li key={ev.id} className="relative pl-6">
                    <span aria-hidden="true" className={cn("absolute left-0 top-3 h-[11px] w-[11px] rounded-full ring-2 ring-card", EVENT_TYPE_STYLE[ev.event_type].dot)} />
                    <button
                      type="button"
                      onClick={() => setDetails(ev)}
                      className="flex w-full items-start gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/25"
                    >
                      <span className="shrink-0 whitespace-nowrap text-sm font-medium tabular-nums">{fmtTime(s)} – {fmtTime(e)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold break-words">{ev.title}</span>
                        <span className="block text-xs text-muted-foreground">{EVENT_TYPE_LABEL[ev.event_type]}</span>
                        {ev.location && (
                          <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span className="min-w-0 break-words">{ev.location}</span>
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section aria-labelledby="agenda-title" className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 id="agenda-title" className="mb-2 font-display text-lg font-bold">Dəvətlər və hadisələr</h2>
          {visibleEvents.filter((event) => eventStatus(event) !== 'completed').slice(0, 8).map((event) => (
            <div key={event.id} className="border-b border-border py-3 last:border-0">
              <button
                type="button"
                className="flex w-full items-start gap-2 rounded-md text-left text-sm font-semibold hover:text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/25"
                onClick={() => setDetails(event)}
              >
                <span aria-hidden="true" className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", EVENT_TYPE_STYLE[event.event_type].dot)} />
                <span className="min-w-0 break-words">{event.title}</span>
              </button>
              <p className="ml-[1.125rem] mt-1 text-xs text-muted-foreground tabular-nums">
                {fmtDate(new Date(event.starts_at))} · {fmtTime(new Date(event.starts_at))} · {EVENT_TYPE_LABEL[event.event_type]}
              </p>
              {myInvite(event)?.status === 'invited' && (
                <div className="ml-[1.125rem] mt-3 flex gap-2">
                  <Button size="sm" onClick={() => respond(event, 'accepted')}><Check className="h-3 w-3" />Qəbul</Button>
                  <Button size="sm" variant="outline" onClick={() => respond(event, 'declined')}><X className="h-3 w-3" />İmtina</Button>
                </div>
              )}
            </div>
          ))}
          {!visibleEvents.some((event) => eventStatus(event) !== 'completed') && <p className="text-sm text-muted-foreground">Gələcək hadisə yoxdur.</p>}
        </section>
      </aside>
      </div>
      {/* Details dialog */}
      <Dialog open={!!details} onOpenChange={(o) => !o && setDetails(null)}>
        <DialogContent className="max-w-lg">
          {details && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{details.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {fmtDate(new Date(details.starts_at))} · {fmtTime(new Date(details.starts_at))} – {fmtTime(new Date(details.ends_at))}
                </div>
                {details.location && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" /> {details.location}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{EVENT_TYPE_LABEL[details.event_type] ?? "Hadisə"}</Badge>
                  {details.event_type === "exam" && details.exam?.title && (
                    <span className="font-medium">{details.exam.title}</span>
                  )}
                  {details.event_type === "online_course" && details.course?.title && (
                    <span className="font-medium">{details.course.title}</span>
                  )}
                  {details.event_type === "offline_course" && details.offline_lesson?.title && (
                    <span className="font-medium">{details.offline_lesson.title}</span>
                  )}
                </div>
                {details.notes && (
                  <div className="rounded-md bg-muted/50 p-3 text-xs whitespace-pre-wrap">
                    <div className="font-medium mb-1">Əlavə qeydlər</div>
                    {details.notes}
                  </div>
                )}
                {details.description && <p className="whitespace-pre-wrap">{details.description}</p>}
                <div>
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <UsersIcon className="h-3.5 w-3.5" /> İştirakçılar ({details.invitees?.length ?? 0})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(details.invitees ?? []).map((i) => (
                      <Badge
                        key={i.id}
                        variant={i.status === "accepted" ? "default" : i.status === "declined" ? "destructive" : "outline"}
                        className="text-xs"
                      >
                        {i.full_name ?? i.user_id.slice(0, 6)}
                        {i.user_id === user?.id && " (sən)"}
                        {` · ${rsvpLabel[i.status] ?? i.status}`}
                      </Badge>
                    ))}
                    {!(details.invitees ?? []).length && (
                      <span className="text-xs text-muted-foreground">Yoxdur</span>
                    )}
                  </div>
                </div>
                {myInvite(details) && eventStatus(details) !== "completed" && (
                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="text-xs text-muted-foreground">Dəvətə cavab</div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={myInvite(details)?.status === "accepted" ? "default" : "outline"}
                        onClick={() => respond(details, "accepted")}
                      >
                        <Check className="h-4 w-4" /> Qəbul edirəm
                      </Button>
                      <Button
                        size="sm"
                        variant={myInvite(details)?.status === "declined" ? "destructive" : "outline"}
                        onClick={() => respond(details, "declined")}
                      >
                        <X className="h-4 w-4" /> İmtina
                      </Button>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Badge>{statusLabel(eventStatus(details))}</Badge>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => downloadIcs(details)}>
                    <Download className="h-4 w-4" /> Təqvimə əlavə et
                  </Button>
                  {isAdmin && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => { setDetails(null); openEdit(details); }}>
                        <Pencil className="h-4 w-4" /> Redaktə
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(details.id)}>
                        <Trash2 className="h-4 w-4" /> Sil
                      </Button>
                    </>
                  )}
                </div>
                {eventStatus(details) !== "completed" && details.event_type === "exam" && details.exam_id && (
                  <Button asChild size="sm">
                    <Link to="/exams" search={{ exam: details.exam_id }}>
                      <Play className="h-4 w-4" /> İmtahana keç
                    </Link>
                  </Button>
                )}
                {eventStatus(details) !== "completed" && details.event_type === "online_course" && details.course_id && (
                  <Button asChild size="sm">
                    <Link to="/courses/$courseId" params={{ courseId: details.course_id }}>
                      <Play className="h-4 w-4" /> Kursa keç
                    </Link>
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Editor dialog */}
      {isAdmin && (
        <EditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          event={activeEvent}
          exams={exams}
          courses={courses}
          offlineLessons={offlineLessons}
          profiles={profiles}
          onSaved={() => { setEditorOpen(false); setActiveEvent(null); load(); }}
        />
      )}
    </div>
  );
}

function statusLabel(s: ReturnType<typeof eventStatus>) {
  if (s === "upcoming") return "Gələcək";
  if (s === "ongoing") return "Davam edir";
  return "Tamamlandı";
}

/* ------------------------- Month View ------------------------- */
function MonthView({
  cursor, events, isAdmin, onSelectDay, onSelectEvent, onDropEvent,
}: {
  cursor: Date;
  events: EventRow[];
  isAdmin: boolean;
  onSelectDay: (d: Date) => void;
  onSelectEvent: (e: EventRow) => void;
  onDropEvent: (target: Date, eventId: string) => void;
}) {
  const start = startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const today = new Date();
  const weekdays = ["B.e", "Ç.a", "Ç", "C.a", "C", "Ş", "B"];

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
        {weekdays.map((w) => (
          <div key={w} className="px-3 py-2 text-center">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {days.map((d, idx) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const dayEvents = events.filter((e) => sameDay(new Date(e.starts_at), d));
          return (
            <div
              key={idx}
              onClick={() => onSelectDay(d)}
              onDragOver={(e) => { if (isAdmin) e.preventDefault(); }}
              onDrop={(e) => {
                const id = e.dataTransfer.getData("text/event-id");
                if (id) onDropEvent(d, id);
              }}
              className={cn(
                "min-h-[110px] p-1.5 border-b border-r text-sm cursor-pointer hover:bg-muted/30 transition",
                !inMonth && "bg-muted/10 text-muted-foreground",
                (idx + 1) % 7 === 0 && "border-r-0",
              )}
            >
              <div className={cn(
                "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                sameDay(d, today) && "bg-primary text-primary-foreground",
              )}>
                {d.getDate()}
              </div>
              <div className="mt-1 space-y-1">
                {dayEvents.slice(0, 3).map((ev) => (
                  <div
                    key={ev.id}
                    draggable={isAdmin}
                    onDragStart={(e) => e.dataTransfer.setData("text/event-id", ev.id)}
                    onClick={(e) => { e.stopPropagation(); onSelectEvent(ev); }}
                    className={cn("text-xs truncate px-1.5 py-1 rounded-md cursor-pointer transition-colors", EVENT_TYPE_STYLE[ev.event_type].chip)}
                  >
                    <span className="font-medium">{fmtTime(new Date(ev.starts_at))}</span>{" "}
                    {ev.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-muted-foreground px-1.5">+{dayEvents.length - 3} daha</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ------------------------- Week / Day View ------------------------- */
function TimeView({
  days, events, isAdmin, onSelectSlot, onSelectEvent, onDropEvent,
}: {
  days: Date[];
  events: EventRow[];
  isAdmin: boolean;
  onSelectSlot: (d: Date) => void;
  onSelectEvent: (e: EventRow) => void;
  onDropEvent: (target: Date, eventId: string, hour?: number) => void;
}) {
  const today = new Date();
  return (
    <Card className="overflow-hidden">
      <div className="grid border-b bg-muted/40" style={{ gridTemplateColumns: `64px repeat(${days.length}, 1fr)` }}>
        <div />
        {days.map((d) => (
          <div key={d.toISOString()} className="px-3 py-2 text-center text-sm">
            <div className="text-xs text-muted-foreground">
              {azWeekdayShort(d)}
            </div>
            <div className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full font-medium",
              sameDay(d, today) && "bg-primary text-primary-foreground",
            )}>
              {d.getDate()}
            </div>
          </div>
        ))}
      </div>
      <div className="overflow-y-auto max-h-[70vh]">
        <div className="grid" style={{ gridTemplateColumns: `64px repeat(${days.length}, 1fr)` }}>
          {HOURS.map((h) => (
            <Fragment key={`row-${h}`}>
              <div className="text-xs text-muted-foreground px-2 py-1 border-b text-right -mt-2">
                {String(h).padStart(2, "0")}:00
              </div>
              {days.map((d) => {
                const slot = new Date(d); slot.setHours(h, 0, 0, 0);
                const cellEvents = events.filter((e) => {
                  const s = new Date(e.starts_at);
                  return sameDay(s, d) && s.getHours() === h;
                });
                return (
                  <div
                    key={`c-${d.toISOString()}-${h}`}
                    onClick={() => onSelectSlot(slot)}
                    onDragOver={(e) => { if (isAdmin) e.preventDefault(); }}
                    onDrop={(e) => {
                      const id = e.dataTransfer.getData("text/event-id");
                      if (id) onDropEvent(d, id, h);
                    }}
                    className="relative border-b border-l h-14 hover:bg-muted/30 cursor-pointer transition"
                  >
                    {cellEvents.map((ev) => {
                      const s = new Date(ev.starts_at);
                      const e2 = new Date(ev.ends_at);
                      const minutes = Math.max(30, (e2.getTime() - s.getTime()) / 60000);
                      const height = (minutes / 60) * 56;
                      return (
                        <div
                          key={ev.id}
                          draggable={isAdmin}
                          onDragStart={(e) => e.dataTransfer.setData("text/event-id", ev.id)}
                          onClick={(e) => { e.stopPropagation(); onSelectEvent(ev); }}
                          style={{ height: `${height}px` }}
                          className={cn("absolute inset-x-1 top-0 z-10 rounded-md px-2 py-1 text-xs shadow-sm cursor-pointer overflow-hidden", EVENT_TYPE_STYLE[ev.event_type].block)}
                        >
                          <div className="font-medium truncate">{ev.title}</div>
                          <div className="opacity-80 truncate">
                            {fmtTime(s)} – {fmtTime(e2)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------- Editor ------------------------- */
function EditorDialog({
  open, onOpenChange, event, exams, courses, offlineLessons, profiles, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  event: EventRow | null;
  exams: ExamLite[];
  courses: CourseLite[];
  offlineLessons: OfflineLessonLite[];
  profiles: ProfileLite[];
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<EventType>("exam");
  const [examId, setExamId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [notes, setNotes] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!event) return;
    setTitle(event.title || "");
    setEventType(event.event_type ?? "exam");
    setExamId(event.exam_id || "");
    setCourseId(event.course_id || "");
    setLessonId(event.attendance_lesson_id || "");
    setNotes(event.notes || "");
    setDescription(event.description || "");
    setLocation(event.location || "");
    setStart(toLocalInput(new Date(event.starts_at)));
    setEnd(toLocalInput(new Date(event.ends_at)));
    setSelected(new Set((event.invitees ?? []).map((i) => i.user_id)));
    setSearch("");
  }, [event]);

  const filtered = profiles.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return p.full_name.toLowerCase().includes(q) || p.employee_id.toLowerCase().includes(q);
  });

  const toggle = (id: string) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  };

  const handleSave = async () => {
    if (!title.trim()) return toast.error("Başlıq tələb olunur");
    if (eventType === "exam" && !examId) return toast.error("İmtahan seçin");
    if (eventType === "online_course" && !courseId) return toast.error("Kurs seçin");
    if (eventType === "offline_course" && !lessonId) return toast.error("Offline kurs seçin");
    if (eventType === "offline_course" && !location.trim()) return toast.error("Offline kurs üçün məkan tələb olunur");
    if (!start || !end) return toast.error("Tarix/saat tələb olunur");
    const s = new Date(start);
    const e = new Date(end);
    if (e <= s) return toast.error("Bitmə vaxtı başlanğıcdan sonra olmalıdır");

    setSaving(true);
    try {
      let eventId: string = event?.id ?? "";
      const payload = {
        title: title.trim(),
        event_type: eventType,
        exam_id: eventType === "exam" ? examId : null,
        course_id: eventType === "online_course" ? courseId : null,
        attendance_lesson_id: eventType === "offline_course" ? lessonId : null,
        notes: notes.trim() || null,
        description: description.trim() || null,
        location: location.trim() || null,
        starts_at: s.toISOString(),
        ends_at: e.toISOString(),
      };

      if (eventId) {
        const { error } = await supabase.from("exam_events").update(payload).eq("id", eventId);
        if (error) throw error;
        // Sync invitees: delete removed, insert new
        const existing = new Set((event?.invitees ?? []).map((i) => i.user_id));
        const toAdd = Array.from(selected).filter((id) => !existing.has(id));
        const toRemove = Array.from(existing).filter((id) => !selected.has(id));
        if (toRemove.length) {
          await supabase.from("exam_event_invitees").delete().eq("event_id", eventId).in("user_id", toRemove);
        }
        if (toAdd.length) {
          await supabase.from("exam_event_invitees").insert(toAdd.map((uid) => ({ event_id: eventId, user_id: uid })));
        }
      } else {
        const { data, error } = await supabase
          .from("exam_events")
          .insert({ ...payload, created_by: user?.id })
          .select("id")
          .single();
        if (error) throw error;
        eventId = data.id;
        if (selected.size) {
          await supabase.from("exam_event_invitees").insert(Array.from(selected).map((uid) => ({ event_id: eventId, user_id: uid })));
        }
      }
      toast.success(event?.id ? "Hadisə yeniləndi" : "Hadisə yaradıldı və dəvətlər göndərildi");
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event?.id ? "Hadisəni redaktə et" : "Yeni hadisə"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Başlıq</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="məs: Q4 Təhlükəsizlik İmtahanı" />
          </div>
          <div>
            <Label>Hadisə növü</Label>
            <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="exam">Müstəqil imtahan</SelectItem>
                <SelectItem value="online_course">Online kurs</SelectItem>
                <SelectItem value="offline_course">Offline kurs</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {eventType === "exam" && (
            <div>
              <Label>İmtahan</Label>
              <Select value={examId} onValueChange={setExamId}>
                <SelectTrigger><SelectValue placeholder="İmtahan seç" /></SelectTrigger>
                <SelectContent>
                  {exams.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {eventType === "online_course" && (
            <div>
              <Label>Online kurs</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger><SelectValue placeholder="Kurs seç" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {eventType === "offline_course" && (
            <div>
              <Label>Offline kurs (Davamiyyət modulundan)</Label>
              <Select value={lessonId} onValueChange={setLessonId}>
                <SelectTrigger><SelectValue placeholder="Offline kurs seç" /></SelectTrigger>
                <SelectContent>
                  {offlineLessons.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Başlama</Label>
              <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label>Bitmə</Label>
              <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>{eventType === "offline_course" ? "Məkan" : "Yer (istəyə bağlı)"}</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Otaq, link və s." />
          </div>
          <div>
            <Label>Dəvət mesajı</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Əlavə qeydlər</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Özünlə gətir, iştirak qaydaları və s." />
          </div>
          <div>
            <Label>İştirakçılar ({selected.size})</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ad və ya əməkdaş ID üzrə axtar..."
              className="mt-1"
            />
            <div className="mt-2 max-h-56 overflow-y-auto border rounded-md divide-y">
              {filtered.map((p) => (
                <label key={p.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50">
                  <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{p.full_name}</div>
                    <div className="text-xs text-muted-foreground">ID {p.employee_id}</div>
                  </div>
                </label>
              ))}
              {!filtered.length && <div className="p-3 text-sm text-muted-foreground">Tapılmadı</div>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Ləğv et</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Yadda saxlanılır..." : "Yadda saxla"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
