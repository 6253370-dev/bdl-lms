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
import { useEffect, useRef, type ReactNode } from "react";
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
      <div className="flex-1 min-h-0 p-2 sm:p-3 [&_.lk-participant-tile]:rounded-xl [&_.lk-participant-tile]:overflow-hidden">
        <GridLayout tracks={tracks} className="h-full">
          <ParticipantTile />
        </GridLayout>
      </div>

      <div className="flex flex-wrap items-end justify-center gap-x-3 gap-y-2 border-t border-sidebar-border px-3 py-3 sm:gap-x-5">
        <ControlButton
          label={t.live.mic}
          active={micOn}
          disabled={forceMuted && !micOn}
          onClick={() => toggle("mic")}
        >
          {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </ControlButton>
        <ControlButton label={t.live.camera} active={camOn} onClick={() => toggle("cam")}>
          {camOn ? <VideoIcon className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </ControlButton>
        <ControlButton label={t.live.screenShare} active={screenOn} onClick={() => toggle("screen")}>
          <MonitorUp className="h-5 w-5" />
        </ControlButton>
        {!isHost && (
          <ControlButton
            label={handRaised ? t.live.lowerHand : t.live.raiseHand}
            active={handRaised}
            onClick={onToggleHand}
          >
            <Hand className="h-5 w-5" />
          </ControlButton>
        )}
        <div className="flex flex-col items-center gap-1.5">
          <Button
            variant="destructive"
            className="h-12 rounded-full px-5"
            onClick={isHost && onEnd ? onEnd : onLeave}
          >
            <PhoneOff className="h-5 w-5 mr-2" />
            {isHost ? t.live.endLesson : t.live.leave}
          </Button>
          <div
            role="status"
            className={cn(
              "flex items-center gap-1 text-xs",
              connState === ConnectionState.Connected
                ? "text-[var(--success-500)]"
                : "text-[var(--warning-500)]",
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
      </div>
    </>
  );
}

function ControlButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex w-16 flex-col items-center gap-1.5 sm:w-20">
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
          active
            ? "bg-primary text-primary-foreground hover:bg-[var(--primary-hover)]"
            : "bg-muted text-foreground hover:bg-[var(--gray-200)] dark:hover:bg-[var(--gray-700)]",
        )}
      >
        {children}
      </button>
      <span className="text-center text-[11px] leading-tight text-muted-foreground">{label}</span>
    </div>
  );
}
