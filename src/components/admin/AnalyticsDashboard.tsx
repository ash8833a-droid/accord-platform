import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PageGate } from "@/components/PageGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Activity, AlertTriangle, CheckCircle2, ClipboardList, HeartHandshake,
  ListTodo, Loader2, ShieldCheck, TrendingUp, UserPlus, Users, Wallet,
  Target, Inbox, FileBarChart, Settings2, ChevronDown,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

type Period = "day" | "week" | "month" | "quarter" | "year";

const PERIOD_LABEL: Record<Period, string> = {
  day: "اليوم", week: "الأسبوع", month: "الشهر", quarter: "الربع", year: "السنة",
};

function periodStart(p: Period): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  switch (p) {
    case "day": return d;
    case "week": { const x = new Date(d); x.setDate(d.getDate() - 6); return x; }
    case "month": { const x = new Date(d); x.setDate(d.getDate() - 29); return x; }
    case "quarter": { const x = new Date(d); x.setDate(d.getDate() - 89); return x; }
    case "year": { const x = new Date(d); x.setFullYear(d.getFullYear() - 1); return x; }
  }
}

interface Bucket { key: string; label: string; }

function buckets(p: Period): Bucket[] {
  const start = periodStart(p);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const out: Bucket[] = [];
  if (p === "day") {
    for (let h = 0; h < 24; h += 2) {
      const d = new Date(today); d.setHours(h);
      out.push({ key: `${today.toISOString().slice(0, 10)}T${String(h).padStart(2, "0")}`, label: `${h}:00` });
    }
    return out;
  }
  if (p === "year") {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i, 1); d.setHours(0, 0, 0, 0);
      out.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("ar-SA", { month: "short" }) });
    }
    return out;
  }
  // week / month / quarter — daily buckets
  const days = Math.round((today.getTime() - start.getTime()) / 86400000) + 1;
  for (let i = 0; i < days; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    out.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString("ar-SA", { month: "numeric", day: "numeric" }) });
  }
  return out;
}

function bucketKey(p: Period, iso: string): string {
  const d = new Date(iso);
  if (p === "day") {
    const h = d.getHours() - (d.getHours() % 2);
    return `${d.toISOString().slice(0, 10)}T${String(h).padStart(2, "0")}`;
  }
  if (p === "year") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return d.toISOString().slice(0, 10);
}

const COLORS = ["#0e7490", "#d4a017", "#16a34a", "#ea580c", "#7c3aed", "#dc2626", "#0891b2", "#ca8a04"];

export function AnalyticsDashboard() {
  return (
    <PageGate pageKey="admin">
      {() => <Inner />}
    </PageGate>
  );
}

