/**
 * Live Quiz room background music.
 * The track is an MP3 uploaded by an admin on the quiz itself.
 * There is no default/generated music — without an uploaded file there is no sound.
 */
import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "quiz-room-music";

export function useRoomMusic(
  url: string | null | undefined,
  status: "lobby" | "active" | "finished",
) {
  const [enabled, setEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setEnabled(localStorage.getItem(STORAGE_KEY) !== "off");
  }, []);

  useEffect(() => {
    if (!url) {
      audioRef.current?.pause();
      audioRef.current = null;
      return;
    }
    if (!audioRef.current || audioRef.current.src !== url) {
      audioRef.current?.pause();
      const a = new Audio(url);
      a.loop = true;
      a.volume = 0.35;
      audioRef.current = a;
    }
    const audio = audioRef.current;
    if (enabled && (status === "lobby" || status === "active")) {
      audio.volume = status === "active" ? 0.25 : 0.4;
      void audio.play().catch(() => {});
    } else {
      audio.pause();
    }
    return () => {
      audio.pause();
    };
  }, [url, enabled, status]);

  const toggle = () => {
    setEnabled((v) => {
      localStorage.setItem(STORAGE_KEY, v ? "off" : "on");
      return !v;
    });
  };

  return { musicOn: enabled, toggleMusic: toggle, hasMusic: !!url };
}
