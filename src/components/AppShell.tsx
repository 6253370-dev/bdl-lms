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
  ChevronDown,
  Search,
  User as UserIcon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/GlobalSearch";
import { UserAvatar } from "@/components/design/UserAvatar";
import { useUnansweredComments } from "@/lib/useUnansweredComments";
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
  const { user, profile, roles, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false); // mobile drawer
  const [desktopHidden, setDesktopHidden] = useState(false); // desktop collapse
  const [mobileSearch, setMobileSearch] = useState(false);
  const unanswered = useUnansweredComments(isAdmin, user?.id);

  const items = NAV.filter((i) => (i.adminOnly ? isAdmin : true));
  const badges: Record<string, number | null> = { "/admin/comments": unanswered };

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

  const isActive = (to: string) =>
    location.pathname === to || (to !== "/dashboard" && location.pathname.startsWith(to));

  // Breadcrumb (maddə 5): Ana səhifə › Bölmə. Yalnız bölmənin əsas səhifəsində göstərilir;
  // alt səhifələrin (məs. kurs səhifəsi) öz breadcrumb-ı var, təkrar olmasın.
  const section = location.pathname.startsWith("/profile")
    ? { to: "/profile", label: "Profil" }
    : items.find((item) => isActive(item.to));
  const showCrumbs =
    section && section.to !== "/dashboard" && location.pathname.replace(/\/$/, "") === section.to;

  const avatar = <UserAvatar name={profile?.full_name} src={profile?.avatar_url} size="md" />;

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 w-64 shrink-0 h-[100dvh] max-h-[100dvh] bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col overflow-y-auto overscroll-contain transition-transform lg:sticky lg:top-0",
          "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
          open ? "translate-x-0" : "-translate-x-full",
          desktopHidden ? "lg:hidden" : "lg:translate-x-0",
        )}
      >
        <div className="px-5 pt-6 pb-6 flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-semibold text-base leading-tight">{t.brand}</div>
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
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-8 w-8 rounded-full"
            onClick={() => setOpen(false)}
            aria-label="Menyunu bağla"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 px-3 pb-4 space-y-1 overflow-y-auto" aria-label="Əsas menyu">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            const badge = badges[item.to];
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-base font-semibold transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
                  active
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-200"
                    : "text-sidebar-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={2} />
                <span className="truncate flex-1">{item.label}</span>
                {badge ? (
                  <span
                    className={cn(
                      "ml-auto inline-flex min-w-5 h-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-brand-200",
                    )}
                    aria-label={`${badge} cavablanmamış şərh`}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 pb-4 space-y-3">
          <div className="hidden rounded-xl bg-muted border border-border p-5 [@media(min-height:960px)]:block">
            <Sprout className="h-6 w-6 text-primary mb-3" />
            <div className="font-display font-bold leading-snug">Daha yaxşı bir sən üçün</div>
            <div className="text-xs text-muted-foreground mt-1">Öyrən. İnkişaf et. Gələcəyini qur.</div>
          </div>
          {/* İstifadəçi kartı (maddə 4) */}
          <div className="flex items-center gap-3 rounded-xl border border-border p-2.5">
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              <UserAvatar name={profile?.full_name} src={profile?.avatar_url} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {profile?.full_name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{roleLabel}</span>
              </span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={handleLogout}
              aria-label={t.nav.signOut}
              title={t.nav.signOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 bg-gray-950/70 backdrop-blur-[4px] z-30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-20 border-b bg-card">
          <div className="h-16 flex items-center gap-1 px-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(true)}
              aria-label="Menyunu aç"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="ml-2 font-display font-semibold truncate">{t.brand}</div>
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileSearch((v) => !v)}
                aria-label="Kurs axtar"
                aria-expanded={mobileSearch}
              >
                <Search className="h-5 w-5" />
              </Button>
              <NotificationBell />
              <UserMenu
                avatar={avatar}
                name={profile?.full_name}
                roleLabel={roleLabel}
                onLogout={handleLogout}
                compact
              />
            </div>
          </div>
          {mobileSearch && (
            <div className="px-4 pb-3">
              <GlobalSearch autoFocus onNavigate={() => setMobileSearch(false)} />
            </div>
          )}
        </header>

        {/* Desktop top bar */}
        <header className="hidden lg:flex h-16 shrink-0 items-center gap-4 px-7 sticky top-0 z-20 bg-card border-b border-border">
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
          <GlobalSearch className="max-w-md" />
          <div className="ml-auto flex items-center gap-4">
            <div className="rounded-full bg-card shadow-card">
              <NotificationBell />
            </div>
            <UserMenu
              avatar={avatar}
              name={profile?.full_name}
              roleLabel={roleLabel}
              subline={`ID ${profile?.employee_id ?? ""} · ${roleLabel}`}
              onLogout={handleLogout}
            />
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden">
          {showCrumbs && (
            <Breadcrumb className="mx-auto w-full max-w-[1440px] px-4 pt-5 md:px-7 -mb-2">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/dashboard">{t.nav.dashboard}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{section.label}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

/** İstifadəçi menyusu (maddə 2): yalnız Profil və Çıxış. */
function UserMenu({
  avatar,
  name,
  roleLabel,
  subline,
  onLogout,
  compact,
}: {
  avatar: ReactNode;
  name?: string | null;
  roleLabel: string;
  subline?: string;
  onLogout: () => void;
  compact?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-3 rounded-full focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
          compact ? "p-0.5" : "pl-1 pr-3 py-1 hover:bg-muted",
        )}
        aria-label={`İstifadəçi menyusu: ${name ?? ""}`}
      >
        {avatar}
        {!compact && (
          <>
            <span className="text-left">
              <span className="block text-sm font-semibold leading-tight">{name}</span>
              <span className="block text-xs text-muted-foreground">{subline ?? roleLabel}</span>
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-semibold">{name}</span>
          <span className="block text-xs text-muted-foreground">{roleLabel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile">
            <UserIcon className="h-4 w-4" /> Profil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onLogout}>
          <LogOut className="h-4 w-4" /> {t.nav.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
