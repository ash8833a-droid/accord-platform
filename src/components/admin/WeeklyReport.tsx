import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageGate } from "@/components/PageGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Trophy, AlertTriangle, Loader2, FileDown, RefreshCw,
  TrendingUp, TrendingDown, Minus, CalendarClock, Save,
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

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  // Saturday = 6 → start of week (Arabic calendar)
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

  // Real-time refresh on any task change
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
    if (error) {
      toast.error("تعذّر حفظ لقطة الأسبوع");
    } else {
      toast.success("تم حفظ لقطة هذا الأسبوع للمقارنة لاحقاً");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6">
      <Card className="border-primary/10">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">الملخص الأسبوعي للأداء</h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              أسبوع يبدأ من {thisWeek.toLocaleDateString("ar-SA-u-ca-gregory")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} className="gap-2">
              <RefreshCw className="h-4 w-4" /> تحديث
            </Button>
            <Button variant="outline" size="sm" onClick={() => void saveSnapshot()} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ لقطة الأسبوع
            </Button>
            <Button
              size="sm"
              onClick={() => exportWeeklyReportPdf({ weekStart: thisWeek, top, delayed })}
              className="gap-2 bg-[#064e3b] hover:bg-[#053f30] text-white"
            >
              <FileDown className="h-4 w-4" /> تنزيل الملخص PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top performers */}
        <Card className="border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Trophy className="h-5 w-5" /> الأفضل أداءً
              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">{top.length}</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">لجان أنجزت 100% من مهامها</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {top.length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">
                لا توجد لجان وصلت إلى الإنجاز الكامل بعد.
              </div>
            )}
            {top.map((r) => (
              <CommitteeCard key={r.id} row={r} variant="success" />
            ))}
          </CardContent>
        </Card>

        {/* Delayed */}
        <Card className="border-rose-500/30 bg-rose-50/40 dark:bg-rose-950/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" /> تحتاج إلى متابعة
              <Badge className="bg-rose-600 hover:bg-rose-600 text-white">{delayed.length}</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">لجان لم تكتمل أو لديها مهام متأخرة</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {delayed.length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">
                ممتاز — لا توجد لجان متأخرة هذا الأسبوع.
              </div>
            )}
            {delayed.map((r) => (
              <CommitteeCard key={r.id} row={r} variant="warning" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CommitteeCard({ row, variant }: { row: CommitteeRow; variant: "success" | "warning" }) {
  const ringColor = variant === "success" ? "ring-emerald-500/20" : "ring-rose-500/20";
  const bg = variant === "success" ? "bg-white/70 dark:bg-emerald-950/20" : "bg-white/70 dark:bg-rose-950/20";
  return (
    <div className={`rounded-xl border ring-1 ${ringColor} ${bg} p-3`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold truncate">{row.name}</span>
          <DeltaBadge delta={row.delta} />
        </div>
        <span className="text-sm tabular-nums shrink-0">
          <span className="font-bold">{row.rate}%</span>{" "}
          <span className="text-muted-foreground">· {row.done}/{row.total}</span>
        </span>
      </div>
      <Progress value={Math.max(0, Math.min(100, row.rate))} className="h-2" />
      {row.overdue > 0 && (
        <div className="mt-2 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          {row.overdue} مهمة متأخرة عن تاريخ الاستحقاق
        </div>
      )}
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <span className="text-[10px] text-muted-foreground border rounded-full px-1.5 py-0.5">
        جديد
      </span>
    );
  }
  if (delta === 0) {
    return (
      <span className="text-[11px] inline-flex items-center gap-0.5 text-muted-foreground">
        <Minus className="h-3 w-3" /> 0%
      </span>
    );
  }
  if (delta > 0) {
    return (
      <span className="text-[11px] inline-flex items-center gap-0.5 text-emerald-600 font-semibold">
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