import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ClipboardList, Save, FileSpreadsheet, Printer, Plus, Trash2, Loader2, CalendarRange, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { COMMITTEES, type CommitteeType } from "@/lib/committees";
import { useAuth } from "@/lib/auth";
import { BRAND_LOGO_SVG } from "@/assets/brand-logo";

type PmpPhase = "initiating" | "planning" | "executing" | "monitoring" | "closing";
const PHASE_LABELS: Record<PmpPhase, string> = {
  initiating: "التهيئة",
  planning: "التخطيط",
  executing: "التنفيذ",
  monitoring: "المراقبة والضبط",
  closing: "الإغلاق",
};
const PHASE_TONE: Record<PmpPhase, string> = {
  initiating: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  planning: "bg-violet-500/15 text-violet-700 border-violet-500/30",
  executing: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  monitoring: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  closing: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
};

interface EvalRow {
  id: string;
  committee_type: CommitteeType;
  phase: PmpPhase;
  criteria: string;        // معايير التقييم
  tools: string;           // أدوات القياس
  weight: number;          // الوزن النسبي %
  start_date: string;      // YYYY-MM-DD
  end_date: string;        // YYYY-MM-DD
  responsible: string;     // المسؤول
  deliverable: string;     // المخرج النهائي
  notes: string;
}

const SETTING_KEY = "quality.evaluation_plan";

const newRow = (committee_type: CommitteeType, phase: PmpPhase = "initiating"): EvalRow => ({
  id: (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
  committee_type,
  phase,
  criteria: "",
  tools: "قائمة تحقق · مراجعة وثائق",
  weight: 20,
  start_date: "",
  end_date: "",
  responsible: "لجنة الجودة",
  deliverable: "تقرير تقييم",
  notes: "",
});

function defaultPlan(): EvalRow[] {
  // Seed: one row per committee × initiating phase to make starting easier
  return COMMITTEES.map((c) => newRow(c.type));
}

function fmtDate(s: string) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return s; }
}

