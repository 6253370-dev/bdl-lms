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
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Loader2, Trash2, Pencil, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

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
    if (id === currentUser?.id) { toast.error("Cannot delete yourself"); return; }
    if (!confirm("Delete this user permanently?")) return;
    const { error } = await supabase.functions.invoke("admin-delete-user", { body: { user_id: id } });
    if (error) { toast.error(error.message); return; }
    toast.success("User deleted");
    load();
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground mt-1">
            {isSuperAdmin ? "Create and manage all users." : "View and edit user details."}
          </p>
        </div>
        {isSuperAdmin && (
          <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
        )}
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
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
                    <Button variant="ghost" size="icon" onClick={() => setEditing(u)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id)} disabled={u.id === currentUser?.id}>
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
        <EditUserDialog user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

function CreateUserDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const [form, setForm] = useState({ employee_id: "", full_name: "", email: "", phone: "", password: "", role: "user" });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!form.employee_id || !form.full_name || !form.email || !form.password) {
      toast.error("Fill required fields"); return;
    }
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("admin-create-user", {
      body: { ...form, roles: [form.role] },
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("User created");
    setForm({ employee_id: "", full_name: "", email: "", phone: "", password: "", role: "user" });
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="lg"><Plus className="h-4 w-4 mr-2" /> New User</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Create new user</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Employee ID *" value={form.employee_id} onChange={(v) => setForm({ ...form, employee_id: v })} />
            <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          </div>
          <Field label="Full Name *" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
          <Field label="Email *" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="Password *" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
          <div className="space-y-2">
            <Label>Role</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, onClose, onSaved }: { user: UserRow; onClose: () => void; onSaved: () => void }) {
  const [phone, setPhone] = useState(user.phone ?? "");
  const [fullName, setFullName] = useState(user.full_name);
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<string[]>(user.roles);
  const [saving, setSaving] = useState(false);

  const toggleRole = (r: string) => setRoles((rs) => rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]);

  const save = async () => {
    setSaving(true);
    const body: Record<string, unknown> = { user_id: user.id, phone, full_name: fullName, roles };
    if (password) body.password = password;
    const { error } = await supabase.functions.invoke("admin-update-user", { body });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("User updated");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit user · ID {user.employee_id}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Full Name" value={fullName} onChange={setFullName} />
          <Field label="Phone" value={phone} onChange={setPhone} />
          <Field label="New password (leave blank to keep)" type="password" value={password} onChange={setPassword} />
          <div className="space-y-2">
            <Label>Roles</Label>
            {(["super_admin", "admin", "user"] as const).map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={roles.includes(r)} onChange={() => toggleRole(r)} className="h-4 w-4" />
                {r.replace("_", " ")}
              </label>
            ))}
          </div>
        </div>
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

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
