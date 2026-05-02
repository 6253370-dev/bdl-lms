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
import { BookOpen, Plus, Loader2, Folder, FolderOpen, Search, MoreVertical, Pencil, Trash2, FolderPlus, Move } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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
  folder_id: string | null;
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
    const [cRes, fRes] = await Promise.all([
      supabase.from("courses").select("id,title,description,is_published,passing_score,folder_id").order("created_at", { ascending: false }),
      supabase.from("folders").select("id,name,parent_id").order("name"),
    ]);
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
    setLoading(false);
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
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {visibleCourses.map((c) => (
                <Card key={c.id} className="p-5 h-full hover:shadow-[var(--shadow-elegant)] transition-shadow border-border/60 flex flex-col relative">
                  <div className="h-32 -mx-5 -mt-5 mb-4 rounded-t-xl" style={{ background: "var(--gradient-hero)" }} />
                  {isAdmin && (
                    <div className="absolute top-3 right-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="secondary" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setMoveDialog({ courseId: c.id, current: c.folder_id })}>
                            <Move className="h-4 w-4 mr-2" /> {t.folders.moveTo}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
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

function FolderItem({
  label, count, active, icon: Icon, onClick, actions,
}: {
  label: string;
  count: number;
  active: boolean;
  icon: typeof Folder;
  onClick: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors",
        active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      <span className={cn("text-xs", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{count}</span>
      {actions}
    </div>
  );
}
