import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  computeQualityKpis,
  type KpiSummary,
  KPI_CATEGORY_LABEL,
  KPI_CATEGORY_TONE,
  type KpiCategory,
} from "@/lib/quality-kpis";
import { ShieldCheck, Target, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const RATING_TONE: Record<KpiSummary["rating"], string> = {
  "ممتاز": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  "جيد جداً": "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  "جيد": "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  "مقبول": "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  "يحتاج تحسين": "bg-destructive/15 text-destructive border-destructive/30",
};

export function QualityScorecard() {
  const [summary, setSummary] = useState<KpiSummary | null>(null);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [
        committees,
        tasks,
        requests,
        grooms,
        subs,
        reports,
        teamMembers,
      ] = await Promise.all([
        supabase.from("committees").select("id, budget_allocated, budget_spent"),
        supabase.from("committee_tasks").select("committee_id, status, due_date, updated_at"),
        supabase.from("payment_requests").select("status"),
        supabase.from("grooms").select("status"),
        supabase.from("subscriptions").select("status"),
        supabase.from("reports").select("is_archived"),
        supabase.from("team_members").select("committee_id"),
      ]);

      const com = committees.data ?? [];
      const tk = tasks.data ?? [];
      const rq = requests.data ?? [];
      const gr = grooms.data ?? [];
      const sb = subs.data ?? [];
      const rp = reports.data ?? [];
      const tm = teamMembers.data ?? [];

      const tasksWithDue = tk.filter((t) => !!t.due_date);
      const onTime = tasksWithDue.filter(
        (t) => t.status === "completed" && t.due_date && t.updated_at && t.updated_at.slice(0, 10) <= t.due_date,
      ).length;
      const overdue = tk.filter(
        (t) => t.status !== "completed" && t.due_date && t.due_date < today,
      ).length;

      const activeCommittees = new Set(
        tk.filter((t) => t.status === "in_progress" || t.status === "completed").map((t) => t.committee_id),
      ).size;
      const committeesWithTeam = new Set(tm.map((m) => m.committee_id)).size;

      const result = computeQualityKpis({
        totalTasks: tk.length,
        doneTasks: tk.filter((t) => t.status === "completed").length,
        overdueTasks: overdue,
        onTimeDoneTasks: onTime,
        tasksWithDueDate: tasksWithDue.length,
        totalBudget: com.reduce((a, c) => a + Number(c.budget_allocated), 0),
        spentBudget: com.reduce((a, c) => a + Number(c.budget_spent), 0),
        totalRequests: rq.length,
        pendingRequests: rq.filter((r) => r.status === "pending").length,
        committees: com.length,
        activeCommittees,
        committeesWithTeam,
        totalGrooms: gr.length,
        progressedGrooms: gr.filter((g) => g.status === "approved" || g.status === "completed").length,
        totalSubs: sb.length,
        confirmedSubs: sb.filter((s) => s.status === "confirmed").length,
        totalReports: rp.length,
        archivedReports: rp.filter((r) => r.is_archived).length,
      });
      setSummary(result);
    })();
  }, []);

  if (!summary) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
        جاري حساب مؤشرات الأداء...
      </div>
    );
  }

  const grouped = summary.results.reduce<Record<KpiCategory, typeof summary.results>>(
    (acc, r) => {
      (acc[r.kpi.category] ||= []).push(r);
      return acc;
    },
    {} as Record<KpiCategory, typeof summary.results>,
  );

  const topRisks = [...summary.results]
    .filter((r) => r.achievement < 70)
    .sort((a, b) => a.achievement - b.achievement)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Overall scorecard */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-gold/5 p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-hero text-primary-foreground flex items-center justify-center shadow-elegant shrink-0">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">مؤشر الأداء العام للبرنامج</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-4xl font-extrabold text-shimmer-gold">{summary.overall}</h3>
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
              <Badge variant="outline" className={`mt-1 text-[11px] ${RATING_TONE[summary.rating]}`}>
                {summary.rating}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Target className="h-4 w-4" />
            تقييم آلي بناءً على {summary.results.length} مؤشراً مرجحاً
          </div>
        </div>

        {topRisks.length > 0 && (
          <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 mb-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-bold text-sm">أولويات التحسين</span>
            </div>
            <ul className="space-y-1.5 text-xs">
              {topRisks.map((r) => (
                <li key={r.kpi.id} className="flex items-center justify-between gap-3">
                  <span className="font-medium">{r.kpi.title}</span>
                  <span className="font-bold tabular-nums">{r.achievement}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Detailed grid by category */}
      {(Object.keys(grouped) as KpiCategory[]).map((cat) => (
        <div key={cat} className="rounded-2xl border bg-card shadow-soft overflow-hidden">
          <div className={`px-5 py-3 border-b flex items-center gap-2 ${KPI_CATEGORY_TONE[cat]}`}>
            <TrendingUp className="h-4 w-4" />
            <h4 className="font-bold text-sm">{KPI_CATEGORY_LABEL[cat]}</h4>
            <Badge variant="outline" className="text-[10px] ms-auto bg-background/60">
              {grouped[cat].length} مؤشر
            </Badge>
          </div>
          <div className="divide-y">
            {grouped[cat].map((r) => {
              const ok = r.achievement >= 80;
              const warn = r.achievement < 60;
              const barTone = ok ? "bg-emerald-500" : warn ? "bg-destructive" : "bg-amber-500";
              return (
                <div key={r.kpi.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {ok && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                        <p className="font-bold text-sm">{r.kpi.title}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{r.kpi.detail}</p>
                    </div>
                    <div className="text-end shrink-0">
                      <p className="text-2xl font-extrabold tabular-nums leading-none">{r.value}<span className="text-xs text-muted-foreground">{r.kpi.unit}</span></p>
                      <p className="text-[10px] text-muted-foreground mt-1">الهدف: {r.kpi.target}{r.kpi.unit}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full ${barTone} transition-all duration-700`}
                        style={{ width: `${r.achievement}%` }}
                      />
                    </div>
                    <span className="text-[11px] tabular-nums font-bold w-12 text-end">
                      {r.achievement}%
                    </span>
                    {r.raw && (
                      <span className="text-[10px] text-muted-foreground tabular-nums w-24 text-end truncate">
                        {r.raw}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Compact summary card for the dashboard */
export function QualitySummaryCard() {
  const [summary, setSummary] = useState<KpiSummary | null>(null);

  useEffect(() => {
    (async () => {
      const [committees, tasks, requests, grooms, subs, reports, teamMembers] = await Promise.all([
        supabase.from("committees").select("id, budget_allocated, budget_spent"),
        supabase.from("committee_tasks").select("committee_id, status, due_date, updated_at"),
        supabase.from("payment_requests").select("status"),
        supabase.from("grooms").select("status"),
        supabase.from("subscriptions").select("status"),
        supabase.from("reports").select("is_archived"),
        supabase.from("team_members").select("committee_id"),
      ]);
      const com = committees.data ?? [];
      const tk = tasks.data ?? [];
      const rq = requests.data ?? [];
      const gr = grooms.data ?? [];
      const sb = subs.data ?? [];
      const rp = reports.data ?? [];
      const tm = teamMembers.data ?? [];
      const today = new Date().toISOString().slice(0, 10);
      const tasksWithDue = tk.filter((t) => !!t.due_date);
      const onTime = tasksWithDue.filter(
        (t) => t.status === "completed" && t.due_date && t.updated_at && t.updated_at.slice(0, 10) <= t.due_date,
      ).length;
      const overdue = tk.filter((t) => t.status !== "completed" && t.due_date && t.due_date < today).length;

      setSummary(
        computeQualityKpis({
          totalTasks: tk.length,
          doneTasks: tk.filter((t) => t.status === "completed").length,
          overdueTasks: overdue,
          onTimeDoneTasks: onTime,
          tasksWithDueDate: tasksWithDue.length,
          totalBudget: com.reduce((a, c) => a + Number(c.budget_allocated), 0),
          spentBudget: com.reduce((a, c) => a + Number(c.budget_spent), 0),
          totalRequests: rq.length,
          pendingRequests: rq.filter((r) => r.status === "pending").length,
          committees: com.length,
          activeCommittees: new Set(
            tk.filter((t) => t.status === "in_progress" || t.status === "completed").map((t) => t.committee_id),
          ).size,
          committeesWithTeam: new Set(tm.map((m) => m.committee_id)).size,
          totalGrooms: gr.length,
          progressedGrooms: gr.filter((g) => g.status === "approved" || g.status === "completed").length,
          totalSubs: sb.length,
          confirmedSubs: sb.filter((s) => s.status === "confirmed").length,
          totalReports: rp.length,
          archivedReports: rp.filter((r) => r.is_archived).length,
        }),
      );
    })();
  }, []);

  if (!summary) return null;

  // top 4 highlights = 2 highest + 2 lowest for a balanced compact view
  const sorted = [...summary.results].sort((a, b) => b.achievement - a.achievement);
  const highlights = [...sorted.slice(0, 2), ...sorted.slice(-2)];

  return (
    <div className="rounded-2xl border bg-gradient-to-br from-sky-500/5 via-card to-primary/5 p-5 shadow-soft">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="h-9 w-9 rounded-xl bg-sky-500/15 text-sky-600 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-bold text-sm">مؤشر الجودة الإجمالي</h3>
            <p className="text-[11px] text-muted-foreground">تقييم آلي مرجح من لجنة الجودة</p>
          </div>
        </div>
        <div className="text-end">
          <p className="text-3xl font-extrabold tabular-nums leading-none text-shimmer-gold">{summary.overall}</p>
          <Badge variant="outline" className={`mt-1 text-[10px] ${RATING_TONE[summary.rating]}`}>
            {summary.rating}
          </Badge>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {highlights.map((r) => {
          const ok = r.achievement >= 80;
          const warn = r.achievement < 60;
          const tone = ok
            ? "border-emerald-500/30 bg-emerald-500/5"
            : warn
              ? "border-destructive/30 bg-destructive/5"
              : "border-amber-500/30 bg-amber-500/5";
          return (
            <div key={r.kpi.id} className={`rounded-lg border ${tone} px-3 py-2`}>
              <p className="text-[10px] text-muted-foreground truncate">{r.kpi.title}</p>
              <p className="text-sm font-extrabold tabular-nums mt-0.5">{r.achievement}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
