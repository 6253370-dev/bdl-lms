import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

function LoginPage() {
  const { signInWithEmployeeId, session, loading } = useAuth();
  const navigate = useNavigate();
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard" });
  }, [loading, session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signInWithEmployeeId(employeeId.trim(), password);
      toast.success(t.login.welcomeBack);
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      {/* Left: branded panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div className="font-display font-bold text-xl">{t.brand}</div>
        </div>
        <div className="space-y-6 max-w-lg">
          <h1 className="font-display text-5xl font-bold leading-tight">
            {t.login.heroTitle} <span className="text-white/95">{t.login.heroAccent}</span>
          </h1>
          <p className="text-lg text-primary-foreground/85">
            {t.login.heroSubtitle}
          </p>
        </div>
        <div className="text-sm text-primary-foreground/70">
          © {new Date().getFullYear()} {t.brand} — {t.login.footer}
        </div>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-background">
        <Card className="w-full max-w-md p-8 shadow-[var(--shadow-elegant)] border-border/60">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="font-display font-bold">{t.brand}</div>
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground">{t.login.title}</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-8">
            {t.login.subtitle}
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="employee_id">{t.login.employeeId}</Label>
              <Input
                id="employee_id"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.login.password}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full mt-2" size="lg" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t.login.signIn}
            </Button>
            <p className="text-xs text-center text-muted-foreground pt-2">
              {t.login.forgotPassword}
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
