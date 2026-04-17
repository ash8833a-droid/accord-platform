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

interface CommitteeStat {
  id: string;
  type: CommitteeType;
  name: string;
  budget_allocated: number;
  budget_spent: number;
  total_tasks: number;
  done_tasks: number;
  pending_requests: number;
  paid_requests: number;
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
        supabase.from("committee_tasks").select("committee_id, status"),
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
          return {
            id: c.id,
            type: c.type as CommitteeType,
            name: c.name,
            budget_allocated: Number(c.budget_allocated),
            budget_spent: Number(c.budget_spent),
            total_tasks: ct.length,
            done_tasks: ct.filter((t) => t.status === "completed").length,
            pending_requests: cr.filter((r) => r.status === "pending").length,
            paid_requests: cr.filter((r) => r.status === "paid").length,
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
      <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-8 lg:p-10 text-primary-foreground shadow-elegant">
        <div className="absolute -top-10 -left-10 w-72 h-72 bg-gold/20 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="space-y-3 text-center lg:text-right">
            <p className="text-sm text-primary-foreground/70">لوحة الإدارة العليا</p>
            <h1 className="text-3xl lg:text-4xl font-bold">
              نظرة عامة على <span className="text-shimmer-gold">برنامج الزواج الجماعي</span>
            </h1>
            <p className="text-primary-foreground/80 max-w-xl">
              متابعة شاملة لأداء جميع اللجان: الميزانيات، المهام، طلبات الصرف، الاشتراكات وملفات العرسان.
            </p>
          </div>
          <AnimatedRings className="w-56 h-32" />
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
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

            return (
              <Link
                key={c.id}
                to="/committee/$type"
                params={{ type: c.type }}
                className="group rounded-xl border bg-gradient-to-br from-card to-muted/30 p-4 hover:shadow-elegant hover:-translate-y-0.5 transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${meta?.tone ?? "bg-muted"}`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {meta?.description}
                      </p>
                    </div>
                  </div>
                  {c.pending_requests > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                      <AlertCircle className="h-3 w-3" />
                      {c.pending_requests}
                    </span>
                  )}
                </div>

                {/* Budget bar */}
                <div className="space-y-1.5 mb-2.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">الميزانية</span>
                    <span className={`font-semibold ${overBudget ? "text-destructive" : ""}`}>
                      {fmt(c.budget_spent)} / {fmt(c.budget_allocated)} ر.س
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-700 ${overBudget ? "bg-destructive" : "bg-gradient-hero"}`}
                      style={{ width: `${Math.min(100, budgetPct)}%` }}
                    />
                  </div>
                </div>

                {/* Tasks bar */}
                <div className="space-y-1.5 mb-2.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">المهام</span>
                    <span className="font-semibold">
                      {c.done_tasks} / {c.total_tasks}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-gold transition-all duration-700"
                      style={{ width: `${Math.min(100, taskPct)}%` }}
                    />
                  </div>
                </div>

                {/* Stats footer */}
                <div className="flex items-center justify-between pt-2 mt-2 border-t border-border/60 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Receipt className="h-3 w-3" />
                    {c.paid_requests} مصروف
                  </span>
                  <span className="text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    عرض اللجنة ←
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
