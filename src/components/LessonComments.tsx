import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Comment {
  id: string;
  block_id: string;
  course_id: string;
  user_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
}

interface AuthorInfo {
  full_name: string | null;
  isAdmin: boolean;
}

export function LessonComments({ blockId, courseId }: { blockId: string; courseId: string }) {
  const { user, isAdmin } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [authors, setAuthors] = useState<Record<string, AuthorInfo>>({});
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // For regular users we read their own thread. For admins viewing the lesson, we
    // show their own thread with the user (none in this view) — the per-user admin
    // view lives elsewhere if needed. Here, scope by current user as the thread owner.
    const { data, error } = await supabase
      .from("lesson_comments")
      .select("*")
      .eq("block_id", blockId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as Comment[];
    setComments(list);

    // Resolve author display names
    const ids = Array.from(new Set(list.map((c) => c.author_id)));
    if (ids.length) {
      const [{ data: profs }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", ids),
        supabase.from("user_roles").select("user_id, role").in("user_id", ids),
      ]);
      const adminSet = new Set(
        ((roles ?? []) as { user_id: string; role: string }[])
          .filter((r) => r.role === "admin" || r.role === "super_admin")
          .map((r) => r.user_id),
      );
      const map: Record<string, AuthorInfo> = {};
      ((profs ?? []) as { id: string; full_name: string | null }[]).forEach((p) => {
        map[p.id] = { full_name: p.full_name, isAdmin: adminSet.has(p.id) };
      });
      setAuthors(map);
    }
    setLoading(false);
  }, [blockId, user]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!user || !body.trim()) return;
    setSending(true);
    const { error } = await supabase.from("lesson_comments").insert({
      block_id: blockId,
      course_id: courseId,
      user_id: user.id, // thread is owned by current user (when admin posts in own thread it equals self; admin replies to other users via dedicated admin view)
      author_id: user.id,
      body: body.trim(),
    });
    if (error) {
      toast.error(error.message);
    } else {
      setBody("");
      await load();
    }
    setSending(false);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("lesson_comments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else setComments((cs) => cs.filter((c) => c.id !== id));
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-1">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-display font-semibold">{t.comments.title}</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">{t.comments.subtitle}</p>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">{t.comments.empty}</p>
      ) : (
        <div className="space-y-3 mb-4">
          {comments.map((c) => {
            const a = authors[c.author_id];
            const mine = c.author_id === user?.id;
            const adminMsg = a?.isAdmin;
            return (
              <div
                key={c.id}
                className={cn(
                  "rounded-lg p-3 text-sm",
                  adminMsg ? "bg-primary/5 border border-primary/20" : "bg-muted/50",
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-semibold">
                    {adminMsg ? t.comments.admin : (mine ? t.comments.you : (a?.full_name ?? "—"))}
                    <span className="ml-2 text-muted-foreground font-normal">
                      {new Date(c.created_at).toLocaleString("az-AZ", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </div>
                  {(mine || isAdmin) && (
                    <button
                      onClick={() => remove(c.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={t.comments.delete}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-wrap leading-relaxed">{c.body}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t.comments.placeholder}
          rows={3}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={submit} disabled={!body.trim() || sending}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {t.comments.send}
          </Button>
        </div>
      </div>
    </Card>
  );
}
