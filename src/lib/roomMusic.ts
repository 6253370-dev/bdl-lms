/**
 * Live Quiz room background music.
 * Generated with the Web Audio API (no external audio assets required).
 * Lobby → calm arpeggio, Active → faster driving loop.
 */
import { useEffect, useRef, useState } from "react";

type Mode = "lobby" | "active" | "off";

const LOBBY_NOTES = [220, 277.18, 329.63, 415.3, 329.63, 277.18];
const ACTIVE_NOTES = [261.63, 329.63, 392, 523.25, 392, 329.63, 293.66, 349.23];

class MusicEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private step = 0;

  start(mode: Exclude<Mode, "off">) {
    this.stop();
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    void this.ctx.resume();
    this.master = this.ctx.createGain();
    this.master.gain.value = mode === "active" ? 0.05 : 0.035;
    this.master.connect(this.ctx.destination);

    const notes = mode === "active" ? ACTIVE_NOTES : LOBBY_NOTES;
    const interval = mode === "active" ? 220 : 420;
    this.step = 0;
    const tick = () => {
      const ctx = this.ctx;
      const master = this.master;
      if (!ctx || !master) return;
      const freq = notes[this.step % notes.length];
      this.step += 1;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = mode === "active" ? "square" : "triangle";
      osc.frequency.value = freq;
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(1, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + interval / 1000);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + interval / 1000 + 0.05);

      // bass note every 4 steps
      if (this.step % 4 === 1) {
        const bass = ctx.createOscillator();
        const bg = ctx.createGain();
        bass.type = "sine";
        bass.frequency.value = freq / 4;
        bg.gain.setValueAtTime(0.0001, t);
        bg.gain.exponentialRampToValueAtTime(0.8, t + 0.03);
        bg.gain.exponentialRampToValueAtTime(0.0001, t + (interval * 4) / 1000);
        bass.connect(bg);
        bg.connect(master);
        bass.start(t);
        bass.stop(t + (interval * 4) / 1000 + 0.05);
      }
    };
    tick();
    this.timer = window.setInterval(tick, interval);
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    if (this.ctx) {
      const ctx = this.ctx;
      this.ctx = null;
      this.master = null;
      void ctx.close().catch(() => {});
    }
  }
}

const STORAGE_KEY = "quiz-room-music";

export function useRoomMusic(status: "lobby" | "active" | "finished") {
  const [enabled, setEnabled] = useState(false);
  const engineRef = useRef<MusicEngine | null>(null);

  useEffect(() => {
    setEnabled(localStorage.getItem(STORAGE_KEY) !== "off");
  }, []);

  useEffect(() => {
    if (!engineRef.current) engineRef.current = new MusicEngine();
    const engine = engineRef.current;
    if (enabled && (status === "lobby" || status === "active")) engine.start(status);
    else engine.stop();
    return () => engine.stop();
  }, [enabled, status]);

  const toggle = () => {
    setEnabled((v) => {
      localStorage.setItem(STORAGE_KEY, v ? "off" : "on");
      return !v;
    });
  };

  return { musicOn: enabled, toggleMusic: toggle };
}
