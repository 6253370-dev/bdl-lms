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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Loader2, Trash2, Pencil, ShieldCheck, Search, Eye, Folder, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { saveCourseAccess } from "@/components/CourseAccessEditor";

export const Route = createFileRoute("/users")({
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

  const load = async () => {
    setLoading(true);
    const { data: profs } = await supabase
      .from("profiles").select("id,employee_id,full_name,email,phone").order("created_at", { ascending: false });
    const { data: roles } = await supabase.from("user_roles").select("user_id,role");
    const map = new Map<string, string[]>();
    (roles ?? []).forEach((r: { user_id: string; role: string }) => {
      const arr = map.get(r.user_id) ?? []; arr.push(r.role); map.set(r.user_id, arr);
    });
    setUsers(((profs ?? []) as Omit<UserRow, "roles">[]).map((p) => ({ ...p, roles: map.get(p.id) ?? [] })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

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
    if (!q) return users;
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.employee_id.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone ?? "").toLowerCase().includes(q),
    );
  }, [users, search]);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">{t.users.title}</h1>
          <p className="text-muted-foreground mt-1">
            {isSuperAdmin ? "Bütün istifadəçiləri yarat və idarə et." : "İstifadəçi məlumatlarına bax və redaktə et."}
          </p>
        </div>
        {isSuperAdmin && (
          <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
        )}
      </div>

      <div className="mb-4 relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.users.search}
          className="pl-9"
        />
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Əməkdaş ID</TableHead>
                <TableHead>Ad Soyad</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Rollar</TableHead>
                <TableHead className="text-right">Əməliyyatlar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono">{u.employee_id}</TableCell>
                  <TableCell className="font-medium">{u.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell className="text-muted-foreground">{u.phone ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {u.roles.map((r) => (
                        <span key={r} className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          r === "super_admin" ? "bg-accent/20 text-accent-foreground" :
                          r === "admin" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                        }`}>
                          {r === "super_admin" && <ShieldCheck className="h-3 w-3 inline mr-0.5" />}
                          {r.replace("_", " ")}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {isSuperAdmin && (
                      <Button variant="ghost" size="icon" onClick={() => setViewing(u)} title={t.users.view}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => setEditing(u)} title={t.users.edit}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id)} disabled={u.id === currentUser?.id} title={t.users.delete}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

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
  const [form, setForm] = useState({ employee_id: "", full_name: "", email: "", phone: "", password: "", password2: "", role: "user" });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!form.employee_id || !form.full_name || !form.email || !form.password) {
      toast.error("Vacib sahələri doldurun"); return;
    }
    if (form.password !== form.password2) {
      toast.error(t.users.passwordMismatch); return;
    }
    setSubmitting(true);
    const { password2, ...payload } = form;
    void password2;
    const { error } = await supabase.functions.invoke("admin-create-user", {
      body: { ...payload, roles: [form.role] },
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("İstifadəçi yaradıldı");
    setForm({ employee_id: "", full_name: "", email: "", phone: "", password: "", password2: "", role: "user" });
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="lg"><Plus className="h-4 w-4 mr-2" /> {t.users.new}</Button>
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
    await saveCourseAccess(user.id, Array.from(folderIds), Array.from(courseIds));
    setSaving(false);
    toast.success("İstifadəçi yeniləndi");
    onSaved();
  };

  const uncat = courses.filter((c) => !c.folder_id);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit user · ID {user.employee_id}</DialogTitle></DialogHeader>
        <Tabs defaultValue="info">
          <TabsList>
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="access">{t.users.accessTitle}</TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Employee ID" value={employeeId} onChange={setEmployeeId} disabled={!isSuperAdmin} />
              <Field label="Phone" value={phone} onChange={setPhone} />
            </div>
            <Field label="Full Name" value={fullName} onChange={setFullName} />
            <Field label="Email" type="email" value={email} onChange={setEmail} disabled={!isSuperAdmin} />
            <Field label="New password (leave blank to keep)" type="password" value={password} onChange={setPassword} />
            {password && (
              <Field label={t.users.confirmPassword} type="password" value={password2} onChange={setPassword2} />
            )}
            <div className="space-y-2">
              <Label>Roles</Label>
              {(["super_admin", "admin", "user"] as const).map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={roles.includes(r)} onChange={() => toggleRole(r)} className="h-4 w-4" />
                  {r.replace("_", " ")}
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
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
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
          <Row label="Employee ID" value={user.employee_id} mono />
          <Row label="Full Name" value={user.full_name} />
          <Row label="Email" value={user.email} />
          <Row label="Phone" value={user.phone ?? "—"} />
          <Row label="Roles" value={user.roles.map((r) => r.replace("_", " ")).join(", ") || "—"} />
          <div className="border-t pt-3 mt-3">
            {stats ? (
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Attempts" value={stats.attempts} />
                <Stat label="Passed" value={stats.passed} />
                <Stat label="Certs" value={stats.certs} />
              </div>
            ) : (
              <div className="flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
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
