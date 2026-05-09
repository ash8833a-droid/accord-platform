import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageGate } from "@/components/PageGate";
import { Button } from "@/components/ui/button";
import {
  Trophy, AlertTriangle, Loader2, FileDown, RefreshCw,
  CalendarClock, Save, ShieldAlert, Sparkles, Activity,
  Clock, Users2, TrendingUp,
} from "lucide-react";
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

export interface InsightItem {
  name: string;
  detail: string;
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

  // KPIs
  const activeCommittees = rows.filter((r) => r.total > 0).length;
  const totalTasks = rows.reduce((s, r) => s + r.total, 0);
  const doneTasks = rows.reduce((s, r) => s + r.done, 0);
  const overdueTasks = rows.reduce((s, r) => s + r.overdue, 0);
  const overallRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Insights — concise 3-bullet summaries
  const { excellence, weakness, critical } = useMemo(() => {
    const active = rows.filter((r) => r.total > 0);

    const excellenceRows = active
      .filter((r) => r.rate >= 80 && r.overdue === 0)
      .sort((a, b) => b.rate - a.rate || (b.delta ?? 0) - (a.delta ?? 0))
      .slice(0, 3)
      .map<InsightItem>((r) => ({
        name: r.name,
        detail: `إنجاز ${r.rate}% — ${r.done} من ${r.total} مهمة${r.delta && r.delta > 0 ? ` · تحسّن +${r.delta}%` : ""}`,
      }));

    const weaknessRows = active
      .filter((r) => r.rate >= 40 && r.rate < 80 && r.overdue === 0)
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 3)
      .map<InsightItem>((r) => ({
        name: r.name,
        detail: `إنجاز ${r.rate}% — تقدّم بطيء يحتاج إلى دعم ومتابعة`,
      }));

    const criticalRows = active
      .filter((r) => r.rate < 40 || r.overdue > 0)
      .sort((a, b) => b.overdue - a.overdue || a.rate - b.rate)
      .slice(0, 3)
      .map<InsightItem>((r) => ({
        name: r.name,
        detail: r.overdue > 0
          ? `${r.overdue} مهمة متأخرة · إنجاز ${r.rate}% — تدخل عاجل`
          : `إنجاز ${r.rate}% فقط — اختناق في سير العمل`,
      }));

    return { excellence: excellenceRows, weakness: weaknessRows, critical: criticalRows };
  }, [rows]);

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
            ملخص تنفيذي · أسبوع يبدأ من {thisWeek.toLocaleDateString("ar-SA-u-ca-gregory")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportWeeklyReportPdf({
              weekStart: thisWeek,
              overallRate, activeCommittees, overdueTasks,
              excellence, weakness, critical,
            })}
            className="gap-2 bg-white border border-teal-700 text-teal-700 hover:bg-teal-50 hover:text-teal-800 rounded-xl shadow-sm"
          >
            <FileDown className="h-4 w-4" /> طباعة / تصدير PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} className="gap-2 bg-white border-0 shadow-sm text-slate-700 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" /> تحديث
          </Button>
          <Button variant="outline" size="sm" onClick={() => void saveSnapshot()} disabled={saving} className="gap-2 bg-white border-0 shadow-sm text-slate-700 hover:bg-slate-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            حفظ لقطة الأسبوع
          </Button>
        </div>
      </div>

      {/* Executive Overview — 3 KPIs */}
      <div className="space-y-3">
        <SectionTitle title="نظرة عامة" subtitle="مؤشرات الأداء التنفيذية" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Kpi label="نسبة الإنجاز الكلي" value={`${overallRate}%`} icon={TrendingUp} />
          <Kpi label="إجمالي المهام المتأخرة" value={overdueTasks} icon={Clock} tone={overdueTasks > 0 ? "rose" : "teal"} />
          <Kpi label="اللجان النشطة" value={`${activeCommittees}/${rows.length}`} icon={Users2} />
        </div>
      </div>

      {/* Analytical grid — 3 insight cards */}
      <div className="space-y-3">
        <SectionTitle title="القراءة التحليلية" subtitle="ملخص مكثّف لرفعه إلى الأمانة" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <InsightCard
            tone="excellence"
            icon={Sparkles}
            title="نقاط التميّز"
            subtitle="لجان متقدّمة في الإنجاز"
            empty="لم تُسجَّل لجان عند مستوى تميّز هذا الأسبوع."
            items={excellence}
          />
          <InsightCard
            tone="weakness"
            icon={Activity}
            title="نقاط الضعف"
            subtitle="تقدّم بطيء يحتاج إلى دعم"
            empty="لا توجد لجان ضمن مرحلة الضعف."
            items={weakness}
          />
          <InsightCard
            tone="critical"
            icon={ShieldAlert}
            title="مواطن الخلل"
            subtitle="تدخّل عاجل من الأمانة"
            empty="لا توجد اختناقات حرجة هذا الأسبوع."
            items={critical}
          />
        </div>
      </div>
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

function InsightCard({
  tone, icon: Icon, title, subtitle, items, empty,
}: {
  tone: "excellence" | "weakness" | "critical";
  icon: any;
  title: string;
  subtitle: string;
  items: InsightItem[];
  empty: string;
}) {
  const cfg = {
    excellence: {
      border: "border-r-4 border-r-teal-600",
      iconBg: "bg-teal-50 text-teal-700",
      bullet: "bg-teal-600",
      countBg: "bg-teal-50 text-teal-700",
    },
    weakness: {
      border: "border-r-4 border-r-amber-500",
      iconBg: "bg-amber-50 text-amber-700",
      bullet: "bg-amber-500",
      countBg: "bg-amber-50 text-amber-700",
    },
    critical: {
      border: "border-r-4 border-r-red-500",
      iconBg: "bg-red-50 text-red-700",
      bullet: "bg-red-500",
      countBg: "bg-red-50 text-red-700",
    },
  }[tone];

  return (
    <div className={`rounded-2xl bg-white shadow-sm overflow-hidden ${cfg.border}`}>
      <div className="flex items-start justify-between gap-3 p-6">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`h-9 w-9 rounded-lg ${cfg.iconBg} flex items-center justify-center shrink-0`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800">{title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
        <span className={`text-xs font-bold rounded-full px-2.5 py-1 tabular-nums ${cfg.countBg}`}>{items.length}</span>
      </div>
      <div className="px-6 pb-6">
        {items.length === 0 ? (
          <div className="text-sm text-slate-400 py-6 text-center">{empty}</div>
        ) : (
          <ul className="space-y-4">
            {items.map((it, i) => (
              <li key={`${it.name}-${i}`} className="flex items-start gap-3">
                <span className={`mt-1.5 h-2 w-2 rounded-full ${cfg.bullet} shrink-0`} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{it.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{it.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// keep export to avoid breakage in case some import survives
export type { CommitteeRow };
// Trophy & AlertTriangle still imported intentionally for potential reuse
void Trophy; void AlertTriangle;