function Inner() {
  const [period, setPeriod] = useState<Period>("month");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [period]);

  async function load() {
    setLoading(true);
    const start = periodStart(period).toISOString();
    const [
      committeesRes, tasksRes, tasksAllRes, membersRes, requestsRes,
      groomsRes, paymentsRes, paymentsAllRes,
    ] = await Promise.all([
      supabase.from("committees").select("id, name, type, budget_allocated, budget_spent"),
      supabase.from("committee_tasks").select("id, status, priority, committee_id, due_date, created_at, updated_at").gte("created_at", start),
      supabase.from("committee_tasks").select("id, status, priority, committee_id, due_date, created_at"),
      supabase.from("user_roles").select("user_id, created_at"),
      supabase.from("membership_requests").select("id, status, created_at"),
      supabase.from("grooms").select("id, status, created_at"),
      supabase.from("payment_requests").select("id, amount, status, committee_id, created_at").gte("created_at", start),
      supabase.from("payment_requests").select("id, amount, status, committee_id, created_at"),
    ]);

    setData({
      committees: committeesRes.data ?? [],
      tasksPeriod: tasksRes.data ?? [],
      tasksAll: tasksAllRes.data ?? [],
      members: membersRes.data ?? [],
      requests: requestsRes.data ?? [],
      grooms: groomsRes.data ?? [],
      paymentsPeriod: paymentsRes.data ?? [],
      paymentsAll: paymentsAllRes.data ?? [],
    });
    setLoading(false);
  }

  const k = useMemo(() => {
    if (!data) return null;
    const start = periodStart(period);
    const completedAll = data.tasksAll.filter((t: any) => t.status === "completed").length;
    const totalAll = data.tasksAll.length;
    const overdue = data.tasksAll.filter((t: any) =>
      t.due_date && t.status !== "completed" && new Date(t.due_date).getTime() < Date.now() - 86400000).length;
    const active = data.tasksAll.filter((t: any) => t.status !== "completed").length;
    const completedPeriod = data.tasksPeriod.filter((t: any) => t.status === "completed").length;
    const newRequests = data.requests.filter((r: any) => new Date(r.created_at) >= start).length;
    const newMembers = data.members.filter((m: any) => m.created_at && new Date(m.created_at) >= start).length;
    const newGrooms = data.grooms.filter((g: any) => new Date(g.created_at) >= start).length;
    const totalBudget = data.committees.reduce((s: number, c: any) => s + Number(c.budget_allocated || 0), 0);
    const totalSpent = data.committees.reduce((s: number, c: any) => s + Number(c.budget_spent || 0), 0);
    const pendingPayments = data.paymentsAll.filter((p: any) => p.status === "pending").length;
    const paidPeriodAmount = data.paymentsPeriod
      .filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

    return {
      totalAll, active, completedAll, completedPeriod, overdue,
      completionRate: totalAll === 0 ? 0 : Math.round((completedAll / totalAll) * 100),
      newRequests, newMembers, newGrooms,
      totalMembers: new Set(data.members.map((m: any) => m.user_id)).size,
      totalGrooms: data.grooms.length,
      pendingRequests: data.requests.filter((r: any) => r.status === "pending").length,
      totalBudget, totalSpent,
      remainingBudget: Math.max(0, totalBudget - totalSpent),
      spendRate: totalBudget === 0 ? 0 : Math.round((totalSpent / totalBudget) * 100),
      pendingPayments, paidPeriodAmount,
    };
  }, [data, period]);

  const charts = useMemo(() => {
    if (!data) return null;
    const bs = buckets(period);
    const cmName = (id: string) => data.committees.find((c: any) => c.id === id)?.name ?? "—";

    // Tasks over time (created vs completed) within period
    const taskTrend = bs.map((b) => ({
      label: b.label,
      created: data.tasksPeriod.filter((t: any) => bucketKey(period, t.created_at) === b.key).length,
      completed: data.tasksPeriod.filter((t: any) =>
        t.status === "completed" && bucketKey(period, t.updated_at || t.created_at) === b.key).length,
    }));

    // Status distribution
    const statusCounts = { todo: 0, in_progress: 0, completed: 0 } as Record<string, number>;
    data.tasksAll.forEach((t: any) => { statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1; });
    const statusPie = [
      { name: "قائمة الانتظار", value: statusCounts.todo },
      { name: "قيد التنفيذ", value: statusCounts.in_progress },
      { name: "مكتملة", value: statusCounts.completed },
    ];

    // Per-committee performance
    const perCommittee = data.committees.map((c: any) => {
      const ct = data.tasksAll.filter((t: any) => t.committee_id === c.id);
      const done = ct.filter((t: any) => t.status === "completed").length;
      return { name: c.name, total: ct.length, done, rate: ct.length === 0 ? 0 : Math.round((done / ct.length) * 100) };
    }).sort((a: any, b: any) => b.total - a.total).slice(0, 8);

    // Spending per committee
    const spending = data.committees
      .map((c: any) => ({ name: c.name, value: Number(c.budget_spent || 0) }))
      .filter((x: any) => x.value > 0)
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 6);

    // Grooms by status
    const groomStatus: Record<string, number> = {};
    data.grooms.forEach((g: any) => { groomStatus[g.status] = (groomStatus[g.status] ?? 0) + 1; });
    const groomLabels: Record<string, string> = {
      new: "جديد", under_review: "قيد المراجعة", approved: "معتمد", rejected: "مرفوض", completed: "مكتمل",
    };
    const groomPie = Object.entries(groomStatus).map(([k, v]) => ({ name: groomLabels[k] ?? k, value: v }));

    // Payment requests trend
    const paymentTrend = bs.map((b) => ({
      label: b.label,
      pending: data.paymentsPeriod.filter((p: any) => p.status === "pending" && bucketKey(period, p.created_at) === b.key).length,
      paid: data.paymentsPeriod.filter((p: any) => p.status === "paid" && bucketKey(period, p.created_at) === b.key).length,
    }));

    void cmName;
    return { taskTrend, statusPie, perCommittee, spending, groomPie, paymentTrend };
  }, [data, period]);

  if (!data || !k || !charts) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Minimal header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">لوحة الأداء</h1>
          <p className="text-sm text-muted-foreground mt-1">نظرة سريعة على ما يهمّك اليوم</p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)} dir="rtl">
            <TabsList>
              {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
                <TabsTrigger key={p} value={p}>{PERIOD_LABEL[p]}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Primary KPIs — top of dashboard, modern styled */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <HeroKpi
          label="عدد العرسان"
          value={k.totalGrooms}
          sub={`+${k.newGrooms} ${PERIOD_LABEL[period]}`}
          icon={HeartHandshake}
          accent="from-pink-500/15 to-pink-500/0 text-pink-600 ring-pink-500/20"
        />
        <HeroKpi
          label="طلبات معلّقة"
          value={k.pendingRequests}
          sub={`+${k.newRequests} ${PERIOD_LABEL[period]}`}
          icon={Inbox}
          accent="from-violet-500/15 to-violet-500/0 text-violet-600 ring-violet-500/20"
        />
        <HeroKpi
          label="مهام نشطة"
          value={k.active}
          sub={`${k.overdue} متأخرة`}
          icon={ClipboardList}
          accent="from-sky-500/15 to-sky-500/0 text-sky-600 ring-sky-500/20"
        />
        <HeroKpi
          label="نسبة الإنجاز"
          value={`${k.completionRate}%`}
          sub={`${k.completedAll} مكتملة`}
          icon={CheckCircle2}
          accent="from-emerald-500/15 to-emerald-500/0 text-emerald-600 ring-emerald-500/20"
        />
      </div>

      {/* Advanced: hidden by default */}
      <Collapsible>
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-sm text-muted-foreground">تفاصيل وتحليلات إضافية</p>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <Settings2 className="h-4 w-4" />
              عرض التحليلات المتقدمة
              <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="space-y-4 pt-4">

      {/* Extended KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="إجمالي المهام" value={k.totalAll} sub={`${k.active} نشطة`} icon={ClipboardList} tone="text-sky-600 bg-sky-500/10" />
        <Kpi label={`أُنجزت ${PERIOD_LABEL[period]}`} value={k.completedPeriod} sub="خلال الفترة" icon={Activity} tone="text-amber-600 bg-amber-500/10" />
        <Kpi label="إجمالي الأعضاء" value={k.totalMembers} sub={`+${k.newMembers} جدد`} icon={Users} tone="text-indigo-600 bg-indigo-500/10" />
        <Kpi label="نسبة الإنفاق" value={`${k.spendRate}%`} sub={`${fmtSar(k.totalSpent)} من ${fmtSar(k.totalBudget)}`} icon={Wallet} tone="text-teal-600 bg-teal-500/10" />
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="إجمالي المهام" value={k.totalAll} sub={`${k.active} نشطة`} icon={ClipboardList} tone="text-sky-600 bg-sky-500/10" />
        <Kpi label="نسبة الإنجاز" value={`${k.completionRate}%`} sub={`${k.completedAll} مكتملة`} icon={CheckCircle2} tone="text-emerald-600 bg-emerald-500/10" />
        <Kpi label="مهام متأخرة" value={k.overdue} sub="بحاجة متابعة" icon={AlertTriangle} tone="text-rose-600 bg-rose-500/10" />
        <Kpi label={`أُنجزت ${PERIOD_LABEL[period]}`} value={k.completedPeriod} sub="خلال الفترة" icon={Activity} tone="text-amber-600 bg-amber-500/10" />

        <Kpi label="إجمالي الأعضاء" value={k.totalMembers} sub={`+${k.newMembers} جدد`} icon={Users} tone="text-indigo-600 bg-indigo-500/10" />
        <Kpi label="طلبات الانضمام" value={k.pendingRequests} sub={`+${k.newRequests} ${PERIOD_LABEL[period]}`} icon={UserPlus} tone="text-violet-600 bg-violet-500/10" />
        <Kpi label="عدد العرسان" value={k.totalGrooms} sub={`+${k.newGrooms} ${PERIOD_LABEL[period]}`} icon={HeartHandshake} tone="text-pink-600 bg-pink-500/10" />
        <Kpi label="نسبة الإنفاق" value={`${k.spendRate}%`} sub={`${fmtSar(k.totalSpent)} من ${fmtSar(k.totalBudget)}`} icon={Wallet} tone="text-teal-600 bg-teal-500/10" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="اتجاه المهام خلال الفترة" subtitle="المُنشأة مقابل المُنجزة" icon={TrendingUp}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={charts.taskTrend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="created" name="مُنشأة" stroke="#0e7490" strokeWidth={2} />
              <Line type="monotone" dataKey="completed" name="مُنجزة" stroke="#16a34a" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="توزيع حالات المهام" subtitle="إجمالي على مستوى المنصة" icon={ListTodo}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={charts.statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {charts.statusPie.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="أداء اللجان" subtitle="عدد المهام ونسبة الإنجاز" icon={ShieldCheck}>
          <ResponsiveContainer width="100%" height={Math.max(260, charts.perCommittee.length * 36)}>
            <BarChart data={charts.perCommittee} layout="vertical" margin={{ right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
              <Tooltip />
              <Legend />
              <Bar dataKey="done" name="مكتملة" fill="#16a34a" />
              <Bar dataKey="total" name="الإجمالي" fill="#0e7490" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="توزيع الإنفاق على اللجان" subtitle="المبالغ المنصرفة (ر.س)" icon={Wallet}>
          {charts.spending.length === 0 ? (
            <EmptyState text="لا توجد مصروفات بعد" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={charts.spending} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => fmtSar(e.value as number)}>
                  {charts.spending.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmtSar(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="حالات العرسان" subtitle="توزيع حسب الحالة الحالية" icon={HeartHandshake}>
          {charts.groomPie.length === 0 ? (
            <EmptyState text="لا يوجد عرسان مسجّلون" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={charts.groomPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {charts.groomPie.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="طلبات الصرف" subtitle="معلّقة مقابل مدفوعة خلال الفترة" icon={Wallet}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={charts.paymentTrend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="pending" name="معلّقة" fill="#ea580c" />
              <Bar dataKey="paid" name="مدفوعة" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function HeroKpi({ label, value, sub, icon: Icon, accent }: { label: string; value: string | number; sub?: string; icon: any; accent: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${accent} bg-card p-5 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>}
        </div>
        <div className={`h-11 w-11 rounded-xl bg-background/70 ring-1 ${accent.split(" ").find(c => c.startsWith("ring-")) ?? ""} flex items-center justify-center shrink-0`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, icon: Icon, tone }: { label: string; value: string | number; sub?: string; icon: any; tone: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-extrabold leading-tight">{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, subtitle, icon: Icon, children }: { title: string; subtitle?: string; icon: any; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="h-4 w-4 text-primary" />
          <span>{title}</span>
        </CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">{text}</div>;
}

function fmtSar(n: number): string {
  return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(n) + " ر.س";
}
