import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BookOpen, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * Qlobal axtarış (maddə 1, Mərhələ 1): hələlik yalnız kurs adları üzrə.
 * Adi istifadəçi: `dashboard_allowed_courses` RPC (yalnız icazəli kurslar).
 * Admin: `courses` cədvəli (hamısı).
 * Siyahı bir dəfə yüklənir və 5 dəqiqə yaddaşda saxlanır (AppShell hər səhifədə yenidən qurulur).
 */
type CourseHit = { id: string; title: string };
const TTL = 5 * 60 * 1000;
const cache: Record<"admin" | "user", { at: number; uid: string; data: CourseHit[] } | undefined> =
  {
    admin: undefined,
    user: undefined,
  };

async function loadCourses(isAdmin: boolean, uid: string): Promise<CourseHit[]> {
  const key = isAdmin ? "admin" : "user";
  const c = cache[key];
  if (c && c.uid === uid && Date.now() - c.at < TTL) return c.data;
  let data: CourseHit[] = [];
  if (isAdmin) {
    const res = await supabase.from("courses").select("id,title").order("title");
    data = (res.data ?? []) as CourseHit[];
  } else {
    const res = await supabase.rpc("dashboard_allowed_courses");
    data = ((res.data ?? []) as CourseHit[]).map(({ id, title }) => ({ id, title }));
  }
  cache[key] = { at: Date.now(), uid, data };
  return data;
}

const norm = (s: string) => s.toLocaleLowerCase("az").normalize("NFC");

export function GlobalSearch({
  className,
  autoFocus,
  onNavigate,
}: {
  className?: string;
  autoFocus?: boolean;
  onNavigate?: () => void;
}) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [courses, setCourses] = useState<CourseHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);

  const ensureLoaded = () => {
    if (courses || loading || !user) return;
    setLoading(true);
    loadCourses(isAdmin, user.id)
      .then(setCourses)
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  };

  const results = useMemo(() => {
    const term = norm(q.trim());
    if (!term || !courses) return [];
    return courses.filter((c) => norm(c.title).includes(term)).slice(0, 8);
  }, [q, courses]);

  useEffect(() => setActiveIdx(0), [q]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const go = (c: CourseHit) => {
    setOpen(false);
    setQ("");
    onNavigate?.();
    navigate({ to: "/courses/$courseId", params: { courseId: c.id } });
  };

  const showPanel = open && q.trim().length > 0;

  return (
    <div ref={wrapRef} className={cn("relative w-full", className)}>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        type="search"
        role="combobox"
        aria-label="Kurs axtar"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showPanel && results[activeIdx] ? `${listId}-${activeIdx}` : undefined
        }
        autoFocus={autoFocus}
        value={q}
        placeholder="Kurs axtar…"
        onFocus={() => {
          ensureLoaded();
          setOpen(true);
        }}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          ensureLoaded();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIdx((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && results[activeIdx]) {
            e.preventDefault();
            go(results[activeIdx]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="h-10 w-full rounded-full border border-transparent bg-muted pl-10 pr-4 text-sm placeholder:text-[var(--gray-500)] focus-visible:border-brand-500 focus-visible:bg-card focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] [&::-webkit-search-cancel-button]:hidden"
      />
      {showPanel && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg">
          {loading && !courses ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Yüklənir…
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">Heç nə tapılmadı</div>
          ) : (
            <ul id={listId} role="listbox" aria-label="Kurslar">
              {results.map((c, i) => (
                <li
                  key={c.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === activeIdx}
                  onMouseEnter={() => setActiveIdx(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    go(c);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm",
                    i === activeIdx
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-200"
                      : "text-foreground",
                  )}
                >
                  <BookOpen className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
                  <span className="truncate">{c.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
