import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getLiveToken, muteLiveParticipant, closeLiveRoom } from "@/lib/live.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Hand, MicOff, Users, Radio, ArrowLeft, Check, X } from "lucide-react";
import { toast } from "sonner";

const LiveStage = lazy(() => import("@/components/live/LiveStage"));

export const Route = createFileRoute("/live-classes/$roomId/room")({
  component: () => (
    <ProtectedRoute>
      <LiveRoomPage />
    </ProtectedRoute>
  ),
});

interface Msg {
  id: string;
  user_id: string;
  full_name: string | null;
  message: string;
  created_at: string;
}
interface HandRow {
  id: string;
  user_id: string;
  full_name: string | null;
  status: string;
}
interface Part {
  id: string;
  user_id: string;
  full_name: string | null;
  status: string;
  force_muted: boolean;
  mic_enabled: boolean;
}

const REASON: Record<string, string> = {
  not_configured: t.live.errNotConfigured,
  not_found: t.live.errNotFound,
  cancelled: t.live.errCancelled,
  ended: t.live.errEnded,
  not_started: t.live.errNotStarted,
  forbidden: t.live.errForbidden,
};

function LiveRoomPage() {
  const { roomId } = Route.useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const fetchToken = useServerFn(getLiveToken);
  const muteFn = useServerFn(muteLiveParticipant);
  const closeFn = useServerFn(closeLiveRoom);

  const [conn, setConn] = useState<{ token: string; url: string; isHost: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [hands, setHands] = useState<HandRow[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [text, setText] = useState("");
  const [tab, setTab] = useState<"chat" | "people">("chat");
  const joinedAt = useRef<number>(Date.now());
  const chatEnd = useRef<HTMLDivElement>(null);

  const me = parts.find((p) => p.user_id === user?.id);
  const myHand = hands.find((h) => h.user_id === user?.id && h.status === "pending");

  const loadSide = useCallback(async () => {
    const [{ data: m }, { data: h }, { data: p }] = await Promise.all([
      supabase
        .from("live_room_messages")
        .select("id,user_id,full_name,message,created_at")
        .eq("room_id", roomId)
        .is("deleted_at", null)
        .order("created_at")
        .limit(300),
      supabase
        .from("live_room_hand_raises")
        .select("id,user_id,full_name,status")
        .eq("room_id", roomId)
        .eq("status", "pending"),
      supabase
        .from("live_room_participants")
        .select("id,user_id,full_name,status,force_muted,mic_enabled")
        .eq("room_id", roomId)
        .eq("status", "joined"),
    ]);
    setMsgs((m ?? []) as Msg[]);
    setHands((h ?? []) as HandRow[]);
    setParts((p ?? []) as Part[]);
  }, [roomId]);

  // Token + join
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: r } = await supabase.from("live_rooms").select("title").eq("id", roomId).maybeSingle();
      if (r) setTitle(r.title);
      const res = await fetchToken({ data: { roomId } });
      if (cancelled) return;
      if (!res.ok) {
        setError(REASON[res.reason] ?? t.common.error);
        return;
      }
      setConn({ token: res.token, url: res.url, isHost: res.isHost });
      joinedAt.current = Date.now();
      const { data: existing } = await supabase
        .from("live_room_participants")
        .select("id")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("live_room_participants")
          .update({ status: "joined", left_at: null, joined_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("live_room_participants").insert({
          room_id: roomId,
          user_id: user.id,
          full_name: profile?.full_name ?? null,
        });
      }
      await supabase.from("live_room_events").insert({ room_id: roomId, user_id: user.id, event_type: "join" });
      loadSide();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.id]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`live-room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_room_messages", filter: `room_id=eq.${roomId}` }, loadSide)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_room_hand_raises", filter: `room_id=eq.${roomId}` }, loadSide)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_room_participants", filter: `room_id=eq.${roomId}` }, loadSide)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_rooms", filter: `id=eq.${roomId}` }, (payload) => {
        const st = (payload.new as { status: string }).status;
        if (st === "ended" || st === "cancelled") {
          toast.info(t.live.errEnded);
          navigate({ to: "/live-classes" });
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [roomId, loadSide, navigate]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const markLeft = useCallback(async () => {
    if (!user) return;
    const secs = Math.round((Date.now() - joinedAt.current) / 1000);
    const { data: row } = await supabase
      .from("live_room_participants")
      .select("id,total_duration")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (row)
      await supabase
        .from("live_room_participants")
        .update({ status: "left", left_at: new Date().toISOString(), total_duration: row.total_duration + secs })
        .eq("id", row.id);
    await supabase.from("live_room_events").insert({ room_id: roomId, user_id: user.id, event_type: "leave" });
  }, [roomId, user]);

  useEffect(() => {
    return () => {
      void markLeft();
    };
  }, [markLeft]);

  const leave = async () => {
    await markLeft();
    navigate({ to: "/live-classes" });
  };

  const end = async () => {
    if (!confirm(t.live.endConfirm)) return;
    await supabase.from("live_rooms").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", roomId);
    await closeFn({ data: { roomId } });
    await leave();
  };

  const send = async () => {
    const v = text.trim();
    if (!v || !user) return;
    setText("");
    const { error: e } = await supabase
      .from("live_room_messages")
      .insert({ room_id: roomId, user_id: user.id, full_name: profile?.full_name ?? null, message: v.slice(0, 1000) });
    if (e) toast.error(e.message);
  };

  const toggleHand = async () => {
    if (!user) return;
    if (myHand) {
      await supabase.from("live_room_hand_raises").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", myHand.id);
    } else {
      await supabase.from("live_room_hand_raises").insert({ room_id: roomId, user_id: user.id, full_name: profile?.full_name ?? null });
    }
  };

  const resolveHand = async (h: HandRow, approve: boolean) => {
    await supabase
      .from("live_room_hand_raises")
      .update({ status: approve ? "approved" : "rejected", resolved_at: new Date().toISOString() })
      .eq("id", h.id);
    if (approve)
      await supabase.from("live_room_participants").update({ force_muted: false, can_speak: true }).eq("room_id", roomId).eq("user_id", h.user_id);
  };

  const mute = async (p: Part) => {
    await supabase.from("live_room_participants").update({ force_muted: true }).eq("id", p.id);
    await muteFn({ data: { roomId, targetUserId: p.user_id, muted: true } });
  };

  const muteAll = async () => {
    for (const p of parts) if (p.user_id !== user?.id) await mute(p);
  };

  const onMediaState = useCallback(
    (s: { mic: boolean; cam: boolean }) => {
      if (!user) return;
      void supabase
        .from("live_room_participants")
        .update({ mic_enabled: s.mic, cam_enabled: s.cam })
        .eq("room_id", roomId)
        .eq("user_id", user.id);
    },
    [roomId, user],
  );

  if (error)
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4">
        <Card className="p-6">{error}</Card>
        <Button variant="outline" asChild>
          <Link to="/live-classes">
            <ArrowLeft className="h-4 w-4 mr-2" /> {t.live.title}
          </Link>
        </Button>
      </div>
    );

  if (!conn)
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="p-2 sm:p-4 flex flex-col lg:flex-row gap-3 lg:h-[calc(100dvh-1rem)]">
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Badge className="bg-destructive text-destructive-foreground gap-1">
            <Radio className="h-3 w-3" /> {t.live.liveNow}
          </Badge>
          <h1 className="font-display font-bold truncate flex-1">{title}</h1>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {parts.length}
          </span>
        </div>
        <div className="h-[55dvh] lg:h-auto lg:flex-1 min-h-0">
          <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            <LiveStage
              token={conn.token}
              serverUrl={conn.url}
              isHost={conn.isHost}
              forceMuted={!!me?.force_muted && !conn.isHost}
              handRaised={!!myHand}
              onToggleHand={toggleHand}
              onLeave={leave}
              onEnd={end}
              onMediaState={onMediaState}
            />
          </Suspense>
        </div>
      </div>

      <Card className="lg:w-80 shrink-0 flex flex-col h-[60dvh] lg:h-auto">
        <div className="flex border-b">
          <button className={`flex-1 p-3 text-sm font-medium ${tab === "chat" ? "border-b-2 border-primary" : "text-muted-foreground"}`} onClick={() => setTab("chat")}>
            {t.live.chat}
          </button>
          <button className={`flex-1 p-3 text-sm font-medium ${tab === "people" ? "border-b-2 border-primary" : "text-muted-foreground"}`} onClick={() => setTab("people")}>
            {t.live.participants} ({parts.length})
          </button>
        </div>

        {tab === "chat" ? (
          <>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {msgs.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">{t.live.noMessages}</div>}
              {msgs.map((m) => (
                <div key={m.id} className="text-sm">
                  <span className="font-semibold">{m.user_id === user?.id ? t.comments.you : m.full_name ?? "—"}</span>{" "}
                  <span className="text-xs text-muted-foreground">{new Date(m.created_at).toTimeString().slice(0, 5)}</span>
                  <div className="break-words">{m.message}</div>
                </div>
              ))}
              <div ref={chatEnd} />
            </div>
            <div className="p-2 border-t flex gap-2">
              <Input value={text} placeholder={t.live.messagePlaceholder} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
              <Button size="icon" onClick={send} aria-label={t.live.send}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {conn.isHost && (
              <Button size="sm" variant="outline" className="w-full" onClick={muteAll}>
                <MicOff className="h-4 w-4 mr-2" /> {t.live.muteAll}
              </Button>
            )}
            {conn.isHost && hands.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground">{t.live.handsRaised}</div>
                {hands.map((h) => (
                  <div key={h.id} className="flex items-center gap-2 text-sm">
                    <Hand className="h-4 w-4 text-primary" />
                    <span className="flex-1 truncate">{h.full_name}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={t.live.approve} onClick={() => resolveHand(h, true)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={t.live.reject} onClick={() => resolveHand(h, false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {parts.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">{p.full_name ?? "—"}</span>
                {!p.mic_enabled && <MicOff className="h-3.5 w-3.5 text-muted-foreground" />}
                {conn.isHost && p.user_id !== user?.id && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={t.live.micOff} onClick={() => mute(p)}>
                    <MicOff className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
