import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { BookOpen, ClipboardList, Trophy, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  ),
});

function Dashboard() {
  const { profile, isAdmin } = useAuth();
  const [stats, setStats] = useState({ courses: 0, users: 0 });

  useEffect(() => {
    (async () => {
      const [{ count: courses }, { count: users }] = await Promise.all([
        supabase.from("courses").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
      ]);
      setStats({ courses: courses ?? 0, users: users ?? 0 });
    })();
  }, []);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">{t.dashboard.title}, {profile?.full_name?.split(" ")[0]}</h1>
        <p className="text-muted-foreground mt-1">
          {t.dashboard.subtitle}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BookOpen} label={t.dashboard.courses} value={stats.courses} tone="primary" />
        <StatCard icon={ClipboardList} label={t.dashboard.exams} value={0} tone="accent" />
        <StatCard icon={Trophy} label={t.dashboard.certificates} value={0} tone="success" />
        {isAdmin && <StatCard icon={Users} label={t.dashboard.totalUsers} value={stats.users} tone="primary" />}
      </div>

      <Card className="mt-8 p-8 text-center border-dashed">
        <h3 className="font-display text-lg font-semibold mb-2">{t.dashboard.moreSoon}</h3>
        <p className="text-sm text-muted-foreground">
          {t.dashboard.moreSoonDesc}
        </p>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, tone,
}: { icon: typeof BookOpen; label: string; value: number; tone: "primary" | "accent" | "success" }) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/15 text-accent-foreground",
    success: "bg-success/10 text-success",
  };
  return (
    <Card className="p-5">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${toneMap[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 text-3xl font-display font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </Card>
  );
}
