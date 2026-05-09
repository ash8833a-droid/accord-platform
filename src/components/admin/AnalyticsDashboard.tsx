import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageGate } from "@/components/PageGate";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CalendarRange, CheckCircle2, ClipboardList, HeartHandshake, Loader2,
  Wallet, TrendingUp, BarChart3, Scale, Target, RefreshCw, FileDown,
  Banknote, HandCoins, FileSpreadsheet,
} from "lucide-react";
import { exportDashboardPdf } from "@/lib/dashboard-pdf";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WeeklyReport } from "@/components/admin/WeeklyReport";
import { AdminAlertsPanel } from "@/components/admin/AdminAlertsPanel";
import { SmartRecommendations } from "@/components/admin/SmartRecommendations";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
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

// Fixed allocated support per registered groom (SAR)
export const ALLOCATED_SUPPORT_PER_GROOM = 10000;

// ---- Component ----
export function AnalyticsDashboard() {
  return <PageGate pageKey="admin">{() => <Inner />}</PageGate>;
}

function Inner() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [year, setYear] = useState<YearKey>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [data, setData] = useState<any>(null);
  const loadInFlight = useRef(false);

  useEffect(() => { void load(); }, []);

  // Real-time subscription: refresh whenever any task changes (insert/update/delete)
  // so the "مستويات إنجاز اللجان الفرعية" widget reflects Kanban changes instantly.
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-committee-tasks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "committee_tasks" },
        () => { void load({ silent: true }); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  // Real-time subscription on grooms so allocated-funds KPI updates instantly.
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-grooms")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "grooms" },
        () => { void load({ silent: true }); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  async function load(options: { silent?: boolean } = {}) {
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    if (options.silent) setRefreshing(true);
    else setLoading(true);

    try {
      const [committeesRes, tasksRes, groomsRes, paymentsRes, familyRes] = await Promise.all([
        supabase.from("committees").select("id, name, type, budget_allocated, budget_spent"),
        supabase.from("committee_tasks").select("id, status, committee_id, created_at, updated_at, due_date"),
        supabase.from("grooms").select("id, status, created_at, wedding_date, groom_contribution"),
        supabase.from("payment_requests").select("id, amount, status, created_at"),
        supabase.from("family_contributions").select("id, amount, contribution_date"),
      ]);
      setData({
        committees: committeesRes.data ?? [],
        tasks: tasksRes.data ?? [],
        grooms: groomsRes.data ?? [],
        payments: paymentsRes.data ?? [],
        family: familyRes.data ?? [],
      });
    } finally {
      loadInFlight.current = false;
      setRefreshing(false);
      setLoading(false);
    }
  }

  // Real-time subscription on family_contributions for live KPI updates.
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-family-contributions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "family_contributions" },
        () => { void load({ silent: true }); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

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
    const totalMarriages = groomsY.length;

    const paymentsY = data.payments.filter((p: any) => inRange(p.created_at, r));
    const expenses = paymentsY.filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const groomRevenues = groomsY.reduce((s: number, g: any) => s + Number(g.groom_contribution || 0), 0);
    const familyY = (data.family ?? []).filter((f: any) => inRange(f.contribution_date, r));
    const familyContributions = familyY.reduce((s: number, f: any) => s + Number(f.amount || 0), 0);
    const revenues = familyContributions + groomRevenues;
    // Allocated support = total grooms × fixed allocation (treated as projected expense)
    const allocatedFunds = totalMarriages * ALLOCATED_SUPPORT_PER_GROOM;
    const projectedExpenses = expenses + allocatedFunds;
    // Net balance = (Family Contributions + Other Revenues) − (Allocated Support + Other Expenses)
    const netBalance = revenues - projectedExpenses;

    return {
      totalTasks, completed, completionRate, totalMarriages,
      revenues, expenses, allocatedFunds, projectedExpenses, netBalance,
      familyContributions, groomRevenues,
      tasksY, groomsY, paymentsY,
    };
  }, [data, year]);

  const charts = useMemo(() => {
    if (!data || !k) return null;

    // Per-committee achievement (progress + radar)
    // Formula: (completed tasks / total tasks) * 100, with division-by-zero failsafe.
    const todayIso = new Date().toISOString().slice(0, 10);
    const perCommittee = data.committees.map((c: any) => {
      const ct = k.tasksY.filter((t: any) => t.committee_id === c.id);
      const total = ct.length;
      const done = ct.filter((t: any) => t.status === "completed").length;
      const overdue = ct.filter((t: any) => t.status !== "completed" && t.due_date && t.due_date < todayIso).length;
      const rate = total > 0 ? Math.round((done / total) * 100) : 0;
      const savings = Math.max(0, Number(c.budget_allocated || 0) - Number(c.budget_spent || 0));
      return { name: c.name, total, done, overdue, rate, savings };
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

  async function handleExportDashboard() {
    if (!k || !charts || exporting) return;
    setExporting(true);
    try {
      await exportDashboardPdf({
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
      });
    } catch (error) {
      console.error("Dashboard export failed", error);
      toast.error("تعذّر تجهيز التقرير للطباعة");
    } finally {
      setExporting(false);
    }
  }

  async function handleExportCsv() {
    if (!charts || exportingCsv) return;
    setExportingCsv(true);
    const tid = toast.loading("جاري تجهيز ملف البيانات...");
    try {
      // Defer to next tick so the spinner paints before any sync work.
      await new Promise((r) => setTimeout(r, 0));
      const headers = [
        "اسم اللجنة",
        "نسبة الإنجاز %",
        "عدد المهام",
        "المهام المتأخرة",
        "إجمالي الوفورات الاقتصادية (ر.س)",
      ];
      const escape = (v: string | number) => {
        const s = String(v ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [headers.join(",")];
      charts.perCommittee.forEach((c: any) => {
        lines.push([c.name, c.rate, c.total, c.overdue, c.savings].map(escape).join(","));
      });
      const csv = "\uFEFF" + lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `أداء-اللجان-${year === "all" ? "كل-السنوات" : year}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("تم تجهيز ملف البيانات", { id: tid });
    } catch (error) {
      console.error("CSV export failed", error);
      toast.error("تعذّر تجهيز ملف البيانات", { id: tid });
    } finally {
      setExportingCsv(false);
    }
  }

  if (loading || !data || !k || !charts) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="bg-[#F8FAFC] min-h-screen -m-4 sm:-m-6 lg:-m-8 p-6 sm:p-8 lg:p-10 space-y-8 text-right" dir="rtl">
      {/* Header — flat, no card wrapper */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">لوحة الأداء التنفيذية</h1>
          <p className="text-sm text-slate-500 mt-1">نظرة شاملة على أداء لجنة الزواج الجماعي</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AdminAlertsPanel enabled={isAdmin} />
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm">
            <CalendarRange className="h-4 w-4 text-teal-700" />
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
            <Button variant="outline" size="sm" onClick={() => void load({ silent: true })} disabled={refreshing} className="gap-2 bg-white border-0 shadow-sm text-slate-700 hover:bg-slate-50 disabled:opacity-70">
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} تحديث
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleExportCsv()}
              disabled={exportingCsv}
              className="gap-2 bg-white border-0 shadow-sm text-slate-700 hover:bg-slate-50 disabled:opacity-70"
              title="تصدير بيانات اللجان (CSV)"
            >
              {exportingCsv ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} تصدير البيانات
            </Button>
            <Button
              size="sm"
              onClick={() => void handleExportDashboard()}
              disabled={exporting}
              className="gap-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-sm disabled:opacity-70"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} تصدير PDF
            </Button>
        </div>
      </div>

      <Tabs defaultValue="live" dir="rtl" className="w-full">
        <div className="flex justify-start">
          <TabsList className="grid w-full sm:w-auto grid-cols-2 sm:inline-flex bg-white shadow-sm p-1 rounded-xl">
          <TabsTrigger
            value="live"
            className="rounded-lg data-[state=active]:bg-teal-700 data-[state=active]:text-white data-[state=active]:shadow-sm font-semibold text-slate-600"
          >
            الأداء اللحظي
          </TabsTrigger>
          <TabsTrigger
            value="weekly"
            className="rounded-lg data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-sm font-semibold text-slate-600"
          >
            الملخص الأسبوعي
          </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="live" className="space-y-8 mt-8 focus-visible:outline-none">
      {/* Section title outside cards */}
      <SectionTitle title="ملخص الأداء" subtitle="المؤشرات الرئيسية للجنة" />
      {/* Unified KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <HeroKpi label="إجمالي المهام" value={k.totalTasks} sub={`${k.completed} مُنجزة`} icon={ClipboardList} />
        <HeroKpi label="نسبة الإنجاز العامة" value={`${k.completionRate}%`} sub="عبر كل اللجان" icon={CheckCircle2} />
        <HeroKpi label="إجمالي العرسان" value={k.totalMarriages} sub={year === "all" ? "تراكمي" : `سنة ${year}`} icon={HeartHandshake} />
        <HeroKpi label="مساهمات أفراد العائلة" value={fmtSar(k.familyContributions)} sub="إيراد حقيقي" icon={HandCoins} />
        <HeroKpi label="المبالغ المخصصة للعرسان" value={fmtSar(k.allocatedFunds)} sub={`${k.totalMarriages} عريس × ${fmtSar(ALLOCATED_SUPPORT_PER_GROOM)}`} icon={Banknote} />
        <HeroKpi
          label="صافي الرصيد المالي"
          value={fmtSar(k.netBalance)}
          sub={k.netBalance >= 0 ? "فائض" : "عجز"}
          icon={Scale}
          tone={k.netBalance >= 0 ? "teal" : "rose"}
        />
      </div>

      <SmartRecommendations
        committees={charts.perCommittee}
        completionRate={k.completionRate}
        netBalance={k.netBalance}
        totalMarriages={k.totalMarriages}
        allocatedFunds={k.allocatedFunds}
        revenues={k.revenues}
      />

      {/* Task & Committee Management */}
      <SectionTitle title="أداء اللجان" subtitle="مستويات الإنجاز والمقارنة" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="مستويات إنجاز اللجان الفرعية" subtitle="نسبة الإنجاز لكل لجنة" icon={Target}>
          <div className="space-y-3">
            {charts.perCommittee.length === 0 && <Empty text="لا توجد بيانات" />}
            {charts.perCommittee.map((c: any) => (
              <div key={c.name} className="py-2 border-b border-slate-50 last:border-b-0">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium text-slate-700 truncate">{c.name}</span>
                  <span className="text-slate-500 tabular-nums shrink-0">
                    <span className="font-bold text-slate-900">{c.rate}%</span> · {c.done}/{c.total}
                  </span>
                </div>
                <Progress value={Math.max(0, Math.min(100, c.rate))} className="h-1.5 bg-slate-100" />
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
                <PolarGrid stroke="#F1F5F9" />
                <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: "#94A3B8" }} />
                <Radar name="نسبة الإنجاز %" dataKey="rate" stroke="#0F766E" fill="#0F766E" fillOpacity={0.25} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Comparative Analytics */}
      <SectionTitle title="التحليل المقارن" subtitle="نظرة سنوية على المؤشرات" />
      <SectionCard title="التحليل المقارن السنوي" subtitle="مقارنة الأداء عبر السنوات الثلاث الأخيرة" icon={TrendingUp}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={charts.yoy}>
            <CartesianGrid strokeDasharray="4 4" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} allowDecimals={false} axisLine={false} tickLine={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="marriages" name="عدد العرسان" fill="#0F766E" radius={[8, 8, 0, 0]} />
            <Bar dataKey="tasksDone" name="مهام مُنجزة" fill="#D4A95E" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* Financial Overview */}
      <SectionTitle title="الصحة المالية" subtitle="الإيرادات والمصروفات" />
      <SectionCard
        title="الصحة المالية"
        subtitle={`الإيرادات مقابل المصروفات · ${year === "all" ? AVAILABLE_YEARS[0] : year}`}
        icon={Wallet}
        right={
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-teal-700" /> مساهمات العائلة: <b className="tabular-nums text-slate-800">{fmtSar(k.familyContributions)}</b></span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-teal-500" /> إيرادات أخرى: <b className="tabular-nums text-slate-800">{fmtSar(k.groomRevenues)}</b></span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-600" /> مصروفات: <b className="tabular-nums text-slate-800">{fmtSar(k.expenses)}</b></span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> دعم مخصص: <b className="tabular-nums text-slate-800">{fmtSar(k.allocatedFunds)}</b></span>
            <span className="flex items-center gap-1.5 border-r border-slate-200 pr-3 mr-1"><span className="h-2 w-2 rounded-full bg-slate-700" /> إجمالي متوقع: <b className="tabular-nums text-slate-900">{fmtSar(k.projectedExpenses)}</b></span>
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={charts.finance}>
            <CartesianGrid strokeDasharray="4 4" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => Intl.NumberFormat("ar-SA", { notation: "compact" }).format(v as number)} />
            <Tooltip formatter={(v: number) => fmtSar(v)} />
            <Legend />
            <Line type="monotone" dataKey="revenues" name="الإيرادات" stroke="#0F766E" strokeWidth={2.5} dot={{ r: 3, fill: "#0F766E" }} />
            <Line type="monotone" dataKey="expenses" name="المصروفات" stroke="#D4A95E" strokeWidth={2.5} dot={{ r: 3, fill: "#D4A95E" }} />
          </LineChart>
        </ResponsiveContainer>
      </SectionCard>
        </TabsContent>

        <TabsContent value="weekly" className="mt-8 focus-visible:outline-none">
          <WeeklyReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HeroKpi({ label, value, sub, icon: Icon, tone = "teal" }: { label: string; value: string | number; sub?: string; icon: any; tone?: "teal" | "rose" }) {
  const iconBg = tone === "rose" ? "bg-rose-50 text-rose-700" : "bg-teal-50 text-teal-700";
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className={`h-11 w-11 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-5 text-3xl font-bold tracking-tight tabular-nums text-slate-900 truncate">{value}</p>
      <p className="mt-2 text-sm text-slate-500 truncate">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-1 truncate">{sub}</p>}
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-1">
      <h2 className="text-lg font-bold text-slate-800">{title}</h2>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function SectionCard({ title, subtitle, icon: Icon, right, children }: { title: string; subtitle?: string; icon: any; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-3 flex-wrap p-6 border-b border-slate-50">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {right}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="h-[200px] flex items-center justify-center text-sm text-slate-400">{text}</div>;
}
