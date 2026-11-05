import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { Loader2, MessageSquare, Send, Trash2, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/design/PageHeader";
import { MasterDetail } from "@/components/design/MasterDetail";
import { UserAvatar, AvatarStack } from "@/components/design/UserAvatar";
import { StatusChip } from "@/components/design/StatusChip";
import { isThreadUnanswered } from "@/lib/commentThreads";
import { invalidateUnansweredComments } from "@/lib/useUnansweredComments";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/admin/comments")({
  head: () => ({ meta: [
    { title: "Şərhlərin idarəsi | Baku Digital Lab" },
    { name: "description", content: "Dərs şərhləri və istifadəçilərlə yazışmalar." },
    { property: "og:title", content: "Şərhlərin idarəsi | Baku Digital Lab" },
    { property: "og:description", content: "Dərs şərhləri və istifadəçilərlə yazışmalar." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <ProtectedRoute>
      <AdminCommentsPage />
    </ProtectedRoute>
  ),
});

interface CommentRow {
  id: string;
  block_id: string;
  course_id: string;
  user_id: string;
  author_id: string;
  body: string;
  created_at: string;
}
interface ProfileLite { id: string; full_name: string }
interface BlockLite { id: string; title: string; course_id: string }
interface CourseLite { id: string; title: string }

interface ThreadKey { userId: string; blockId: string }
interface ThreadInfo extends ThreadKey {
  user: ProfileLite | null;
  block: BlockLite | null;
  course: CourseLite | null;
  count: number;
  lastAt: string;
  lastBody: string;
  lastAuthorId: string;
}

function AdminCommentsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [blocks, setBlocks] = useState<Record<string, BlockLite>>({});
  const [courses, setCourses] = useState<Record<string, CourseLite>>({});
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<ThreadKey | null>(null);
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [lessonFilter, setLessonFilter] = useState<string>("all");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);


  const load = useCallback(async () => {
    setLoading(true);
    const { data: cmts, error } = await supabase
      .from("lesson_comments")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const list = (cmts ?? []) as CommentRow[];
    setComments(list);

    const userIds = Array.from(new Set(list.flatMap((c) => [c.user_id, c.author_id])));
    const blockIds = Array.from(new Set(list.map((c) => c.block_id)));
    const courseIds = Array.from(new Set(list.map((c) => c.course_id)));

    const [{ data: profs }, { data: roles }, { data: blks }, { data: crs }] = await Promise.all([
      userIds.length ? supabase.from("profiles").select("id, full_name").in("id", userIds) : Promise.resolve({ data: [] }),
      userIds.length ? supabase.from("user_roles").select("user_id, role").in("user_id", userIds) : Promise.resolve({ data: [] }),
      blockIds.length ? supabase.from("course_blocks").select("id, title, course_id").in("id", blockIds) : Promise.resolve({ data: [] }),
      courseIds.length ? supabase.from("courses").select("id, title").in("id", courseIds) : Promise.resolve({ data: [] }),
    ]);
    const pMap: Record<string, ProfileLite> = {};
    ((profs ?? []) as ProfileLite[]).forEach((p) => { pMap[p.id] = p; });
    setProfiles(pMap);
    const bMap: Record<string, BlockLite> = {};
    ((blks ?? []) as BlockLite[]).forEach((b) => { bMap[b.id] = b; });
    setBlocks(bMap);
    const cMap: Record<string, CourseLite> = {};
    ((crs ?? []) as CourseLite[]).forEach((c) => { cMap[c.id] = c; });
    setCourses(cMap);
    setAdminIds(new Set(
      ((roles ?? []) as { user_id: string; role: string }[])
        .filter((r) => r.role === "admin" || r.role === "super_admin")
        .map((r) => r.user_id),
    ));
    setLoading(false);
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const allThreads = useMemo<ThreadInfo[]>(() => {
    const map = new Map<string, ThreadInfo>();
    for (const c of comments) {
      const key = `${c.user_id}|${c.block_id}`;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        if (c.created_at > existing.lastAt) {
          existing.lastAt = c.created_at;
          existing.lastBody = c.body;
          existing.lastAuthorId = c.author_id;
        }
      } else {
        map.set(key, {
          userId: c.user_id,
          blockId: c.block_id,
          user: profiles[c.user_id] ?? null,
          block: blocks[c.block_id] ?? null,
          course: courses[c.course_id] ?? null,
          count: 1,
          lastAt: c.created_at,
          lastBody: c.body,
          lastAuthorId: c.author_id,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  }, [comments, profiles, blocks, courses]);

  const courseOptions = useMemo(() => {
    const map = new Map<string, string>();
    allThreads.forEach((th) => {
      if (th.course) map.set(th.course.id, th.course.title);
    });
    return Array.from(map, ([id, title]) => ({ id, title })).sort((a, b) =>
      a.title.localeCompare(b.title, "az"),
    );
  }, [allThreads]);

  const lessonOptions = useMemo(() => {
    if (courseFilter === "all") return [];
    const map = new Map<string, string>();
    allThreads
      .filter((th) => th.course?.id === courseFilter)
      .forEach((th) => {
        if (th.block) map.set(th.block.id, th.block.title);
      });
    return Array.from(map, ([id, title]) => ({ id, title })).sort((a, b) =>
      a.title.localeCompare(b.title, "az"),
    );
  }, [allThreads, courseFilter]);

  const threads = useMemo(
    () =>
      allThreads.filter((th) => {
        if (courseFilter !== "all" && th.course?.id !== courseFilter) return false;
        if (lessonFilter !== "all" && th.blockId !== lessonFilter) return false;
        return true;
      }),
    [allThreads, courseFilter, lessonFilter],
  );


  const activeMessages = useMemo(() => {
    if (!active) return [];
    return comments
      .filter((c) => c.user_id === active.userId && c.block_id === active.blockId)
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  }, [active, comments]);

  const activeParticipants = useMemo(
    () =>
      Array.from(new Set(activeMessages.map((c) => c.author_id))).map((id) => ({
        id,
        name: profiles[id]?.full_name ?? null,
      })),
    [activeMessages, profiles],
  );

  const sendReply = async () => {
    if (!user || !active || !reply.trim()) return;
    setSending(true);
    const { error } = await supabase.from("lesson_comments").insert({
      block_id: active.blockId,
      course_id: blocks[active.blockId]?.course_id ?? activeMessages[0]?.course_id,
      user_id: active.userId, // post into the student's thread
      author_id: user.id,
      body: reply.trim(),
    });
    if (error) toast.error(error.message);
    else {
      setReply("");
      invalidateUnansweredComments();
      await load();
    }
    setSending(false);
  };

  const removeMsg = async (id: string) => {
    const { error } = await supabase.from("lesson_comments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      invalidateUnansweredComments();
      setComments((cs) => cs.filter((c) => c.id !== id));
    }
  };

  if (authLoading) {
    return <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!isAdmin) {
    return (
      <div className="p-10 text-center">
        <p className="text-muted-foreground">Bu səhifəyə girişin yoxdur.</p>
        <Button asChild variant="link"><Link to="/dashboard">Ana səhifə</Link></Button>
      </div>
    );
  }

  return (
    <div className="bento-page">
      <PageHeader title={t.comments.adminTitle} description={t.comments.adminSubtitle} />

      <Card className="p-4 mb-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">{t.comments.course}</Label>
            <Select
              value={courseFilter}
              onValueChange={(v) => {
                setCourseFilter(v);
                setLessonFilter("all");
                setActive(null);
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Bütün kurslar</SelectItem>
                {courseOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">{t.comments.lesson}</Label>
            <Select
              value={lessonFilter}
              onValueChange={(v) => { setLessonFilter(v); setActive(null); }}
              disabled={courseFilter === "all"}
            >
              <SelectTrigger>
                <SelectValue placeholder="Əvvəlcə kurs seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Bütün dərslər</SelectItem>
                {lessonOptions.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>


      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : threads.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t.comments.adminEmpty}</p>
        </Card>
      ) : (
        <MasterDetail
          className="lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.6fr)]"
          detailOpen={!!active}
          onBack={() => setActive(null)}
          backLabel="Geri"
          list={
            <Card className="p-2 max-h-[70vh] overflow-y-auto">
              {threads.map((th) => {
                const isActive = active?.userId === th.userId && active?.blockId === th.blockId;
                return (
                  <Button
                    variant="ghost"
                    key={`${th.userId}-${th.blockId}`}
                    onClick={() => setActive({ userId: th.userId, blockId: th.blockId })}
                    className={cn(
                      "block h-auto w-full text-left p-3 rounded-lg whitespace-normal transition-colors",
                      isActive ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                    )}
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <UserAvatar name={th.user?.full_name} size="sm" />
                      <div className="font-semibold text-sm truncate flex-1 min-w-0">
                        {th.user?.full_name ?? "—"}
                      </div>
                      {isThreadUnanswered(th.lastAuthorId, adminIds) && (
                        <StatusChip tone="warning" dot>
                          Cavabsız
                        </StatusChip>
                      )}
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full",
                          isActive ? "bg-primary/10" : "bg-muted-foreground/15",
                        )}
                      >
                        {th.count}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "text-xs flex items-center gap-1 mb-1",
                        "text-muted-foreground",
                      )}
                    >
                      <BookOpen className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {th.course?.title ?? "—"} · {th.block?.title ?? "—"}
                      </span>
                    </div>
                    <div className={cn("text-xs truncate", "text-muted-foreground")}>
                      {th.lastBody}
                    </div>
                  </Button>
                );
              })}
            </Card>
          }
          detail={
            <Card className="p-5 flex flex-col min-h-[60vh]">
              {!active ? (
                <div className="m-auto text-center text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mx-auto mb-3" />
                  <p className="text-sm">{t.comments.selectThread}</p>
                </div>
              ) : (
                <>
                  <div className="border-b pb-3 mb-4 flex items-start gap-3">
                    <UserAvatar name={profiles[active.userId]?.full_name} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="font-display font-semibold">
                        {profiles[active.userId]?.full_name ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t.comments.course}:{" "}
                        {courses[blocks[active.blockId]?.course_id ?? ""]?.title ?? "—"} ·{" "}
                        {t.comments.lesson}: {blocks[active.blockId]?.title ?? "—"}
                      </div>
                    </div>
                    <AvatarStack people={activeParticipants} max={4} size="sm" />
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                    {activeMessages.map((c) => {
                      const isAdminMsg = adminIds.has(c.author_id);
                      return (
                        <div
                          key={c.id}
                          className={cn(
                            "rounded-lg p-3 text-sm max-w-[85%]",
                            isAdminMsg
                              ? "bg-primary/10 border border-primary/20 ml-auto"
                              : "bg-muted",
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold">
                              {isAdminMsg
                                ? t.comments.admin
                                : (profiles[c.author_id]?.full_name ?? "—")}
                              <span className="ml-2 font-normal text-muted-foreground">
                                {new Date(c.created_at).toLocaleString("az-AZ", {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                              </span>
                            </span>
                            <button
                              onClick={() => removeMsg(c.id)}
                              className="text-muted-foreground hover:text-destructive"
                              aria-label={t.comments.delete}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{c.body}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-2">
                    <Textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder={t.comments.replyPlaceholder}
                      rows={3}
                    />
                    <div className="flex justify-end">
                      <Button size="sm" onClick={sendReply} disabled={!reply.trim() || sending}>
                        {sending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        {t.comments.send}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </Card>
          }
        />
      )}
    </div>
  );
}
