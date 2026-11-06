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
import { StatusChip } from "@/components/design/StatusChip";
import { IconChip } from "@/components/design/IconChip";
import { UserAvatar } from "@/components/design/UserAvatar";
import { cn } from "@/lib/utils";
import { Loader2, Send, Hand, MicOff, Users, ArrowLeft, Check, X, Video, Clock } from "lucide-react";
import { toast } from "sonner";

const LiveStage = lazy(() => import("@/components/live/LiveStage"));

export const Route = createFileRoute("/live-classes/$roomId/room")({
  head: () => ({
    meta: [
      { title: "Canlı dərs otağı — Baku Digital Lab" },
      { name: "description", content: "Baku Digital Lab canlı dərs otağı və iştirakçı müzakirələri." },
      { property: "og:title", content: "Canlı dərs otağı — Baku Digital Lab" },
      { property: "og:description", content: "Baku Digital Lab canlı dərs otağı və iştirakçı müzakirələri." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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
  livekit_error: t.live.errLivekit,
};

async function liveAuthHeaders() {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error("Sessiya bitib. Hesabınıza yenidən daxil olun.");
  return { Authorization: `Bearer ${token}` };
}

function LiveRoomPage() {
  const { roomId } = Route.useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const fetchToken = useServerFn(getLiveToken);
  const muteFn = useServerFn(muteLiveParticipant);
  const closeFn = useServerFn(closeLiveRoom);

  const [conn, setConn] = useState<{ token: string; url: string; isHost: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinAttempt, setJoinAttempt] = useState(0);
  const [title, setTitle] = useState("");
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [hands, setHands] = useState<HandRow[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [text, setText] = useState("");
  const [tab, setTab] = useState<"chat" | "people" | "hands">("chat");
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
    setError(null);
    setConn(null);
    (async () => {
      try {
      const { data: r } = await supabase.from("live_rooms").select("title,started_at").eq("id", roomId).maybeSingle();
      if (cancelled) return;
      if (r) { setTitle(r.title); setStartedAt(r.started_at); }
      const headers = await liveAuthHeaders();
      if (cancelled) return;
      const res = await fetchToken({ data: { roomId }, headers });
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
      await loadSide();
      } catch {
        if (!cancelled) {
          setConn(null);
          setError("Canlı dərsə qoşulmaq mümkün olmadı. Yenidən cəhd edin; xəta davam edərsə hesabınıza yenidən daxil olun.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.id, joinAttempt]);

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
    try {
      const result = await closeFn({ data: { roomId }, headers: await liveAuthHeaders() });
      if (!result.ok) {
        toast.error(REASON[result.reason] ?? t.common.error);
        return;
      }
      const { error: updateError } = await supabase.from("live_rooms").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", roomId);
      if (updateError) throw updateError;
      await leave();
    } catch {
      toast.error("Dərsi bitirmək mümkün olmadı. Yenidən cəhd edin.");
    }
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
    try {
      const result = await muteFn({ data: { roomId, targetUserId: p.user_id, muted: true }, headers: await liveAuthHeaders() });
      if (!result.ok) {
        toast.error(REASON[result.reason] ?? t.common.error);
        return;
      }
      const { error: updateError } = await supabase.from("live_room_participants").update({ force_muted: true }).eq("id", p.id);
      if (updateError) throw updateError;
    } catch {
      toast.error("Mikrofonu söndürmək mümkün olmadı. Yenidən cəhd edin.");
    }
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
        <Card className="p-6" role="alert">{error}</Card>
        <Button onClick={() => setJoinAttempt((attempt) => attempt + 1)}>Yenidən cəhd et</Button>
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

  const tabs: { id: "chat" | "people" | "hands"; label: string }[] = [
    { id: "chat", label: t.live.chat },
    { id: "people", label: `${t.live.participants} (${parts.length})` },
    ...(conn.isHost ? [{ id: "hands" as const, label: `${t.live.handsRaised} (${hands.length})` }] : []),
  ];

  return (
    <div className="flex flex-col gap-4 p-2 sm:p-4 lg:h-[calc(100dvh-5rem)]">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <IconChip icon={Video} size="lg" className="max-sm:hidden" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-lg font-bold break-words sm:text-2xl">{title}</h1>
              <StatusChip tone="live">{t.live.liveNow}</StatusChip>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4 text-muted-foreground" /> {parts.length} {t.live.people}
          </span>
          {startedAt && (
            <span className="inline-flex items-center gap-1.5 border-l border-border pl-4 tabular-nums">
              <Clock className="h-4 w-4 text-muted-foreground" /> <RoomClock since={startedAt} />
            </span>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <div className="h-[60dvh] min-w-0 lg:h-auto lg:flex-1">
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
              onConnectionError={() => {
                setConn(null);
                setError(t.live.errLivekit);
              }}
            />
          </Suspense>
        </div>

        <Card className="flex h-[60dvh] shrink-0 flex-col overflow-hidden border-0 lg:h-auto lg:w-[360px]">
          <div role="tablist" aria-label={t.live.chat} className="flex overflow-x-auto overflow-y-hidden border-b border-border px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                id={`room-tab-${x.id}`}
                aria-selected={tab === x.id}
                aria-controls="room-tabpanel"
                onClick={() => setTab(x.id)}
                className={cn(
                  "-mb-px flex-1 shrink-0 whitespace-nowrap border-b-2 px-2 py-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/25",
                  tab === x.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {x.label}
              </button>
            ))}
          </div>

          <div id="room-tabpanel" role="tabpanel" aria-labelledby={`room-tab-${tab}`} className="flex min-h-0 flex-1 flex-col">
            {tab === "chat" ? (
              <>
                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                  {msgs.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">{t.live.noMessages}</div>}
                  {msgs.map((m) => {
                    const mine = m.user_id === user?.id;
                    return (
                      <div key={m.id} className="flex gap-3">
                        <UserAvatar name={m.full_name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2 text-sm">
                            <span className="font-semibold">{mine ? t.comments.you : m.full_name ?? "—"}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {new Date(m.created_at).toTimeString().slice(0, 5)}
                            </span>
                          </div>
                          <div
                            className={cn(
                              "mt-1 inline-block max-w-full rounded-xl px-3 py-2 text-sm break-words",
                              mine ? "bg-brand-50 text-brand-900 dark:bg-brand-600/15 dark:text-brand-100" : "bg-muted",
                            )}
                          >
                            {m.message}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEnd} />
                </div>
                <div className="flex gap-2 border-t border-border p-3">
                  <Input
                    value={text}
                    aria-label={t.live.messagePlaceholder}
                    placeholder={t.live.messagePlaceholder}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                  />
                  <Button size="icon" onClick={send} aria-label={t.live.send}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : tab === "people" ? (
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {conn.isHost && (
                  <Button size="sm" variant="outline" className="mb-2 w-full" onClick={muteAll}>
                    <MicOff className="h-4 w-4 mr-2" /> {t.live.muteAll}
                  </Button>
                )}
                {parts.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 text-sm">
                    <UserAvatar name={p.full_name} size="sm" />
                    <span className="flex-1 truncate">{p.full_name ?? "—"}</span>
                    {hands.some((h) => h.user_id === p.user_id) && (
                      <Hand className="h-4 w-4 text-primary" aria-label={t.live.handsRaised} />
                    )}
                    {!p.mic_enabled && <MicOff className="h-3.5 w-3.5 text-muted-foreground" aria-label={t.live.micOff} />}
                    {conn.isHost && p.user_id !== user?.id && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={t.live.micOff} onClick={() => mute(p)}>
                        <MicOff className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {hands.length === 0 && (
                  <div className="py-6 text-center text-sm text-muted-foreground">Qaldırılmış əl yoxdur.</div>
                )}
                {hands.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 rounded-xl bg-muted/50 p-2 text-sm">
                    <IconChip icon={Hand} size="sm" />
                    <span className="flex-1 truncate font-medium">{h.full_name ?? "—"}</span>
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={t.live.approve} onClick={() => resolveHand(h, true)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={t.live.reject} onClick={() => resolveHand(h, false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function RoomClock({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  const days = Math.floor(s / 86400);
  const clock = `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return <>{days > 0 ? `${days} gün ${clock}` : clock}</>;
}
