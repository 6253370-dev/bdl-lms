import "@livekit/components-styles";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  GridLayout,
  ParticipantTile,
  useTracks,
  useLocalParticipant,
  useConnectionState,
} from "@livekit/components-react";
import { Track, ConnectionState } from "livekit-client";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  MonitorUp,
  PhoneOff,
  Hand,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface LiveStageProps {
  token: string;
  serverUrl: string;
  isHost: boolean;
  forceMuted: boolean;
  handRaised: boolean;
  onToggleHand: () => void;
  onLeave: () => void;
  onEnd?: () => void;
  onMediaState?: (s: { mic: boolean; cam: boolean }) => void;
  onConnectionError?: () => void;
}

export default function LiveStage(props: LiveStageProps) {
  const everConnected = useRef(false);
  return (
    <LiveKitRoom
      token={props.token}
      serverUrl={props.serverUrl}
      connect
      audio={false}
      video={false}
      onConnected={() => {
        everConnected.current = true;
      }}
      onDisconnected={() => {
        // A disconnect before the first successful connect means the join
        // itself failed (e.g. LiveKit rejected the token) — surface an error
        // instead of silently navigating the user out of the room page.
        if (everConnected.current) props.onLeave();
        else props.onConnectionError?.();
      }}
      onError={() => {
        if (!everConnected.current) props.onConnectionError?.();
      }}
      data-lk-theme="default"
      className="flex flex-col h-full bg-sidebar rounded-xl overflow-hidden"
    >
      <StageInner {...props} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function StageInner({
  isHost,
  forceMuted,
  handRaised,
  onToggleHand,
  onLeave,
  onEnd,
  onMediaState,
}: LiveStageProps) {
  const { localParticipant } = useLocalParticipant();
  const connState = useConnectionState();
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const micOn = localParticipant?.isMicrophoneEnabled ?? false;
  const camOn = localParticipant?.isCameraEnabled ?? false;
  const screenOn = localParticipant?.isScreenShareEnabled ?? false;

  useEffect(() => {
    onMediaState?.({ mic: micOn, cam: camOn });
  }, [micOn, camOn, onMediaState]);

  useEffect(() => {
    if (forceMuted && micOn) localParticipant?.setMicrophoneEnabled(false);
  }, [forceMuted, micOn, localParticipant]);

  const toggle = async (kind: "mic" | "cam" | "screen") => {
    if (!localParticipant) return;
    try {
      if (kind === "mic") {
        if (forceMuted && !micOn) return;
        await localParticipant.setMicrophoneEnabled(!micOn);
      } else if (kind === "cam") {
        await localParticipant.setCameraEnabled(!camOn);
      } else {
        await localParticipant.setScreenShareEnabled(!screenOn, { audio: true });
      }
    } catch {
      /* permission denied — handled by browser prompt */
    }
  };

  return (
    <>
      <div className="flex-1 min-h-0 p-2">
        <GridLayout tracks={tracks} className="h-full">
          <ParticipantTile />
        </GridLayout>
      </div>

      <div className="border-t border-sidebar-border p-3 flex items-center justify-center gap-2 flex-wrap">
        <Button
          variant={micOn ? "default" : "secondary"}
          size="icon"
          aria-label={t.live.mic}
          disabled={forceMuted && !micOn}
          onClick={() => toggle("mic")}
        >
          {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </Button>
        <Button
          variant={camOn ? "default" : "secondary"}
          size="icon"
          aria-label={t.live.camera}
          onClick={() => toggle("cam")}
        >
          {camOn ? <VideoIcon className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </Button>
        <Button
          variant={screenOn ? "default" : "secondary"}
          size="icon"
          aria-label={t.live.screenShare}
          onClick={() => toggle("screen")}
        >
          <MonitorUp className="h-4 w-4" />
        </Button>
        {!isHost && (
          <Button
            variant={handRaised ? "default" : "secondary"}
            size="sm"
            onClick={onToggleHand}
          >
            <Hand className="h-4 w-4 mr-2" />
            {handRaised ? t.live.lowerHand : t.live.raiseHand}
          </Button>
        )}
        <Button variant="destructive" size="sm" onClick={isHost && onEnd ? onEnd : onLeave}>
          <PhoneOff className="h-4 w-4 mr-2" />
          {isHost ? t.live.endLesson : t.live.leave}
        </Button>
        <div
          className={cn(
            "ml-2 flex items-center gap-1 text-xs",
            connState === ConnectionState.Connected ? "text-emerald-500" : "text-amber-500",
          )}
        >
          {connState === ConnectionState.Connected ? (
            <>
              <Wifi className="h-3.5 w-3.5" /> {t.live.connGood}
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5" /> {t.live.reconnecting}
            </>
          )}
        </div>
      </div>
    </>
  );
}
