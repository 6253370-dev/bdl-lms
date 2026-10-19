import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export const EXAM_BLOCKED_MSG = "İmtahan bloklanıb. Blokdan çıxmaq üçün administratora müraciət edin.";

/** Returns blocked reason if current user is exam-blocked, otherwise null. */
export async function getExamBlock(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("is_exam_blocked,exam_blocked_reason")
    .eq("id", userId)
    .maybeSingle();
  return data?.is_exam_blocked ? data.exam_blocked_reason || "Qayda pozuntusu" : null;
}

export async function enterFullscreen() {
  try {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    if (document.fullscreenElement) return;
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" } as FullscreenOptions);
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  } catch {
    /* not supported (e.g. iOS Safari) */
  }
}

export async function exitFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* ignore */
  }
}

/**
 * While `active`, enforces fullscreen and blocks the user on tab/app switch,
 * window blur (second monitor / other window) or leaving fullscreen.
 * Admins are never blocked (enabled=false).
 */
export function useExamProctor(active: boolean, enabled: boolean, onBlocked: (reason: string) => void) {
  const firedRef = useRef(false);
  const cbRef = useRef(onBlocked);
  cbRef.current = onBlocked;

  useEffect(() => {
    if (!active || !enabled) return;
    firedRef.current = false;
    const startedAt = Date.now();
    let wasFullscreen = !!document.fullscreenElement;

    const violate = (reason: string) => {
      if (firedRef.current) return;
      if (Date.now() - startedAt < 1500) return; // grace for fullscreen transition
      firedRef.current = true;
      // Query builders are lazy — must be awaited/then'd to actually send the request.
      supabase.rpc("block_me_from_exam", { _reason: reason }).then(({ error }) => {
        if (error) console.error("block_me_from_exam failed", error);
      });
      void exitFullscreen();
      cbRef.current(reason);
    };

    const onVis = () => { if (document.visibilityState === "hidden") violate("Tab və ya tətbiq dəyişildi"); };
    const onBlur = () => violate("Pəncərədən çıxıldı (başqa pəncərə / ikinci monitor)");
    const onFs = () => {
      if (document.fullscreenElement) { wasFullscreen = true; return; }
      if (wasFullscreen) violate("Tam ekran rejimindən çıxıldı");
    };
    const onPageHide = () => violate("Səhifə tərk edildi");

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
    };
  }, [active, enabled]);
}
