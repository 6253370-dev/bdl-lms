import { createFileRoute } from "@tanstack/react-router";
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  Loader2,
  ShieldCheck,
  Search,
  Eye,
  Folder,
  BookOpen,
  Unlock,
  Users as UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { saveCourseAccess } from "@/components/CourseAccessEditor";
import { StatCard } from "@/components/design/StatCard";
import { StatusChip } from "@/components/design/StatusChip";
import { UserAvatar } from "@/components/design/UserAvatar";
import { RowActions, TableCard, TablePagination } from "@/components/design/DataTable";
import { usePagination } from "@/lib/design";
import { PageHeader } from "@/components/design/PageHeader";

export const Route = createFileRoute("/users")({
  head: () => ({ meta: [
    { title: "İstifadəçilər | Baku Digital Lab" },
    { name: "description", content: "Təlim platformasının istifadəçiləri və hesab məlumatlarının idarəsi." },
    { property: "og:title", content: "İstifadəçilər | Baku Digital Lab" },
    { property: "og:description", content: "Təlim platformasının istifadəçiləri və hesab məlumatlarının idarəsi." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <ProtectedRoute requireAdmin>
      <UsersPage />
    </ProtectedRoute>
  ),
});

interface UserRow {
  id: string;
  employee_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  team: string | null;
  is_exam_blocked: boolean;
  exam_blocked_reason: string | null;
  roles: string[];
}

function UsersPage() {
  const { isSuperAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [viewing, setViewing] = useState<UserRow | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "super_admin" | "admin" | "user">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: profs } = await supabase
      .from("profiles").select("id,employee_id,full_name,email,phone,team,is_exam_blocked,exam_blocked_reason").order("created_at", { ascending: false });
    const { data: roles } = await supabase.from("user_roles").select("user_id,role");
    const map = new Map<string, string[]>();
    (roles ?? []).forEach((r: { user_id: string; role: string }) => {
      const arr = map.get(r.user_id) ?? []; arr.push(r.role); map.set(r.user_id, arr);
    });
    setUsers(((profs ?? []) as Omit<UserRow, "roles">[]).map((p) => ({ ...p, roles: map.get(p.id) ?? [] })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleUnblock = async (u: UserRow) => {
    const { error } = await supabase.from("profiles")
      .update({ is_exam_blocked: false, exam_blocked_reason: null, exam_blocked_at: null })
      .eq("id", u.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${u.full_name} blokdan çıxarıldı`);
    load();
  };

  const handleDelete = async (id: string) => {
    if (id === currentUser?.id) { toast.error("Özünüzü silə bilməzsiniz"); return; }
    if (!confirm("Bu istifadəçini həmişəlik silmək istəyirsiniz?")) return;
    const { error } = await supabase.functions.invoke("admin-delete-user", { body: { user_id: id } });
    if (error) { toast.error(error.message); return; }
    toast.success("İstifadəçi silindi");
    load();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      // Maddə 60: rol filtri ("İstifadəçi" = admin/super admin olmayanlar).
      if (roleFilter === "super_admin" && !u.roles.includes("super_admin")) return false;
      if (roleFilter === "admin" && !u.roles.includes("admin")) return false;
      if (roleFilter === "user" && (u.roles.includes("admin") || u.roles.includes("super_admin"))) return false;
      if (!q) return true;
      return (
        u.full_name.toLowerCase().includes(q) ||
        u.employee_id.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter]);
  const pager = usePagination(filtered, 10);
  const { setPage } = pager;
  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, setPage]);

  const toggleSelected = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const pageIds = pager.pageRows.map((u) => u.id);
  const pageAllSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const pageSomeSelected = pageIds.some((id) => selected.has(id));
  const selectedBlocked = users.filter((u) => selected.has(u.id) && u.is_exam_blocked);

  // Toplu əməliyyat: tək-tək "Blokdan çıxar" ilə eyni yeniləmə.
  const bulkUnblock = async () => {
    if (!selectedBlocked.length) return;
    setBulkBusy(true);
    const { error } = await supabase.from("profiles")
      .update({ is_exam_blocked: false, exam_blocked_reason: null, exam_blocked_at: null })
      .in("id", selectedBlocked.map((u) => u.id));
    setBulkBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${selectedBlocked.length} istifadəçi blokdan çıxarıldı`);
    setSelected(new Set());
    load();
  };

  return (
    <div className="bento-page">
      <PageHeader
        title={t.users.title}
        description={
          isSuperAdmin
            ? "Bütün istifadəçiləri yarat və idarə et."
            : "İstifadəçi məlumatlarına bax və redaktə et."
        }
        actions={
          <>
            {isSuperAdmin && (
              <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <StatCard
          icon={UsersIcon}
          label="İstifadəçilər"
          value={users.length.toLocaleString("az-AZ")}
        />
        <StatCard
          icon={ShieldCheck}
          label="Adminlər"
          value={
            users.filter((u) => u.roles.includes("admin") || u.roles.includes("super_admin")).length
          }
        />
        <StatCard
          icon={Unlock}
          label="İmtahandan bloklanmış"
          value={users.filter((u) => u.is_exam_blocked).length}
          tone="warning"
        />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[14rem] max-w-md flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.users.search}
            aria-label={t.users.search}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
          <SelectTrigger className="w-48" aria-label="Rol filtri">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Bütün rollar</SelectItem>
            <SelectItem value="super_admin">Super admin</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="user">İstifadəçi</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-brand-50 px-4 py-2.5 text-sm dark:bg-brand-600/15" role="status">
          <span className="font-medium text-brand-700 dark:text-brand-300">{selected.size} istifadəçi seçilib</span>
          {selectedBlocked.length > 0 && (
            <Button size="sm" disabled={bulkBusy} onClick={bulkUnblock}>
              {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
              Seçilənləri blokdan çıxar ({selectedBlocked.length})
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Seçimi ləğv et
          </Button>
        </div>
      )}

      <TableCard>
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Səhifədəkilərin hamısını seç"
                    checked={pageAllSelected ? true : pageSomeSelected ? "indeterminate" : false}
                    onCheckedChange={(v) =>
                      setSelected((s) => {
                        const n = new Set(s);
                        pageIds.forEach((id) => (v === true ? n.add(id) : n.delete(id)));
                        return n;
                      })
                    }
                  />
                </TableHead>
                <TableHead>İstifadəçi</TableHead>
                <TableHead>Əməkdaş ID</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Rollar</TableHead>
                <TableHead className="text-right">Əməliyyatlar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pager.pageRows.map((u) => (
                <TableRow key={u.id} data-state={selected.has(u.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      aria-label={`${u.full_name} seç`}
                      checked={selected.has(u.id)}
                      onCheckedChange={() => toggleSelected(u.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={u.full_name} size="md" />
                      <div className="min-w-0">
                        <div className="break-words">{u.full_name}</div>
                        <div className="text-xs font-normal text-muted-foreground break-all">{u.email}</div>
                        {u.is_exam_blocked && (
                          <StatusChip tone="error" className="mt-1">
                            <span title={u.exam_blocked_reason ?? ""}>İmtahandan bloklanıb</span>
                          </StatusChip>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">{u.employee_id}</TableCell>
                  <TableCell className="text-muted-foreground">{u.phone ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {u.roles.map((r) => (
                        <StatusChip key={r} tone={r === "user" ? "gray" : "brand"}>
                          {r === "super_admin" && (
                            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                          )}
                          {r.replace("_", " ")}
                        </StatusChip>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <RowActions
                      subject={u.full_name}
                      extra={
                        <>
                          {u.is_exam_blocked && (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="mr-1"
                              onClick={() => handleUnblock(u)}
                              title={u.exam_blocked_reason ?? ""}
                            >
                              <Unlock className="h-4 w-4" /> Blokdan çıxar
                            </Button>
                          )}
                          {isSuperAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => setViewing(u)}
                              title={t.users.view}
                              aria-label={`${t.users.view}: ${u.full_name}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      }
                      edit={{ onClick: () => setEditing(u), label: t.users.edit }}
                      remove={{
                        onClick: () => handleDelete(u.id),
                        label: t.users.delete,
                        disabled: u.id === currentUser?.id,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>
      {!loading && (
        <TablePagination
          page={pager.page}
          pageCount={pager.pageCount}
          pageSize={pager.pageSize}
          total={pager.total}
          onPageChange={pager.setPage}
        />
      )}

      {editing && (
        <EditUserDialog
          user={editing}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
      {viewing && (
        <ViewUserDialog user={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}

function CreateUserDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const [form, setForm] = useState({ employee_id: "", full_name: "", email: "", phone: "", password: "", password2: "", role: "user", team: "" });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!form.employee_id || !form.full_name || !form.email || !form.password) {
      toast.error("Vacib sahələri doldurun"); return;
    }
    if (form.password !== form.password2) {
      toast.error(t.users.passwordMismatch); return;
    }
    setSubmitting(true);
    const { password2, team, ...payload } = form;
    void password2;
    const { error } = await supabase.functions.invoke("admin-create-user", {
      body: { ...payload, roles: [form.role] },
    });
    if (!error && team) {
      await supabase.from("profiles").update({ team }).eq("employee_id", form.employee_id);
    }
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("İstifadəçi yaradıldı");
    setForm({ employee_id: "", full_name: "", email: "", phone: "", password: "", password2: "", role: "user", team: "" });
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> {t.users.new}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Yeni istifadəçi yarat</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Əməkdaş ID *" value={form.employee_id} onChange={(v) => setForm({ ...form, employee_id: v })} />
            <Field label="Telefon" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          </div>
          <Field label="Ad Soyad *" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
          <Field label="E-mail *" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="Şifrə *" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
          <Field label={`${t.users.confirmPassword} *`} type="password" value={form.password2} onChange={(v) => setForm({ ...form, password2: v })} />
          <TeamSelect value={form.team} onChange={(v) => setForm({ ...form, team: v })} />
          <div className="space-y-2">
            <Label>Rol</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="user">İstifadəçi</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Ləğv et</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Yarat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, isSuperAdmin, onClose, onSaved }: { user: UserRow; isSuperAdmin: boolean; onClose: () => void; onSaved: () => void }) {
  const [employeeId, setEmployeeId] = useState(user.employee_id);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [fullName, setFullName] = useState(user.full_name);
  const [team, setTeam] = useState(user.team ?? "");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [roles, setRoles] = useState<string[]>(user.roles);
  const [saving, setSaving] = useState(false);

  // Course access state
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string; folder_id: string | null }[]>([]);
  const [folderIds, setFolderIds] = useState<Set<string>>(new Set());
  const [courseIds, setCourseIds] = useState<Set<string>>(new Set());
  const [accessLoading, setAccessLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [fRes, cRes, fAcc, cAcc] = await Promise.all([
        supabase.from("folders").select("id,name").order("name"),
        supabase.from("courses").select("id,title,folder_id").order("title"),
        supabase.from("user_folder_access").select("folder_id").eq("user_id", user.id),
        supabase.from("user_course_access").select("course_id").eq("user_id", user.id),
      ]);
      setFolders((fRes.data ?? []) as { id: string; name: string }[]);
      setCourses((cRes.data ?? []) as { id: string; title: string; folder_id: string | null }[]);
      setFolderIds(new Set((fAcc.data ?? []).map((r: { folder_id: string }) => r.folder_id)));
      setCourseIds(new Set((cAcc.data ?? []).map((r: { course_id: string }) => r.course_id)));
      setAccessLoading(false);
    })();
  }, [user.id]);

  const toggleRole = (r: string) => setRoles((rs) => rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]);
  const toggleFolder = (id: string) => setFolderIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleCourse = (id: string) => setCourseIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const save = async () => {
    if (password && password !== password2) {
      toast.error(t.users.passwordMismatch); return;
    }
    setSaving(true);
    const body: Record<string, unknown> = { user_id: user.id, phone, full_name: fullName, roles };
    if (password) body.password = password;
    if (isSuperAdmin) {
      if (employeeId !== user.employee_id) body.employee_id = employeeId;
      if (email !== user.email) body.email = email;
    }
    const { error } = await supabase.functions.invoke("admin-update-user", { body });
    if (error) { setSaving(false); toast.error(error.message); return; }
    if ((team || null) !== (user.team || null)) {
      const { error: tErr } = await supabase.from("profiles").update({ team: team || null }).eq("id", user.id);
      if (tErr) { setSaving(false); toast.error(tErr.message); return; }
    }
    await saveCourseAccess(user.id, Array.from(folderIds), Array.from(courseIds));
    setSaving(false);
    toast.success("İstifadəçi yeniləndi");
    onSaved();
  };

  const uncat = courses.filter((c) => !c.folder_id);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>İstifadəçini redaktə et · ID {user.employee_id}</DialogTitle></DialogHeader>
        <Tabs defaultValue="info">
          <TabsList>
            <TabsTrigger value="info">Məlumat</TabsTrigger>
            <TabsTrigger value="access">{t.users.accessTitle}</TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Əməkdaş ID" value={employeeId} onChange={setEmployeeId} disabled={!isSuperAdmin} />
              <Field label="Telefon" value={phone} onChange={setPhone} />
            </div>
            <Field label="Ad Soyad" value={fullName} onChange={setFullName} />
            <TeamSelect value={team} onChange={setTeam} />
            <Field label="E-mail" type="email" value={email} onChange={setEmail} disabled={!isSuperAdmin} />
            <Field label="Yeni şifrə (dəyişməyəcəksinizsə boş buraxın)" type="password" value={password} onChange={setPassword} />
            {password && (
              <Field label={t.users.confirmPassword} type="password" value={password2} onChange={setPassword2} />
            )}
            <div className="space-y-2">
              <Label>Rollar</Label>
              {(["super_admin", "admin", "user"] as const).map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={roles.includes(r)} onChange={() => toggleRole(r)} className="h-4 w-4" />
                  {r === "super_admin" ? "Super admin" : r === "admin" ? "Admin" : "İstifadəçi"}
                </label>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="access" className="pt-3">
            <p className="text-xs text-muted-foreground mb-3">{t.users.accessHint}</p>
            {accessLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {folders.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-2">{t.users.selectFolders}</div>
                    <div className="space-y-1.5">
                      {folders.map((f) => {
                        const inFolder = courses.filter((c) => c.folder_id === f.id);
                        const folderChecked = folderIds.has(f.id);
                        return (
                          <div key={f.id} className="border rounded-md p-2">
                            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                              <Checkbox checked={folderChecked} onCheckedChange={() => toggleFolder(f.id)} />
                              <Folder className="h-4 w-4" />
                              {f.name}
                              <span className="text-xs text-muted-foreground">({inFolder.length})</span>
                            </label>
                            {!folderChecked && inFolder.length > 0 && (
                              <div className="mt-2 ml-6 space-y-1">
                                {inFolder.map((c) => (
                                  <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer">
                                    <Checkbox checked={courseIds.has(c.id)} onCheckedChange={() => toggleCourse(c.id)} />
                                    <BookOpen className="h-3 w-3" />
                                    {c.title}
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {uncat.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-2">{t.users.selectCourses}</div>
                    <div className="space-y-1 ml-1">
                      {uncat.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox checked={courseIds.has(c.id)} onCheckedChange={() => toggleCourse(c.id)} />
                          <BookOpen className="h-3 w-3" />
                          {c.title}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Ləğv et</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Yadda saxla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewUserDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [stats, setStats] = useState<{ attempts: number; passed: number; certs: number } | null>(null);
  useEffect(() => {
    (async () => {
      const [att, exAtt, cert] = await Promise.all([
        supabase.from("block_attempts").select("passed").eq("user_id", user.id),
        supabase.from("standalone_exam_attempts").select("passed").eq("user_id", user.id),
        supabase.from("certificates").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      const all = [...(att.data ?? []), ...(exAtt.data ?? [])];
      setStats({
        attempts: all.length,
        passed: all.filter((a) => a.passed).length,
        certs: cert.count ?? 0,
      });
    })();
  }, [user.id]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t.users.details}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <Row label="Əməkdaş ID" value={user.employee_id} mono />
          <Row label="Ad Soyad" value={user.full_name} />
          <Row label="E-mail" value={user.email} />
          <Row label="Telefon" value={user.phone ?? "—"} />
          <Row label="Komanda" value={user.team ?? "—"} />
          <Row label="Rollar" value={user.roles.map((r) => r === "super_admin" ? "Super admin" : r === "admin" ? "Admin" : "İstifadəçi").join(", ") || "—"} />
          <div className="border-t pt-3 mt-3">
            {stats ? (
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Cəhdlər" value={stats.attempts} />
                <Stat label="Keçib" value={stats.passed} />
                <Stat label="Sertifikat" value={stats.certs} />
              </div>
            ) : (
              <div className="flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Bağla</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono" : "font-medium"}>{value}</span>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="text-2xl font-display font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", disabled }: { label: string; value: string; onChange: (v: string) => void; type?: string; disabled?: boolean }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    </div>
  );
}

function TeamSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [teams, setTeams] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const loadTeams = async () => {
    const { data } = await supabase.from("teams").select("name").order("name");
    setTeams((data ?? []).map((r: { name: string }) => r.name));
  };
  useEffect(() => { loadTeams(); }, []);
  const add = async () => {
    const n = name.trim();
    if (!n) return;
    if (!teams.includes(n)) {
      const { error } = await supabase.from("teams").insert({ name: n });
      if (error) { toast.error(error.message); return; }
      await loadTeams();
    }
    onChange(n); setName(""); setAdding(false);
    toast.success("Komanda əlavə edildi");
  };
  return (
    <div className="space-y-2">
      <Label>Komanda (Team Battle)</Label>
      <div className="flex gap-2">
        <select
          className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— Komanda yoxdur —</option>
          {value && !teams.includes(value) && <option value={value}>{value}</option>}
          {teams.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <Button type="button" variant="outline" onClick={() => setAdding((a) => !a)}>
          <Plus className="h-4 w-4 mr-1" /> Komanda əlavə et
        </Button>
      </div>
      {adding && (
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Yeni komanda adı" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <Button type="button" onClick={add}>Əlavə et</Button>
        </div>
      )}
    </div>
  );
}
