import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/courses/")({
  component: () => (
    <ProtectedRoute>
      <CoursesPage />
    </ProtectedRoute>
  ),
});

interface CourseRow {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
  passing_score: number;
}

function CoursesPage() {
  const { isAdmin, user } = useAuth();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("courses")
      .select("id,title,description,is_published,passing_score")
      .order("created_at", { ascending: false });
    setCourses((data ?? []) as CourseRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("courses")
      .insert({ title: title.trim(), description: description.trim() || null, created_by: user?.id })
      .select()
      .single();
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Kurs yaradıldı");
    setOpen(false);
    setTitle(""); setDescription("");
    navigate({ to: "/courses/$courseId", params: { courseId: data.id } });
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold">{t.courses.title}</h1>
          <p className="text-muted-foreground mt-1">{t.courses.subtitle}</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg"><Plus className="h-4 w-4 mr-2" /> {t.courses.newCourse}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t.courses.createNew}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t.courses.title_field}</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Məs. Müştəri xidməti" />
                </div>
                <div className="space-y-2">
                  <Label>{t.courses.description}</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qısa təsvir" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t.common.create}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : courses.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-display font-semibold text-lg">{t.courses.noneYet}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin ? t.courses.adminEmpty : t.courses.userEmpty}
          </p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((c) => (
            <Card key={c.id} className="p-5 h-full hover:shadow-[var(--shadow-elegant)] transition-shadow border-border/60 flex flex-col">
              <div className="h-32 -mx-5 -mt-5 mb-4 rounded-t-xl" style={{ background: "var(--gradient-hero)" }} />
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.is_published ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                  {c.is_published ? t.common.published : t.common.draft}
                </span>
                <span className="text-xs text-muted-foreground">{t.common.pass}: {c.passing_score}%</span>
              </div>
              <h3 className="font-display font-semibold text-lg leading-snug">{c.title}</h3>
              {c.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2 flex-1">{c.description}</p>}
              <div className="flex gap-2 mt-4">
                <Button asChild size="sm" className="flex-1">
                  <Link to="/courses/$courseId/play" params={{ courseId: c.id }}>{t.common.open}</Link>
                </Button>
                {isAdmin && (
                  <Button asChild size="sm" variant="outline">
                    <Link to="/courses/$courseId" params={{ courseId: c.id }}>{t.common.edit}</Link>
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
