import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { countUnansweredThreads, type ThreadMessage } from "@/lib/commentThreads";

// Yan menyudakı "Şərhlər" say nişanı üçün: cavablanmamış zəncir sayı (tərif: src/lib/commentThreads.ts).
// Yalnız adminlər üçün oxunur. AppShell hər səhifədə yenidən qurulduğu üçün nəticə 60 saniyə yaddaşda saxlanır.
const TTL = 60 * 1000;
let cached: { at: number; uid: string; count: number } | null = null;
let inflight: Promise<number> | null = null;

async function fetchCount(): Promise<number> {
  const [{ data: msgs, error }, { data: roles }] = await Promise.all([
    supabase.from("lesson_comments").select("user_id,block_id,author_id,created_at"),
    supabase.from("user_roles").select("user_id,role").in("role", ["admin", "super_admin"]),
  ]);
  if (error) throw error;
  const adminIds = new Set(((roles ?? []) as { user_id: string }[]).map((r) => r.user_id));
  return countUnansweredThreads((msgs ?? []) as ThreadMessage[], adminIds);
}

export function useUnansweredComments(enabled: boolean, uid: string | undefined) {
  const fresh =
    cached && uid && cached.uid === uid && Date.now() - cached.at < TTL ? cached.count : null;
  const [count, setCount] = useState<number | null>(fresh);

  useEffect(() => {
    if (!enabled || !uid) return;
    if (cached && cached.uid === uid && Date.now() - cached.at < TTL) {
      setCount(cached.count);
      return;
    }
    let alive = true;
    inflight ??= fetchCount().finally(() => {
      inflight = null;
    });
    inflight
      .then((n) => {
        cached = { at: Date.now(), uid, count: n };
        if (alive) setCount(n);
      })
      .catch(() => {
        /* nişan göstərilmir */
      });
    return () => {
      alive = false;
    };
  }, [enabled, uid]);

  return enabled ? count : null;
}

/** Şərhlər səhifəsində cavab yazılanda/silinəndə çağırılır ki, nişan növbəti səhifədə yenilənsin. */
export function invalidateUnansweredComments() {
  cached = null;
}
