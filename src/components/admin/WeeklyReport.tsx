import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageGate } from "@/components/PageGate";
import { Button } from "@/components/ui/button";
import {
  Loader2, FileDown, RefreshCw, CalendarClock, Save,
  ShieldAlert, Sparkles, Activity, Crown, TrendingUp,
  TrendingDown, Minus, AlertOctagon, CheckCircle2, BadgeCheck,
} from "lucide-react";
import { exportWeeklyReportPdf } from "@/lib/weekly-report-pdf";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

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
  const [exporting, setExporting] = useState(false);
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
  const totalTasks = rows.reduce((s, r) => s + r.total, 0);
  const doneTasks = rows.reduce((s, r) => s + r.done, 0);
  const overdueTasks = rows.reduce((s, r) => s + r.overdue, 0);
  const overallRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Weighted previous rate (per-committee weighted by current total)
  const prevOverall = useMemo(() => {
    const weighted = rows.filter((r) => r.prevRate !== null && r.total > 0);
    if (weighted.length === 0) return null;
    const tw = weighted.reduce((s, r) => s + r.total, 0);
    if (tw === 0) return null;
    return Math.round(weighted.reduce((s, r) => s + r.prevRate! * r.total, 0) / tw);
  }, [rows]);
  const overallDelta = prevOverall === null ? null : overallRate - prevOverall;

  const topCommittee = useMemo(() => {
    const active = rows.filter((r) => r.total > 0);
    if (active.length === 0) return null;
    return [...active].sort((a, b) => b.rate - a.rate || b.done - a.done)[0];
  }, [rows]);

  // Smart grid groups
  const { leaders, monitoring, urgent } = useMemo(() => {
    const active = rows.filter((r) => r.total > 0);
    const leadersR = active
      .filter((r) => r.rate >= 80 && r.overdue === 0)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 4)
      .map<InsightItem>((r) => ({
        name: r.name,
        detail: `إنجاز ${r.rate}% — ${r.done}/${r.total}${r.delta && r.delta > 0 ? ` · تحسّن +${r.delta}%` : ""}`,
      }));
    const monitoringR = active
      .filter((r) => (r.rate >= 40 && r.rate < 80 && r.overdue === 0) || (r.overdue > 0 && r.overdue <= 2 && r.rate >= 40))
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 4)
      .map<InsightItem>((r) => ({
        name: r.name,
        detail: `إنجاز ${r.rate}%${r.overdue ? ` · ${r.overdue} متأخرة` : ""} — تقدّم بطيء`,
      }));
    const urgentR = active
      .filter((r) => r.rate < 40 || r.overdue > 2)
      .sort((a, b) => b.overdue - a.overdue || a.rate - b.rate)
      .slice(0, 4)
      .map<InsightItem>((r) => ({
        name: r.name,
        detail: r.overdue > 0
          ? `${r.overdue} مهمة متأخرة · إنجاز ${r.rate}%`
          : `إنجاز ${r.rate}% فقط — أداء يستوجب المعالجة`,
      }));
    return { leaders: leadersR, monitoring: monitoringR, urgent: urgentR };
  }, [rows]);

  const reportStatus = urgent.length > 0
    ? { label: "يحتاج اتخاذ قرار عاجل", tone: "rose" as const, icon: AlertOctagon }
    : monitoring.length > 0
    ? { label: "قيد المتابعة", tone: "amber" as const, icon: Activity }
    : { label: "أداء ممتاز — جاهز للاعتماد", tone: "teal" as const, icon: BadgeCheck };

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

  const statusToneClasses = {
    teal: "bg-teal-50 text-teal-700 border-teal-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
  }[reportStatus.tone];
  const StatusIcon = reportStatus.icon;

  return (
    <div dir="rtl" className="bg-[#F8FAFC] min-h-screen -m-4 sm:-m-6 lg:-m-8 p-6 sm:p-8 lg:p-10 space-y-8 print:m-0 print:p-0 print:bg-white">
      {/* Header — Leadership Pulse */}
      <div
        className="relative rounded-3xl bg-white shadow-sm overflow-hidden animate-fade-in print:shadow-none print:border print:border-slate-200"
        style={{
          backgroundImage: `radial-gradient(circle at 100% 0%, rgba(13,124,102,0.06) 0%, transparent 45%), radial-gradient(circle at 0% 100%, rgba(212,169,94,0.05) 0%, transparent 45%)`,
        }}
      >
        {/* Watermark */}
        <img
          src={logo}
          alt=""
          aria-hidden="true"
          className="absolute -left-8 top-1/2 -translate-y-1/2 h-56 w-56 opacity-[0.04] pointer-events-none select-none"
        />
        <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0">
            <div className="h-12 w-12 rounded-2xl bg-[#0D7C66]/10 text-[#0D7C66] flex items-center justify-center shrink-0">
              <Crown className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-wider text-[#0D7C66] uppercase">ملخص الأداء التنفيذي</p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
                التقرير الأسبوعي للأداء العام
              </h1>
              <p className="text-sm text-slate-500 mt-1.5 flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-[#0D7C66]" />
                أسبوع يبدأ من {thisWeek.toLocaleDateString("ar-SA-u-ca-gregory", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-3 print:hidden">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${statusToneClasses}`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {reportStatus.label}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                disabled={exporting}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (exporting) return;
                  setExporting(true);
                  const tid = toast.loading("جاري تجهيز التقرير...");
                  try {
                    await exportWeeklyReportPdf({
                      weekStart: thisWeek, overallRate, overallDelta,
                      overdueTasks,
                      topCommittee: topCommittee ? { name: topCommittee.name, rate: topCommittee.rate } : null,
                      leaders, monitoring, urgent, statusLabel: reportStatus.label,
                    });
                    toast.success("تم تجهيز التقرير", { id: tid });
                  } catch (err) {
                    console.error("PDF export failed", err);
                    toast.error("تعذّر تصدير التقرير", { id: tid });
                  } finally {
                    setExporting(false);
                  }
                }}
                className="gap-2 bg-[#0D7C66] hover:bg-[#0a6655] text-white rounded-xl shadow-sm disabled:opacity-70"
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                {exporting ? "جاري التجهيز..." : "طباعة / تصدير PDF"}
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
        </div>
      </div>

      {/* Section A — Performance Snapshot */}
      <div className="space-y-3 animate-fade-in">
        <SectionTitle title="لمحة الأداء" subtitle="مؤشرات تنفيذية في سطر واحد" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <ProgressKpi
            label="نسبة الإنجاز"
            value={`${overallRate}%`}
            delta={overallDelta}
            sublabel={prevOverall === null ? "لا توجد لقطة سابقة للمقارنة" : `الأسبوع السابق: ${prevOverall}%`}
          />
          <SnapshotKpi
            label="مهام تستوجب المعالجة"
            value={overdueTasks}
            sublabel={overdueTasks === 0 ? "لا توجد مهام عالقة" : `${overdueTasks} مهمة تحتاج تدخّل`}
            tone={overdueTasks > 0 ? "rose" : "teal"}
            icon={overdueTasks > 0 ? AlertOctagon : CheckCircle2}
          />
          <SnapshotKpi
            label="اللجنة الأعلى أداءً"
            value={topCommittee ? topCommittee.name : "—"}
            sublabel={topCommittee ? `إنجاز ${topCommittee.rate}% · ${topCommittee.done}/${topCommittee.total}` : "لا توجد بيانات كافية"}
            tone="teal"
            icon={Crown}
            isText
          />
        </div>
      </div>

      {/* Section B — Committee Spotlight (Smart Grid) */}
      <div className="space-y-3 animate-fade-in">
        <SectionTitle title="تحليل اللجان" subtitle="تصنيف ذكي يدعم اتخاذ القرار" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SpotlightCard
            tone="leaders"
            icon={Sparkles}
            title="الرواد"
            subtitle="لجان تجاوزت المستهدف"
            recommendation="توصية: إبراز التجربة وتعميمها كنموذج على بقية اللجان."
            empty="لا توجد لجان ضمن مستوى الريادة هذا الأسبوع."
            items={leaders}
          />
          <SpotlightCard
            tone="monitoring"
            icon={Activity}
            title="تحت المتابعة"
            subtitle="تأخر يسير في بعض المهام"
            recommendation="توصية: تواصل دوري مع رؤساء اللجان لإزالة العوائق التشغيلية."
            empty="لا توجد لجان تحت المتابعة."
            items={monitoring}
          />
          <SpotlightCard
            tone="urgent"
            icon={ShieldAlert}
            title="تنبيه عاجل"
            subtitle="حالات تستوجب تدخّل إدارة اللجنة"
            recommendation="توصية: يتطلب دعم لوجستي وقرار عاجل من إدارة اللجنة."
            empty="لا توجد تنبيهات عاجلة — أداء سليم."
            items={urgent}
          />
        </div>
      </div>

      {/* Print-only signature footer */}
      <div className="hidden print:block mt-12 pt-6 border-t border-slate-300">
        <div className="grid grid-cols-2 gap-12 text-sm">
          <div>
            <p className="text-slate-500 mb-10">إعداد: إدارة اللجنة</p>
            <div className="border-t border-slate-400 pt-2 text-slate-700">التوقيع</div>
          </div>
          <div>
            <p className="text-slate-500 mb-10">اعتماد اللجنة المنظمة</p>
            <div className="border-t border-slate-400 pt-2 text-slate-700">التوقيع والتاريخ</div>
          </div>
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

function ProgressKpi({ label, value, delta, sublabel }: { label: string; value: string; delta: number | null; sublabel: string }) {
  const deltaIcon = delta === null ? Minus : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const Icon = deltaIcon;
  const deltaColor =
    delta === null || delta === 0 ? "text-slate-400 bg-slate-50"
    : delta > 0 ? "text-teal-700 bg-teal-50"
    : "text-rose-700 bg-rose-50";
  const deltaText = delta === null ? "—" : delta === 0 ? "0%" : delta > 0 ? `+${delta}%` : `${delta}%`;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm hover:shadow-md transition-shadow print:shadow-none print:border print:border-slate-200">
      <div className="flex items-center justify-between">
        <div className="h-11 w-11 rounded-full bg-[#0D7C66]/10 text-[#0D7C66] flex items-center justify-center">
          <TrendingUp className="h-5 w-5" />
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${deltaColor}`}>
          <Icon className="h-3 w-3" />
          {deltaText}
        </span>
      </div>
      <p className="mt-5 text-3xl font-bold tracking-tight tabular-nums text-slate-900">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-700">{label}</p>
      <p className="mt-1 text-xs text-slate-500">{sublabel}</p>
    </div>
  );
}

function SnapshotKpi({
  label, value, sublabel, tone, icon: Icon, isText = false,
}: {
  label: string; value: string | number; sublabel: string;
  tone: "teal" | "rose"; icon: any; isText?: boolean;
}) {
  const iconBg = tone === "rose" ? "bg-rose-50 text-rose-700" : "bg-[#0D7C66]/10 text-[#0D7C66]";
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm hover:shadow-md transition-shadow print:shadow-none print:border print:border-slate-200">
      <div className={`h-11 w-11 rounded-full ${iconBg} flex items-center justify-center`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className={`mt-5 font-bold tracking-tight text-slate-900 ${isText ? "text-xl truncate" : "text-3xl tabular-nums"}`} title={String(value)}>
        {value}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-700">{label}</p>
      <p className="mt-1 text-xs text-slate-500">{sublabel}</p>
    </div>
  );
}

function SpotlightCard({
  tone, icon: Icon, title, subtitle, items, empty, recommendation,
}: {
  tone: "leaders" | "monitoring" | "urgent";
  icon: any; title: string; subtitle: string;
  items: InsightItem[]; empty: string; recommendation: string;
}) {
  const cfg = {
    leaders: {
      border: "border-r-4 border-r-[#0D7C66]",
      iconBg: "bg-[#0D7C66]/10 text-[#0D7C66]",
      bullet: "bg-[#0D7C66]",
      countBg: "bg-[#0D7C66]/10 text-[#0D7C66]",
      recBg: "bg-teal-50 text-teal-800 border-teal-100",
    },
    monitoring: {
      border: "border-r-4 border-r-[#D4A95E]",
      iconBg: "bg-amber-50 text-amber-700",
      bullet: "bg-[#D4A95E]",
      countBg: "bg-amber-50 text-amber-700",
      recBg: "bg-amber-50 text-amber-800 border-amber-100",
    },
    urgent: {
      border: "border-r-4 border-r-rose-500",
      iconBg: "bg-rose-50 text-rose-700",
      bullet: "bg-rose-500",
      countBg: "bg-rose-50 text-rose-700",
      recBg: "bg-rose-50 text-rose-800 border-rose-100",
    },
  }[tone];

  return (
    <div className={`rounded-2xl bg-white shadow-sm overflow-hidden ${cfg.border} print:shadow-none print:border print:border-slate-200`}>
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
      <div className="px-6 pb-4">
        {items.length === 0 ? (
          <div className="text-sm text-slate-400 py-6 text-center">{empty}</div>
        ) : (
          <ul className="space-y-3.5">
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
      <div className={`mx-6 mb-6 mt-1 rounded-xl border px-3.5 py-2.5 text-[11px] leading-relaxed ${cfg.recBg}`}>
        <span className="font-bold ml-1">توصية:</span>
        {recommendation.replace(/^توصية:\s*/, "")}
      </div>
    </div>
  );
}

export type { CommitteeRow };
