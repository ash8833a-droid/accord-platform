import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageGate } from "@/components/PageGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CalendarRange, CheckCircle2, ClipboardList, HeartHandshake, Loader2,
  Wallet, TrendingUp, BarChart3, Scale, Target, RefreshCw, FileDown,
} from "lucide-react";
import { exportDashboardPdf } from "@/lib/dashboard-pdf";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

// ---- Date helpers ----
type YearKey = number | "all";

function yearRange(y: YearKey): { start: Date; end: Date } {
  if (y === "all") {
    return { start: new Date(2000, 0, 1), end: new Date(2999, 11, 31) };
  }
  return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
}

function inRange(iso: string | null | undefined, r: { start: Date; end: Date }): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= r.start.getTime() && t < r.end.getTime();
}

function fmtSar(n: number): string {
  return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(n) + " ر.س";
}

const AVAILABLE_YEARS = (() => {
  const cur = new Date().getFullYear();
  return [cur, cur - 1, cur - 2, cur - 3, cur - 4];
})();

// ---- Component ----
export function AnalyticsDashboard() {
  return <PageGate pageKey="admin">{() => <Inner />}</PageGate>;
}

function Inner() {
  const [year, setYear] = useState<YearKey>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const [committeesRes, tasksRes, groomsRes, paymentsRes] = await Promise.all([
      supabase.from("committees").select("id, name, type, budget_allocated, budget_spent"),
      supabase.from("committee_tasks").select("id, status, committee_id, created_at, updated_at"),
      supabase.from("grooms").select("id, status, created_at, wedding_date, groom_contribution"),
      supabase.from("payment_requests").select("id, amount, status, created_at"),
    ]);
    setData({
      committees: committeesRes.data ?? [],
      tasks: tasksRes.data ?? [],
      grooms: groomsRes.data ?? [],
      payments: paymentsRes.data ?? [],
    });
    setLoading(false);
  }

  const k = useMemo(() => {
    if (!data) return null;
    const r = yearRange(year);

    const tasksY = data.tasks.filter((t: any) => inRange(t.created_at, r));
    const totalTasks = tasksY.length;
    const completed = tasksY.filter((t: any) => t.status === "completed").length;
    const completionRate = totalTasks ? Math.round((completed / totalTasks) * 100) : 0;

    const groomsY = year === "all"
      ? data.grooms
      : data.grooms.filter((g: any) => inRange(g.wedding_date ?? g.created_at, r));
    const totalMarriages = groomsY.filter((g: any) => g.status === "completed" || g.status === "approved").length;

    const paymentsY = data.payments.filter((p: any) => inRange(p.created_at, r));
    const expenses = paymentsY.filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const revenues = groomsY.reduce((s: number, g: any) => s + Number(g.groom_contribution || 0), 0);
    const netBalance = revenues - expenses;

    return { totalTasks, completed, completionRate, totalMarriages, revenues, expenses, netBalance, tasksY, groomsY, paymentsY };
  }, [data, year]);

  const charts = useMemo(() => {
    if (!data || !k) return null;

    // Per-committee achievement (progress + radar)
    const perCommittee = data.committees.map((c: any) => {
      const ct = k.tasksY.filter((t: any) => t.committee_id === c.id);
      const done = ct.filter((t: any) => t.status === "completed").length;
      return {
        name: c.name,
        total: ct.length,
        done,
        rate: ct.length ? Math.round((done / ct.length) * 100) : 0,
      };
    });

    // Year-over-year comparison (current year vs previous 2 years)
    const baseYear = year === "all" ? new Date().getFullYear() : year;
    const yoyYears = [baseYear - 2, baseYear - 1, baseYear];
    const yoy = yoyYears.map((y) => {
      const r = yearRange(y);
      const marriages = data.grooms.filter((g: any) =>
        inRange(g.wedding_date ?? g.created_at, r) &&
        (g.status === "completed" || g.status === "approved")
      ).length || data.grooms.filter((g: any) => inRange(g.created_at, r)).length;
      const tasksDone = data.tasks.filter((t: any) =>
        inRange(t.created_at, r) && t.status === "completed"
      ).length;
      return { year: String(y), marriages, tasksDone };
    });

    // Financial trend by month within selected year
    const monthRange = year === "all" ? AVAILABLE_YEARS[0] : year;
    const months = Array.from({ length: 12 }, (_, i) => i);
    const finance = months.map((m) => {
      const start = new Date(monthRange, m, 1);
      const end = new Date(monthRange, m + 1, 1);
      const r = { start, end };
      const exp = data.payments
        .filter((p: any) => p.status === "paid" && inRange(p.created_at, r))
        .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
      const rev = data.grooms
        .filter((g: any) => inRange(g.created_at, r))
        .reduce((s: number, g: any) => s + Number(g.groom_contribution || 0), 0);
      return {
        label: new Date(monthRange, m, 1).toLocaleDateString("ar-SA", { month: "short" }),
        revenues: rev,
        expenses: exp,
      };
    });

    return { perCommittee, yoy, finance };
  }, [data, k, year]);

  if (loading || !data || !k || !charts) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Filter bar */}
      <Card className="border-primary/10">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">لوحة الأداء التنفيذية</h1>
            <p className="text-sm text-muted-foreground mt-1">نظرة شاملة على أداء لجنة الزواج الجماعي</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2">
              <CalendarRange className="h-4 w-4 text-primary" />
              <Select value={String(year)} onValueChange={(v) => setYear(v === "all" ? "all" : Number(v))}>
                <SelectTrigger className="h-8 w-[160px] border-0 shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل السنوات</SelectItem>
                  {AVAILABLE_YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>سنة {y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={load} className="gap-2">
              <RefreshCw className="h-4 w-4" /> تحديث
            </Button>
            <Button
              size="sm"
              onClick={() => exportDashboardPdf({
                year,
                kpis: {
                  totalTasks: k.totalTasks,
                  completionRate: k.completionRate,
                  totalMarriages: k.totalMarriages,
                  netBalance: k.netBalance,
                },
                finance: charts.finance,
                committees: charts.perCommittee,
                revenues: k.revenues,
                expenses: k.expenses,
              })}
              className="gap-2 bg-[#064e3b] hover:bg-[#053f30] text-white"
            >
              <FileDown className="h-4 w-4" /> تصدير PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Unified KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <HeroKpi label="إجمالي المهام" value={k.totalTasks} sub={`${k.completed} مُنجزة`}
          icon={ClipboardList} accent="from-sky-500/15 to-sky-500/0 text-sky-600 ring-sky-500/20" />
        <HeroKpi label="نسبة الإنجاز العامة" value={`${k.completionRate}%`} sub="عبر كل اللجان"
          icon={CheckCircle2} accent="from-emerald-500/15 to-emerald-500/0 text-emerald-600 ring-emerald-500/20" />
        <HeroKpi label="إجمالي الزيجات" value={k.totalMarriages} sub={year === "all" ? "تراكمي" : `سنة ${year}`}
          icon={HeartHandshake} accent="from-pink-500/15 to-pink-500/0 text-pink-600 ring-pink-500/20" />
        <HeroKpi label="صافي الرصيد المالي"
          value={fmtSar(k.netBalance)}
          sub={k.netBalance >= 0 ? "فائض" : "عجز"}
          icon={Scale}
          accent={k.netBalance >= 0
            ? "from-teal-500/15 to-teal-500/0 text-teal-600 ring-teal-500/20"
            : "from-rose-500/15 to-rose-500/0 text-rose-600 ring-rose-500/20"} />
      </div>

      {/* Task & Committee Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="مستويات إنجاز اللجان الفرعية" subtitle="نسبة الإنجاز لكل لجنة" icon={Target}>
          <div className="space-y-3">
            {charts.perCommittee.length === 0 && <Empty text="لا توجد بيانات" />}
            {charts.perCommittee.map((c: any) => (
              <div key={c.name}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="font-medium truncate">{c.name}</span>
                  <span className="text-muted-foreground tabular-nums shrink-0">
                    {c.done}/{c.total} · <span className="font-bold text-foreground">{c.rate}%</span>
                  </span>
                </div>
                <Progress value={c.rate} className="h-2" />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="مقارنة أداء اللجان" subtitle="رادار الإنجاز" icon={BarChart3}>
          {charts.perCommittee.length === 0 ? (
            <Empty text="لا توجد بيانات" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={charts.perCommittee}>
                <PolarGrid />
                <PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar name="نسبة الإنجاز %" dataKey="rate" stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))" fillOpacity={0.35} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Comparative Analytics */}
      <SectionCard title="التحليل المقارن السنوي" subtitle="مقارنة الأداء عبر السنوات الثلاث الأخيرة" icon={TrendingUp}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={charts.yoy}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="marriages" name="عدد الزيجات" fill="#ec4899" radius={[8, 8, 0, 0]} />
            <Bar dataKey="tasksDone" name="مهام مُنجزة" fill="#0e7490" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* Financial Overview */}
      <SectionCard
        title="الصحة المالية"
        subtitle={`الإيرادات مقابل المصروفات · ${year === "all" ? AVAILABLE_YEARS[0] : year}`}
        icon={Wallet}
        right={
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> إيرادات: <b className="tabular-nums">{fmtSar(k.revenues)}</b></span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> مصروفات: <b className="tabular-nums">{fmtSar(k.expenses)}</b></span>
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={charts.finance}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => Intl.NumberFormat("ar-SA", { notation: "compact" }).format(v as number)} />
            <Tooltip formatter={(v: number) => fmtSar(v)} />
            <Legend />
            <Line type="monotone" dataKey="revenues" name="الإيرادات" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="expenses" name="المصروفات" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </SectionCard>
    </div>
  );
}

function HeroKpi({ label, value, sub, icon: Icon, accent }: { label: string; value: string | number; sub?: string; icon: any; accent: string }) {
  const ring = accent.split(" ").find((c) => c.startsWith("ring-")) ?? "";
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${accent} bg-card p-5 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums truncate">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>}
        </div>
        <div className={`h-11 w-11 rounded-xl bg-background/70 ring-1 ${ring} flex items-center justify-center shrink-0`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, icon: Icon, right, children }: { title: string; subtitle?: string; icon: any; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Icon className="h-4 w-4 text-primary" />
              {title}
            </CardTitle>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {right}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">{text}</div>;
}
