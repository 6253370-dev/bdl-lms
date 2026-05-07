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
import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendar")({
  component: () => (
    <ProtectedRoute>
      <CalendarPage />
    </ProtectedRoute>
  ),
});

type ViewMode = "month" | "week" | "day";

type ExamLite = { id: string; title: string };
type ProfileLite = { id: string; full_name: string; employee_id: string };
type Invitee = { id: string; user_id: string; status: string; full_name?: string; employee_id?: string };
type EventRow = {
  id: string;
  exam_id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  exam?: { title: string } | null;
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
  return d.toLocaleTimeString("az-AZ", { hour: "2-digit", minute: "2-digit", hour12: false });
}
function fmtDate(d: Date) {
  return d.toLocaleDateString("az-AZ", { day: "2-digit", month: "long", year: "numeric" });
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

function CalendarPage() {
  const { isAdmin, user } = useAuth();
  const [view, setView] = useState<ViewMode>("week");
  const [cursor, setCursor] = useState<Date>(startOfDay(new Date()));
  const [events, setEvents] = useState<EventRow[]>([]);
  const [exams, setExams] = useState<ExamLite[]>([]);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState<EventRow | null>(null);
  const [details, setDetails] = useState<EventRow | null>(null);

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
    const { data } = await supabase
      .from("exam_events")
      .select("id,exam_id,title,description,location,starts_at,ends_at,exam:standalone_exams(title),invitees:exam_event_invitees(id,user_id,status)")
      .gte("starts_at", range.from.toISOString())
      .lt("starts_at", range.to.toISOString())
      .order("starts_at");
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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, cursor.getTime(), isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([
      supabase.from("standalone_exams").select("id,title").eq("is_published", true).order("title"),
      supabase.from("profiles").select("id,full_name,employee_id").order("full_name"),
    ]).then(([e, p]) => {
      setExams((e.data ?? []) as ExamLite[]);
      setProfiles((p.data ?? []) as ProfileLite[]);
    });
  }, [isAdmin]);

  const openCreate = (preset?: Date) => {
    const start = preset ?? new Date();
    if (preset) start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);
    setActiveEvent({
      id: "",
      exam_id: "",
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

  const navTitle = useMemo(() => {
    if (view === "month") return cursor.toLocaleDateString("az-AZ", { month: "long", year: "numeric" });
    if (view === "week") {
      const s = startOfWeek(cursor);
      const e = addDays(s, 6);
      return `${s.toLocaleDateString("az-AZ", { day: "2-digit", month: "short" })} – ${e.toLocaleDateString("az-AZ", { day: "2-digit", month: "short", year: "numeric" })}`;
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
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold mb-1 flex items-center gap-2">
            <CalendarIcon className="h-7 w-7 text-primary" /> Təqvim
          </h1>
          <p className="text-muted-foreground text-sm">İmtahan tədbirlərini planlaşdır və idarə et.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => openCreate()}>
            <Plus className="h-4 w-4" /> Yeni hadisə
          </Button>
        )}
      </div>

      {/* Toolbar */}
      <Card className="p-3 mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCursor(startOfDay(new Date()))}>
            Bu gün
          </Button>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="font-medium px-3 min-w-[200px] text-center capitalize">{navTitle}</div>
            <Button variant="ghost" size="icon" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="inline-flex rounded-md border bg-background p-0.5">
          {(["day", "week", "month"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-3 py-1.5 text-sm rounded",
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "day" ? "Gün" : v === "week" ? "Həftə" : "Ay"}
            </button>
          ))}
        </div>
      </Card>

      {view === "month" && (
        <MonthView
          cursor={cursor}
          events={events}
          isAdmin={isAdmin}
          onSelectDay={(d) => isAdmin && openCreate(d)}
          onSelectEvent={(e) => setDetails(e)}
          onDropEvent={handleDropOnDate}
        />
      )}
      {view === "week" && (
        <TimeView
          days={Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i))}
          events={events}
          isAdmin={isAdmin}
          onSelectSlot={(d) => isAdmin && openCreate(d)}
          onSelectEvent={(e) => setDetails(e)}
          onDropEvent={handleDropOnDate}
        />
      )}
      {view === "day" && (
        <TimeView
          days={[startOfDay(cursor)]}
          events={events}
          isAdmin={isAdmin}
          onSelectSlot={(d) => isAdmin && openCreate(d)}
          onSelectEvent={(e) => setDetails(e)}
          onDropEvent={handleDropOnDate}
        />
      )}

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
                {details.exam?.title && (
                  <div>
                    <Badge variant="secondary">İmtahan</Badge>{" "}
                    <span className="font-medium">{details.exam.title}</span>
                  </div>
                )}
                {details.description && <p className="whitespace-pre-wrap">{details.description}</p>}
                <div>
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <UsersIcon className="h-3.5 w-3.5" /> İştirakçılar ({details.invitees?.length ?? 0})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(details.invitees ?? []).map((i) => (
                      <Badge key={i.id} variant="outline" className="text-xs">
                        {i.full_name ?? i.user_id.slice(0, 6)}
                        {i.user_id === user?.id && " (sən)"}
                      </Badge>
                    ))}
                    {!(details.invitees ?? []).length && (
                      <span className="text-xs text-muted-foreground">Yoxdur</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{statusLabel(eventStatus(details))}</Badge>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                <div className="flex gap-2">
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
                {eventStatus(details) !== "completed" && details.exam_id && (
                  <Button asChild size="sm">
                    <Link to="/exams">
                      <Play className="h-4 w-4" /> İmtahana keç
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
                    className="text-xs truncate px-1.5 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
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
            <div className="text-xs text-muted-foreground uppercase">
              {d.toLocaleDateString("az-AZ", { weekday: "short" })}
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
            <FragmentRow key={`row-${h}`}>
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
                          className="absolute inset-x-1 top-0 z-10 rounded-md bg-primary text-primary-foreground px-2 py-1 text-xs shadow-sm cursor-pointer overflow-hidden"
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
            </FragmentRow>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------- Editor ------------------------- */
function EditorDialog({
  open, onOpenChange, event, exams, profiles, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  event: EventRow | null;
  exams: ExamLite[];
  profiles: ProfileLite[];
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [examId, setExamId] = useState("");
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
    setExamId(event.exam_id || "");
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
    if (!examId) return toast.error("İmtahan seçin");
    if (!start || !end) return toast.error("Tarix/saat tələb olunur");
    const s = new Date(start);
    const e = new Date(end);
    if (e <= s) return toast.error("Bitmə vaxtı başlanğıcdan sonra olmalıdır");

    setSaving(true);
    try {
      let eventId: string = event?.id ?? "";
      const payload = {
        title: title.trim(),
        exam_id: examId,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event?.id ? "Hadisəni redaktə et" : "Yeni imtahan hadisəsi"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Başlıq</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="məs: Q4 Təhlükəsizlik İmtahanı" />
          </div>
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
            <Label>Yer (istəyə bağlı)</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Otaq, link və s." />
          </div>
          <div>
            <Label>Dəvət mesajı</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
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