function escapeHtml(s: string) {
  return (s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" } as Record<string,string>)[c]!);
}

export function EvaluationPlanBuilder() {
  const { user } = useAuth();
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterCommittee, setFilterCommittee] = useState<CommitteeType | "all">("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("app_settings").select("value").eq("key", SETTING_KEY).maybeSingle();
      const v = data?.value as { rows?: EvalRow[] } | null;
      const loaded = Array.isArray(v?.rows) && v!.rows.length > 0 ? v!.rows : defaultPlan();
      setRows(loaded);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(
    () => filterCommittee === "all" ? rows : rows.filter(r => r.committee_type === filterCommittee),
    [rows, filterCommittee]
  );

  const totalsByCommittee = useMemo(() => {
    const m = new Map<CommitteeType, { count: number; weight: number }>();
    rows.forEach(r => {
      const cur = m.get(r.committee_type) ?? { count: 0, weight: 0 };
      cur.count += 1; cur.weight += Number(r.weight) || 0;
      m.set(r.committee_type, cur);
    });
    return m;
  }, [rows]);

  const updateRow = (id: string, patch: Partial<EvalRow>) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));

  const removeRow = (id: string) => setRows(prev => prev.filter(r => r.id !== id));

  const addRow = (committee_type?: CommitteeType) => {
    const ct = committee_type ?? (filterCommittee === "all" ? COMMITTEES[0].type : filterCommittee);
    setRows(prev => [...prev, newRow(ct)]);
  };

  const seedAllPhasesForCommittee = (ct: CommitteeType) => {
    const phases: PmpPhase[] = ["initiating", "planning", "executing", "monitoring", "closing"];
    setRows(prev => [
      ...prev,
      ...phases.map(p => newRow(ct, p)),
    ]);
    toast.success("تم إضافة 5 صفوف (مرحلة لكل صفّ) لهذه اللجنة");
  };

  const save = async () => {
    setSaving(true);
    try {
      // Validate weights per committee shouldn't exceed 100%
      const overweight: string[] = [];
      totalsByCommittee.forEach((v, k) => {
        if (v.weight > 100) overweight.push(COMMITTEES.find(c => c.type === k)?.label ?? k);
      });
      if (overweight.length) {
        toast.warning("تنبيه: مجموع الأوزان يتجاوز 100% في: " + overweight.join("، "));
      }

      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: SETTING_KEY, value: { rows } as never, updated_by: user?.id ?? null }, { onConflict: "key" });
      if (error) { toast.error("تعذر الحفظ", { description: error.message }); return; }
      toast.success("تم حفظ خطة التقييم");
    } finally { setSaving(false); }
  };

  const exportXLSX = () => {
    const data = rows.map(r => ({
      "اللجنة": COMMITTEES.find(c => c.type === r.committee_type)?.label ?? r.committee_type,
      "المرحلة": PHASE_LABELS[r.phase],
      "معايير التقييم": r.criteria,
      "أدوات القياس": r.tools,
      "الوزن %": r.weight,
      "تاريخ البدء": r.start_date,
      "تاريخ الانتهاء": r.end_date,
      "المسؤول": r.responsible,
      "المخرج النهائي": r.deliverable,
      "ملاحظات": r.notes,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 22 }, { wch: 16 }, { wch: 38 }, { wch: 28 },
      { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 22 }, { wch: 28 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "خطة التقييم");
    XLSX.writeFile(wb, `evaluation-plan-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const printPDF = () => {
    const html = buildHTML(rows);
    const w = window.open("", "_blank", "width=1200,height=800");
    if (!w) { toast.error("متصفّحك يمنع النوافذ المنبثقة"); return; }
    w.document.open(); w.document.write(html); w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 350);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin inline ms-2" /> جارٍ التحميل…
      </div>
    );
  }

  return (
    <section className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b bg-gradient-to-l from-sky-500/5 to-transparent flex flex-wrap items-center gap-3">
        <span className="h-10 w-10 rounded-xl bg-sky-500/15 text-sky-600 flex items-center justify-center">
          <ClipboardList className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-[200px]">
          <h2 className="text-base font-bold flex items-center gap-2">
            خطة تقييم اللجان — المرحلة الأولى
            <Badge variant="outline" className="text-[10px]">PMP</Badge>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            عرّف معايير التقييم لكل لجنة، وحدّد جدول البدء والانتهاء، ثم احفظ أو صدّر النتيجة.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportXLSX}>
            <FileSpreadsheet className="h-4 w-4 ms-1" /> Excel
          </Button>
          <Button size="sm" variant="outline" onClick={printPDF}>
            <Printer className="h-4 w-4 ms-1" /> PDF / طباعة
          </Button>
          <Button size="sm" onClick={save} disabled={saving} className="bg-gradient-hero text-primary-foreground">
            {saving ? <Loader2 className="h-4 w-4 ms-1 animate-spin" /> : <Save className="h-4 w-4 ms-1" />}
            حفظ
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-5 py-3 border-b bg-muted/20 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">تصفية:</Label>
          <Select value={filterCommittee} onValueChange={(v) => setFilterCommittee(v as CommitteeType | "all")}>
            <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع اللجان</SelectItem>
              {COMMITTEES.map(c => <SelectItem key={c.type} value={c.type}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 ms-auto">
          {filterCommittee !== "all" && (
            <Button size="sm" variant="outline" onClick={() => seedAllPhasesForCommittee(filterCommittee)}>
              <Sparkles className="h-4 w-4 ms-1" /> إضافة 5 مراحل
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => addRow()}>
            <Plus className="h-4 w-4 ms-1" /> صف جديد
          </Button>
        </div>
      </div>

      {/* Summary chips */}
      <div className="px-5 py-3 border-b flex flex-wrap gap-2">
        {COMMITTEES.map(c => {
          const t = totalsByCommittee.get(c.type);
          const w = t?.weight ?? 0;
          const tone = w === 0 ? "bg-muted text-muted-foreground"
            : w > 100 ? "bg-rose-500/15 text-rose-700 border-rose-500/30"
            : w === 100 ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
            : "bg-amber-500/10 text-amber-700 border-amber-500/30";
          return (
            <span key={c.type} className={`text-[11px] px-2 py-1 rounded-md border ${tone}`}>
              {c.label}: {t?.count ?? 0} صفوف · {w}%
            </span>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead className="bg-muted/30 text-xs">
            <tr className="text-start">
              <th className="px-3 py-2 font-medium text-start">اللجنة</th>
              <th className="px-3 py-2 font-medium text-start">المرحلة</th>
              <th className="px-3 py-2 font-medium text-start">معايير التقييم</th>
              <th className="px-3 py-2 font-medium text-start">أدوات القياس</th>
              <th className="px-3 py-2 font-medium text-start">الوزن %</th>
              <th className="px-3 py-2 font-medium text-start">البدء</th>
              <th className="px-3 py-2 font-medium text-start">الانتهاء</th>
              <th className="px-3 py-2 font-medium text-start">المسؤول</th>
              <th className="px-3 py-2 font-medium text-start">المخرج</th>
              <th className="px-3 py-2 font-medium text-start"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-muted-foreground">
                لا توجد صفوف. اضغط «صف جديد» للبدء.
              </td></tr>
            )}
            {filtered.map(r => (
              <tr key={r.id} className="align-top hover:bg-muted/10">
                <td className="px-3 py-2 min-w-[140px]">
                  <Select value={r.committee_type} onValueChange={(v) => updateRow(r.id, { committee_type: v as CommitteeType })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COMMITTEES.map(c => <SelectItem key={c.type} value={c.type}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2 min-w-[140px]">
                  <Select value={r.phase} onValueChange={(v) => updateRow(r.id, { phase: v as PmpPhase })}>
                    <SelectTrigger className={`h-8 text-xs border ${PHASE_TONE[r.phase]}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PHASE_LABELS) as PmpPhase[]).map(p => (
                        <SelectItem key={p} value={p}>{PHASE_LABELS[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2 min-w-[260px]">
                  <Textarea rows={2} className="text-xs" value={r.criteria}
                    onChange={(e) => updateRow(r.id, { criteria: e.target.value })}
                    placeholder="مثال: التزام بالخطة الزمنية، جودة المخرجات، التوثيق…" />
                </td>
                <td className="px-3 py-2 min-w-[200px]">
                  <Textarea rows={2} className="text-xs" value={r.tools}
                    onChange={(e) => updateRow(r.id, { tools: e.target.value })}
                    placeholder="قائمة تحقق · مقابلة · مراجعة وثائق · استبيان" />
                </td>
                <td className="px-3 py-2 w-[80px]">
                  <Input type="number" min={0} max={100} className="h-8 text-xs" value={r.weight}
                    onChange={(e) => updateRow(r.id, { weight: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
                </td>
                <td className="px-3 py-2 w-[140px]">
                  <Input type="date" className="h-8 text-xs" value={r.start_date}
                    onChange={(e) => updateRow(r.id, { start_date: e.target.value })} />
                </td>
                <td className="px-3 py-2 w-[140px]">
                  <Input type="date" className="h-8 text-xs" value={r.end_date}
                    onChange={(e) => updateRow(r.id, { end_date: e.target.value })} />
                </td>
                <td className="px-3 py-2 min-w-[140px]">
                  <Input className="h-8 text-xs" value={r.responsible}
                    onChange={(e) => updateRow(r.id, { responsible: e.target.value })} placeholder="المسؤول" />
                </td>
                <td className="px-3 py-2 min-w-[160px]">
                  <Input className="h-8 text-xs" value={r.deliverable}
                    onChange={(e) => updateRow(r.id, { deliverable: e.target.value })} placeholder="تقرير تقييم" />
                </td>
                <td className="px-3 py-2">
                  <Button size="sm" variant="ghost" className="h-8 text-rose-600 hover:bg-rose-500/10"
                    onClick={() => removeRow(r.id)} aria-label="حذف الصف">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 border-t bg-muted/10 text-[11px] text-muted-foreground flex items-center gap-2">
        <CalendarRange className="h-3.5 w-3.5" />
        تنبيه: مجموع الأوزان لكل لجنة يجب ألا يتجاوز 100%. يتم التحقق عند الحفظ.
      </div>
    </section>
  );
}

// ===== Print HTML builder =====
function buildHTML(rows: EvalRow[]): string {
  const grouped = new Map<CommitteeType, EvalRow[]>();
  rows.forEach(r => {
    const arr = grouped.get(r.committee_type) ?? [];
    arr.push(r); grouped.set(r.committee_type, arr);
  });

  const sections = COMMITTEES
    .filter(c => grouped.has(c.type))
    .map(c => {
      const items = grouped.get(c.type)!;
      const totalW = items.reduce((s, r) => s + (Number(r.weight) || 0), 0);
      const tbody = items.map(r => `
        <tr>
          <td><span class="phase">${escapeHtml(PHASE_LABELS[r.phase])}</span></td>
          <td>${escapeHtml(r.criteria) || "—"}</td>
          <td>${escapeHtml(r.tools) || "—"}</td>
          <td class="num">${Number(r.weight) || 0}%</td>
          <td class="num">${escapeHtml(fmtDate(r.start_date))}</td>
          <td class="num">${escapeHtml(fmtDate(r.end_date))}</td>
          <td>${escapeHtml(r.responsible) || "—"}</td>
          <td>${escapeHtml(r.deliverable) || "—"}</td>
        </tr>`).join("");
      return `
        <section class="committee">
          <header class="ch">
            <h3>${escapeHtml(c.label)}</h3>
            <span class="meta">${items.length} صفوف · مجموع الأوزان: ${totalW}%</span>
          </header>
          <table>
            <thead><tr>
              <th>المرحلة</th><th>معايير التقييم</th><th>أدوات القياس</th>
              <th>الوزن</th><th>البدء</th><th>الانتهاء</th><th>المسؤول</th><th>المخرج</th>
            </tr></thead>
            <tbody>${tbody}</tbody>
          </table>
        </section>`;
    }).join("");

  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
<title>خطة تقييم اللجان — المرحلة الأولى</title>
<style>
  *{box-sizing:border-box} body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f7f8fb;color:#0f172a;margin:0;padding:24px}
  .wrap{max-width:1100px;margin:0 auto;background:#fff;border-radius:14px;padding:28px;box-shadow:0 4px 20px rgba(0,0,0,.06)}
  .top{display:flex;align-items:center;gap:14px;border-bottom:1px solid #e5e7eb;padding-bottom:14px;margin-bottom:18px}
  .top .logo{width:56px;height:56px}
  h1{margin:0;font-size:20px} .sub{color:#64748b;font-size:12px;margin-top:2px}
  .committee{margin:18px 0;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden}
  .ch{display:flex;justify-content:space-between;align-items:center;background:#f1f5f9;padding:10px 14px}
  .ch h3{margin:0;font-size:14px} .ch .meta{font-size:11px;color:#475569}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{padding:8px 10px;border-bottom:1px solid #eef2f7;text-align:right;vertical-align:top}
  th{background:#fafafa;font-weight:600;color:#334155}
  td.num{white-space:nowrap;color:#0f172a}
  .phase{display:inline-block;padding:2px 8px;border-radius:6px;background:#eef2ff;color:#3730a3;font-size:11px;font-weight:600}
  .footer{margin-top:18px;font-size:11px;color:#64748b;text-align:center;border-top:1px dashed #e5e7eb;padding-top:10px}
  @media print{body{background:#fff;padding:0}.wrap{box-shadow:none;border-radius:0;padding:14px}}
</style></head><body><div class="wrap">
  <div class="top">
    <div class="logo">${BRAND_LOGO_SVG}</div>
    <div>
      <h1>خطة تقييم اللجان — المرحلة الأولى</h1>
      <div class="sub">إعداد: لجنة الجودة · تاريخ التصدير: ${new Date().toLocaleDateString("ar-SA")}</div>
    </div>
  </div>
  ${sections || '<p style="text-align:center;color:#64748b">لا توجد بيانات</p>'}
  <div class="footer">منصة لجنة الزواج الجماعي · مستند داخلي</div>
</div></body></html>`;
}