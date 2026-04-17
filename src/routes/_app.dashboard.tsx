import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/StatCard";
import { AnimatedRings } from "@/components/Logo";
import { Wallet, HeartHandshake, Users2, Target, TrendingUp, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

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
  });

  useEffect(() => {
    (async () => {
      const [com, grooms, subs, tasks] = await Promise.all([
        supabase.from("committees").select("budget_allocated, budget_spent"),
        supabase.from("grooms").select("id", { count: "exact", head: true }),
        supabase.from("subscriptions").select("status, amount"),
        supabase.from("committee_tasks").select("status"),
      ]);

      const totalBudget = (com.data ?? []).reduce((a, c) => a + Number(c.budget_allocated), 0);
      const spent = (com.data ?? []).reduce((a, c) => a + Number(c.budget_spent), 0);
      const subsList = subs.data ?? [];
      const taskList = tasks.data ?? [];

      setStats({
        totalBudget,
        spent,
        grooms: grooms.count ?? 0,
        confirmed: subsList.filter((s) => s.status === "confirmed").length,
        pending: subsList.filter((s) => s.status === "pending").length,
        tasks: taskList.length,
        doneTasks: taskList.filter((t) => t.status === "completed").length,
        committees: com.data?.length ?? 0,
      });
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
              متابعة مباشرة لأداء اللجان، الميزانيات، اشتراكات أبناء العائلة، وملفات العرسان.
            </p>
          </div>
          <AnimatedRings className="w-56 h-32" />
        </div>
      </div>

      {/* Stats grid */}
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

      {/* Quick info row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-2xl border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">تقدم اللجان</h2>
            <Users2 className="h-5 w-5 text-primary" />
          </div>
          <CommitteesProgress />
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-gold/10 to-transparent p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">الهدف السنوي</h2>
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
                style={{ width: `${Math.min(100, (stats.confirmed / Math.max(1, stats.confirmed + stats.pending)) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommitteesProgress() {
  const [list, setList] = useState<Array<{ id: string; name: string; budget_allocated: number; budget_spent: number }>>([]);
  useEffect(() => {
    supabase
      .from("committees")
      .select("id, name, budget_allocated, budget_spent")
      .order("budget_allocated", { ascending: false })
      .then(({ data }) => setList(data ?? []));
  }, []);
  const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(n);
  return (
    <div className="space-y-4">
      {list.map((c) => {
        const pct = c.budget_allocated > 0 ? (Number(c.budget_spent) / Number(c.budget_allocated)) * 100 : 0;
        return (
          <div key={c.id} className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{c.name}</span>
              <span className="text-muted-foreground">
                {fmt(Number(c.budget_spent))} / {fmt(Number(c.budget_allocated))} ر.س
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-hero transition-all duration-700"
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        );
      })}
      {list.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">لا توجد لجان بعد</p>}
    </div>
  );
}
