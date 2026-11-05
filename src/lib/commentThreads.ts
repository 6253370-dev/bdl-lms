// "Cavablanmamış şərh" tərifi (AppShell say nişanı və Şərhlər səhifəsi üçün ortaq).
//
// Zəncir = eyni istifadəçinin (user_id) eyni dərsdəki (block_id) bütün mesajları.
// Zəncir CAVABLANMAMIŞDIR, əgər onun ən son mesajının müəllifi (author_id) admin və ya super admin DEYİLSƏ.
// Yəni istifadəçi yazıb və ondan sonra admin cavab verməyib.

export interface ThreadMessage {
  user_id: string;
  block_id: string;
  author_id: string;
  created_at: string;
}

/** Hər zəncirin son mesajını qaytarır. Açar: `${user_id}|${block_id}`. */
export function lastMessageByThread<T extends ThreadMessage>(messages: T[]): Map<string, T> {
  const last = new Map<string, T>();
  for (const m of messages) {
    const key = `${m.user_id}|${m.block_id}`;
    const cur = last.get(key);
    if (!cur || m.created_at > cur.created_at) last.set(key, m);
  }
  return last;
}

export function isThreadUnanswered(lastAuthorId: string, adminIds: Set<string>) {
  return !adminIds.has(lastAuthorId);
}

export function countUnansweredThreads(messages: ThreadMessage[], adminIds: Set<string>) {
  let n = 0;
  for (const m of lastMessageByThread(messages).values()) {
    if (isThreadUnanswered(m.author_id, adminIds)) n++;
  }
  return n;
}
