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
  ClipboardCheck,
  BarChart3,
  MessageSquare,
  Award,
  CalendarDays,
  Library,
  BookMarked,
  CalendarCheck,
  Video,
  Grid3x3,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Sprout,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";
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
  { to: "/live-classes", label: t.live.title, icon: Video },
  { to: "/question-bank", label: "Sual Bankı", icon: Library, adminOnly: true },
  { to: "/quiz", label: t.nav.quiz, icon: FileQuestion },
  { to: "/crosswords", label: "Krossvordlar", icon: Grid3x3 },
  { to: "/grading", label: "İmtahan yoxlaması", icon: ClipboardCheck, adminOnly: true },
  { to: "/library", label: "Kitabxana", icon: BookMarked },
  { to: "/attendance", label: "Davamiyyət", icon: CalendarCheck, adminOnly: true },
  { to: "/calendar", label: "Təqvim", icon: CalendarDays },
  { to: "/champions", label: "Gamification Center", icon: Trophy },
  { to: "/certificates", label: t.nav.certificates, icon: Award },
  { to: "/admin/comments", label: t.nav.adminComments, icon: MessageSquare, adminOnly: true },
  { to: "/reports", label: t.nav.reports, icon: BarChart3, adminOnly: true },
  { to: "/users", label: t.nav.users, icon: Users, adminOnly: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, roles, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false); // mobile drawer
  const [desktopHidden, setDesktopHidden] = useState(false); // desktop collapse

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

  const avatar = (
    <div className="h-10 w-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-sm font-semibold overflow-hidden shrink-0 ring-2 ring-card shadow-card">
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="Profil şəkli" className="h-full w-full object-cover" />
      ) : (
        (profile?.full_name?.[0]?.toUpperCase() ?? "?")
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 w-72 h-[100dvh] max-h-[100dvh] bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col overflow-y-auto overscroll-contain transition-transform lg:sticky lg:top-0",
          "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
          open ? "translate-x-0" : "-translate-x-full",
          desktopHidden ? "lg:hidden" : "lg:translate-x-0",
        )}
      >
        <div className="px-6 pt-7 pb-6 flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-brand flex items-center justify-center text-primary-foreground shadow-elegant">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-extrabold text-lg leading-tight">{t.brand}</div>
            <div className="text-xs text-muted-foreground truncate">{t.brandTagline}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:flex h-8 w-8 rounded-full"
            onClick={() => setDesktopHidden(true)}
            aria-label="Naviqasiyanı gizlət"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 px-4 pb-4 space-y-1 overflow-y-auto">
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
                  "flex items-center gap-3.5 px-4 py-3 rounded-xl text-[15px] font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                    : "text-sidebar-foreground/75 hover:bg-muted hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 pb-4">
          <div className="rounded-2xl bg-gradient-soft border border-border/60 p-5 mb-3">
            <Sprout className="h-6 w-6 text-primary mb-3" />
            <div className="font-display font-bold leading-snug">Daha yaxşı bir sən üçün</div>
            <div className="text-xs text-muted-foreground mt-1">Öyrən. İnkişaf et. Gələcəyini qur.</div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start rounded-xl text-sidebar-foreground/75 hover:bg-muted hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4 mr-2" /> {t.nav.signOut}
          </Button>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden h-16 flex items-center px-4 border-b bg-card/90 backdrop-blur sticky top-0 z-20">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="ml-3 font-display font-extrabold">{t.brand}</div>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <Link to="/profile">{avatar}</Link>
          </div>
        </header>

        {/* Desktop top bar */}
        <header className="hidden lg:flex h-20 items-center gap-4 px-8 sticky top-0 z-20 bg-background/85 backdrop-blur">
          {desktopHidden && (
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setDesktopHidden(false)}
              className="h-10 w-10 rounded-full shadow-card bg-card"
              aria-label="Naviqasiyanı göstər"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          )}
          <div className="ml-auto flex items-center gap-4">
            <div className="rounded-full bg-card shadow-card">
              <NotificationBell />
            </div>
            <Link
              to="/profile"
              className="flex items-center gap-3 rounded-full pl-1 pr-4 py-1 hover:bg-card hover:shadow-card transition-all"
            >
              {avatar}
              <div className="text-left">
                <div className="text-sm font-semibold leading-tight">{profile?.full_name}</div>
                <div className="text-xs text-muted-foreground">
                  ID {profile?.employee_id} · {roleLabel}
                </div>
              </div>
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
