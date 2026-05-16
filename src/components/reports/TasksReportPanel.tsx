import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ListChecks, FileSpreadsheet, FileText, Filter,
  CheckCircle2, Clock, AlertTriangle, TrendingUp, Loader2, Send, BellRing,
} from "lucide-react";
import { toast } from "sonner";
import {
  exportTasksPDF, exportTasksXLSX, exportFirstTasksPDF,
  type TaskRow, type TaskReportSummary, type CommitteePerf,
  type FirstTaskRow, type CommitteeProgressBrief,
} from "@/lib/task-reports";
import { sendFirstTaskReminders } from "@/server/task-reminders.functions";

interface Committee { id: string; name: string }
interface Profile { user_id: string; full_name: string }

const RANGE_OPTIONS = [
  { value: "all", label: "كل الفترات" },
  { value: "30", label: "آخر 30 يوماً" },
  { value: "90", label: "آخر 90 يوماً" },
  { value: "year", label: "السنة الحالية" },
];

export function TasksReportPanel() {
  const { user } = useAuth();
  const signerName =
    (user?.user_metadata as any)?.full_name ?? undefined;
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [exportingFirst, setExportingFirst] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [responsesAgg, setResponsesAgg] = useState<Record<string, number>>({});
  const [attachmentsAgg, setAttachmentsAgg] = useState<Record<string, number>>({});

  const [committeeFilter, setCommitteeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [rangeFilter, setRangeFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: c }, { data: p }, { data: rs }, { data: at }] = await Promise.all([
      supabase.from("committee_tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("committees").select("id, name"),
      supabase.from("profiles").select("user_id, full_name"),
      supabase.from("task_responses").select("task_id"),
      supabase.from("task_attachments").select("task_id"),
    ]);
    setTasks((t ?? []) as any[]);
    setCommittees((c ?? []) as Committee[]);
    setProfiles((p ?? []) as Profile[]);

    const rAgg: Record<string, number> = {};
    (rs ?? []).forEach((x: any) => { rAgg[x.task_id] = (rAgg[x.task_id] ?? 0) + 1; });
    setResponsesAgg(rAgg);

    const aAgg: Record<string, number> = {};
    (at ?? []).forEach((x: any) => { aAgg[x.task_id] = (aAgg[x.task_id] ?? 0) + 1; });
    setAttachmentsAgg(aAgg);

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const committeeName = (id: string) =>
    committees.find((c) => c.id === id)?.name ?? "—";
  const profileName = (id: string | null) =>
    id ? profiles.find((p) => p.user_id === id)?.full_name ?? "—" : null;

  const filteredRaw = useMemo(() => {
    const now = Date.now();
    return tasks.filter((t) => {
      if (committeeFilter !== "all" && t.committee_id !== committeeFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (rangeFilter !== "all") {
        const created = new Date(t.created_at).getTime();
        if (rangeFilter === "year") {
          if (new Date(t.created_at).getFullYear() !== new Date().getFullYear()) return false;
        } else {
          const days = Number(rangeFilter);
          if (now - created > days * 86400000) return false;
        }
      }
      return true;
    });
  }, [tasks, committeeFilter, statusFilter, rangeFilter]);

  const rows: TaskRow[] = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return filteredRaw.map((t) => {
      const due = t.due_date ? new Date(t.due_date) : null;
      const isOverdue = !!(due && t.status !== "done" && t.status !== "cancelled" && due < today);
      const daysLate = isOverdue && due
        ? Math.floor((today.getTime() - due.getTime()) / 86400000)
        : 0;
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        committee_name: committeeName(t.committee_id),
        status: t.status,
        priority: t.priority,
        due_date: t.due_date,
        assignee_name: profileName(t.assigned_to),
        created_at: t.created_at,
        updated_at: t.updated_at,
        responses_count: responsesAgg[t.id] ?? 0,
        attachments_count: attachmentsAgg[t.id] ?? 0,
        is_overdue: isOverdue,
        days_late: daysLate,
      };
    });
  }, [filteredRaw, committees, profiles, responsesAgg, attachmentsAgg]);

  const summary: TaskReportSummary = useMemo(() => {
    const total = rows.length;
    const done = rows.filter((r) => r.status === "done").length;
    return {
      total,
      todo: rows.filter((r) => r.status === "todo").length,
      in_progress: rows.filter((r) => r.status === "in_progress").length,
      done,
      cancelled: rows.filter((r) => r.status === "cancelled").length,
      overdue: rows.filter((r) => r.is_overdue).length,
      completion_rate: total === 0 ? 0 : Math.round((done / total) * 100),
      with_responses: rows.filter((r) => r.responses_count > 0).length,
    };
  }, [rows]);

  const perCommittee: CommitteePerf[] = useMemo(() => {
    const map = new Map<string, { name: string; total: number; done: number; overdue: number }>();
    rows.forEach((r) => {
      const key = r.committee_name;
      const cur = map.get(key) ?? { name: key, total: 0, done: 0, overdue: 0 };
      cur.total++;
      if (r.status === "done") cur.done++;
      if (r.is_overdue) cur.overdue++;
      map.set(key, cur);
    });
    return Array.from(map.values())
      .map((m) => ({
        committee_name: m.name,
        total: m.total,
        done: m.done,
        overdue: m.overdue,
        completion_rate: m.total === 0 ? 0 : Math.round((m.done / m.total) * 100),
      }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  const filename = `تقرير-المهام-${new Date().toISOString().slice(0, 10)}`;

  const onExportPDF = () => {
    setExporting("pdf");
    try {
      exportTasksPDF(rows, summary, perCommittee, filename, signerName);
      toast.success("تم فتح التقرير للطباعة");
    } catch (e: any) {
      toast.error("تعذر التصدير", { description: e?.message });
    } finally { setExporting(null); }
  };

  const onExportXLSX = () => {
    setExporting("xlsx");
    try {
      exportTasksXLSX(rows, summary, perCommittee, filename);
      toast.success("تم تنزيل ملف Excel");
    } catch (e: any) {
      toast.error("تعذر التصدير", { description: e?.message });
    } finally { setExporting(null); }
  };

  const onExportFirstTasks = () => {
    setExportingFirst(true);
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      // Pick the highest-priority pending task per committee. Order:
      // 1) priority rank (urgent > high > medium > low),
      // 2) manual sort_order (drag-and-drop position in the plan),
      // 3) oldest created_at as a stable tiebreaker.
      // Exclude completed/cancelled tasks so we surface the true next item.
      const priorityRank: Record<string, number> = {
        urgent: 0, high: 1, medium: 2, low: 3,
      };
      const sorted = [...tasks]
        .filter((t) => t.status !== "done" && t.status !== "cancelled")
        .sort((a, b) => {
          const pr = (priorityRank[a.priority] ?? 99) - (priorityRank[b.priority] ?? 99);
          if (pr !== 0) return pr;
          const so = (a.sort_order ?? 0) - (b.sort_order ?? 0);
          if (so !== 0) return so;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
      const seen = new Set<string>();
      const firstPerCommittee: FirstTaskRow[] = [];
      for (const t of sorted) {
        if (seen.has(t.committee_id)) continue;
        seen.add(t.committee_id);
        const due = t.due_date ? new Date(t.due_date) : null;
        const isOverdue = !!(due && t.status !== "done" && t.status !== "cancelled" && due < today);
        firstPerCommittee.push({
          committee_name: committeeName(t.committee_id),
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          due_date: t.due_date,
          assignee_name: profileName(t.assigned_to),
          created_at: t.created_at,
          is_overdue: isOverdue,
          days_late: isOverdue && due ? Math.floor((today.getTime() - due.getTime()) / 86400000) : 0,
        });
      }
      // sort committees alphabetically for a stable, executive-friendly order
      firstPerCommittee.sort((a, b) => a.committee_name.localeCompare(b.committee_name, "ar"));
      if (firstPerCommittee.length === 0) {
        toast.error("لا توجد مهام لأي لجنة");
        return;
      }
      // Build per-committee summary of done + in-progress tasks (in task-center order).
      const progressByCommittee = new Map<string, CommitteeProgressBrief>();
      const ordered = [...tasks].sort((a, b) => {
        const so = (a.sort_order ?? 0) - (b.sort_order ?? 0);
        if (so !== 0) return so;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      for (const t of ordered) {
        const cname = committeeName(t.committee_id);
        let entry = progressByCommittee.get(cname);
        if (!entry) {
          entry = { committee_name: cname, done: [], in_progress: [] };
          progressByCommittee.set(cname, entry);
        }
        const brief = {
          title: t.title,
          assignee_name: profileName(t.assigned_to),
          due_date: t.due_date,
        };
        if (t.status === "done") entry.done.push(brief);
        else if (t.status === "in_progress") entry.in_progress.push(brief);
      }
      const progress = Array.from(progressByCommittee.values())
        .sort((a, b) => a.committee_name.localeCompare(b.committee_name, "ar"));
      const fname = `المهام-العاجلة-لكل-لجنة-${new Date().toISOString().slice(0, 10)}`;
      exportFirstTasksPDF(firstPerCommittee, fname, signerName, progress);
      toast.success(`تم إعداد تقرير المهام العاجلة (${firstPerCommittee.length} لجنة)`);
    } catch (e: any) {
      toast.error("تعذر التصدير", { description: e?.message });
    } finally { setExportingFirst(false); }
  };

  const onSendReminders = async () => {
    if (!confirm("إرسال تذكير داخلي للمكلّفين ورؤساء اللجان بأول مهمة لكل لجنة؟")) return;
    setSendingReminders(true);
    try {
      const res = await sendFirstTaskReminders({ data: {} });
      toast.success(`تم إرسال ${res.sent} تذكير لـ ${res.committees} لجنة`);
    } catch (e: any) {
      toast.error("تعذر إرسال التذكيرات", { description: e?.message });
    } finally { setSendingReminders(false); }
  };

  return (
    <div className="rounded-2xl border bg-card shadow-soft overflow-hidden">
      <div className="px-6 py-4 border-b bg-gradient-to-l from-primary/5 to-transparent flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          <h2 className="font-bold">تقارير المهام</h2>
          <Badge variant="outline" className="text-[10px]">{rows.length} مهمة</Badge>
          {summary.overdue > 0 && (
            <Badge variant="secondary" className="text-[10px] bg-red-500/15 text-red-700 border-red-500/30">
              {summary.overdue} متأخرة
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={onExportFirstTasks}
            disabled={exportingFirst || tasks.length === 0}
            className="border-gold/40 bg-gold/10 hover:bg-gold/20 text-foreground"
            title="طباعة أول مهمة من كل لجنة كقائمة عاجلة"
          >
            {exportingFirst ? <Loader2 className="h-3.5 w-3.5 animate-spin ms-1" /> : <Send className="h-3.5 w-3.5 ms-1" />}
            المهام العاجلة (أول مهمة لكل لجنة)
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onSendReminders}
            disabled={sendingReminders || tasks.length === 0}
            className="border-primary/40 bg-primary/10 hover:bg-primary/20 text-foreground"
            title="إرسال تذكير داخلي للمكلّفين ورؤساء اللجان بأول مهمة لكل لجنة"
          >
            {sendingReminders ? <Loader2 className="h-3.5 w-3.5 animate-spin ms-1" /> : <BellRing className="h-3.5 w-3.5 ms-1" />}
            إرسال تذكير المتابعة
          </Button>
          <Button size="sm" variant="outline" onClick={onExportXLSX} disabled={exporting !== null || rows.length === 0}>
            {exporting === "xlsx" ? <Loader2 className="h-3.5 w-3.5 animate-spin ms-1" /> : <FileSpreadsheet className="h-3.5 w-3.5 ms-1" />}
            Excel
          </Button>
          <Button size="sm" onClick={onExportPDF} disabled={exporting !== null || rows.length === 0}>
            {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin ms-1" /> : <FileText className="h-3.5 w-3.5 ms-1" />}
            PDF رسمي
          </Button>
        </div>
      </div>

      <div className="px-6 py-3 border-b bg-muted/20 flex items-center gap-2 flex-wrap text-xs">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <Select value={committeeFilter} onValueChange={setCommitteeFilter}>
          <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder="كل اللجان" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل اللجان</SelectItem>
            {committees.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[140px]"><SelectValue placeholder="كل الحالات" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="todo">لم تبدأ</SelectItem>
            <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
            <SelectItem value="done">منجزة</SelectItem>
            <SelectItem value="cancelled">ملغاة</SelectItem>
          </SelectContent>
        </Select>
        <Select value={rangeFilter} onValueChange={setRangeFilter}>
          <SelectTrigger className="h-8 w-[140px]"><SelectValue placeholder="الفترة" /></SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4">
        <KpiCard icon={ListChecks} label="إجمالي" value={summary.total} tone="primary" />
        <KpiCard icon={CheckCircle2} label="منجزة" value={summary.done} tone="emerald" />
        <KpiCard icon={Clock} label="قيد التنفيذ" value={summary.in_progress} tone="blue" />
        <KpiCard icon={AlertTriangle} label="متأخرة" value={summary.overdue} tone="red" />
        <KpiCard icon={TrendingUp} label="نسبة الإنجاز" value={`${summary.completion_rate}%`} tone="gold" />
      </div>

      {loading ? (
        <div className="py-10 text-center text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin inline-block ms-2" /> جارٍ التحميل…
        </div>
      ) : perCommittee.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground text-sm">
          لا توجد مهام تطابق الفلاتر الحالية
        </div>
      ) : (
        <div className="px-4 pb-4">
          <div className="text-xs font-bold text-muted-foreground mb-2 px-2">أداء اللجان</div>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs">
                <tr>
                  <th className="text-right p-2 font-medium">اللجنة</th>
                  <th className="p-2 font-medium">إجمالي</th>
                  <th className="p-2 font-medium">منجزة</th>
                  <th className="p-2 font-medium">متأخرة</th>
                  <th className="p-2 font-medium">الإنجاز</th>
                </tr>
              </thead>
              <tbody>
                {perCommittee.map((p) => (
                  <tr key={p.committee_name} className="border-t hover:bg-muted/20">
                    <td className="text-right p-2 font-medium">{p.committee_name}</td>
                    <td className="text-center p-2">{p.total}</td>
                    <td className="text-center p-2 text-emerald-700 font-semibold">{p.done}</td>
                    <td className={`text-center p-2 ${p.overdue > 0 ? "text-red-700 font-semibold" : ""}`}>{p.overdue}</td>
                    <td className="text-center p-2">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-l from-primary to-gold"
                            style={{ width: `${p.completion_rate}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold tabular-nums">{p.completion_rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, tone,
}: { icon: any; label: string; value: number | string; tone: "primary" | "emerald" | "blue" | "red" | "gold" }) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-700",
    blue: "bg-blue-500/10 text-blue-700",
    red: "bg-red-500/10 text-red-700",
    gold: "bg-gold/10 text-gold",
  };
  return (
    <div className="rounded-xl border bg-card p-3 flex items-center gap-3">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-lg font-bold tabular-nums">{value}</p>
      </div>
    </div>
  );
}
