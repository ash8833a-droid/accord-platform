import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  ShieldCheck, Printer, ClipboardCheck, ChevronDown, ChevronLeft,
  Loader2, Save, FileText, Sparkles, Clock, AlertTriangle, CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { COMMITTEES, committeeByType, type CommitteeType } from "@/lib/committees";
import { BRAND_LOGO_SVG } from "@/assets/brand-logo";

type TaskStatus = "todo" | "in_progress" | "completed";
type TaskPriority = "low" | "medium" | "high" | "urgent";

interface RawTask {
  id: string;
  committee_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assigned_to: string | null;
  updated_at: string;
}

interface CommitteeRow {
  id: string;
  name: string;
  type: CommitteeType;
  budget_allocated: number;
  budget_spent: number;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "قائمة الانتظار",
  in_progress: "قيد التنفيذ",
  completed: "مكتملة",
};
const STATUS_TONE: Record<TaskStatus, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
};
const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "منخفضة", medium: "متوسطة", high: "عالية", urgent: "عاجلة",
};

const AUDIT_TAG_RE = /\n?\[تدقيق الجودة\]([\s\S]*?)\[\/تدقيق الجودة\]/;

// ===== Time tracking (60-day soft cap from system activation date) =====
const SYSTEM_DEADLINE_DAYS = 60;
// Activation date: from today the user enabled the policy. Stored as a constant baseline.
const SYSTEM_ACTIVATION = new Date(); SYSTEM_ACTIVATION.setHours(0,0,0,0);
const SYSTEM_DEADLINE = new Date(SYSTEM_ACTIVATION);
SYSTEM_DEADLINE.setDate(SYSTEM_DEADLINE.getDate() + SYSTEM_DEADLINE_DAYS);

type TimeStatus = "ontrack" | "approaching" | "overdue" | "completed";

function getTimeStatus(t: { status: TaskStatus; due_date: string | null }): TimeStatus {
  if (t.status === "completed") return "completed";
  const today = new Date(); today.setHours(0,0,0,0);
  // effective deadline = min(task due_date, system deadline)
  let effective = SYSTEM_DEADLINE;
  if (t.due_date) {
    const td = new Date(t.due_date);
    if (td < effective) effective = td;
  }
  const diffDays = Math.ceil((effective.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 14) return "approaching";
  return "ontrack";
}

const TIME_LABELS: Record<TimeStatus, string> = {
  ontrack: "في الوقت",
  approaching: "قاربت المهلة",
  overdue: "متأخرة",
  completed: "مُنجزة",
};
const TIME_TONE: Record<TimeStatus, string> = {
  ontrack: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  approaching: "bg-amber-500/10 text-amber-700 border-amber-500/40",
  overdue: "bg-rose-500/10 text-rose-700 border-rose-500/40",
  completed: "bg-muted text-muted-foreground",
};

function daysLeft(): number {
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.max(0, Math.ceil((SYSTEM_DEADLINE.getTime() - today.getTime()) / 86400000));
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" });
}

function splitAudit(desc: string | null): { body: string; audit: string } {
  if (!desc) return { body: "", audit: "" };
  const m = desc.match(AUDIT_TAG_RE);
  if (!m) return { body: desc, audit: "" };
  return { body: desc.replace(AUDIT_TAG_RE, "").trim(), audit: m[1].trim() };
}
function mergeAudit(body: string, audit: string): string {
  const cleanBody = (body ?? "").trim();
  if (!audit.trim()) return cleanBody;
  return `${cleanBody}\n\n[تدقيق الجودة]\n${audit.trim()}\n[/تدقيق الجودة]`;
}
function splitPhase(title: string) {
  const m = title.match(/^\s*\[([^\]]+)\]\s*(.*)$/);
  return m ? { phase: m[1].trim(), clean: m[2].trim() } : { phase: "", clean: title };
}

