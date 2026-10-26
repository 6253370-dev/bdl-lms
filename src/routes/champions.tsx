import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Loader2, Swords, Flame, Medal, Crown, Target, Star, Check, X, Clock, Users, Skull, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/champions")({
  head: () => ({ meta: [
    { title: "Gamification Center | Baku Digital Lab" },
    { name: "description", content: "Təlim yarışları, gündəlik suallar və şəxsi nailiyyətlər." },
    { property: "og:title", content: "Gamification Center | Baku Digital Lab" },
    { property: "og:description", content: "Təlim yarışları, gündəlik suallar və şəxsi nailiyyətlər." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <ProtectedRoute>
      <GamificationPage />
    </ProtectedRoute>
  ),
});

// ---------- types ----------
interface Profile { id: string; full_name: string; team?: string | null }
interface Duel {
  id: string;
  challenger_id: string;
  opponent_id: string;
  question_count: number;
  duration_seconds: number;
  status: string;
  question_ids: string[];
  winner_id: string | null;
  challenger_score: number | null;
  opponent_score: number | null;
  challenger_time_ms: number | null;
  opponent_time_ms: number | null;
  challenger_finished_at: string | null;
  opponent_finished_at: string | null;
  created_at: string;
}
interface BankQ {
  id: string;
  text: string;
  question_type: string;
  answers: { id: string; text: string; is_correct: boolean }[];
}
interface XpEvent { user_id: string; xp: number; event_type: string; created_at: string }

const XP = {
  correct: 100,
  speedBonusMax: 50,
  duelParticipation: 30,
  duelWin: 100,
  dailyChallenge: 50,
  challengePerfect: 30,
  badge: 50,
};

async function loadXpConfig() {
  const { data } = await supabase.from("gamification_xp_config").select("key,xp");
  const map: Record<string, keyof typeof XP> = {
    correct_answer: "correct",
    duel_participation: "duelParticipation",
    duel_win: "duelWin",
    daily_challenge: "dailyChallenge",
    challenge_perfect: "challengePerfect",
    badge: "badge",
  };
  (data ?? []).forEach((r: any) => {
    const k = map[r.key];
    if (k && typeof r.xp === "number" && r.xp >= 0) XP[k] = r.xp;
  });
}

const levelFor = (xp: number) => {
  // level N requires N*500 cumulative xp per level (L1:0, L2:500, L3:1500, ...)
  let lvl = 1, need = 500, total = 0;
  while (xp >= total + need) { total += need; lvl++; need = lvl * 500; }
  return { level: lvl, into: xp - total, needed: need };
};

const fmtMs = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

async function awardXp(userId: string, type: string, xp: number, refId?: string) {
  if (xp <= 0) return;
  await supabase.from("gamification_xp_events").insert({ user_id: userId, event_type: type, xp, ref_id: refId ?? null } as any);
}

// ---------- badge engine ----------
async function awardBadge(userId: string, code: string) {
  const { data: b } = await supabase.from("gamification_badges").select("id,name").eq("key", code).maybeSingle();
  if (!b) return;
  const { data: existing } = await supabase.from("gamification_user_badges").select("id").eq("user_id", userId).eq("badge_id", (b as any).id).maybeSingle();
  if (existing) return;
  const { error } = await supabase.from("gamification_user_badges").insert({ user_id: userId, badge_id: (b as any).id } as any);
  if (!error) {
    toast.success(`Yeni badge qazandın: ${(b as any).name}!`);
    await awardXp(userId, "badge", XP.badge, (b as any).id);
  }
}

async function checkBadges(userId: string) {
  const [{ data: ds }, { data: xps }] = await Promise.all([
    supabase.from("gamification_duels").select("*").eq("status", "completed").or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`),
    supabase.from("gamification_xp_events").select("created_at").eq("user_id", userId),
  ]);
  const duels = (ds ?? []) as any[];
  const wins = duels.filter((d) => d.winner_id === userId).length;
  if (wins >= 1) await awardBadge(userId, "first_victory");
  if (duels.length >= 10) await awardBadge(userId, "duelist");
  const sorted = [...duels].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  let maxStreak = 0, cur = 0;
  for (const d of sorted) {
    if (d.winner_id === userId) { cur++; maxStreak = Math.max(maxStreak, cur); } else cur = 0;
  }
  if (maxStreak >= 5) await awardBadge(userId, "champion");
  const days = new Set((xps ?? []).map((e: any) => String(e.created_at).slice(0, 10)));
  let s = 0;
  const dd = new Date();
  if (!days.has(dd.toISOString().slice(0, 10))) dd.setDate(dd.getDate() - 1);
  while (days.has(dd.toISOString().slice(0, 10))) { s++; dd.setDate(dd.getDate() - 1); }
  if (s >= 7) await awardBadge(userId, "streak_7");
}

// ---------- main page ----------
function GamificationPage() {
  const { user, profile, isAdmin } = useAuth();
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [duels, setDuels] = useState<Duel[]>([]);
  const [xpEvents, setXpEvents] = useState<XpEvent[]>([]);
  const [allXp, setAllXp] = useState<XpEvent[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [myBadges, setMyBadges] = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeDuel, setActiveDuel] = useState<Duel | null>(null);
  const [detailDuel, setDetailDuel] = useState<Duel | null>(null);
  const [lbPeriod, setLbPeriod] = useState<"week" | "month" | "all">("week");
  const [challenge, setChallenge] = useState<any | null>(null);
  const [xpOpen, setXpOpen] = useState(false);
  const [myAttempt, setMyAttempt] = useState<any | null>(null);

  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.full_name ?? "—";

  const load = async () => {
    if (!user) return;
    setLoading(true);
    await loadXpConfig();
    const [{ data: profs }, { data: ds }, { data: xps }, { data: axp }, { data: bs }, { data: mb }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,team"),
      supabase.from("gamification_duels").select("*").order("created_at", { ascending: false }),
      supabase.from("gamification_xp_events").select("user_id,xp,event_type,created_at").eq("user_id", user.id),
      supabase.from("gamification_xp_events").select("user_id,xp,event_type,created_at"),
      supabase.from("gamification_badges").select("*"),
      supabase.from("gamification_user_badges").select("*").eq("user_id", user.id),
    ]);
    setProfiles((profs ?? []) as Profile[]);
    setDuels((ds ?? []) as unknown as Duel[]);
    setXpEvents((xps ?? []) as XpEvent[]);
    setAllXp((axp ?? []) as XpEvent[]);
    setBadges(bs ?? []);
    setMyBadges(mb ?? []);

    // daily challenge
    const today = new Date().toISOString().slice(0, 10);
    let { data: ch } = await supabase.from("gamification_daily_challenges").select("*").eq("challenge_date", today).maybeSingle();
    if (!ch) {
      const { data: pool } = await supabase
        .from("bank_questions")
        .select("id")
        .eq("is_gamification_enabled", true);
      const ids = ((pool ?? []) as { id: string }[]).map((q) => q.id);
      if (ids.length >= 5) {
        const sample = [...ids].sort(() => Math.random() - 0.5).slice(0, 5);
        const ins = await supabase.from("gamification_daily_challenges").insert({ challenge_date: today, question_ids: sample } as any).select().single();
        ch = ins.data ?? null;
      }
    }
    setChallenge(ch);
    if (ch) {
      const { data: att } = await supabase.from("gamification_challenge_attempts").select("*").eq("challenge_id", (ch as any).id).eq("user_id", user.id).maybeSingle();
      setMyAttempt(att);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  // stats
  const myXp = useMemo(() => xpEvents.reduce((s, e) => s + e.xp, 0), [xpEvents]);
  const lvl = levelFor(myXp);
  const myDuels = duels.filter((d) => d.status === "completed");
  const wins = myDuels.filter((d) => d.winner_id === user?.id).length;

  const streak = useMemo(() => {
    const days = new Set(xpEvents.map((e) => e.created_at.slice(0, 10)));
    let s = 0;
    const d = new Date();
    if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
    while (days.has(d.toISOString().slice(0, 10))) { s++; d.setDate(d.getDate() - 1); }
    return s;
  }, [xpEvents]);

  const pendingForMe = duels.filter((d) => d.status === "pending" && d.opponent_id === user?.id);
  const myActive = duels.filter((d) =>
    (d.challenger_id === user?.id || d.opponent_id === user?.id) &&
    (d.status === "in_progress" || d.status === "accepted" ||
      (d.status === "pending" && d.challenger_id === user?.id))
  );

  // leaderboard
  const leaderboard = useMemo(() => {
    const now = new Date();
    const cutoff = lbPeriod === "week" ? new Date(now.getTime() - 7 * 864e5)
      : lbPeriod === "month" ? new Date(now.getTime() - 30 * 864e5) : null;
    const map = new Map<string, number>();
    allXp.forEach((e) => {
      if (cutoff && new Date(e.created_at) < cutoff) return;
      map.set(e.user_id, (map.get(e.user_id) ?? 0) + e.xp);
    });
    return Array.from(map.entries())
      .map(([user_id, xp]) => ({ user_id, xp }))
      .sort((a, b) => b.xp - a.xp);
  }, [allXp, lbPeriod]);

  const mostImproved = useMemo(() => {
    const now = Date.now();
    const cur = new Map<string, number>(), prev = new Map<string, number>();
    allXp.forEach((e) => {
      const t = new Date(e.created_at).getTime();
      if (t >= now - 7 * 864e5) cur.set(e.user_id, (cur.get(e.user_id) ?? 0) + e.xp);
      else if (t >= now - 14 * 864e5) prev.set(e.user_id, (prev.get(e.user_id) ?? 0) + e.xp);
    });
    return Array.from(cur.entries())
      .map(([user_id, c]) => {
        const p = prev.get(user_id) ?? 0;
        const pct = p > 0 ? Math.round(((c - p) / p) * 100) : c > 0 ? 100 : 0;
        return { user_id, pct, cur: c };
      })
      .filter((r) => r.pct > 0)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);
  }, [allXp]);

  const myTeam = (profile as any)?.team?.trim() ?? null;
  const teamLb = useMemo(() => {
    const teamOf = new Map(profiles.filter((p) => p.team?.trim()).map((p) => [p.id, p.team!.trim()]));
    if (!teamOf.size) return [] as { team: string; xp: number; members: number }[];
    const map = new Map<string, { xp: number; members: Set<string> }>();
    allXp.forEach((e) => {
      const t = teamOf.get(e.user_id);
      if (!t) return;
      const cur = map.get(t) ?? { xp: 0, members: new Set<string>() };
      cur.xp += e.xp;
      cur.members.add(e.user_id);
      map.set(t, cur);
    });
    return Array.from(map.entries())
      .map(([team, v]) => ({ team, xp: v.xp, members: v.members.size }))
      .sort((a, b) => b.xp - a.xp);
  }, [allXp, profiles]);

  // duel actions
  const respondDuel = async (duel: Duel, accept: boolean) => {
    const { error } = await supabase.from("gamification_duels")
      .update({ status: accept ? "accepted" : "declined" } as any).eq("id", duel.id);
    if (error) return toast.error(error.message);
    toast.success(accept ? "Duel qəbul edildi" : "Dueldən imtina edildi");
    if (accept) setActiveDuel({ ...duel, status: "accepted" });
    load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activeDuel) {
    return (
      <DuelPlay
        duel={activeDuel}
        onDone={() => { setActiveDuel(null); load(); }}
      />
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-7 w-7 text-warning" /> Gamification Center
          </h1>
          <p className="text-muted-foreground">Öyrən, yarış, qazan və lider ol.</p>
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={() => setXpOpen(true)}>XP tənzimləmələri</Button>
        )}
        <Button onClick={() => setCreateOpen(true)} size="lg">
          <Swords className="h-4 w-4 mr-2" /> Duel başlat
        </Button>
      </div>

      {/* personal stats */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Səviyyə</div>
            <div className="font-display text-2xl font-bold">Level {lvl.level}</div>
          </div>
          <div className="flex-1 min-w-48">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{myXp} XP</span>
              <span>{lvl.into} / {lvl.needed} XP</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, (lvl.into / lvl.needed) * 100)}%` }} />
            </div>
          </div>
          <div className="flex gap-5 text-center">
            <div><div className="font-bold flex items-center gap-1"><Flame className="h-4 w-4 text-warning" />{streak}</div><div className="text-xs text-muted-foreground">günlük streak</div></div>
            <div><div className="font-bold">{myDuels.length}</div><div className="text-xs text-muted-foreground">duel</div></div>
            <div><div className="font-bold">{wins}</div><div className="text-xs text-muted-foreground">qələbə</div></div>
            <div><div className="font-bold">{myBadges.length}</div><div className="text-xs text-muted-foreground">badge</div></div>
          </div>
        </div>
      </Card>

      {/* pending invites */}
      {pendingForMe.length > 0 && (
        <Card className="p-4 border-primary/50 bg-primary/5 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><Swords className="h-4 w-4" /> Duel dəvətləri</h3>
          {pendingForMe.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-3 justify-between">
              <div className="text-sm">
                <span className="font-medium">{nameOf(d.challenger_id)}</span> səni duelə çağırdı! · {d.question_count} sual · {Math.round(d.duration_seconds / 60)} dəqiqə
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => respondDuel(d, true)}><Check className="h-4 w-4 mr-1" /> Qəbul et</Button>
                <Button size="sm" variant="outline" onClick={() => respondDuel(d, false)}><X className="h-4 w-4 mr-1" /> İmtina</Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Ümumi</TabsTrigger>
          <TabsTrigger value="duels">Duellər</TabsTrigger>
          <TabsTrigger value="leaderboard">Liderlik</TabsTrigger>
          <TabsTrigger value="challenge">Daily Challenge</TabsTrigger>
          <TabsTrigger value="badges">Badge-lər</TabsTrigger>
          <TabsTrigger value="teams">Team Battle</TabsTrigger>
          <TabsTrigger value="boss">Boss Battle</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {myActive.length > 0 && (
            <Card className="p-4 space-y-2">
              <h3 className="font-semibold text-sm">Aktiv duellər</h3>
              {myActive.map((d) => (
                <DuelRow key={d.id} duel={d} nameOf={nameOf} userId={user!.id}
                  onPlay={() => setActiveDuel(d)} onOpen={() => setDetailDuel(d)} />
              ))}
            </Card>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Crown className="h-4 w-4 text-warning" /> Həftənin çempionları</h3>
              <LeaderboardList rows={leaderboard.slice(0, 5)} nameOf={nameOf} meId={user!.id} />
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Ən çox inkişaf edənlər</h3>
              {mostImproved.length === 0 ? (
                <p className="text-sm text-muted-foreground">Hələ məlumat yoxdur</p>
              ) : mostImproved.map((r) => (
                <div key={r.user_id} className="flex justify-between py-1.5 text-sm">
                  <span>{nameOf(r.user_id)}</span>
                  <span className="font-medium text-green-700">+{r.pct}%</span>
                </div>
              ))}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="duels" className="space-y-3 mt-4">
          {duels.length === 0 ? (
            <Card className="p-10 text-center border-dashed">
              <Swords className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Hələ duel yoxdur — ilk dueli sən başlat!</p>
            </Card>
          ) : duels.map((d) => (
            <DuelRow key={d.id} duel={d} nameOf={nameOf} userId={user!.id}
              onPlay={() => setActiveDuel(d)} onOpen={() => setDetailDuel(d)} />
          ))}
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-4 space-y-4">
          <Select value={lbPeriod} onValueChange={(v) => setLbPeriod(v as any)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Bu həftə</SelectItem>
              <SelectItem value="month">Bu ay</SelectItem>
              <SelectItem value="all">Bütün zamanlar</SelectItem>
            </SelectContent>
          </Select>
          <Card className="p-4">
            <LeaderboardList rows={leaderboard} nameOf={nameOf} meId={user!.id} showRank />
          </Card>
        </TabsContent>

        <TabsContent value="challenge" className="mt-4">
          <DailyChallengeCard
            challenge={challenge}
            attempt={myAttempt}
            onDone={() => load()}
          />
        </TabsContent>

        <TabsContent value="badges" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {badges.length === 0 && <p className="text-sm text-muted-foreground">Hələ badge yoxdur</p>}
            {badges.map((b) => {
              const earned = myBadges.some((mb) => mb.badge_id === b.id);
              return (
                <Card key={b.id} className={cn("p-4", !earned && "opacity-50")}>
                  <div className="flex items-center gap-3">
                    <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", earned ? "bg-warning text-warning-foreground" : "bg-muted text-muted-foreground")}>
                      <Medal className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{b.name}</div>
                      <div className="text-xs text-muted-foreground">{b.description}</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="teams" className="mt-4 space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold flex items-center gap-2 mb-3"><Users className="h-4 w-4" /> Komanda reytinqi (ümumi XP)</h3>
            {teamLb.length === 0 ? (
              <p className="text-sm text-muted-foreground">Hələ komanda yoxdur. Profil səhifəndə "Komanda" sahəsini doldur — eyni adlı komandada olanların XP-ləri toplanır.</p>
            ) : (
              <div className="space-y-2">
                {teamLb.map((t, i) => (
                  <div key={t.team} className={cn("flex items-center gap-3 rounded-lg p-2.5", t.team === myTeam && "border-2 border-primary bg-primary/5")}>
                    <span className="w-6 text-center">{["🥇", "🥈", "🥉"][i] ?? `#${i + 1}`}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{t.team}{t.team === myTeam && <span className="ml-2 text-xs text-primary">(sənin komandan)</span>}</div>
                      <div className="text-xs text-muted-foreground">{t.members} üzv</div>
                    </div>
                    <span className="font-semibold">{t.xp} XP</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="boss" className="mt-4">
          <BossBattleCard onChanged={() => load()} />
        </TabsContent>
      </Tabs>

      {createOpen && (
        <CreateDuelDialog
          profiles={profiles.filter((p) => p.id !== user?.id)}
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); load(); }}
        />
      )}
      {xpOpen && <XpConfigDialog onClose={() => setXpOpen(false)} />}
      {detailDuel && (
        <DuelDetailDialog duel={detailDuel} nameOf={nameOf} onClose={() => setDetailDuel(null)} />
      )}
    </div>
  );
}

// ---------- leaderboard ----------
function LeaderboardList({ rows, nameOf, meId, showRank }: { rows: { user_id: string; xp: number }[]; nameOf: (id: string) => string; meId: string; showRank?: boolean }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Hələ məlumat yoxdur</p>;
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="space-y-1">
      {rows.map((r, i) => (
        <div key={r.user_id} className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
          r.user_id === meId && "bg-primary/10 border border-primary/40 font-medium"
        )}>
          <span className="w-8 text-center">{medals[i] ?? `#${i + 1}`}</span>
          <span className="flex-1 truncate">{nameOf(r.user_id)}{r.user_id === meId && " (Sən)"}</span>
          <span className="font-semibold">{r.xp} XP</span>
        </div>
      ))}
    </div>
  );
}

// ---------- duel row ----------
function DuelRow({ duel, nameOf, userId, onPlay, onOpen }: {
  duel: Duel; nameOf: (id: string) => string; userId: string;
  onPlay: () => void; onOpen: () => void;
}) {
  const isMe = (id: string | null) => id === userId;
  const myScore = isMe(duel.challenger_id) ? duel.challenger_score : duel.opponent_score;
  const oppScore = isMe(duel.challenger_id) ? duel.opponent_score : duel.challenger_score;
  const myFinished = isMe(duel.challenger_id) ? !!duel.challenger_finished_at : !!duel.opponent_finished_at;
  const canPlay = (duel.status === "accepted" || duel.status === "in_progress") && !myFinished;
  const statusLabel: Record<string, string> = {
    pending: "Gözləyir", accepted: "Qəbul edildi", declined: "İmtina",
    expired: "Vaxtı keçib", in_progress: "Davam edir", completed: "Tamamlandı",
  };
  return (
    <Card className="p-4 flex flex-wrap items-center gap-3">
      <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
        <Swords className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-40">
        <div className="font-medium text-sm truncate">
          {nameOf(duel.challenger_id)} <span className="text-muted-foreground">vs</span> {nameOf(duel.opponent_id)}
        </div>
        <div className="text-xs text-muted-foreground">
          {duel.question_count} sual · {Math.round(duel.duration_seconds / 60)} dəq · {new Date(duel.created_at).toLocaleDateString("az-Latn-AZ")}
        </div>
      </div>
      {duel.status === "completed" && (
        <div className="text-sm">
          {duel.winner_id === userId ? <Badge className="bg-green-600">🏆 Qələbə</Badge>
            : duel.winner_id ? <Badge variant="secondary">❌ Məğlubiyyət</Badge>
            : <Badge variant="outline">🤝 Bərabər</Badge>}
          <span className="ml-2 font-medium">{myScore ?? 0} / {duel.question_count}</span>
          <span className="text-xs text-muted-foreground ml-1">(rəqib: {oppScore ?? 0})</span>
        </div>
      )}
      {duel.status !== "completed" && <Badge variant="outline">{statusLabel[duel.status] ?? duel.status}</Badge>}
      {canPlay && <Button size="sm" onClick={onPlay}>Oyna</Button>}
      {duel.status === "completed" && <Button size="sm" variant="outline" onClick={onOpen}>Detallar</Button>}
    </Card>
  );
}

// ---------- create duel ----------
function CreateDuelDialog({ profiles, onClose, onCreated }: {
  profiles: Profile[]; onClose: () => void; onCreated: () => void;
}) {
  const { user, profile } = useAuth();
  const [opponent, setOpponent] = useState("");
  const [count, setCount] = useState("10");
  const [duration, setDuration] = useState("120");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [poolSize, setPoolSize] = useState<number | null>(null);

  useEffect(() => {
    supabase.from("bank_questions").select("id", { count: "exact", head: true })
      .eq("is_gamification_enabled", true)
      .then(({ count }) => setPoolSize(count ?? 0));
  }, []);

  const filtered = profiles.filter((p) => p.full_name.toLowerCase().includes(search.toLowerCase()));
  const suggested = useMemo(() => profiles.length ? profiles[Math.floor(Math.random() * profiles.length)] : null, [profiles]);

  const create = async () => {
    if (!opponent) return toast.error("Rəqib seçin");
    const n = Number(count);
    if (poolSize !== null && poolSize < n) {
      return toast.error(`Bu duel üçün kifayət qədər aktiv sual mövcud deyil. Hazırda ${poolSize} sual mövcuddur.`);
    }
    setSaving(true);
    const { data: pool } = await supabase.from("bank_questions").select("id").eq("is_gamification_enabled", true);
    const ids = ((pool ?? []) as { id: string }[]).map((q) => q.id);
    if (ids.length < n) {
      setSaving(false);
      return toast.error(`Bu duel üçün kifayət qədər aktiv sual mövcud deyil. Hazırda ${ids.length} sual mövcuddur.`);
    }
    const sample = [...ids].sort(() => Math.random() - 0.5).slice(0, n);
    const { data, error } = await supabase.from("gamification_duels").insert({
      challenger_id: user!.id,
      opponent_id: opponent,
      question_count: n,
      duration_seconds: Number(duration),
      question_ids: sample,
      status: "pending",
    } as any).select().single();
    if (error) { setSaving(false); return toast.error(error.message); }
    await supabase.from("notifications").insert({
      user_id: opponent,
      type: "duel_invite",
      title: "⚔️ Duel dəvəti",
      body: `${profile?.full_name ?? "Bir istifadəçi"} səni duelə çağırdı! ${n} sual · ${Math.round(Number(duration) / 60)} dəqiqə`,
      link: "/champions",
    } as any);
    setSaving(false);
    toast.success("Duel dəvəti göndərildi");
    onCreated();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Swords className="h-5 w-5" /> Duel başlat</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Rəqib</label>
            {suggested && !opponent && (
              <button type="button" className="text-left text-xs text-primary hover:underline"
                onClick={() => setOpponent(suggested.id)}>
                Təklif: {suggested.full_name}
              </button>
            )}
            <Input placeholder="İstifadəçi axtar..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="border rounded-md max-h-40 overflow-y-auto">
              {filtered.map((p) => (
                <div key={p.id}
                  className={cn("px-3 py-2 text-sm cursor-pointer hover:bg-muted", opponent === p.id && "bg-primary/10 text-primary font-medium")}
                  onClick={() => setOpponent(p.id)}>
                  {p.full_name}
                </div>
              ))}
              {filtered.length === 0 && <p className="p-3 text-xs text-muted-foreground">Nəticə yoxdur</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Sual sayı</label>
              <Select value={count} onValueChange={setCount}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["5", "10", "15", "20"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Müddət</label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">1 dəqiqə</SelectItem>
                  <SelectItem value="120">2 dəqiqə</SelectItem>
                  <SelectItem value="180">3 dəqiqə</SelectItem>
                  <SelectItem value="300">5 dəqiqə</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {poolSize !== null && (
            <p className="text-xs text-muted-foreground">Gamification sual poolu: {poolSize} sual</p>
          )}
          <Button className="w-full" onClick={create} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Dəvət göndər"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- duel play ----------
function DuelPlay({ duel, onDone }: { duel: Duel; onDone: () => void }) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<BankQ[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(duel.duration_seconds);
  const startRef = useRef(Date.now());
  const answersRef = useRef<{ question_id: string; answer_id: string | null; is_correct: boolean; response_ms: number }[]>([]);
  const qStartRef = useRef(Date.now());
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<{ correct: number; xp: number } | null>(null);

  useEffect(() => {
    (async () => {
      // mark in_progress
      await supabase.from("gamification_duels").update({ status: "in_progress" } as any).eq("id", duel.id).eq("status", "accepted");
      const { data: qs } = await supabase.from("bank_questions").select("id,text,question_type").in("id", duel.question_ids).eq("is_gamification_enabled", true);
      const { data: ans } = await supabase.from("bank_answers").select("id,question_id,text,is_correct").in("question_id", duel.question_ids);
      const ordered = duel.question_ids
        .map((id) => (qs ?? []).find((q: any) => q.id === id))
        .filter(Boolean)
        .map((q: any) => ({ ...q, answers: (ans ?? []).filter((a: any) => a.question_id === q.id) }));
      setQuestions(ordered as BankQ[]);
      startRef.current = Date.now();
      qStartRef.current = Date.now();
    })();
  }, [duel.id]);

  useEffect(() => {
    if (!questions || done) return;
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) { clearInterval(t); finish(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [questions, done]);

  const answer = (answerId: string | null, isCorrect: boolean) => {
    const q = questions![idx];
    answersRef.current.push({
      question_id: q.id,
      answer_id: answerId,
      is_correct: isCorrect,
      response_ms: Date.now() - qStartRef.current,
    });
    if (idx + 1 < questions!.length) {
      setIdx(idx + 1);
      qStartRef.current = Date.now();
    } else {
      finish();
    }
  };

  const finish = async () => {
    if (done) return;
    setDone(true);
    const totalMs = Date.now() - startRef.current;
    const correct = answersRef.current.filter((a) => a.is_correct).length;

    // save answers
    if (answersRef.current.length) {
      await supabase.from("gamification_duel_answers").insert(
        answersRef.current.map((a) => ({ ...a, duel_id: duel.id, user_id: user!.id })) as any
      );
    }

    // XP: participation + correct + speed bonus (win bonus after both finish)
    const avgMs = answersRef.current.length ? totalMs / answersRef.current.length : totalMs;
    const speedBonus = Math.max(0, Math.round(XP.speedBonusMax * (1 - avgMs / (duel.duration_seconds * 1000 / duel.question_count))));
    const xp = XP.duelParticipation + correct * XP.correct + speedBonus;
    await awardXp(user!.id, "duel", xp, duel.id);

    // update duel
    const isChallenger = duel.challenger_id === user!.id;
    const patch: any = isChallenger
      ? { challenger_score: correct, challenger_time_ms: totalMs, challenger_finished_at: new Date().toISOString() }
      : { opponent_score: correct, opponent_time_ms: totalMs, opponent_finished_at: new Date().toISOString() };
    await supabase.from("gamification_duels").update(patch).eq("id", duel.id);

    // check if both finished
    const { data: fresh } = await supabase.from("gamification_duels").select("*").eq("id", duel.id).single();
    const d = fresh as unknown as Duel;
    if (d && d.challenger_finished_at && d.opponent_finished_at && d.status !== "completed") {
      const cs = d.challenger_score ?? 0, os = d.opponent_score ?? 0;
      let winner: string | null = null;
      if (cs > os) winner = d.challenger_id;
      else if (os > cs) winner = d.opponent_id;
      else if ((d.challenger_time_ms ?? 0) < (d.opponent_time_ms ?? 0)) winner = d.challenger_id;
      else if ((d.opponent_time_ms ?? 0) < (d.challenger_time_ms ?? 0)) winner = d.opponent_id;
      await supabase.from("gamification_duels").update({ status: "completed", winner_id: winner } as any).eq("id", duel.id);
      if (winner) await awardXp(winner, "duel_win", XP.duelWin, duel.id);
    }
    if (correct >= 10 && correct === duel.question_count) await awardBadge(user!.id, "sniper");
    if (correct > 0 && totalMs <= duel.duration_seconds * 500) await awardBadge(user!.id, "speedster");
    await checkBadges(user!.id);
    setResult({ correct, xp });
  };

  if (!questions) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (result) {
    return (
      <div className="p-6 lg:p-10 max-w-xl mx-auto">
        <Card className="p-8 text-center space-y-4">
          <Trophy className="h-12 w-12 mx-auto text-warning" />
          <h2 className="font-display text-2xl font-bold">Duel tamamlandı!</h2>
          <p className="text-lg">{result.correct} / {questions.length} düzgün cavab</p>
          <p className="text-primary font-semibold">+{result.xp} XP</p>
          <p className="text-sm text-muted-foreground">Qalib rəqib də cavablandırdıqdan sonra müəyyənləşəcək.</p>
          <Button onClick={onDone}>Geri qayıt</Button>
        </Card>
      </div>
    );
  }

  const q = questions[idx];
  const mm = Math.floor(timeLeft / 60), ss = timeLeft % 60;
  return (
    <div className="p-6 lg:p-10 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="outline">Sual {idx + 1} / {questions.length}</Badge>
        <Badge variant={timeLeft < 15 ? "destructive" : "secondary"} className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" /> {mm}:{String(ss).padStart(2, "0")}
        </Badge>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${(idx / questions.length) * 100}%` }} />
      </div>
      <Card className="p-6">
        <p className="font-medium mb-4">{q.text}</p>
        <div className="space-y-2">
          {q.answers.map((a) => (
            <Button key={a.id} variant="outline" className="w-full justify-start text-left h-auto py-3"
              onClick={() => answer(a.id, a.is_correct)}>
              {a.text}
            </Button>
          ))}
          {q.answers.length === 0 && (
            <Button variant="outline" className="w-full" onClick={() => answer(null, false)}>Keç</Button>
          )}
        </div>
      </Card>
    </div>
  );
}

// ---------- duel detail ----------
function DuelDetailDialog({ duel, nameOf, onClose }: { duel: Duel; nameOf: (id: string) => string; onClose: () => void }) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    (async () => {
      const { data: ans } = await supabase.from("gamification_duel_answers").select("*").eq("duel_id", duel.id);
      const qIds = duel.question_ids;
      const { data: qs } = await supabase.from("bank_questions").select("id,text").in("id", qIds);
      const { data: bas } = await supabase.from("bank_answers").select("id,question_id,text,is_correct").in("question_id", qIds);
      const merged = (ans ?? []).map((a: any) => ({
        ...a,
        question_text: (qs ?? []).find((q: any) => q.id === a.question_id)?.text ?? "—",
        answer_text: (bas ?? []).find((b: any) => b.id === a.answer_id)?.text ?? "—",
        correct_text: (bas ?? []).find((b: any) => b.question_id === a.question_id && b.is_correct)?.text ?? "—",
      }));
      setRows(merged);
    })();
  }, [duel.id]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{nameOf(duel.challenger_id)} vs {nameOf(duel.opponent_id)}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground mb-3">
          {nameOf(duel.challenger_id)}: {duel.challenger_score ?? "—"} ({duel.challenger_time_ms ? fmtMs(duel.challenger_time_ms) : "—"}) ·{" "}
          {nameOf(duel.opponent_id)}: {duel.opponent_score ?? "—"} ({duel.opponent_time_ms ? fmtMs(duel.opponent_time_ms) : "—"})
        </div>
        {!rows ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <Card key={r.id} className="p-3 text-sm">
                <div className="font-medium mb-1">{r.question_text}</div>
                <div className="text-xs text-muted-foreground">
                  {nameOf(r.user_id)}: <span className={r.is_correct ? "text-green-700" : "text-destructive"}>{r.answer_text}</span>
                  {" · "}Düzgün: {r.correct_text} · {fmtMs(r.response_ms)}
                </div>
              </Card>
            ))}
            {rows.length === 0 && <p className="text-sm text-muted-foreground">Cavab tapılmadı</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- daily challenge ----------
function DailyChallengeCard({ challenge, attempt, onDone }: { challenge: any; attempt: any; onDone: () => void }) {
  const { user } = useAuth();
  const [playing, setPlaying] = useState(false);
  const [questions, setQuestions] = useState<BankQ[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState<number | null>(null);

  const start = async () => {
    const ids = (challenge?.question_ids ?? []) as string[];
    const { data: qs } = await supabase.from("bank_questions").select("id,text,question_type").in("id", ids).eq("is_gamification_enabled", true);
    const { data: ans } = await supabase.from("bank_answers").select("id,question_id,text,is_correct").in("question_id", ids);
    const ordered = ids.map((id) => (qs ?? []).find((q: any) => q.id === id)).filter(Boolean)
      .map((q: any) => ({ ...q, answers: (ans ?? []).filter((a: any) => a.question_id === q.id) }));
    if (!ordered.length) return toast.error("Challenge sualları tapılmadı");
    setQuestions(ordered as BankQ[]);
    setPlaying(true);
  };

  const answer = async (isCorrect: boolean) => {
    const newCorrect = correct + (isCorrect ? 1 : 0);
    setCorrect(newCorrect);
    if (idx + 1 < questions!.length) setIdx(idx + 1);
    else {
      const perfect = newCorrect === questions!.length;
      const xp = XP.dailyChallenge + (perfect ? XP.challengePerfect : 0);
      await supabase.from("gamification_challenge_attempts").insert({
        challenge_id: challenge.id, user_id: user!.id,
        correct_count: newCorrect, total_questions: questions!.length, xp_earned: xp,
      } as any);
      await awardXp(user!.id, "daily_challenge", xp, challenge.id);
      if (perfect) await awardBadge(user!.id, "perfect_score");
      await checkBadges(user!.id);
      setFinished(newCorrect);
    }
  };

  if (!challenge) {
    return (
      <Card className="p-10 text-center border-dashed">
        <Target className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Bugünkü challenge hələ hazır deyil (kifayət qədər aktiv gamification sualı yoxdur).</p>
      </Card>
    );
  }

  if (attempt && !playing) {
    return (
      <Card className="p-8 text-center space-y-2">
        <Star className="h-10 w-10 mx-auto text-warning" />
        <h3 className="font-display text-xl font-bold">Bugünkü challenge tamamlanıb!</h3>
        <p className="text-muted-foreground">{attempt.correct_count} / {attempt.total_questions} düzgün · +{attempt.xp_earned} XP</p>
      </Card>
    );
  }

  if (!playing) {
    return (
      <Card className="p-8 text-center space-y-4">
        <Target className="h-10 w-10 mx-auto text-primary" />
        <h3 className="font-display text-xl font-bold">Bugünkü Challenge</h3>
        <p className="text-muted-foreground">{(challenge.question_ids as string[]).length} sualı cavablandır · +{challenge.xp_reward} XP (100% üçün +{XP.challengePerfect} bonus)</p>
        <Button onClick={start}>Başla</Button>
      </Card>
    );
  }

  if (finished !== null) {
    return (
      <Card className="p-8 text-center space-y-3">
        <Trophy className="h-10 w-10 mx-auto text-warning" />
        <h3 className="font-display text-xl font-bold">{finished} / {questions!.length} düzgün</h3>
        <Button onClick={onDone}>Geri qayıt</Button>
      </Card>
    );
  }

  const q = questions![idx];
  return (
    <Card className="p-6 space-y-4">
      <Badge variant="outline">Sual {idx + 1} / {questions!.length}</Badge>
      <p className="font-medium">{q.text}</p>
      <div className="space-y-2">
        {q.answers.map((a) => (
          <Button key={a.id} variant="outline" className="w-full justify-start text-left h-auto py-3"
            onClick={() => answer(a.is_correct)}>
            {a.text}
          </Button>
        ))}
      </div>
    </Card>
  );
}

// ---------- boss battle ----------
interface BossBattle {
  id: string;
  title: string;
  question_ids: string[];
  question_count: number;
  duration_seconds: number;
  is_active: boolean;
  created_at: string;
}

function BossBattleCard({ onChanged }: { onChanged: () => void }) {
  const { user, isAdmin } = useAuth();
  const [battles, setBattles] = useState<BossBattle[] | null>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [createOpen, setCreateOpen] = useState(false);
  const [playing, setPlaying] = useState<BossBattle | null>(null);
  const [title, setTitle] = useState("");
  const [count, setCount] = useState("20");
  const [duration, setDuration] = useState("300");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [{ data: bs }, { data: atts }, { data: profs }] = await Promise.all([
      supabase.from("gamification_boss_battles" as any).select("*").eq("is_active", true).order("created_at", { ascending: false }),
      supabase.from("gamification_boss_attempts" as any).select("*"),
      supabase.from("profiles").select("id,full_name"),
    ]);
    setBattles((bs ?? []) as unknown as BossBattle[]);
    setAttempts(atts ?? []);
    setNames(new Map(((profs ?? []) as any[]).map((p) => [p.id, p.full_name])));
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!title.trim()) return toast.error("Başlıq boş ola bilməz");
    const n = parseInt(count);
    const { data: pool } = await supabase.from("bank_questions").select("id").eq("is_gamification_enabled", true);
    const ids = ((pool ?? []) as { id: string }[]).map((q) => q.id);
    if (ids.length < n) return toast.error(`Kifayət qədər aktiv sual yoxdur (${ids.length}/${n})`);
    const sample = [...ids].sort(() => Math.random() - 0.5).slice(0, n);
    setSaving(true);
    const { error } = await supabase.from("gamification_boss_battles" as any).insert({
      title: title.trim(), question_ids: sample, question_count: n,
      duration_seconds: parseInt(duration), created_by: user!.id,
    } as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Boss Battle yaradıldı");
    setCreateOpen(false);
    setTitle("");
    load();
    onChanged();
  };

  const closeBattle = async (id: string) => {
    const { error } = await supabase.from("gamification_boss_battles" as any).update({ is_active: false } as any).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  if (playing) {
    return <BossPlay battle={playing} onDone={() => { setPlaying(null); load(); onChanged(); }} />;
  }

  if (!battles) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Boss Battle — hamı eyni sual dəstini cavablandırır, ən yaxşı nəticə qazanır. Hər battle üçün bir cəhd.</p>
        {isAdmin && (
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> Yeni Boss Battle</Button>
        )}
      </div>
      {battles.length === 0 && (
        <Card className="p-10 text-center border-dashed">
          <Skull className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Aktiv Boss Battle yoxdur</p>
        </Card>
      )}
      {battles.map((b) => {
        const bAtts = attempts.filter((a) => a.battle_id === b.id).sort((x, y) => y.correct_count - x.correct_count || x.duration_seconds - y.duration_seconds);
        const mine = bAtts.find((a) => a.user_id === user?.id);
        return (
          <Card key={b.id} className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-display font-semibold flex items-center gap-2"><Skull className="h-4 w-4 text-destructive" /> {b.title}</div>
                <div className="text-xs text-muted-foreground">{b.question_count} sual · {Math.round(b.duration_seconds / 60)} dəqiqə · {bAtts.length} iştirakçı</div>
              </div>
              <div className="flex gap-2">
                {mine ? (
                  <Badge variant="secondary">{mine.correct_count}/{mine.total_questions} · +{mine.xp_earned} XP</Badge>
                ) : (
                  <Button size="sm" onClick={() => setPlaying(b)}>Başla</Button>
                )}
                {isAdmin && <Button size="sm" variant="outline" onClick={() => closeBattle(b.id)}>Bitir</Button>}
              </div>
            </div>
            {bAtts.length > 0 && (
              <div className="border-t pt-2 space-y-1">
                {bAtts.slice(0, 5).map((a, i) => (
                  <div key={a.id} className={cn("flex items-center gap-2 text-sm", a.user_id === user?.id && "font-semibold text-primary")}>
                    <span className="w-6">{["🥇", "🥈", "🥉"][i] ?? `#${i + 1}`}</span>
                    <span className="flex-1 truncate">{names.get(a.user_id) ?? "—"}</span>
                    <span>{a.correct_count}/{a.total_questions}</span>
                    <span className="text-muted-foreground">{fmtMs(a.duration_seconds * 1000)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Yeni Boss Battle</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Başlıq (məs: Həftənin Boss-u)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Select value={count} onValueChange={setCount}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["10", "15", "20"].map((v) => <SelectItem key={v} value={v}>{v} sual</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[["180", "3 dəqiqə"], ["300", "5 dəqiqə"], ["600", "10 dəqiqə"]].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">Suallar gamification üçün aktiv suallardan təsadüfi seçilir.</p>
            <Button className="w-full" onClick={create} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Yarat
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BossPlay({ battle, onDone }: { battle: BossBattle; onDone: () => void }) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<BankQ[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(battle.duration_seconds);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<{ correct: number; xp: number } | null>(null);
  const answersRef = useRef<{ question_id: string; is_correct: boolean }[]>([]);
  const startRef = useRef(Date.now());

  useEffect(() => {
    (async () => {
      const ids = battle.question_ids;
      const [{ data: qs }, { data: ans }] = await Promise.all([
        supabase.from("bank_questions").select("id,text,question_type").in("id", ids).eq("is_gamification_enabled", true),
        supabase.from("bank_answers").select("id,question_id,text,is_correct").in("question_id", ids),
      ]);
      const ordered = ids.map((id) => (qs ?? []).find((q: any) => q.id === id)).filter(Boolean)
        .map((q: any) => ({ ...q, answers: (ans ?? []).filter((a: any) => a.question_id === q.id) }));
      if (!ordered.length) { toast.error("Suallar tapılmadı"); onDone(); return; }
      setQuestions(ordered as BankQ[]);
    })();
  }, []);

  useEffect(() => {
    if (!questions || done) return;
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) { clearInterval(t); finish(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [questions, done]);

  const answer = (isCorrect: boolean) => {
    answersRef.current.push({ question_id: questions![idx].id, is_correct: isCorrect });
    if (idx + 1 < questions!.length) setIdx(idx + 1);
    else finish();
  };

  const finish = async () => {
    if (done) return;
    setDone(true);
    const totalSec = Math.round((Date.now() - startRef.current) / 1000);
    const total = questions!.length;
    const correct = answersRef.current.filter((a) => a.is_correct).length;
    const xp = correct * 50;
    const { error } = await supabase.from("gamification_boss_attempts" as any).insert({
      battle_id: battle.id, user_id: user!.id,
      correct_count: correct, total_questions: total,
      duration_seconds: totalSec, score_percent: total ? (correct / total) * 100 : 0,
      xp_earned: xp,
    } as any);
    if (error) {
      toast.error("Bu Boss Battle-i artıq tamamlamısan");
      return onDone();
    }
    if (xp > 0) await awardXp(user!.id, "boss_battle", xp, battle.id);
    if (correct === total) await awardBadge(user!.id, "perfect_score");
    await checkBadges(user!.id);
    setResult({ correct, xp });
  };

  if (!questions) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (result) {
    return (
      <Card className="p-8 text-center space-y-4 max-w-xl mx-auto">
        <Skull className="h-12 w-12 mx-auto text-destructive" />
        <h2 className="font-display text-2xl font-bold">Boss Battle tamamlandı!</h2>
        <p className="text-lg">{result.correct} / {questions.length} düzgün cavab</p>
        <p className="text-primary font-semibold">+{result.xp} XP</p>
        <Button onClick={onDone}>Geri qayıt</Button>
      </Card>
    );
  }

  const q = questions[idx];
  const mm = Math.floor(timeLeft / 60), ss = timeLeft % 60;
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <Badge variant="outline">Sual {idx + 1} / {questions.length}</Badge>
        <Badge variant={timeLeft < 30 ? "destructive" : "secondary"} className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" /> {mm}:{String(ss).padStart(2, "0")}
        </Badge>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-destructive transition-all" style={{ width: `${(idx / questions.length) * 100}%` }} />
      </div>
      <Card className="p-6">
        <p className="font-medium mb-4">{q.text}</p>
        <div className="space-y-2">
          {q.answers.map((a) => (
            <Button key={a.id} variant="outline" className="w-full justify-start text-left h-auto py-3"
              onClick={() => answer(a.is_correct)}>
              {a.text}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ---------- XP config (admin) ----------
function XpConfigDialog({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<{ key: string; label: string; xp: number }[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("gamification_xp_config").select("key,label,xp").order("key");
      setRows((data ?? []) as any);
    })();
  }, []);

  const save = async () => {
    if (!rows) return;
    setSaving(true);
    for (const r of rows) {
      const { error } = await supabase.from("gamification_xp_config").update({ xp: Math.max(0, Math.round(r.xp)) } as any).eq("key", r.key);
      if (error) { setSaving(false); return toast.error(error.message); }
    }
    await loadXpConfig();
    setSaving(false);
    toast.success("XP dəyərləri yeniləndi");
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>XP tənzimləmələri</DialogTitle></DialogHeader>
        {!rows ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={r.key} className="flex items-center gap-3">
                <span className="flex-1 text-sm">{r.label}</span>
                <Input
                  type="number" min={0} className="w-24"
                  value={r.xp}
                  onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, xp: Number(e.target.value) } : x))}
                />
              </div>
            ))}
            <Button className="w-full" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Yadda saxla
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
