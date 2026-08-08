import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "admin" | "user";

export interface Profile {
  id: string;
  employee_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  signInWithEmployeeId: (employeeId: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    const [{ data: prof }, { data: rolesData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile((prof as Profile) ?? null);
    setRoles(((rolesData ?? []) as { role: AppRole }[]).map((r) => r.role));
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess?.user) {
        // defer to avoid deadlock
        setTimeout(() => loadProfile(sess.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      if (sess?.user) loadProfile(sess.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithEmployeeId = async (employeeId: string, password: string) => {
    // Resolve email from employee id via edge function
    const { data, error } = await supabase.functions.invoke("login-with-employee-id", {
      body: { employee_id: employeeId },
    });
    if (error || !data?.email) throw new Error("Invalid Employee ID or password");
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: data.email,
      password,
    });
    if (signErr) throw new Error("Invalid Employee ID or password");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    roles,
    loading,
    signInWithEmployeeId,
    signOut,
    refreshProfile,
    isAdmin: roles.includes("admin") || roles.includes("super_admin"),
    isSuperAdmin: roles.includes("super_admin"),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
