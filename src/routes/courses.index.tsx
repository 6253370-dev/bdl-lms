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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Plus, Loader2, Folder, Search, MoreVertical, Pencil, Trash2, FolderPlus, Move, Award, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { downloadCertificateSmart } from "@/lib/certificate";
import { StarRating } from "@/components/StarRating";


export const Route = createFileRoute("/courses/")({
  head: () => ({
    meta: [
      { title: "Kurslar — Baku Digital Lab" },
      { name: "description", content: "Baku Digital Lab təlim kursları, müəllimlər və iştirakçıların qiymətləndirmələri." },
      { property: "og:title", content: "Kurslar — Baku Digital Lab" },
      { property: "og:description", content: "Təlim kurslarına baxın, rəyləri oxuyun və öyrənməyə davam edin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
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
  folder_id: string | null;
  cover_image_url: string | null;
  certificate_template_url: string | null;
  instructor_name: string | null;
}

interface CertRow {
  course_id: string;
  serial: string;
  full_name: string;
  course_title: string;
  score_percent: number;
  issued_at: string;
}


interface FolderRow {
  id: string;
  name: string;
  parent_id: string | null;
}

const ALL = "__all__";
const UNCAT = "__uncat__";

function CoursesPage() {
  const { isAdmin, user } = useAuth();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [certs, setCerts] = useState<Record<string, CertRow>>({});
  const [certBusy, setCertBusy] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, { avg: number; count: number }>>({});

  const [loading, setLoading] = useState(true);

  // Course create
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [createFolderId, setCreateFolderId] = useState<string>(UNCAT);
  const [creating, setCreating] = useState(false);

  // Folder create/rename
  const [folderDialog, setFolderDialog] = useState<{ mode: "create" | "rename"; id?: string; name: string } | null>(null);

  // Move dialog
  const [moveDialog, setMoveDialog] = useState<{ courseId: string; current: string | null } | null>(null);

  // Filter / search
  const [activeFolder, setActiveFolder] = useState<string>(ALL);
  const [search, setSearch] = useState("");

  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const [cRes, fRes, rRes] = await Promise.all([
      supabase.from("courses").select("id,title,description,is_published,passing_score,folder_id,cover_image_url,certificate_template_url,instructor_name").order("created_at", { ascending: false }),
      supabase.from("folders").select("id,name,parent_id").order("name"),
      supabase.from("course_reviews").select("course_id,rating"),
    ]);
    const rMap: Record<string, { sum: number; count: number }> = {};
    ((rRes.data ?? []) as { course_id: string; rating: number }[]).forEach((r) => {
      const cur = rMap[r.course_id] ?? { sum: 0, count: 0 };
      cur.sum += r.rating; cur.count += 1;
      rMap[r.course_id] = cur;
    });
    const rFinal: Record<string, { avg: number; count: number }> = {};
    Object.entries(rMap).forEach(([id, v]) => { rFinal[id] = { avg: v.sum / v.count, count: v.count }; });
    setRatings(rFinal);
    let list = (cRes.data ?? []) as CourseRow[];
    if (!isAdmin) {
      // Hide unpublished
      list = list.filter((c) => c.is_published);
      // Apply per-user access rules
      if (user?.id) {
        const [{ data: ca }, { data: fa }] = await Promise.all([
          supabase.from("user_course_access").select("course_id").eq("user_id", user.id),
          supabase.from("user_folder_access").select("folder_id").eq("user_id", user.id),
        ]);
        const courseIds = new Set((ca ?? []).map((r) => r.course_id));
        const folderIds = new Set((fa ?? []).map((r) => r.folder_id));
        const hasRules = courseIds.size > 0 || folderIds.size > 0;
        if (hasRules) {
          list = list.filter((c) => courseIds.has(c.id) || (c.folder_id && folderIds.has(c.folder_id)));
        }
      }
    }
    setCourses(list);
    setFolders((fRes.data ?? []) as FolderRow[]);

    // Keçid progresi
    if (user?.id && list.length) {
      const ids = list.map((c) => c.id);
      const [{ data: blocks }, { data: done }] = await Promise.all([
        supabase.from("course_blocks").select("id,course_id,block_type").in("course_id", ids),
        supabase.from("block_progress").select("block_id,course_id").eq("user_id", user.id).in("course_id", ids),
      ]);
      const totals = new Map<string, number>();
      (blocks ?? []).forEach((b) => {
        if (b.block_type === "quiz") return;
        totals.set(b.course_id, (totals.get(b.course_id) ?? 0) + 1);
      });
      const doneCounts = new Map<string, number>();
      (done ?? []).forEach((d) => doneCounts.set(d.course_id, (doneCounts.get(d.course_id) ?? 0) + 1));
      const map: Record<string, number> = {};
      ids.forEach((id) => {
        const total = totals.get(id) ?? 0;
        map[id] = total ? Math.min(100, Math.round(((doneCounts.get(id) ?? 0) / total) * 100)) : 0;
      });
      setProgress(map);

      const { data: certRows } = await supabase
        .from("certificates")
        .select("course_id,serial,full_name,course_title,score_percent,issued_at")
        .eq("user_id", user.id)
        .in("course_id", ids);
      const certMap: Record<string, CertRow> = {};
      (certRows ?? []).forEach((c: any) => (certMap[c.course_id] = c as CertRow));
      setCerts(certMap);
    } else {
      setProgress({});
      setCerts({});
    }
    setLoading(false);
  };

  const handleCertificate = async (c: CourseRow) => {
    const cert = certs[c.id];
    if (!cert) return;
    setCertBusy(c.id);
    try {
      await downloadCertificateSmart(
        {
          fullName: cert.full_name,
          courseTitle: cert.course_title,
          scorePercent: Math.round(Number(cert.score_percent)),
          serial: cert.serial,
          issuedAt: cert.issued_at,
        },
        c.certificate_template_url,
      );
    } catch (e: any) {
      toast.error(e.message ?? "Yükləmə alınmadı");
    } finally {
      setCertBusy(null);
    }
  };


  useEffect(() => { load(); }, [isAdmin, user?.id]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("courses")
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        created_by: user?.id,
        folder_id: createFolderId === UNCAT ? null : createFolderId,
      })
      .select()
      .single();
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Kurs yaradıldı");
    setOpen(false);
    setTitle(""); setDescription(""); setCreateFolderId(UNCAT);
    navigate({ to: "/courses/$courseId", params: { courseId: data.id } });
  };

  const handleSaveFolder = async () => {
    if (!folderDialog || !folderDialog.name.trim()) return;
    if (folderDialog.mode === "create") {
      const { error } = await supabase.from("folders").insert({ name: folderDialog.name.trim(), created_by: user?.id });
      if (error) { toast.error(error.message); return; }
      toast.success("Qovluq yaradıldı");
    } else {
      const { error } = await supabase.from("folders").update({ name: folderDialog.name.trim() }).eq("id", folderDialog.id!);
      if (error) { toast.error(error.message); return; }
      toast.success("Qovluq yeniləndi");
    }
    setFolderDialog(null);
    load();
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm(t.folders.confirmDelete)) return;
    // Move courses out
    await supabase.from("courses").update({ folder_id: null }).eq("folder_id", id);
    const { error } = await supabase.from("folders").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Qovluq silindi");
    if (activeFolder === id) setActiveFolder(ALL);
    load();
  };

  const handleMove = async (folderId: string) => {
    if (!moveDialog) return;
    const { error } = await supabase
      .from("courses")
      .update({ folder_id: folderId === UNCAT ? null : folderId })
      .eq("id", moveDialog.courseId);
    if (error) { toast.error(error.message); return; }
    toast.success("Köçürüldü");
    setMoveDialog(null);
    load();
  };

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    let uncat = 0;
    courses.forEach((c) => {
      if (!c.folder_id) uncat++;
      else map.set(c.folder_id, (map.get(c.folder_id) ?? 0) + 1);
    });
    return { byFolder: map, uncategorized: uncat, total: courses.length };
  }, [courses]);

  const visibleCourses = useMemo(() => {
    let list = courses;
    if (activeFolder === UNCAT) list = list.filter((c) => !c.folder_id);
    else if (activeFolder !== ALL) list = list.filter((c) => c.folder_id === activeFolder);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.description ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [courses, activeFolder, search]);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">{t.courses.title}</h1>
          <p className="text-muted-foreground mt-1">{t.courses.subtitle}</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setFolderDialog({ mode: "create", name: "" })}>
              <FolderPlus className="h-4 w-4 mr-2" /> {t.folders.new}
            </Button>
          )}
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
                  <div className="space-y-2">
                    <Label>{t.folders.moveTo}</Label>
                    <Select value={createFolderId} onValueChange={setCreateFolderId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNCAT}>{t.folders.uncategorized}</SelectItem>
                        {folders.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
      </div>

      {/* Search + folder dropdown */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.folders.search}
            className="pl-9"
          />
        </div>
        <Select value={activeFolder} onValueChange={setActiveFolder}>
          <SelectTrigger className="w-[240px]">
            <Folder className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t.folders.all} ({counts.total})</SelectItem>
            <SelectItem value={UNCAT}>{t.folders.uncategorized} ({counts.uncategorized})</SelectItem>
            {folders.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name} ({counts.byFolder.get(f.id) ?? 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAdmin && activeFolder !== ALL && activeFolder !== UNCAT && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  const f = folders.find((x) => x.id === activeFolder);
                  if (f) setFolderDialog({ mode: "rename", id: f.id, name: f.name });
                }}
              >
                <Pencil className="h-4 w-4 mr-2" /> {t.folders.rename}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteFolder(activeFolder)}>
                <Trash2 className="h-4 w-4 mr-2" /> {t.folders.delete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div>
        {/* Courses grid */}
        <div>
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : visibleCourses.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-display font-semibold text-lg">
                {search ? t.folders.noResults : t.courses.noneYet}
              </h3>
              {!search && (
                <p className="text-sm text-muted-foreground mt-1">
                  {isAdmin ? t.courses.adminEmpty : t.courses.userEmpty}
                </p>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-5">
              {visibleCourses.map((c) => (
                <article key={c.id} className="group relative flex min-w-0 flex-col rounded-lg border border-border bg-card p-4 text-card-foreground transition-shadow hover:shadow-[var(--shadow-card)] focus-within:ring-2 focus-within:ring-ring">
                  <div className="relative mb-4 aspect-video overflow-hidden rounded-md bg-muted">
                    {c.cover_image_url ? (
                      <img src={c.cover_image_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground"><BookOpen className="h-10 w-10" /></div>
                    )}
                    {!c.is_published && (
                      <span className="absolute left-2 top-2 rounded px-2 py-1 text-xs font-medium bg-card text-card-foreground shadow-sm">{t.common.draft}</span>
                    )}
                    {isAdmin && (
                      <div className="absolute right-2 top-2 z-20 flex gap-1">
                        <Button asChild variant="secondary" size="icon" className="h-8 w-8 rounded-full" title={t.common.edit}>
                          <Link to="/courses/$courseId/edit" params={{ courseId: c.id }} aria-label={`${c.title}: ${t.common.edit}`}><Pencil className="h-4 w-4" /></Link>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full" aria-label={`${c.title}: seçimlər`} title="Seçimlər"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setMoveDialog({ courseId: c.id, current: c.folder_id })}>
                              <Move className="h-4 w-4 mr-2" /> {t.folders.moveTo}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                  <h3 className="font-display text-base font-semibold leading-snug tracking-normal">
                    <Link to="/courses/$courseId" params={{ courseId: c.id }} className="after:absolute after:inset-0 after:z-10 after:rounded-lg hover:text-primary focus:outline-none">
                      {c.title}
                    </Link>
                  </h3>
                  {c.instructor_name && <p className="mt-1 text-xs text-muted-foreground">{c.instructor_name}</p>}
                  <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="rounded border border-border px-1.5 py-0.5 text-muted-foreground">Kurs</span>
                    {ratings[c.id] ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 rounded border border-border px-1.5 py-0.5" aria-label={`5 üzərindən ${ratings[c.id].avg.toFixed(1)}`}>
                          <StarRating value={ratings[c.id].avg} size="sm" />
                          <span className="font-semibold">{ratings[c.id].avg.toFixed(1)}</span>
                        </span>
                        <span className="rounded border border-border px-1.5 py-0.5 text-muted-foreground">{ratings[c.id].count} rəy</span>
                      </>
                    ) : (
                      <span className="py-0.5 text-muted-foreground">Hələ qiymətləndirilməyib</span>
                    )}
                  </div>
                  {certs[c.id] && (
                    <div className="relative z-20 mt-3 flex flex-wrap items-center gap-2">
                      <Button asChild size="sm" variant="ghost" className="h-auto justify-start p-0 text-xs text-primary hover:bg-transparent">
                        <Link to="/courses/$courseId" params={{ courseId: c.id }}><RotateCcw />Kursu təkrar keç</Link>
                      </Button>
                      <Button size="icon" variant="ghost" className="ml-auto h-7 w-7" title="Sertifikatı əldə et" aria-label={`${c.title}: sertifikatı əldə et`} disabled={certBusy === c.id} onClick={() => handleCertificate(c)}>
                        {certBusy === c.id ? <Loader2 className="animate-spin" /> : <Award />}
                      </Button>
                    </div>
                  )}
                  {(progress[c.id] ?? 0) > 0 && (
                    <div className="mt-auto pt-4">
                      <div role="progressbar" aria-label={`${c.title}: keçid`} aria-valuenow={progress[c.id]} aria-valuemin={0} aria-valuemax={100} className="h-1 overflow-hidden rounded-full bg-muted" title={`Keçid: ${progress[c.id]}%`}>
                        <div className="h-full bg-primary" style={{ width: `${progress[c.id]}%` }} />
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Folder create/rename dialog */}
      <Dialog open={!!folderDialog} onOpenChange={(o) => !o && setFolderDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{folderDialog?.mode === "create" ? t.folders.new : t.folders.rename}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t.folders.name}</Label>
            <Input
              autoFocus
              value={folderDialog?.name ?? ""}
              onChange={(e) => setFolderDialog((p) => p ? { ...p, name: e.target.value } : p)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveFolder()}
              placeholder="Məs. Satış"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialog(null)}>{t.common.cancel}</Button>
            <Button onClick={handleSaveFolder}>{t.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move dialog */}
      <Dialog open={!!moveDialog} onOpenChange={(o) => !o && setMoveDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.folders.moveTo}</DialogTitle></DialogHeader>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            <button
              className={cn("w-full text-left px-3 py-2 rounded-md hover:bg-muted flex items-center gap-2", moveDialog?.current === null && "bg-muted")}
              onClick={() => handleMove(UNCAT)}
            >
              <Folder className="h-4 w-4" /> {t.folders.uncategorized}
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                className={cn("w-full text-left px-3 py-2 rounded-md hover:bg-muted flex items-center gap-2", moveDialog?.current === f.id && "bg-muted")}
                onClick={() => handleMove(f.id)}
              >
                <Folder className="h-4 w-4" /> {f.name}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

