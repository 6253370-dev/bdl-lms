import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import {
  GraduationCap,
  LayoutDashboard,
  BookOpen,
  Users,
  FileQuestion,
  Trophy,
  ClipboardList,
  BarChart3,
  MessageSquare,
  Award,
  LogOut,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
  { to: "/courses", label: t.nav.courses, icon: BookOpen },
  { to: "/exams", label: t.nav.exams, icon: ClipboardList },
  { to: "/quiz", label: t.nav.quiz, icon: FileQuestion },
  { to: "/champions", label: t.nav.champions, icon: Trophy },
  { to: "/certificates", label: t.nav.certificates, icon: Award },
  { to: "/admin/comments", label: t.nav.adminComments, icon: MessageSquare, adminOnly: true },
  { to: "/reports", label: t.nav.reports, icon: BarChart3, adminOnly: true },
  { to: "/users", label: t.nav.users, icon: Users, adminOnly: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, roles, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((i) => (i.adminOnly ? isAdmin : true));

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const roleLabel = (() => {
    const r = roles[0];
    if (r === "super_admin") return "Super admin";
    if (r === "admin") return "Admin";
    return "İstifadəçi";
  })();

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform lg:translate-x-0 lg:static",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="px-5 py-5 flex items-center gap-3 border-b border-sidebar-border">
          <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display font-bold text-base leading-tight">{t.brand}</div>
            <div className="text-xs text-muted-foreground">{t.brandTagline}</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon;
            const active =
              location.pathname === item.to ||
              (item.to !== "/dashboard" && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-muted hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-sm font-semibold">
              {profile?.full_name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{profile?.full_name}</div>
              <div className="text-xs text-muted-foreground truncate">
                ID {profile?.employee_id} · {roleLabel}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start text-sidebar-foreground/80 hover:bg-muted hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4 mr-2" /> {t.nav.signOut}
          </Button>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden h-14 flex items-center px-4 border-b bg-background">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="ml-3 font-display font-bold">{t.brand}</div>
        </header>
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
