import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import { AppShell } from "./AppShell";

interface Props {
  children: ReactNode;
  requireAdmin?: boolean;
  requireSuperAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin, requireSuperAdmin }: Props) {
  const { session, loading, isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/" });
    else if (requireSuperAdmin && !isSuperAdmin) navigate({ to: "/dashboard" });
    else if (requireAdmin && !isAdmin) navigate({ to: "/dashboard" });
  }, [loading, session, isAdmin, isSuperAdmin, requireAdmin, requireSuperAdmin, navigate]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <AppShell>{children}</AppShell>;
}
