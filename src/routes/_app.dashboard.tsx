import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/StatCard";
import { AnimatedRings } from "@/components/Logo";
import { COMMITTEES, type CommitteeType } from "@/lib/committees";
import {
  Wallet,
  HeartHandshake,
  Target,
  TrendingUp,
  CheckCircle2,
  ListTodo,
  Receipt,
  Users2,
  AlertCircle,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

type PmpPhase = "initiating" | "planning" | "executing" | "monitoring" | "closing";

const PHASE_LABELS: Record<PmpPhase, string> = {
  initiating: "البدء",
  planning: "التخطيط",
  executing: "التنفيذ",
  monitoring: "المراقبة",
  closing: "الإغلاق",
};

const PHASE_TONE: Record<PmpPhase, string> = {
  initiating: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  planning: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  executing: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  monitoring: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  closing: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

const PHASE_PREFIX: Record<string, PmpPhase> = {
  "[البدء]": "initiating",
  "[التخطيط]": "planning",
  "[التنفيذ]": "executing",
  "[المراقبة]": "monitoring",
  "[الإغلاق]": "closing",
};

const detectPhase = (title: string): PmpPhase | null => {
  for (const [pre, ph] of Object.entries(PHASE_PREFIX)) {
    if (title.startsWith(pre)) return ph;
  }
  return null;
};

interface CommitteeStat {
  id: string;
  type: CommitteeType;
  name: string;
  budget_allocated: number;
  budget_spent: number;
  total_tasks: number;
  done_tasks: number;
  in_progress_tasks: number;
  pending_requests: number;
  paid_requests: number;
  /** PMP phase progress: { phase: { total, done } } */
  phases: Record<PmpPhase, { total: number; done: number }>;
  /** Schedule Performance Index proxy = done / total */
  spi: number;
  /** Cost Performance Index proxy = (allocated - spent) / allocated */
  cpi: number;
}

function Dashboard() {
  const [stats, setStats] = useState({
    totalBudget: 0,
    spent: 0,
    grooms: 0,
    confirmed: 0,
    pending: 0,
    tasks: 0,
    doneTasks: 0,
    committees: 0,
    pendingRequests: 0,
  });
  const [perCommittee, setPerCommittee] = useState<CommitteeStat[]>([]);

  useEffect(() => {
    (async () => {
      const [com, grooms, subs, tasks, requests] = await Promise.all([
        supabase.from("committees").select("id, type, name, budget_allocated, budget_spent"),
        supabase.from("grooms").select("id", { count: "exact", head: true }),
        supabase.from("subscriptions").select("status, amount"),
        supabase.from("committee_tasks").select("committee_id, status, title"),
        supabase.from("payment_requests").select("committee_id, status, amount"),
      ]);

      const committees = com.data ?? [];
      const taskList = tasks.data ?? [];
      const reqList = requests.data ?? [];
      const subsList = subs.data ?? [];

      const totalBudget = committees.reduce((a, c) => a + Number(c.budget_allocated), 0);
      const spent = committees.reduce((a, c) => a + Number(c.budget_spent), 0);

      setStats({
        totalBudget,
        spent,
        grooms: grooms.count ?? 0,
        confirmed: subsList.filter((s) => s.status === "confirmed").length,
        pending: subsList.filter((s) => s.status === "pending").length,
        tasks: taskList.length,
        doneTasks: taskList.filter((t) => t.status === "completed").length,
        committees: committees.length,
        pendingRequests: reqList.filter((r) => r.status === "pending").length,
      });

      setPerCommittee(
        committees.map((c) => {
          const ct = taskList.filter((t) => t.committee_id === c.id);
          const cr = reqList.filter((r) => r.committee_id === c.id);
          const phases: Record<PmpPhase, { total: number; done: number }> = {
            initiating: { total: 0, done: 0 },
            planning: { total: 0, done: 0 },
            executing: { total: 0, done: 0 },
            monitoring: { total: 0, done: 0 },
            closing: { total: 0, done: 0 },
          };
          ct.forEach((t) => {
            const ph = detectPhase(t.title ?? "");
            if (ph) {
              phases[ph].total += 1;
              if (t.status === "completed") phases[ph].done += 1;
            }
          });
          const allocated = Number(c.budget_allocated);
          const spentC = Number(c.budget_spent);
          const doneCount = ct.filter((t) => t.status === "completed").length;
          return {
            id: c.id,
            type: c.type as CommitteeType,
            name: c.name,
            budget_allocated: allocated,
            budget_spent: spentC,
            total_tasks: ct.length,
            done_tasks: doneCount,
            in_progress_tasks: ct.filter((t) => t.status === "in_progress").length,
            pending_requests: cr.filter((r) => r.status === "pending").length,
            paid_requests: cr.filter((r) => r.status === "paid").length,
            phases,
            spi: ct.length > 0 ? doneCount / ct.length : 0,
            cpi: allocated > 0 ? Math.max(0, (allocated - spentC) / allocated) : 1,
          };
        }),
      );
    })();
  }, []);

  const completion = stats.tasks ? Math.round((stats.doneTasks / stats.tasks) * 100) : 0;
  const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(n);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-8 text-primary-foreground shadow-elegant">
        <div className="absolute -top-10 -left-10 w-72 h-72 bg-gold/20 rounded-full blur-3xl" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gold/20 flex items-center justify-center backdrop-blur-sm shrink-0">
            <TrendingUp className="h-7 w-7 text-gold" />
          </div>
          <div>
            <p className="text-sm text-primary-foreground/70">لوحة الإدارة العليا</p>
            <h1 className="text-2xl lg:text-3xl font-bold">
              نظرة عامة على <span className="text-shimmer-gold">برنامج الزواج الجماعي</span>
            </h1>
            <p className="text-primary-foreground/80 text-sm mt-1">
              متابعة شاملة لأداء جميع اللجان: الميزانيات، المهام، طلبات الصرف، الاشتراكات وملفات العرسان
            </p>
          </div>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          variant="teal"
          label="إجمالي الميزانية"
          value={`${fmt(stats.totalBudget)} ر.س`}
          hint={`المنصرف ${fmt(stats.spent)} ر.س`}
          icon={Wallet}
        />
        <StatCard
          variant="gold"
          label="عدد العرسان"
          value={fmt(stats.grooms)}
          hint="مسجل في النظام"
          icon={HeartHandshake}
        />
        <StatCard
          label="اشتراكات مؤكدة"
          value={fmt(stats.confirmed)}
          hint={`${fmt(stats.pending)} معلقة`}
          icon={CheckCircle2}
        />
        <StatCard
          label="نسبة إنجاز المهام"
          value={`${completion}%`}
          hint={`${stats.doneTasks} / ${stats.tasks} مهمة`}
          icon={TrendingUp}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <StatCard
          label="عدد اللجان"
          value={fmt(stats.committees)}
          hint="لجنة فعّالة"
          icon={Users2}
        />
        <StatCard
          label="طلبات صرف معلقة"
          value={fmt(stats.pendingRequests)}
          hint="بانتظار اعتماد المالية"
          icon={Receipt}
        />
        <StatCard
          label="إجمالي المهام"
          value={fmt(stats.tasks)}
          hint={`${stats.doneTasks} مكتملة`}
          icon={ListTodo}
        />
      </div>

      {/* Per-committee multi-indicator grid */}
      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold">مؤشرات اللجان</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              أداء كل لجنة عبر الميزانية، المهام، وطلبات الصرف
            </p>
          </div>
          <Users2 className="h-5 w-5 text-primary" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {perCommittee.map((c) => {
            const meta = COMMITTEES.find((m) => m.type === c.type);
            const Icon = meta?.icon ?? Users2;
            const budgetPct =
              c.budget_allocated > 0 ? (c.budget_spent / c.budget_allocated) * 100 : 0;
            const taskPct = c.total_tasks > 0 ? (c.done_tasks / c.total_tasks) * 100 : 0;
            const overBudget = budgetPct > 90;

            const remaining = c.budget_allocated - c.budget_spent;
            return (
              <Link
                key={c.id}
                to="/committee/$type"
                params={{ type: c.type }}
                className="group rounded-2xl border bg-gradient-card p-5 hover:shadow-elegant hover:-translate-y-0.5 transition-all duration-300 shadow-soft"
              >
                {/* Top row: title + 3 stat chips */}
                <div className="flex flex-col gap-4 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${meta?.tone ?? "bg-muted"}`}>
                      <Icon className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-base break-words leading-tight">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{meta?.description}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <BudgetChip label="مخصص" value={`${fmt(c.budget_allocated)} ر.س`} tone="bg-primary/10 text-primary" />
                    <BudgetChip label="منصرف" value={`${fmt(c.budget_spent)} ر.س`} tone="bg-gold/15 text-gold-foreground" />
                    <BudgetChip label="المتبقي" value={`${fmt(remaining)} ر.س`} tone="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" />
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5 mb-3">
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full transition-all duration-700 ${overBudget ? "bg-destructive" : "bg-gradient-gold"}`}
                      style={{ width: `${Math.min(100, budgetPct)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>نسبة الصرف من الميزانية: {budgetPct.toFixed(0)}%</span>
                    {c.pending_requests > 0 && (
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                        <AlertCircle className="h-3 w-3" />
                        {c.pending_requests} بانتظار الاعتماد
                      </span>
                    )}
                  </div>
                </div>

                {/* Tasks + PMP phases (compact) */}
                <div className="flex items-center gap-3 pt-3 border-t border-border/60">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <ListTodo className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">المهام:</span>
                    <span className="font-bold">{c.done_tasks}/{c.total_tasks}</span>
                    <span className="text-muted-foreground">({taskPct.toFixed(0)}%)</span>
                  </div>
                  <div className="flex items-center gap-1 ms-auto">
                    {(Object.keys(PHASE_LABELS) as PmpPhase[]).map((ph) => {
                      const p = c.phases[ph];
                      const pct = p.total > 0 ? (p.done / p.total) * 100 : 0;
                      return (
                        <span
                          key={ph}
                          className={`h-6 px-1.5 rounded-md text-[9px] font-bold inline-flex items-center ${PHASE_TONE[ph]}`}
                          title={`${PHASE_LABELS[ph]}: ${p.done}/${p.total}`}
                        >
                          {p.total > 0 ? `${Math.round(pct)}%` : "—"}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* SPI / CPI footer */}
                <div className="flex items-center justify-between pt-2 mt-2 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded font-bold ${c.spi >= 0.8 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : c.spi >= 0.5 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-destructive/15 text-destructive"}`} title="مؤشر أداء الجدول">
                      SPI {c.spi.toFixed(2)}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded font-bold ${c.cpi >= 0.3 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : c.cpi >= 0.1 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-destructive/15 text-destructive"}`} title="مؤشر أداء التكلفة">
                      CPI {c.cpi.toFixed(2)}
                    </span>
                  </div>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Receipt className="h-3 w-3" />
                    {c.paid_requests} طلب مصروف
                  </span>
                </div>
              </Link>
            );
          })}
          {perCommittee.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6 col-span-full">
              لا توجد لجان بعد
            </p>
          )}
        </div>
      </div>

      {/* Annual goal */}
      <div className="rounded-2xl border bg-gradient-to-br from-gold/10 to-transparent p-6 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">الهدف السنوي للاشتراكات</h2>
          <Target className="h-5 w-5 text-gold" />
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          اشتراك أبناء العائلة بقيمة <span className="font-bold text-foreground">300 ر.س</span> سنوياً
        </p>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>المؤكد</span>
            <span className="font-semibold">{fmt(stats.confirmed * 300)} ر.س</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-gold transition-all duration-700"
              style={{
                width: `${Math.min(100, (stats.confirmed / Math.max(1, stats.confirmed + stats.pending)) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function BudgetChip({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-xl px-3 py-2 ${tone}`}>
      <p className="text-[10px] opacity-80 leading-none mb-1">{label}</p>
      <p className="text-xs font-extrabold leading-tight truncate" title={value}>{value}</p>
    </div>
  );
}
