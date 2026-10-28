import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Video,
  Plus,
  KeyRound,
  Radio,
  CalendarDays,
  Clock,
  Users,
  Trash2,
  Pencil,
  Eye,
  Ban,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/live-classes/")({
  head: () => ({ meta: [
    { title: "Canlı dərslər | Baku Digital Lab" },
    { name: "description", content: "Planlaşdırılmış və davam edən canlı təlimlər." },
    { property: "og:title", content: "Canlı dərslər | Baku Digital Lab" },
    { property: "og:description", content: "Planlaşdırılmış və davam edən canlı təlimlər." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <ProtectedRoute>
      <LiveClassesPage />
    </ProtectedRoute>
  ),
});

export type RoomStatus = "scheduled" | "live" | "ended" | "cancelled";

export interface LiveRoom {
  id: string;
  title: string;
  description: string | null;
  teacher_id: string;
  course_id: string | null;
  scheduled_date: string;
  scheduled_start_time: string;
  planned_duration: number;
  room_code: string;
  status: RoomStatus;
  audience: "all" | "course" | "selected";
  audience_course_id: string | null;
  started_at: string | null;
  ended_at: string | null;
}

interface PersonRow {
  id: string;
  full_name: string;
  employee_id: string;
}

const DURATIONS = [30, 45, 60, 90, 120];

export function statusBadge(status: RoomStatus) {
  if (status === "live")
    return (
      <Badge className="bg-destructive text-destructive-foreground gap-1">
        <Radio className="h-3 w-3" /> {t.live.liveNow}
      </Badge>
    );
  if (status === "scheduled") return <Badge variant="secondary">{t.live.scheduled}</Badge>;
  if (status === "ended") return <Badge variant="outline">{t.live.ended}</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">{t.live.cancelled}</Badge>;
}

export function roomStartDate(r: Pick<LiveRoom, "scheduled_date" | "scheduled_start_time">) {
  return new Date(`${r.scheduled_date}T${r.scheduled_start_time}`);
}

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

function fmtTime(v: string) {
  return v.slice(0, 5);
}

function Countdown({ target }: { target: Date }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, target.getTime() - now);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="font-mono tabular-nums">
      {pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}

function LiveClassesPage() {
  const { isAdmin, user, profile } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [teachers, setTeachers] = useState<PersonRow[]>([]);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | RoomStatus>("all");
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LiveRoom | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("live_rooms")
      .select(
        "id,title,description,teacher_id,course_id,scheduled_date,scheduled_start_time,planned_duration,room_code,status,audience,audience_course_id,started_at,ended_at",
      )
      .order("scheduled_date", { ascending: false })
      .order("scheduled_start_time", { ascending: false });
    const list = (data ?? []) as LiveRoom[];
    setRooms(list);

    if (list.length) {
      const { data: parts } = await supabase
        .from("live_room_participants")
        .select("room_id,status")
        .in(
          "room_id",
          list.map((r) => r.id),
        );
      const c: Record<string, number> = {};
      for (const p of parts ?? []) {
        if ((p as { status: string }).status === "joined")
          c[p.room_id] = (c[p.room_id] ?? 0) + 1;
      }
      setCounts(c);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("live-rooms-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_rooms" }, () => load())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_room_participants" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const [{ data: profs }, { data: roles }, { data: crs }] = await Promise.all([
        supabase.from("profiles").select("id,full_name,employee_id").order("full_name"),
        supabase.from("user_roles").select("user_id,role"),
        supabase.from("courses").select("id,title").order("title"),
      ]);
      const all = (profs ?? []) as PersonRow[];
      setPeople(all);
      const adminIds = new Set(
        (roles ?? [])
          .filter((r) => r.role === "admin" || r.role === "super_admin")
          .map((r) => r.user_id),
      );
      setTeachers(all.filter((p) => adminIds.has(p.id)));
      setCourses((crs ?? []) as { id: string; title: string }[]);
    })();
  }, [isAdmin]);

  const teacherName = (id: string) =>
    teachers.find((x) => x.id === id)?.full_name ??
    people.find((x) => x.id === id)?.full_name ??
    (id === user?.id ? (profile?.full_name ?? "—") : "—");

  const filtered = useMemo(
    () => (filter === "all" ? rooms : rooms.filter((r) => r.status === filter)),
    [rooms, filter],
  );

  const liveRooms = filtered.filter((r) => r.status === "live");
  const upcoming = filtered.filter((r) => r.status === "scheduled");
  const past = filtered.filter((r) => r.status === "ended" || r.status === "cancelled");

  const handleJoinByCode = async () => {
    const value = code.trim().toUpperCase();
    if (!value) return;
    setJoining(true);
    const { data, error } = await supabase.rpc("find_live_room_by_code", { _code: value });
    setJoining(false);
    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row) {
      toast.error(t.live.errNotFound);
      return;
    }
    if (!row.allowed) {
      toast.error(t.live.errForbidden);
      return;
    }
    if (row.status === "cancelled") return toast.error(t.live.errCancelled);
    if (row.status === "ended") return toast.error(t.live.errEnded);
    if (row.status === "scheduled") return toast.error(t.live.errNotStarted);
    setJoinOpen(false);
    setCode("");
    navigate({ to: "/live-classes/$roomId/room", params: { roomId: row.id } });
  };

  const startRoom = async (room: LiveRoom) => {
    const { error } = await supabase
      .from("live_rooms")
      .update({ status: "live", started_at: new Date().toISOString() })
      .eq("id", room.id);
    if (error) return toast.error(error.message);
    await notifyAudience(room, `"${room.title}" ${t.live.notifStarted}`);
    navigate({ to: "/live-classes/$roomId/room", params: { roomId: room.id } });
  };

  const notifyAudience = async (room: LiveRoom, body: string) => {
    let userIds: string[] = [];
    if (room.audience === "selected") {
      const { data } = await supabase
        .from("live_room_invitees")
        .select("user_id")
        .eq("room_id", room.id);
      userIds = (data ?? []).map((d) => d.user_id);
    } else {
      const { data } = await supabase.from("profiles").select("id");
      userIds = (data ?? []).map((d) => d.id);
    }
    if (!userIds.length) return;
    await supabase.from("notifications").insert(
      userIds.map((uid) => ({
        user_id: uid,
        type: "live_class",
        title: t.live.title,
        body,
        link: "/live-classes",
      })),
    );
  };

  const cancelRoom = async (room: LiveRoom) => {
    await supabase.from("live_rooms").update({ status: "cancelled" }).eq("id", room.id);
    toast.success(t.live.cancelled);
  };

  const deleteRoom = async (room: LiveRoom) => {
    if (!confirm(t.live.deleteConfirm)) return;
    const { error } = await supabase.from("live_rooms").delete().eq("id", room.id);
    if (error) return toast.error(error.message);
    toast.success(t.common.delete);
  };

  return (
    <div className="bento-page space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Video className="h-6 w-6 text-primary" /> {t.live.title}
          </h1>
          <p className="text-sm text-muted-foreground">{t.live.subtitle}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setJoinOpen(true)}>
            <KeyRound className="h-4 w-4 mr-2" /> {t.live.joinByCode}
          </Button>
          {isAdmin && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" /> {t.live.create}
            </Button>
          )}
        </div>
      </div>

      <div className="bento-toolbar">
        {(
          [
            ["all", t.live.all],
            ["scheduled", t.live.scheduled],
            ["live", t.live.liveNow],
            ["ended", t.live.ended],
            ["cancelled", t.live.cancelled],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={filter === key ? "default" : "outline"}
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">{t.live.noRooms}</Card>
      ) : isAdmin ? (
        <Card className="bento-table border-0">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">{t.live.lessonName}</th>
                <th className="p-3 font-medium">{t.live.teacher}</th>
                <th className="p-3 font-medium">{t.live.date}</th>
                <th className="p-3 font-medium">{t.live.startTime}</th>
                <th className="p-3 font-medium">{t.live.participants}</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium text-right">—</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">{r.title}</div>
                    <div className="text-xs text-muted-foreground font-mono">{r.room_code}</div>
                  </td>
                  <td className="p-3">{teacherName(r.teacher_id)}</td>
                  <td className="p-3">{fmtDate(r.scheduled_date)}</td>
                  <td className="p-3">{fmtTime(r.scheduled_start_time)}</td>
                  <td className="p-3">{counts[r.id] ?? 0}</td>
                  <td className="p-3">{statusBadge(r.status)}</td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-end flex-wrap">
                      {r.status === "live" && (
                        <Button
                          size="sm"
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() =>
                            navigate({
                              to: "/live-classes/$roomId/room",
                              params: { roomId: r.id },
                            })
                          }
                        >
                          <Radio className="h-3.5 w-3.5 mr-1" /> {t.live.enterRoom}
                        </Button>
                      )}
                      {r.status === "scheduled" && (
                        <Button size="sm" onClick={() => startRoom(r)}>
                          {t.live.startLesson}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" asChild aria-label={t.live.details}>
                        <Link to="/live-classes/$roomId" params={{ roomId: r.id }}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t.live.edit}
                        onClick={() => {
                          setEditing(r);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {r.status !== "ended" && r.status !== "cancelled" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={t.live.cancel}
                          onClick={() => cancelRoom(r)}
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t.common.delete}
                        onClick={() => deleteRoom(r)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <div className="space-y-6">
          {liveRooms.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {liveRooms.map((r) => (
                <Card key={r.id} className="p-5 space-y-3 border-destructive/40">
                  {statusBadge(r.status)}
                  <div className="font-display font-bold text-lg">{r.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {t.live.teacher}: {teacherName(r.teacher_id)}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Users className="h-4 w-4" /> {counts[r.id] ?? 0} {t.live.people}
                  </div>
                  <Button
                    className="w-full"
                    onClick={() =>
                      navigate({ to: "/live-classes/$roomId/room", params: { roomId: r.id } })
                    }
                  >
                    {t.live.join}
                  </Button>
                </Card>
              ))}
            </div>
          )}
          {upcoming.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((r) => (
                <Card key={r.id} className="p-5 space-y-3">
                  {statusBadge(r.status)}
                  <div className="font-display font-bold text-lg">{r.title}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-4 w-4" /> {fmtDate(r.scheduled_date)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" /> {fmtTime(r.scheduled_start_time)}
                    </span>
                  </div>
                  <div className="text-sm">
                    {t.live.startsIn}: <Countdown target={roomStartDate(r)} />
                  </div>
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/live-classes/$roomId" params={{ roomId: r.id }}>
                      {t.live.details}
                    </Link>
                  </Button>
                </Card>
              ))}
            </div>
          )}
          {past.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {past.map((r) => (
                <Card key={r.id} className="p-5 space-y-3 opacity-80">
                  {statusBadge(r.status)}
                  <div className="font-display font-bold text-lg">{r.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {fmtDate(r.scheduled_date)} · {fmtTime(r.scheduled_start_time)}
                  </div>
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/live-classes/$roomId" params={{ roomId: r.id }}>
                      {t.live.details}
                    </Link>
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Join by code */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.live.joinByCodeTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="room-code">{t.live.joinByCodeHint}</Label>
            <Input
              id="room-code"
              value={code}
              placeholder="LIVE-4829"
              className="font-mono uppercase"
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleJoinByCode} disabled={joining}>
              {joining && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t.live.join}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isAdmin && (
        <RoomFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={editing}
          teachers={teachers}
          people={people}
          courses={courses}
          onSaved={load}
        />
      )}
    </div>
  );
}

function RoomFormDialog({
  open,
  onOpenChange,
  editing,
  teachers,
  people,
  courses,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: LiveRoom | null;
  teachers: PersonRow[];
  people: PersonRow[];
  courses: { id: string; title: string }[];
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [courseId, setCourseId] = useState<string>("none");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(60);
  const [audience, setAudience] = useState<"all" | "course" | "selected">("all");
  const [audienceCourse, setAudienceCourse] = useState<string>("none");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [roomCode, setRoomCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const genCode = useCallback(async () => {
    const { data } = await supabase.rpc("generate_live_room_code");
    if (typeof data === "string") setRoomCode(data);
  }, []);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description ?? "");
      setTeacherId(editing.teacher_id);
      setCourseId(editing.course_id ?? "none");
      setDate(editing.scheduled_date);
      setTime(editing.scheduled_start_time.slice(0, 5));
      setDuration(editing.planned_duration);
      setAudience(editing.audience);
      setAudienceCourse(editing.audience_course_id ?? "none");
      setRoomCode(editing.room_code);
      supabase
        .from("live_room_invitees")
        .select("user_id")
        .eq("room_id", editing.id)
        .then(({ data }) => setSelectedUsers((data ?? []).map((d) => d.user_id)));
    } else {
      setTitle("");
      setDescription("");
      setTeacherId(user?.id ?? "");
      setCourseId("none");
      setDate(new Date().toISOString().slice(0, 10));
      setTime("10:00");
      setDuration(60);
      setAudience("all");
      setAudienceCourse("none");
      setSelectedUsers([]);
      genCode();
    }
  }, [open, editing, user?.id, genCode]);

  const save = async () => {
    if (!title.trim()) return toast.error(t.live.lessonName);
    if (!date || !time) return toast.error(t.live.date);
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      teacher_id: teacherId || user!.id,
      course_id: courseId === "none" ? null : courseId,
      scheduled_date: date,
      scheduled_start_time: time,
      planned_duration: duration,
      status: editing?.status ?? ("scheduled" as const),
      audience,
      audience_course_id: audience === "course" && audienceCourse !== "none" ? audienceCourse : null,
    };

    let roomId = editing?.id;
    if (editing) {
      const { error } = await supabase.from("live_rooms").update(payload).eq("id", editing.id);
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
    } else {
      const { data, error } = await supabase
        .from("live_rooms")
        .insert({ ...payload, room_code: roomCode, created_by: user!.id })
        .select("id")
        .single();
      if (error || !data) {
        setSaving(false);
        return toast.error(error?.message ?? t.common.error);
      }
      roomId = data.id;
    }

    if (roomId) {
      await supabase.from("live_room_invitees").delete().eq("room_id", roomId);
      if (audience === "selected" && selectedUsers.length) {
        await supabase
          .from("live_room_invitees")
          .insert(selectedUsers.map((uid) => ({ room_id: roomId!, user_id: uid })));
      }
    }
    setSaving(false);
    onOpenChange(false);
    onSaved();
    toast.success(t.common.save);
  };

  const shown = people.filter(
    (p) =>
      !search ||
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.employee_id.includes(search),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t.live.edit : t.live.create}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lv-title">{t.live.lessonName} *</Label>
            <Input id="lv-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lv-desc">{t.live.description}</Label>
            <Textarea
              id="lv-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t.live.teacher}</Label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger>
                <SelectValue placeholder={t.live.teacher} />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t.live.course}</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t.live.noCourse}</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lv-date">{t.live.date}</Label>
              <Input
                id="lv-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lv-time">{t.live.startTime}</Label>
              <Input
                id="lv-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t.live.duration}</Label>
            <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d} {t.live.minutes}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t.live.audience}</Label>
            <Select value={audience} onValueChange={(v) => setAudience(v as typeof audience)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.live.audienceAll}</SelectItem>
                <SelectItem value="course">{t.live.audienceCourse}</SelectItem>
                <SelectItem value="selected">{t.live.audienceSelected}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {audience === "course" && (
            <Select value={audienceCourse} onValueChange={setAudienceCourse}>
              <SelectTrigger>
                <SelectValue placeholder={t.live.course} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {audience === "selected" && (
            <div className="space-y-2">
              <Input
                placeholder={t.users.search}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
                {shown.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm py-1">
                    <Checkbox
                      checked={selectedUsers.includes(p.id)}
                      onCheckedChange={(v) =>
                        setSelectedUsers((prev) =>
                          v ? [...prev, p.id] : prev.filter((x) => x !== p.id),
                        )
                      }
                    />
                    <span className="truncate">
                      {p.full_name} · {p.employee_id}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>{t.live.roomCode}</Label>
            <div className="flex gap-2">
              <Input value={roomCode} readOnly className="font-mono" />
              {!editing && (
                <Button type="button" variant="outline" onClick={genCode}>
                  <RefreshCw className="h-4 w-4 mr-2" /> {t.live.regenerate}
                </Button>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
