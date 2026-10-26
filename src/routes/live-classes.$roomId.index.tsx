import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, Radio, Users } from "lucide-react";
import { statusBadge, type LiveRoom } from "./live-classes.index";
import { toast } from "sonner";

export const Route = createFileRoute("/live-classes/$roomId/")({
  head: () => ({ meta: [
    { title: "Canlı dərsin məlumatları | Baku Digital Lab" },
    { name: "description", content: "Canlı dərsin vaxtı, iştirakçıları və təlim məlumatları." },
    { property: "og:title", content: "Canlı dərsin məlumatları | Baku Digital Lab" },
    { property: "og:description", content: "Canlı dərsin vaxtı, iştirakçıları və təlim məlumatları." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <ProtectedRoute>
      <RoomDetailsPage />
    </ProtectedRoute>
  ),
});

interface ParticipantRow {
  id: string;
  user_id: string;
  full_name: string | null;
  joined_at: string;
  left_at: string | null;
  total_duration: number;
  status: "joined" | "left";
}

function fmtDateTime(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function RoomDetailsPage() {
  const { roomId } = Route.useParams();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<LiveRoom | null>(null);
  const [parts, setParts] = useState<ParticipantRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase
        .from("live_rooms")
        .select(
          "id,title,description,teacher_id,course_id,scheduled_date,scheduled_start_time,planned_duration,room_code,status,audience,audience_course_id,started_at,ended_at",
        )
        .eq("id", roomId)
        .maybeSingle(),
      supabase
        .from("live_room_participants")
        .select("id,user_id,full_name,joined_at,left_at,total_duration,status")
        .eq("room_id", roomId)
        .order("joined_at"),
    ]);
    setRoom((r as LiveRoom) ?? null);
    setParts((p ?? []) as ParticipantRow[]);
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    load();
  }, [load]);

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const rows = parts.map((p) => ({
      [t.champions.name]: p.full_name ?? "—",
      [t.live.joinedAt]: fmtDateTime(p.joined_at),
      [t.live.leftAt]: fmtDateTime(p.left_at),
      [t.live.totalDuration]: `${Math.round(p.total_duration / 60)} ${t.live.minutes}`,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Live");
    XLSX.writeFile(wb, `${room?.title ?? "live"}_${room?.scheduled_date ?? ""}.xlsx`);
  };

  if (loading)
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  if (!room)
    return (
      <div className="p-8 text-center text-muted-foreground">
        {t.live.errNotFound}
        <div className="mt-4">
          <Button variant="outline" asChild>
            <Link to="/live-classes">{t.common.back}</Link>
          </Button>
        </div>
      </div>
    );

  const total = parts.length;
  const avg = total
    ? Math.round(parts.reduce((s, p) => s + p.total_duration, 0) / total / 60)
    : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/live-classes">
          <ArrowLeft className="h-4 w-4 mr-2" /> {t.live.title}
        </Link>
      </Button>

      <Card className="p-6 space-y-3">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-display font-bold">{room.title}</h1>
            {room.description && (
              <p className="text-sm text-muted-foreground mt-1">{room.description}</p>
            )}
          </div>
          {statusBadge(room.status)}
        </div>
        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground">{t.live.date}</div>
            <div className="font-medium">
              {room.scheduled_date.split("-").reverse().join(".")} ·{" "}
              {room.scheduled_start_time.slice(0, 5)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">{t.live.duration}</div>
            <div className="font-medium">
              {room.planned_duration} {t.live.minutes}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">{t.live.roomCode}</div>
            <div className="font-mono font-medium">{room.room_code}</div>
          </div>
        </div>
        {room.status === "live" && (
          <Button
            onClick={() =>
              navigate({ to: "/live-classes/$roomId/room", params: { roomId: room.id } })
            }
          >
            <Radio className="h-4 w-4 mr-2" /> {t.live.enterRoom}
          </Button>
        )}
        {room.status === "scheduled" && isAdmin && (
          <Button
            onClick={async () => {
              const { error } = await supabase
                .from("live_rooms")
                .update({ status: "live", started_at: new Date().toISOString() })
                .eq("id", room.id);
              if (error) return toast.error(error.message);
              navigate({ to: "/live-classes/$roomId/room", params: { roomId: room.id } });
            }}
          >
            {t.live.startLesson}
          </Button>
        )}
      </Card>

      {isAdmin && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-display font-bold text-lg flex-1 flex items-center gap-2">
              <Users className="h-5 w-5" /> {t.live.stats}
            </h2>
            <Button variant="outline" size="sm" onClick={exportExcel} disabled={!parts.length}>
              <Download className="h-4 w-4 mr-2" /> {t.live.exportExcel}
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border p-3">
              <div className="text-muted-foreground">{t.live.totalParticipants}</div>
              <div className="text-xl font-bold">{total}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-muted-foreground">{t.live.avgDuration}</div>
              <div className="text-xl font-bold">
                {avg} {t.live.minutes}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3 font-medium">{t.champions.name}</th>
                  <th className="p-3 font-medium">{t.live.joinedAt}</th>
                  <th className="p-3 font-medium">{t.live.leftAt}</th>
                  <th className="p-3 font-medium">{t.live.totalDuration}</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-3">{p.full_name ?? "—"}</td>
                    <td className="p-3">{fmtDateTime(p.joined_at)}</td>
                    <td className="p-3">{fmtDateTime(p.left_at)}</td>
                    <td className="p-3">
                      {Math.round(p.total_duration / 60)} {t.live.minutes}
                    </td>
                  </tr>
                ))}
                {!parts.length && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">
                      {t.common.noContent}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
