import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageGate } from "@/components/PageGate";
import { Button } from "@/components/ui/button";
import {
  Trophy, AlertTriangle, Loader2, FileDown, RefreshCw,
  TrendingUp, TrendingDown, Minus, CalendarClock, Save,
  ListChecks, CheckCircle2, Users2, Clock,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { exportWeeklyReportPdf } from "@/lib/weekly-report-pdf";
import { toast } from "sonner";

interface CommitteeRow {
  id: string;
  name: string;
  total: number;
  done: number;
  overdue: number;
  rate: number;
  prevRate: number | null;
  delta: number | null;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = (day - 6 + 7) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function WeeklyReport() {
  return <PageGate pageKey="admin">{() => <Inner />}</PageGate>;
}

function Inner() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<CommitteeRow[]>([]);

  const thisWeek = useMemo(() => startOfWeek(new Date()), []);
  const lastWeek = useMemo(() => {
    const d = new Date(thisWeek);
    d.setDate(d.getDate() - 7);
    return d;
  }, [thisWeek]);

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    const ch = supabase
      .channel("weekly-report-tasks")
      .on("postgres_changes",
          { event: "*", schema: "public", table: "committee_tasks" },
          () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  async function load() {
    setLoading(true);
    const today = isoDate(new Date());
    const [committeesRes, tasksRes, snapsRes] = await Promise.all([
      supabase.from("committees").select("id, name").order("name"),
      supabase.from("committee_tasks").select("id, status, committee_id, due_date"),
      supabase
        .from("committee_weekly_snapshots")
        .select("committee_id, week_start, completion_rate")
        .eq("week_start", isoDate(lastWeek)),
    ]);

    const committees = committeesRes.data ?? [];
    const tasks = tasksRes.data ?? [];
    const snaps = snapsRes.data ?? [];
    const prevByCommittee = new Map<string, number>(
      snaps.map((s: any) => [s.committee_id, Number(s.completion_rate)])
    );

    const next: CommitteeRow[] = committees.map((c: any) => {
      const ct = tasks.filter((t: any) => t.committee_id === c.id);
      const total = ct.length;
      const done = ct.filter((t: any) => t.status === "completed").length;
      const overdue = ct.filter(
        (t: any) =>
          t.status !== "completed" &&
          t.due_date &&
          t.due_date < today
      ).length;
      const rate = total > 0 ? Math.round((done / total) * 100) : 0;
      const prev = prevByCommittee.has(c.id) ? prevByCommittee.get(c.id)! : null;
      const delta = prev === null ? null : Math.round(rate - prev);
      return { id: c.id, name: c.name, total, done, overdue, rate, prevRate: prev, delta };
    });

    setRows(next);
    setLoading(false);
  }

  const top = rows.filter((r) => r.total > 0 && r.rate === 100);
  const delayed = rows.filter((r) => r.total === 0 || r.rate < 100 || r.overdue > 0);
  const totalTasks = rows.reduce((s, r) => s + r.total, 0);
  const doneTasks = rows.reduce((s, r) => s + r.done, 0);
  const overdueTasks = rows.reduce((s, r) => s + r.overdue, 0);
  const avgRate = rows.length ? Math.round(rows.reduce((s, r) => s + r.rate, 0) / rows.length) : 0;

  const chartData = rows
    .filter((r) => r.total > 0)
    .map((r) => ({ name: r.name, rate: r.rate }));

  async function saveSnapshot() {
    setSaving(true);
    const week = isoDate(thisWeek);
    const payload = rows.map((r) => ({
      committee_id: r.id,
      week_start: week,
      completion_rate: r.rate,
      total_tasks: r.total,
      done_tasks: r.done,
    }));
    const { error } = await supabase
      .from("committee_weekly_snapshots")
      .upsert(payload, { onConflict: "committee_id,week_start" });
    setSaving(false);
    if (error) toast.error("تعذّر حفظ لقطة الأسبوع");
    else toast.success("تم حفظ لقطة هذا الأسبوع للمقارنة لاحقاً");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="bg-[#F8FAFC] min-h-screen -m-4 sm:-m-6 lg:-m-8 p-6 sm:p-8 lg:p-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">التقرير الدوري للأمانة</h1>
          <p className="text-sm text-slate-500 mt-1.5 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-teal-700" />
            أسبوع يبدأ من {thisWeek.toLocaleDateString("ar-SA-u-ca-gregory")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} className="gap-2 bg-white border-0 shadow-sm text-slate-700 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" /> تحديث
          </Button>
          <Button variant="outline" size="sm" onClick={() => void saveSnapshot()} disabled={saving} className="gap-2 bg-white border-0 shadow-sm text-slate-700 hover:bg-slate-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            حفظ لقطة الأسبوع
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportWeeklyReportPdf({ weekStart: thisWeek, top, delayed })}
            className="gap-2 bg-white border border-teal-700 text-teal-700 hover:bg-teal-50 hover:text-teal-800 rounded-xl shadow-sm"
          >
            <FileDown className="h-4 w-4" /> طباعة التقرير
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Kpi label="عدد اللجان" value={rows.length} icon={Users2} />
        <Kpi label="متوسط الإنجاز" value={`${avgRate}%`} icon={CheckCircle2} />
        <Kpi label="إجمالي المهام" value={`${doneTasks}/${totalTasks}`} icon={ListChecks} />
        <Kpi label="مهام متأخرة" value={overdueTasks} icon={Clock} tone={overdueTasks > 0 ? "rose" : "teal"} />
      </div>

      {/* Bar chart */}
      <div className="space-y-3">
        <SectionTitle title="مستوى إنجاز اللجان" subtitle="نسبة المهام المنجزة لكل لجنة" />
        <div className="rounded-2xl bg-white shadow-sm p-8">
          {chartData.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-sm text-slate-400">لا توجد بيانات</div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip cursor={{ fill: "#F1F5F9" }} formatter={(v: number) => `${v}%`} />
                <Bar dataKey="rate" name="نسبة الإنجاز" fill="#0F766E" radius={[10, 10, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top + Delayed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ListCard
          icon={Trophy}
          title="الأفضل أداءً"
          subtitle="لجان أنجزت 100% من مهامها"
          count={top.length}
          empty="لا توجد لجان وصلت إلى الإنجاز الكامل بعد."
          rows={top}
          tone="success"
        />
        <ListCard
          icon={AlertTriangle}
          title="تحتاج إلى متابعة"
          subtitle="لجان لم تكتمل أو لديها مهام متأخرة"
          count={delayed.length}
          empty="ممتاز — لا توجد لجان متأخرة هذا الأسبوع."
          rows={delayed}
          tone="warning"
        />
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone = "teal" }: { label: string; value: string | number; icon: any; tone?: "teal" | "rose" }) {
  const iconBg = tone === "rose" ? "bg-rose-50 text-rose-700" : "bg-teal-50 text-teal-700";
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className={`h-11 w-11 rounded-full ${iconBg} flex items-center justify-center`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-5 text-3xl font-bold tracking-tight tabular-nums text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{label}</p>
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

function ListCard({
  icon: Icon, title, subtitle, count, empty, rows, tone,
}: {
  icon: any; title: string; subtitle: string; count: number; empty: string;
  rows: CommitteeRow[]; tone: "success" | "warning";
}) {
  const iconBg = tone === "success" ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700";
  const badgeBg = tone === "success" ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700";
  return (
    <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-6 border-b border-slate-50">
        <div className="flex items-start gap-3">
          <div className={`h-9 w-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">{title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
        <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${badgeBg}`}>{count}</span>
      </div>
      <div className="px-6">
        {rows.length === 0 ? (
          <div className="text-sm text-slate-400 py-10 text-center">{empty}</div>
        ) : (
          rows.map((r) => <CommitteeRowItem key={r.id} row={r} />)
        )}
      </div>
    </div>
  );
}

function CommitteeRowItem({ row }: { row: CommitteeRow }) {
  return (
    <div className="py-4 border-b border-slate-50 last:border-b-0">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-slate-800 truncate">{row.name}</span>
          <DeltaBadge delta={row.delta} />
        </div>
        <span className="text-sm tabular-nums shrink-0 text-slate-500">
          <span className="font-bold text-slate-900">{row.rate}%</span>{" "}
          <span>· {row.done}/{row.total}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full bg-teal-700 transition-all"
          style={{ width: `${Math.max(0, Math.min(100, row.rate))}%` }}
        />
      </div>
      {row.overdue > 0 && (
        <div className="mt-2 text-xs text-rose-600 flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          {row.overdue} مهمة متأخرة عن تاريخ الاستحقاق
        </div>
      )}
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-[10px] text-slate-400 bg-slate-50 rounded-full px-1.5 py-0.5">جديد</span>;
  }
  if (delta === 0) {
    return (
      <span className="text-[11px] inline-flex items-center gap-0.5 text-slate-400">
        <Minus className="h-3 w-3" /> 0%
      </span>
    );
  }
  if (delta > 0) {
    return (
      <span className="text-[11px] inline-flex items-center gap-0.5 text-teal-700 font-semibold">
        <TrendingUp className="h-3 w-3" /> +{delta}%
      </span>
    );
  }
  return (
    <span className="text-[11px] inline-flex items-center gap-0.5 text-rose-600 font-semibold">
      <TrendingDown className="h-3 w-3" /> {delta}%
    </span>
  );
}