export function QualityAuditPanel() {
  const [committees, setCommittees] = useState<CommitteeRow[]>([]);
  const [tasks, setTasks] = useState<RawTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCommittee, setOpenCommittee] = useState<string | null>(null);
  const [auditOpen, setAuditOpen] = useState<RawTask | null>(null);
  const [auditNote, setAuditNote] = useState("");
  const [auditStatus, setAuditStatus] = useState<TaskStatus>("todo");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: cs }, { data: ts }] = await Promise.all([
      supabase.from("committees").select("id, name, type, budget_allocated, budget_spent").order("name"),
      supabase.from("committee_tasks").select("id, committee_id, title, description, status, priority, due_date, assigned_to, updated_at"),
    ]);
    setCommittees(((cs ?? []) as any[]).filter((c) => c.type !== "quality") as CommitteeRow[]);
    setTasks((ts ?? []) as RawTask[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const tasksByCommittee = useMemo(() => {
    const m = new Map<string, RawTask[]>();
    tasks.forEach((t) => {
      const arr = m.get(t.committee_id) ?? [];
      arr.push(t);
      m.set(t.committee_id, arr);
    });
    return m;
  }, [tasks]);

  const openAudit = (t: RawTask) => {
    const { audit } = splitAudit(t.description);
    setAuditOpen(t);
    setAuditNote(audit);
    setAuditStatus(t.status);
  };

  const saveAudit = async () => {
    if (!auditOpen) return;
    setSaving(true);
    const { body } = splitAudit(auditOpen.description);
    const newDesc = mergeAudit(body, auditNote);
    const { error } = await supabase
      .from("committee_tasks")
      .update({ description: newDesc, status: auditStatus })
      .eq("id", auditOpen.id);
    setSaving(false);
    if (error) {
      toast.error("تعذّر حفظ المتابعة", { description: error.message });
      return;
    }
    toast.success("تم حفظ المتابعة");
    setAuditOpen(null);
    load();
  };

  const printCommittee = (c: CommitteeRow) => {
    const list = tasksByCommittee.get(c.id) ?? [];
    const html = buildReportHTML(c, list);
    const w = window.open("", "_blank", "width=900,height=900");
    if (!w) {
      toast.error("فضلاً اسمح بفتح النوافذ المنبثقة لتمكين الطباعة");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 600);
  };

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-soft space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="h-10 w-10 rounded-xl bg-sky-500/15 text-sky-600 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-bold text-base flex items-center gap-1.5">
              لوحة متابعة المخرجات
              <Sparkles className="h-3.5 w-3.5 text-gold" />
            </h3>
            <p className="text-[11px] text-muted-foreground">
              متابعة مهام جميع اللجان · تسجيل ملاحظات الجودة · مؤشرات الالتزام الزمني · طباعة تقرير لكل لجنة
            </p>
          </div>
        </div>
        <Badge variant="outline" className="bg-sky-500/5 border-sky-500/30 text-sky-700">
          {tasks.length} مهمة · {committees.length} لجنة
        </Badge>
      </div>

      {/* Global timeline banner */}
      <div className="rounded-xl border-2 border-gold/30 bg-gradient-to-l from-gold/5 via-background to-sky-500/5 p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="h-9 w-9 rounded-lg bg-gold/15 text-gold-foreground flex items-center justify-center">
            <CalendarClock className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-bold">السقف الزمني العام: {SYSTEM_DEADLINE_DAYS} يوماً</p>
            <p className="text-[10.5px] text-muted-foreground">
              من {fmtDate(SYSTEM_ACTIVATION)} إلى {fmtDate(SYSTEM_DEADLINE)} · سياسة مرنة (تنبيه فقط)
            </p>
          </div>
        </div>
        <Badge className="bg-gold/15 text-gold-foreground border border-gold/40 hover:bg-gold/20">
          <Clock className="h-3 w-3 ms-1" /> متبقي {daysLeft()} يوماً
        </Badge>
      </div>

      {loading && (
        <div className="py-10 flex items-center justify-center text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 ms-2 animate-spin" /> جاري تحميل بيانات اللجان...
        </div>
      )}

      {!loading && (
        <div className="divide-y rounded-xl border bg-background/40">
          {committees.map((c) => {
            const meta = committeeByType(c.type);
            const list = tasksByCommittee.get(c.id) ?? [];
            const total = list.length;
            const done = list.filter((t) => t.status === "completed").length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const overdue = list.filter((t) => getTimeStatus(t) === "overdue").length;
            const approaching = list.filter((t) => getTimeStatus(t) === "approaching").length;
            const onTime = list.filter((t) => {
              const ts = getTimeStatus(t);
              return ts === "ontrack" || ts === "completed";
            }).length;
            const compliancePct = total > 0 ? Math.round((onTime / total) * 100) : 100;
            const isOpen = openCommittee === c.id;
            const Icon = meta?.icon ?? FileText;
            return (
              <div key={c.id} className="p-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => setOpenCommittee(isOpen ? null : c.id)}
                    className="flex items-center gap-2.5 flex-1 text-start hover:bg-muted/30 rounded-lg p-2 transition"
                  >
                    <span className={`h-9 w-9 rounded-lg flex items-center justify-center ${meta?.tone ?? "bg-muted"}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm truncate">{c.name}</p>
                      <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>{total} مهمة · مكتملة: {done} ({pct}%)</span>
                        <span className="text-muted-foreground/50">|</span>
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>التزام زمني: {compliancePct}%
                        </span>
                        {approaching > 0 && (
                          <span className="inline-flex items-center gap-1 text-amber-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>قاربت: {approaching}
                          </span>
                        )}
                        {overdue > 0 && (
                          <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                            <AlertTriangle className="h-3 w-3" />متأخرة: {overdue}
                          </span>
                        )}
                      </div>
                    </div>
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronLeft className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => printCommittee(c)}
                    className="border-gold/40 text-gold-foreground hover:bg-gold/10"
                  >
                    <Printer className="h-3.5 w-3.5 ms-1" /> طباعة تقرير
                  </Button>
                </div>

                {isOpen && (
                  <div className="mt-3 space-y-2 ps-2">
                    {list.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-6 border-2 border-dashed rounded-lg">
                        لا توجد مهام لهذه اللجنة بعد
                      </p>
                    )}
                    {list.map((t) => {
                      const { phase, clean } = splitPhase(t.title);
                      const { body, audit } = splitAudit(t.description);
                      const ts = getTimeStatus(t);
                      return (
                        <div key={t.id} className="rounded-lg border bg-card p-3 hover:border-sky-500/40 transition">
                          <div className="flex items-start gap-2 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                {phase && <Badge variant="outline" className="text-[10px]">{phase}</Badge>}
                                <Badge variant="outline" className={`${STATUS_TONE[t.status]} text-[10px]`}>
                                  {STATUS_LABELS[t.status]}
                                </Badge>
                                <Badge variant="secondary" className="text-[10px]">
                                  {PRIORITY_LABELS[t.priority]}
                                </Badge>
                                <Badge variant="outline" className={`${TIME_TONE[ts]} text-[10px] border`}>
                                  {ts === "overdue" && <AlertTriangle className="h-2.5 w-2.5 ms-1" />}
                                  {ts !== "overdue" && <Clock className="h-2.5 w-2.5 ms-1" />}
                                  {TIME_LABELS[ts]}
                                </Badge>
                              </div>
                              <p className="font-semibold text-sm">{clean}</p>
                              {body && (
                                <p className="text-[11.5px] text-muted-foreground mt-1 line-clamp-2">{body}</p>
                              )}
                              {audit && (
                                <div className="mt-2 rounded-md bg-sky-500/5 border border-sky-500/30 px-2.5 py-1.5">
                                  <p className="text-[10px] font-bold text-sky-700 mb-0.5 flex items-center gap-1">
                                    <ClipboardCheck className="h-3 w-3" /> ملاحظة المتابعة
                                  </p>
                                  <p className="text-[11.5px] text-foreground whitespace-pre-wrap">{audit}</p>
                                </div>
                              )}
                            </div>
                            <Button size="sm" variant="outline" onClick={() => openAudit(t)}>
                              <ClipboardCheck className="h-3.5 w-3.5 ms-1" />
                              {audit ? "تعديل المتابعة" : "متابعة"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!auditOpen} onOpenChange={(o) => !o && setAuditOpen(null)}>
        <DialogContent dir="rtl" className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-sky-600" /> متابعة المهمة
            </DialogTitle>
          </DialogHeader>
          {auditOpen && (
            <div className="space-y-3 pt-2">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[11px] text-muted-foreground mb-1">المهمة</p>
                <p className="font-semibold text-sm">{splitPhase(auditOpen.title).clean}</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold">تحديث حالة التنفيذ</label>
                <Select value={auditStatus} onValueChange={(v) => setAuditStatus(v as TaskStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">قائمة الانتظار</SelectItem>
                    <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                    <SelectItem value="completed">مكتملة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold">ملاحظات المتابعة والجودة</label>
                <Textarea
                  value={auditNote}
                  onChange={(e) => setAuditNote(e.target.value)}
                  rows={5}
                  placeholder="مثال: تم التحقق من المخرج، يحتاج تحديث المرفقات، نسبة المطابقة 90%..."
                />
                <p className="text-[10px] text-muted-foreground">
                  تظهر هذه الملاحظات لرئيس اللجنة وأعضائها وتُطبع ضمن تقرير المتابعة.
                </p>
              </div>
              <Button onClick={saveAudit} disabled={saving} className="w-full bg-gradient-hero text-primary-foreground">
                {saving ? <Loader2 className="h-4 w-4 ms-1 animate-spin" /> : <Save className="h-4 w-4 ms-1" />}
                حفظ المتابعة
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ============== PROFESSIONAL PDF REPORT (PRINT-TO-PDF) ============== */
function buildReportHTML(c: CommitteeRow, tasks: RawTask[]): string {
  const meta = committeeByType(c.type);
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "completed").length;
  const inProg = tasks.filter((t) => t.status === "in_progress").length;
  const todo = tasks.filter((t) => t.status === "todo").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const audited = tasks.filter((t) => splitAudit(t.description).audit).length;
  const today = new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
  const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(n);
  const remaining = Number(c.budget_allocated) - Number(c.budget_spent);
  const overdue = tasks.filter((t) => getTimeStatus(t) === "overdue").length;
  const approaching = tasks.filter((t) => getTimeStatus(t) === "approaching").length;
  const onTime = tasks.filter((t) => {
    const ts = getTimeStatus(t);
    return ts === "ontrack" || ts === "completed";
  }).length;
  const compliancePct = total > 0 ? Math.round((onTime / total) * 100) : 100;

  const rows = tasks.map((t, i) => {
    const { phase, clean } = splitPhase(t.title);
    const { body, audit } = splitAudit(t.description);
    const statusLabel = STATUS_LABELS[t.status];
    const statusCls = t.status === "completed" ? "ok" : t.status === "in_progress" ? "wip" : "todo";
    const ts = getTimeStatus(t);
    const tCls = ts === "overdue" ? "tdue" : ts === "approaching" ? "tnear" : ts === "completed" ? "tdone" : "tok";
    return `
      <tr>
        <td class="num">${i + 1}</td>
        <td>
          ${phase ? `<span class="phase">${escapeHtml(phase)}</span>` : ""}
          <div class="title">${escapeHtml(clean)}</div>
          ${body ? `<div class="desc">${escapeHtml(body)}</div>` : ""}
        </td>
        <td><span class="pri pri-${t.priority}">${PRIORITY_LABELS[t.priority]}</span></td>
        <td><span class="status ${statusCls}">${statusLabel}</span></td>
        <td><span class="tstat ${tCls}">${TIME_LABELS[ts]}</span></td>
        <td class="audit-cell">${
          audit
            ? `<div class="audit"><strong>ملاحظة المتابعة:</strong><br/>${escapeHtml(audit)}</div>`
            : `<span class="muted">— لم يُسجَّل بعد —</span>`
        }</td>
      </tr>
    `;
  }).join("");

  const logo = `data:image/svg+xml;utf8,${encodeURIComponent(BRAND_LOGO_SVG)}`;

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>تقرير متابعة الجودة — ${escapeHtml(c.name)}</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Tajawal', system-ui, sans-serif; color: #1a1a1a; margin: 0; background: #fff; line-height: 1.55; }
  .frame { padding: 0; }
  .topbar {
    background: linear-gradient(135deg, #0E3A42 0%, #1c5663 60%, #2A7E8B 100%);
    color: #fff; padding: 18px 22px; border-radius: 14px;
    display: flex; align-items: center; gap: 16px; position: relative; overflow: hidden;
  }
  .topbar::after {
    content: ""; position: absolute; inset: 0;
    background: radial-gradient(circle at 90% 10%, rgba(233,203,126,.25), transparent 50%);
  }
  .topbar img { height: 64px; width: 64px; background: #fff; border-radius: 12px; padding: 4px; position: relative; z-index: 1; }
  .topbar .ti { position: relative; z-index: 1; flex: 1; }
  .topbar h1 { font-size: 20px; margin: 0 0 4px 0; font-weight: 900; letter-spacing: 0.2px; }
  .topbar .sub { font-size: 12px; opacity: .9; margin: 0; }
  .topbar .meta { font-size: 11px; opacity: .85; margin-top: 6px; }
  .gold-rule { height: 4px; border-radius: 4px; background: linear-gradient(90deg, #E9CB7E, #C4A25C, #8C6E2E); margin: 14px 0 18px; }

  .section-title { font-size: 13px; font-weight: 900; color: #0E3A42; border-right: 4px solid #C4A25C; padding-right: 8px; margin: 18px 0 10px; }

  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 8px 0 4px; }
  .kpi { border: 1px solid #e8e2d3; background: #fbf8f1; border-radius: 10px; padding: 10px 12px; }
  .kpi .lbl { font-size: 10px; color: #6b6f72; }
  .kpi .val { font-size: 18px; font-weight: 900; color: #0E3A42; margin-top: 2px; }
  .kpi.gold { background: linear-gradient(135deg, #FBF7EE, #F1E6CB); border-color: #E9CB7E; }
  .kpi.gold .val { color: #6b4d12; }

  .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; }
  .meta-grid .item { border: 1px solid #ececec; border-radius: 10px; padding: 8px 10px; background: #fafafa; }
  .meta-grid .item .l { font-size: 10px; color: #6b6f72; }
  .meta-grid .item .v { font-size: 12.5px; font-weight: 700; color: #0E3A42; margin-top: 2px; }

  table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 11.5px; margin-top: 6px; }
  thead th {
    background: linear-gradient(135deg, #0E3A42, #2A7E8B); color: #fff; padding: 8px 6px;
    font-weight: 700; font-size: 11px; text-align: right; border-bottom: 3px solid #C4A25C;
  }
  thead th:first-child { border-top-right-radius: 10px; }
  thead th:last-child { border-top-left-radius: 10px; }
  tbody td { padding: 8px 6px; border-bottom: 1px solid #eceae3; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #fbfaf6; }
  tbody tr:hover td { background: #f5f1e6; }
  .num { text-align: center; color: #888; width: 28px; font-weight: 700; }
  .phase { display: inline-block; font-size: 9.5px; padding: 1px 7px; border-radius: 999px; background: #eef6ff; color: #1e5fa8; border: 1px solid #cfe2ff; margin-bottom: 3px; }
  .title { font-weight: 700; color: #0E3A42; }
  .desc { font-size: 10.5px; color: #555; margin-top: 3px; }
  .pri { display: inline-block; font-size: 10px; padding: 2px 8px; border-radius: 999px; font-weight: 700; }
  .pri-low { background: #f1f1f1; color: #555; }
  .pri-medium { background: #e3f2ff; color: #1860a8; }
  .pri-high { background: #fff2dd; color: #a96a09; }
  .pri-urgent { background: #ffe4e6; color: #b91c2b; }
  .status { display: inline-block; font-size: 10px; padding: 2px 8px; border-radius: 999px; font-weight: 700; }
  .status.ok { background: #dff5e6; color: #157a3c; }
  .status.wip { background: #e3f2ff; color: #1860a8; }
  .status.todo { background: #f1f1f1; color: #666; }
  .tstat { display: inline-block; font-size: 10px; padding: 2px 8px; border-radius: 999px; font-weight: 700; }
  .tstat.tok { background: #dff5e6; color: #157a3c; }
  .tstat.tnear { background: #fff5d6; color: #8a6500; }
  .tstat.tdue { background: #ffe4e6; color: #b91c2b; }
  .tstat.tdone { background: #f1f1f1; color: #666; }
  .audit-cell { width: 28%; }
  .audit { background: #f4faff; border: 1px dashed #6aa6d6; border-radius: 8px; padding: 6px 8px; font-size: 10.5px; color: #1f3a4d; }
  .muted { color: #aaa; font-size: 10.5px; }

  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 26px; }
  .sig { border-top: 2px dashed #C4A25C; padding-top: 8px; text-align: center; }
  .sig .role { font-size: 11px; color: #6b6f72; }
  .sig .name { font-size: 13px; font-weight: 700; color: #0E3A42; margin-top: 4px; }

  .footer { margin-top: 22px; padding-top: 8px; border-top: 1px solid #eceae3; display: flex; justify-content: space-between; font-size: 10px; color: #888; }
  .footer .brand { color: #0E3A42; font-weight: 700; }

  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .topbar, .kpi.gold, thead th, .status, .pri, .phase, .audit { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="frame">
    <div class="topbar">
      <img src="${logo}" alt="شعار الحملة" />
      <div class="ti">
        <h1>تقرير متابعة الجودة — ${escapeHtml(c.name)}</h1>
        <p class="sub">منصة لجنة الزواج الجماعي العائلي · إصدار رسمي صادر عن لجنة الجودة</p>
        <p class="meta">${escapeHtml(meta?.description ?? "")}</p>
      </div>
    </div>
    <div class="gold-rule"></div>

    <div class="meta-grid">
      <div class="item"><div class="l">تاريخ التقرير</div><div class="v">${today}</div></div>
      <div class="item"><div class="l">اللجنة المتابَعة</div><div class="v">${escapeHtml(c.name)}</div></div>
      <div class="item"><div class="l">جهة الإصدار</div><div class="v">لجنة الجودة</div></div>
    </div>

    <div class="section-title">المؤشرات الرئيسية</div>
    <div class="kpis">
      <div class="kpi"><div class="lbl">إجمالي المهام</div><div class="val">${fmt(total)}</div></div>
      <div class="kpi"><div class="lbl">مكتملة</div><div class="val">${fmt(done)}</div></div>
      <div class="kpi"><div class="lbl">قيد التنفيذ / انتظار</div><div class="val">${fmt(inProg)} / ${fmt(todo)}</div></div>
      <div class="kpi gold"><div class="lbl">نسبة الإنجاز</div><div class="val">${pct}%</div></div>
    </div>
    <div class="kpis" style="margin-top:8px">
      <div class="kpi"><div class="lbl">الميزانية المعتمدة</div><div class="val">${fmt(Number(c.budget_allocated))} ر.س</div></div>
      <div class="kpi"><div class="lbl">المنصرف</div><div class="val">${fmt(Number(c.budget_spent))} ر.س</div></div>
      <div class="kpi"><div class="lbl">المتبقي</div><div class="val">${fmt(remaining)} ر.س</div></div>
      <div class="kpi gold"><div class="lbl">المهام المتابَعة</div><div class="val">${fmt(audited)} / ${fmt(total)}</div></div>
    </div>

    <div class="section-title">الالتزام الزمني (سقف ${SYSTEM_DEADLINE_DAYS} يوماً حتى ${fmtDate(SYSTEM_DEADLINE)})</div>
    <div class="kpis">
      <div class="kpi gold"><div class="lbl">نسبة الالتزام الزمني</div><div class="val">${compliancePct}%</div></div>
      <div class="kpi"><div class="lbl">في الوقت / مُنجزة</div><div class="val">${fmt(onTime)}</div></div>
      <div class="kpi"><div class="lbl">قاربت المهلة</div><div class="val">${fmt(approaching)}</div></div>
      <div class="kpi"><div class="lbl">متأخرة</div><div class="val">${fmt(overdue)}</div></div>
    </div>

    <div class="section-title">سجل المهام وملاحظات المتابعة</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>المهمة</th>
          <th>الأولوية</th>
          <th>الحالة</th>
          <th>الحالة الزمنية</th>
          <th>ملاحظات لجنة الجودة</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="6" style="text-align:center;color:#888;padding:18px">لا توجد مهام مسجّلة لهذه اللجنة.</td></tr>`}
      </tbody>
    </table>

    <div class="signatures">
      <div class="sig">
        <div class="role">مسؤول المتابعة — لجنة الجودة</div>
        <div class="name">..............................................</div>
      </div>
      <div class="sig">
        <div class="role">رئيس ${escapeHtml(c.name)}</div>
        <div class="name">..............................................</div>
      </div>
    </div>

    <div class="footer">
      <span>صادر بتاريخ ${today}</span>
      <span class="brand">منصة لجنة الزواج الجماعي العائلي</span>
    </div>
  </div>
  <script>window.onafterprint = () => window.close();</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// silence unused export warning if any
void COMMITTEES;