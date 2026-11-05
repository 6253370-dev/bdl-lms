import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BookOpen,
  Plus,
  Loader2,
  Folder,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  FolderPlus,
  Move,
  Award,
  RotateCcw,
  ArrowRight,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { downloadCertificateSmart } from "@/lib/certificate";
import { PageHeader } from "@/components/design/PageHeader";
import { PillTabs } from "@/components/design/PillTabs";
import { CourseCard } from "@/components/design/CourseCard";
import { StatusChip } from "@/components/design/StatusChip";
import {
  matchesStatusTab,
  sortCourses,
  uniqueViewers,
  type CourseSort,
  type CourseStatusTab,
} from "@/lib/courses-catalog";

export const Route = createFileRoute("/courses/")({
  head: () => ({
    meta: [
      { title: "Kurslar — Baku Digital Lab" },
      {
        name: "description",
        content:
          "Baku Digital Lab təlim kursları, müəllimlər və iştirakçıların qiymətləndirmələri.",
      },
      { property: "og:title", content: "Kurslar — Baku Digital Lab" },
      {
        property: "og:description",
        content: "Təlim kurslarına baxın, rəyləri oxuyun və öyrənməyə davam edin.",
      },
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
  created_by: string | null;
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
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);

  // Course create
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [createFolderId, setCreateFolderId] = useState<string>(UNCAT);
  const [creating, setCreating] = useState(false);

  // Folder create/rename
  const [folderDialog, setFolderDialog] = useState<{
    mode: "create" | "rename";
    id?: string;
    name: string;
  } | null>(null);

  // Move dialog
  const [moveDialog, setMoveDialog] = useState<{ courseId: string; current: string | null } | null>(
    null,
  );

  // Filter / search
  const [activeFolder, setActiveFolder] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<CourseStatusTab>("all");
  const [sort, setSort] = useState<CourseSort>("newest");
  const [viewers, setViewers] = useState<Record<string, number>>({});

  const navigate = useNavigate();

  // Müəllim adı: kursda xüsusi müəllim seçilibsə o, yoxsa kursu yaradanın adı
  const teacherOf = (c: CourseRow) =>
    c.instructor_name?.trim() || creatorNames[c.created_by ?? ""] || "";

  const load = async () => {
    setLoading(true);
    const [cRes, fRes, rRes] = await Promise.all([
      supabase
        .from("courses")
        .select(
          "id,title,description,is_published,passing_score,folder_id,cover_image_url,certificate_template_url,instructor_name,created_by",
        )
        .order("created_at", { ascending: false }),
      supabase.from("folders").select("id,name,parent_id").order("name"),
      supabase.from("course_reviews").select("course_id,rating"),
    ]);
    const rMap: Record<string, { sum: number; count: number }> = {};
    ((rRes.data ?? []) as { course_id: string; rating: number }[]).forEach((r) => {
      const cur = rMap[r.course_id] ?? { sum: 0, count: 0 };
      cur.sum += r.rating;
      cur.count += 1;
      rMap[r.course_id] = cur;
    });
    const rFinal: Record<string, { avg: number; count: number }> = {};
    Object.entries(rMap).forEach(([id, v]) => {
      rFinal[id] = { avg: v.sum / v.count, count: v.count };
    });
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
          list = list.filter(
            (c) => courseIds.has(c.id) || (c.folder_id && folderIds.has(c.folder_id)),
          );
        }
      }
    }
    setCourses(list);
    setFolders((fRes.data ?? []) as FolderRow[]);

    // "Ən populyar" sıralaması üçün unikal baxan sayı (ana səhifə ilə eyni mənbə).
    if (isAdmin) {
      const { data: views } = await supabase.from("course_views").select("course_id,user_id");
      setViewers(uniqueViewers((views ?? []) as { course_id: string; user_id: string }[]));
    } else {
      const { data: allowed } = await supabase.rpc("dashboard_allowed_courses");
      setViewers(Object.fromEntries((allowed ?? []).map((c) => [c.id, Number(c.viewers)])));
    }

    // Kursu yaradanların adları (müəllim seçilməyibsə kartda göstərilir)
    const creatorIds = Array.from(
      new Set(list.map((c) => c.created_by).filter(Boolean) as string[]),
    );
    if (creatorIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", creatorIds);
      const cMap: Record<string, string> = {};
      ((profs ?? []) as { id: string; full_name: string | null }[]).forEach((p) => {
        if (p.full_name) cMap[p.id] = p.full_name;
      });
      setCreatorNames(cMap);
    } else {
      setCreatorNames({});
    }

    // Keçid progresi
    if (user?.id && list.length) {
      const ids = list.map((c) => c.id);
      const [{ data: blocks }, { data: done }] = await Promise.all([
        supabase.from("course_blocks").select("id,course_id,block_type").in("course_id", ids),
        supabase
          .from("block_progress")
          .select("block_id,course_id")
          .eq("user_id", user.id)
          .in("course_id", ids),
      ]);
      const totals = new Map<string, number>();
      (blocks ?? []).forEach((b) => {
        if (b.block_type === "quiz") return;
        totals.set(b.course_id, (totals.get(b.course_id) ?? 0) + 1);
      });
      const doneCounts = new Map<string, number>();
      (done ?? []).forEach((d) =>
        doneCounts.set(d.course_id, (doneCounts.get(d.course_id) ?? 0) + 1),
      );
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

  useEffect(() => {
    load();
  }, [isAdmin, user?.id]);

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
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Kurs yaradıldı");
    setOpen(false);
    setTitle("");
    setDescription("");
    setCreateFolderId(UNCAT);
    navigate({ to: "/courses/$courseId", params: { courseId: data.id } });
  };

  const handleSaveFolder = async () => {
    if (!folderDialog || !folderDialog.name.trim()) return;
    if (folderDialog.mode === "create") {
      const { error } = await supabase
        .from("folders")
        .insert({ name: folderDialog.name.trim(), created_by: user?.id });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Qovluq yaradıldı");
    } else {
      const { error } = await supabase
        .from("folders")
        .update({ name: folderDialog.name.trim() })
        .eq("id", folderDialog.id!);
      if (error) {
        toast.error(error.message);
        return;
      }
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
    if (error) {
      toast.error(error.message);
      return;
    }
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
    if (error) {
      toast.error(error.message);
      return;
    }
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

  // Kateqoriya + axtarış süzgəci (tab sayları bu siyahıdan hesablanır).
  const filteredCourses = useMemo(() => {
    let list = courses;
    if (activeFolder === UNCAT) list = list.filter((c) => !c.folder_id);
    else if (activeFolder !== ALL) list = list.filter((c) => c.folder_id === activeFolder);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) => c.title.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [courses, activeFolder, search]);

  const statusCounts = useMemo(() => {
    const count = (tab: CourseStatusTab) =>
      filteredCourses.filter((c) => matchesStatusTab(tab, progress[c.id], !!certs[c.id])).length;
    return {
      all: filteredCourses.length,
      in_progress: count("in_progress"),
      completed: count("completed"),
    };
  }, [filteredCourses, progress, certs]);

  const visibleCourses = useMemo(
    () =>
      sortCourses(
        filteredCourses.filter((c) => matchesStatusTab(statusTab, progress[c.id], !!certs[c.id])),
        sort,
        viewers,
        ratings,
      ),
    [filteredCourses, statusTab, progress, certs, sort, viewers, ratings],
  );

  const folderName = useMemo(() => new Map(folders.map((f) => [f.id, f.name])), [folders]);

  return (
    <div className="bento-page">
      <PageHeader
        title={t.courses.title}
        description={t.courses.subtitle}
        actions={
          <>
            {isAdmin && (
              <Button
                variant="outline"
                onClick={() => setFolderDialog({ mode: "create", name: "" })}
              >
                <FolderPlus className="h-4 w-4 mr-2" /> {t.folders.new}
              </Button>
            )}
            {isAdmin && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4" /> {t.courses.newCourse}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t.courses.createNew}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t.courses.title_field}</Label>
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Məs. Müştəri xidməti"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.courses.description}</Label>
                      <Input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Qısa təsvir"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.folders.moveTo}</Label>
                      <Select value={createFolderId} onValueChange={setCreateFolderId}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNCAT}>{t.folders.uncategorized}</SelectItem>
                          {folders.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                      {t.common.cancel}
                    </Button>
                    <Button onClick={handleCreate} disabled={creating}>
                      {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {t.common.create}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </>
        }
      />

      {/* Maddə 71, 73: status tabları, axtarış və sıralama */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <PillTabs<CourseStatusTab>
          ariaLabel="Kurs vəziyyəti"
          className="-mx-1 flex-nowrap overflow-x-auto px-1 py-0.5"
          value={statusTab}
          onValueChange={setStatusTab}
          items={[
            { value: "all", label: "Hamısı", count: statusCounts.all },
            { value: "in_progress", label: "Davam edən", count: statusCounts.in_progress },
            { value: "completed", label: "Tamamlanan", count: statusCounts.completed },
          ]}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative sm:w-72">
            <Search
              className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.folders.search}
              aria-label={t.folders.search}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="course-sort" className="shrink-0 text-sm text-muted-foreground">
              Sırala:
            </Label>
            <Select value={sort} onValueChange={(v) => setSort(v as CourseSort)}>
              <SelectTrigger id="course-sort" className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="popular">Ən populyar</SelectItem>
                <SelectItem value="newest">Ən yeni</SelectItem>
                <SelectItem value="rating">Reytinq</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Maddə 72: qovluqlar üfüqi kateqoriya çipləri kimi */}
      <div className="mb-6 flex items-center gap-2">
        <div
          role="group"
          aria-label="Kateqoriyalar"
          className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin] lg:flex-wrap lg:overflow-visible"
        >
          {[
            { id: ALL, name: "Bütün kateqoriyalar", count: counts.total },
            { id: UNCAT, name: t.folders.uncategorized, count: counts.uncategorized },
            ...folders.map((f) => ({
              id: f.id,
              name: f.name,
              count: counts.byFolder.get(f.id) ?? 0,
            })),
          ].map((chip) => {
            const active = activeFolder === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveFolder(chip.id)}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
                  active
                    ? "border-brand-200 bg-brand-50 text-brand-700 dark:border-transparent dark:bg-brand-600/15 dark:text-brand-200"
                    : "border-border bg-card text-secondary-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {chip.id !== ALL && chip.id !== UNCAT && (
                  <Folder className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {chip.name}
                <span
                  className={cn(
                    "tabular-nums",
                    active ? "text-brand-600 dark:text-brand-300" : "text-muted-foreground",
                  )}
                >
                  ({chip.count})
                </span>
              </button>
            );
          })}
        </div>
        {isAdmin && activeFolder !== ALL && activeFolder !== UNCAT && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Qovluq seçimləri"
                title="Qovluq seçimləri"
              >
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
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => handleDeleteFolder(activeFolder)}
              >
                <Trash2 className="h-4 w-4 mr-2" /> {t.folders.delete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {!loading && !search && activeFolder === ALL && statusTab === "all" && courses[0] && (
        <article className="group relative mb-6 flex flex-col gap-6 rounded-xl border border-border bg-card p-5 shadow-card focus-within:ring-2 focus-within:ring-ring md:flex-row md:items-center">
          <div className="aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-muted md:w-72">
            {courses[0].cover_image_url ? (
              <img src={courses[0].cover_image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <BookOpen className="h-10 w-10 text-primary" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <StatusChip tone="brand">Son əlavə olunan kurs</StatusChip>
            <h2 className="mt-3 font-display text-xl font-semibold leading-snug">
              <Link
                to="/courses/$courseId"
                params={{ courseId: courses[0].id }}
                className="after:absolute after:inset-0 after:rounded-xl hover:text-primary focus:outline-none"
              >
                {courses[0].title}
              </Link>
            </h2>
            {courses[0].description && (
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                {courses[0].description}
              </p>
            )}
            {teacherOf(courses[0]) && (
              <p className="mt-3 text-xs text-muted-foreground">Müəllim: {teacherOf(courses[0])}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center justify-between gap-6 md:flex-col md:items-end md:self-stretch md:justify-between">
            {ratings[courses[0].id] ? (
              <div className="md:text-right">
                <p className="inline-flex items-center gap-1.5 font-display text-2xl font-semibold tabular-nums">
                  {ratings[courses[0].id].avg.toFixed(1)}
                  <Star
                    className="h-5 w-5 fill-[var(--warning-500)] text-[var(--warning-500)]"
                    aria-hidden="true"
                  />
                </p>
                <p className="text-xs text-muted-foreground">
                  ({ratings[courses[0].id].count} rəy)
                </p>
              </div>
            ) : (
              <span />
            )}
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
              Kursa bax <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
        </article>
      )}
      <div>
        {/* Courses grid */}
        <div>
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : visibleCourses.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-display font-semibold text-lg">
                {search || statusTab !== "all" ? t.folders.noResults : t.courses.noneYet}
              </h3>
              {!search && statusTab === "all" && (
                <p className="text-sm text-muted-foreground mt-1">
                  {isAdmin ? t.courses.adminEmpty : t.courses.userEmpty}
                </p>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-5">
              {visibleCourses.map((c) => (
                <CourseCard
                  key={c.id}
                  id={c.id}
                  title={c.title}
                  cover={c.cover_image_url}
                  teacher={teacherOf(c)}
                  category={c.folder_id ? folderName.get(c.folder_id) : null}
                  rating={
                    ratings[c.id]
                      ? { average: ratings[c.id].avg, count: ratings[c.id].count }
                      : null
                  }
                  emptyRatingText="Hələ qiymətləndirilməyib"
                  progress={user?.id ? (progress[c.id] ?? 0) : undefined}
                  badge={
                    !c.is_published ? (
                      <StatusChip tone="gray" className="bg-card shadow-sm">
                        {t.common.draft}
                      </StatusChip>
                    ) : undefined
                  }
                  actions={
                    isAdmin ? (
                      <>
                        <Button
                          asChild
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8 rounded-full shadow-sm"
                          title={t.common.edit}
                        >
                          <Link
                            to="/courses/$courseId/edit"
                            params={{ courseId: c.id }}
                            aria-label={`${c.title}: ${t.common.edit}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-8 w-8 rounded-full shadow-sm"
                              aria-label={`${c.title}: seçimlər`}
                              title="Seçimlər"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                setMoveDialog({ courseId: c.id, current: c.folder_id })
                              }
                            >
                              <Move className="h-4 w-4 mr-2" /> {t.folders.moveTo}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    ) : undefined
                  }
                  footer={
                    certs[c.id] ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="h-auto justify-start p-0 text-xs text-primary hover:bg-transparent"
                        >
                          <Link to="/courses/$courseId" params={{ courseId: c.id }}>
                            <RotateCcw />
                            Kursu təkrar keç
                          </Link>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="ml-auto h-7 w-7"
                          title="Sertifikatı əldə et"
                          aria-label={`${c.title}: sertifikatı əldə et`}
                          disabled={certBusy === c.id}
                          onClick={() => handleCertificate(c)}
                        >
                          {certBusy === c.id ? <Loader2 className="animate-spin" /> : <Award />}
                        </Button>
                      </div>
                    ) : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Folder create/rename dialog */}
      <Dialog open={!!folderDialog} onOpenChange={(o) => !o && setFolderDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {folderDialog?.mode === "create" ? t.folders.new : t.folders.rename}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t.folders.name}</Label>
            <Input
              autoFocus
              value={folderDialog?.name ?? ""}
              onChange={(e) => setFolderDialog((p) => (p ? { ...p, name: e.target.value } : p))}
              onKeyDown={(e) => e.key === "Enter" && handleSaveFolder()}
              placeholder="Məs. Satış"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialog(null)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleSaveFolder}>{t.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move dialog */}
      <Dialog open={!!moveDialog} onOpenChange={(o) => !o && setMoveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.folders.moveTo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            <button
              className={cn(
                "w-full text-left px-3 py-2 rounded-md hover:bg-muted flex items-center gap-2",
                moveDialog?.current === null && "bg-muted",
              )}
              onClick={() => handleMove(UNCAT)}
            >
              <Folder className="h-4 w-4" /> {t.folders.uncategorized}
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md hover:bg-muted flex items-center gap-2",
                  moveDialog?.current === f.id && "bg-muted",
                )}
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
