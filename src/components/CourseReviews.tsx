import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StarRating } from "@/components/StarRating";
import { Loader2, MessageSquare, Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

export interface ReviewRow {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  full_name: string;
  avatar_url: string | null;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function CourseReviews({ courseId, canReview }: { courseId: string; canReview: boolean }) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState("");
  const [myReviewId, setMyReviewId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("course_reviews")
      .select("id,user_id,rating,comment,created_at,profiles(full_name,avatar_url)")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = ((data ?? []) as any[]).map((r) => ({
      id: r.id as string,
      user_id: r.user_id as string,
      rating: r.rating as number,
      comment: (r.comment ?? null) as string | null,
      created_at: r.created_at as string,
      full_name: (r.profiles?.full_name ?? "—") as string,
      avatar_url: (r.profiles?.avatar_url ?? null) as string | null,
    }));
    setReviews(rows);
    const mine = rows.find((r) => r.user_id === user?.id);
    if (mine) {
      setMyReviewId(mine.id);
      setMyRating(mine.rating);
      setMyComment(mine.comment ?? "");
      setEditing(false);
    } else {
      setMyReviewId(null);
      setMyRating(0);
      setMyComment("");
    }
    setLoading(false);
  }, [courseId, user?.id]);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => {
    const total = reviews.length;
    const avg = total ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
    const counts = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: reviews.filter((r) => r.rating === star).length,
      pct: total ? Math.round((reviews.filter((r) => r.rating === star).length / total) * 100) : 0,
    }));
    return { total, avg, counts };
  }, [reviews]);

  const saveReview = async () => {
    if (!user || myRating < 1) return toast.error("Zəhmət olmasa ulduz seçin");
    setSaving(true);
    const payload = { rating: myRating, comment: myComment.trim() || null, updated_at: new Date().toISOString() };
    const { error } = myReviewId
      ? await supabase.from("course_reviews").update(payload).eq("id", myReviewId)
      : await supabase.from("course_reviews").insert({ course_id: courseId, user_id: user.id, rating: myRating, comment: myComment.trim() || null });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(myReviewId ? "Rəyiniz yeniləndi" : "Rəyiniz əlavə olundu");
    setEditing(false);
    load();
  };

  const deleteReview = async () => {
    if (!myReviewId) return;
    const { error } = await supabase.from("course_reviews").delete().eq("id", myReviewId);
    if (error) return toast.error(error.message);
    toast.success("Rəyiniz silindi");
    load();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reviews;
    return reviews.filter((r) => r.full_name.toLowerCase().includes(q) || (r.comment ?? "").toLowerCase().includes(q));
  }, [reviews, search]);

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const mine = reviews.find((r) => r.user_id === user?.id);
  const showForm = canReview && (!mine || editing);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row gap-8">
          <div className="text-center sm:text-left shrink-0">
            <div className="text-5xl font-display font-bold">{summary.avg ? summary.avg.toFixed(1) : "—"}</div>
            <StarRating value={summary.avg} size="md" className="mt-2 justify-center" />
            <p className="text-sm text-muted-foreground mt-1">{summary.total} rəy</p>
          </div>
          <div className="flex-1 space-y-1.5">
            {summary.counts.map(({ star, pct, count }) => (
              <div key={star} className="flex items-center gap-3 text-sm">
                <span className="w-8 text-muted-foreground tabular-nums">{star} ★</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-warning transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-16 text-right text-muted-foreground tabular-nums">{pct}% ({count})</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* My review */}
      {canReview && (
        <Card className="p-6 space-y-3">
          {mine && !editing ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold">Sizin rəyiniz</h3>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label="Rəyi redaktə et">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={deleteReview} aria-label="Rəyi sil">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <StarRating value={mine.rating} size="sm" />
              {mine.comment && <p className="text-sm text-muted-foreground">{mine.comment}</p>}
            </div>
          ) : showForm ? (
            <>
              <h3 className="font-display font-semibold">{mine ? "Rəyinizi redaktə edin" : "Kursu qiymətləndirin"}</h3>
              <StarRating value={myRating} onChange={setMyRating} size="lg" />
              <Textarea
                value={myComment}
                onChange={(e) => setMyComment(e.target.value)}
                rows={3}
                placeholder="Kurs haqqında fikrinizi yazın (istəyə bağlı)..."
              />
              <div className="flex gap-2">
                <Button onClick={saveReview} disabled={saving || myRating < 1}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {mine ? "Yenilə" : "Rəy göndər"}
                </Button>
                {mine && (
                  <Button variant="outline" onClick={() => { setEditing(false); setMyRating(mine.rating); setMyComment(mine.comment ?? ""); }}>
                    Ləğv et
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </Card>
      )}
      {!canReview && !mine && (
        <Card className="p-4 border-dashed">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4 shrink-0" />
            Rəy yaza bilmək üçün əvvəlcə kursu tamamlamalısınız.
          </p>
        </Card>
      )}

      {/* Review list */}
      <div className="space-y-4">
        {reviews.filter((r) => r.user_id !== user?.id).slice(0, 4).map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
        {reviews.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">Hələ rəy yazılmayıb.</p>
        )}
        {reviews.length > 4 && (
          <div className="text-center">
            <Button variant="outline" onClick={() => setAllOpen(true)}>
              Bütün rəylər ({reviews.length})
            </Button>
          </div>
        )}
      </div>

      {/* All reviews dialog */}
      <Dialog open={allOpen} onOpenChange={setAllOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Bütün rəylər ({reviews.length})</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rəy və ya ad axtar..." className="pl-9" />
          </div>
          <div className="overflow-y-auto space-y-4 pr-1">
            {filtered.length ? (
              filtered.map((r) => <ReviewCard key={r.id} review={r} />)
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Heç bir rəy tapılmadı.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReviewCard({ review }: { review: ReviewRow }) {
  return (
    <div className="flex gap-3">
      <div className="h-10 w-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-sm font-semibold overflow-hidden shrink-0">
        {review.avatar_url ? (
          <img src={review.avatar_url} alt={review.full_name} className="h-full w-full object-cover" />
        ) : (
          review.full_name[0]?.toUpperCase() ?? "?"
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{review.full_name}</span>
          <StarRating value={review.rating} size="sm" />
          <span className="text-xs text-muted-foreground">{fmtDate(review.created_at)}</span>
        </div>
        {review.comment && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{review.comment}</p>}
      </div>
    </div>
  );
}
