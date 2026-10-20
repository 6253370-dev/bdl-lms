import { createServerFn } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type LiveEnv = { url: string; apiKey: string; apiSecret: string };

function readEnv(): LiveEnv | null {
  const url = process.env["LIVEKIT_URL"];
  const apiKey = process.env["LIVEKIT_API_KEY"];
  const apiSecret = process.env["LIVEKIT_API_SECRET"];
  if (!url || !apiKey || !apiSecret) return null;
  return { url, apiKey, apiSecret };
}

/**
 * Issues a LiveKit access token after verifying, server-side, that:
 *  - the caller is authenticated (middleware),
 *  - the caller is allowed into this room (RLS + can_access_live_room),
 *  - the room exists and is currently live (hosts may join before start).
 */
export const getLiveToken = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((data: { roomId: string }) => {
    if (!data || typeof data.roomId !== "string") throw new Error("roomId required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const env = readEnv();
    if (!env) return { ok: false as const, reason: "not_configured" as const };

    // Fail fast with a clear reason when the LiveKit credentials are wrong
    // (e.g. key/secret from a different project than LIVEKIT_URL): otherwise
    // the client gets a token that LiveKit rejects with 401 after joining.
    try {
      const { RoomServiceClient } = await import("livekit-server-sdk");
      const svc = new RoomServiceClient(env.url.replace(/^ws/, "http"), env.apiKey, env.apiSecret);
      await svc.listRooms();
    } catch {
      return { ok: false as const, reason: "livekit_error" as const };
    }

    const { supabase, userId } = context;

    const { data: room, error } = await supabase
      .from("live_rooms")
      .select("id, title, status, teacher_id, room_code")
      .eq("id", data.roomId)
      .maybeSingle();

    if (error || !room) return { ok: false as const, reason: "not_found" as const };

    const { data: isAdmin } = await supabase.rpc("is_admin_or_super", { _user_id: userId });
    const isHost = room.teacher_id === userId || !!isAdmin;

    if (room.status === "cancelled") return { ok: false as const, reason: "cancelled" as const };
    if (room.status === "ended") return { ok: false as const, reason: "ended" as const };
    if (room.status !== "live" && !isHost)
      return { ok: false as const, reason: "not_started" as const };

    // RLS already filtered the row, but re-check explicitly.
    const { data: allowed } = await supabase.rpc("can_access_live_room", {
      _room_id: room.id,
      _user_id: userId,
    });
    if (!allowed) return { ok: false as const, reason: "forbidden" as const };

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    const { AccessToken } = await import("livekit-server-sdk");
    const at = new AccessToken(env.apiKey, env.apiSecret, {
      identity: userId,
      name: profile?.full_name ?? "İştirakçı",
      ttl: "4h",
    });
    at.addGrant({
      room: room.id,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: isHost,
    });

    return {
      ok: true as const,
      token: await at.toJwt(),
      url: env.url,
      isHost,
    };
  });

/** Teacher/admin force-mutes a participant's published audio inside LiveKit. */
export const muteLiveParticipant = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((data: { roomId: string; targetUserId: string; muted: boolean }) => data)
  .handler(async ({ data, context }) => {
    const env = readEnv();
    if (!env) return { ok: false as const, reason: "not_configured" as const };

    const { data: isHost } = await context.supabase.rpc("is_live_room_host", {
      _room_id: data.roomId,
      _user_id: context.userId,
    });
    if (!isHost) return { ok: false as const, reason: "forbidden" as const };

    try {
      const { RoomServiceClient } = await import("livekit-server-sdk");
      const svc = new RoomServiceClient(
        env.url.replace(/^ws/, "http"),
        env.apiKey,
        env.apiSecret,
      );
      const participants = await svc.listParticipants(data.roomId);
      const target = participants.find((p) => p.identity === data.targetUserId);
      if (target) {
        for (const pub of target.tracks) {
          if (pub.type === 0 /* AUDIO */ || pub.source === 2 /* MICROPHONE */) {
            await svc.mutePublishedTrack(data.roomId, target.identity, pub.sid, data.muted);
          }
        }
      }
      return { ok: true as const };
    } catch {
      return { ok: false as const, reason: "livekit_error" as const };
    }
  });

/** Teacher/admin ends the LiveKit room, disconnecting everyone. */
export const closeLiveRoom = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((data: { roomId: string }) => data)
  .handler(async ({ data, context }) => {
    const env = readEnv();
    const { data: isHost } = await context.supabase.rpc("is_live_room_host", {
      _room_id: data.roomId,
      _user_id: context.userId,
    });
    if (!isHost) return { ok: false as const, reason: "forbidden" as const };
    if (env) {
      try {
        const { RoomServiceClient } = await import("livekit-server-sdk");
        const svc = new RoomServiceClient(
          env.url.replace(/^ws/, "http"),
          env.apiKey,
          env.apiSecret,
        );
        await svc.deleteRoom(data.roomId);
      } catch {
        /* room may not exist yet in LiveKit */
      }
    }
    return { ok: true as const };
  });
