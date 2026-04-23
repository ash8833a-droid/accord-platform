import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ClipboardList, Save, FileSpreadsheet, Printer, Plus, Trash2, Loader2,
  CheckCircle2, XCircle, Stamp, CalendarDays, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { COMMITTEES, type CommitteeType } from "@/lib/committees";
import { useAuth } from "@/lib/auth";
import { BRAND_LOGO_SVG } from "@/assets/brand-logo";

interface EvalRow {
  id: string;
  committee_type: CommitteeType;
  task: string;            // المهمة
  done: boolean;           // تمت / لم تتم
  notes: string;
}

const SETTING_KEY = "quality.evaluation_plan";

const newRow = (committee_type: CommitteeType): EvalRow => ({
  id: (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
  committee_type,
  task: "",
  done: false,
  notes: "",
});

function defaultPlan(): EvalRow[] {
  return COMMITTEES.map((c) => newRow(c.type));
}

function escapeHtml(s: string) {
  return (s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" } as Record<string,string>)[c]!);
}

/** Returns next Saturday (or today if Saturday) — weekly issue date label. */
function nextSaturday(): Date {
  const d = new Date();
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = (6 - day + 7) % 7; // days until Saturday
  d.setDate(d.getDate() + diff);
  return d;
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
      // Migrate legacy rows (with phase/criteria/...) into new shape
      const raw = Array.isArray(v?.rows) && v!.rows.length > 0 ? v!.rows : defaultPlan();
      const migrated: EvalRow[] = (raw as any[]).map((r) => ({
        id: r.id ?? (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
        committee_type: r.committee_type,
        task: r.task ?? r.criteria ?? "",
        done: typeof r.done === "boolean" ? r.done : false,
        notes: r.notes ?? "",
      }));
      setRows(migrated);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(
    () => filterCommittee === "all" ? rows : rows.filter(r => r.committee_type === filterCommittee),
    [rows, filterCommittee]
  );

  const statsByCommittee = useMemo(() => {
    const m = new Map<CommitteeType, { count: number; done: number }>();
    rows.forEach(r => {
      const cur = m.get(r.committee_type) ?? { count: 0, done: 0 };
      cur.count += 1; if (r.done) cur.done += 1;
      m.set(r.committee_type, cur);
    });
    return m;
  }, [rows]);

  const overall = useMemo(() => {
    const total = rows.length;
    const done = rows.filter(r => r.done).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, done, pending: total - done, pct };
  }, [rows]);

  const updateRow = (id: string, patch: Partial<EvalRow>) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));

  const removeRow = (id: string) => setRows(prev => prev.filter(r => r.id !== id));

  const addRow = (committee_type?: CommitteeType) => {
    const ct = committee_type ?? (filterCommittee === "all" ? COMMITTEES[0].type : filterCommittee);
    setRows(prev => [...prev, newRow(ct)]);
  };

  const save = async () => {
    setSaving(true);
    try {
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
      "المهمة": r.task,
      "الحالة": r.done ? "تمت ✓" : "لم تتم ✗",
      "ملاحظات": r.notes,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 22 }, { wch: 44 }, { wch: 12 }, { wch: 28 },
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
      <div className="px-5 py-4 border-b bg-gradient-to-l from-primary/10 via-gold/5 to-transparent flex flex-wrap items-center gap-3">
        <span className="h-11 w-11 rounded-xl bg-gradient-hero text-primary-foreground flex items-center justify-center shadow-elegant">
          <ClipboardList className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-[200px]">
          <h2 className="text-base font-bold flex items-center gap-2">
            جدول تقييم اللجان ومتابعتها
            <Badge variant="outline" className="text-[10px] border-gold/40 text-gold">لجنة الجودة</Badge>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            متابعة مهام اللجان مع تواريخ البدء والانتهاء وحالة الإنجاز — صدّر أو اطبع التقرير المعتمد.
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

      {/* KPI strip */}
      <div className="px-5 py-3 border-b grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="rounded-lg border bg-muted/20 px-3 py-2">
          <div className="text-[10px] text-muted-foreground">إجمالي المهام</div>
          <div className="text-lg font-bold">{overall.total}</div>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
          <div className="text-[10px] text-emerald-700 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> تمت</div>
          <div className="text-lg font-bold text-emerald-700">{overall.done}</div>
        </div>
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2">
          <div className="text-[10px] text-rose-700 flex items-center gap-1"><XCircle className="h-3 w-3" /> لم تتم</div>
          <div className="text-lg font-bold text-rose-700">{overall.pending}</div>
        </div>
        <div className="rounded-lg border border-gold/40 bg-gold/5 px-3 py-2">
          <div className="text-[10px] text-gold">نسبة الإنجاز</div>
          <div className="text-lg font-bold text-gold">{overall.pct}%</div>
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
          <Button size="sm" variant="outline" onClick={() => addRow()}>
            <Plus className="h-4 w-4 ms-1" /> صف جديد
          </Button>
        </div>
      </div>

      {/* Summary chips */}
      <div className="px-5 py-3 border-b flex flex-wrap gap-2">
        {COMMITTEES.map(c => {
          const t = statsByCommittee.get(c.type);
          const count = t?.count ?? 0;
          const done = t?.done ?? 0;
          const Icon = c.icon;
          const tone = count === 0 ? "bg-muted text-muted-foreground border-border"
            : done === count ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
            : done === 0 ? "bg-rose-500/10 text-rose-700 border-rose-500/30"
            : "bg-amber-500/10 text-amber-700 border-amber-500/30";
          return (
            <span key={c.type} className={`text-[11px] px-2 py-1 rounded-md border inline-flex items-center gap-1.5 ${tone}`}>
              <Icon className="h-3.5 w-3.5" />
              {c.label}: {done}/{count}
            </span>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-gradient-to-l from-primary/5 to-gold/5 text-xs border-b-2 border-gold/30">
            <tr className="text-start">
              <th className="px-3 py-3 font-bold text-start w-12">#</th>
              <th className="px-3 py-3 font-bold text-start">اللجنة</th>
              <th className="px-3 py-3 font-bold text-start">المهمة</th>
              <th className="px-3 py-3 font-bold text-center w-[110px]">الحالة</th>
              <th className="px-3 py-3 font-bold text-start w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                لا توجد صفوف. اضغط «صف جديد» للبدء.
              </td></tr>
            )}
            {filtered.map((r, idx) => {
              const meta = COMMITTEES.find(c => c.type === r.committee_type);
              const Icon = meta?.icon ?? ClipboardList;
              return (
                <tr key={r.id} className={`align-middle hover:bg-muted/10 transition-colors ${r.done ? "bg-emerald-500/[0.03]" : ""}`}>
                  <td className="px-3 py-2 text-xs text-muted-foreground font-medium">{idx + 1}</td>
                  <td className="px-3 py-2 min-w-[160px]">
                    <div className="flex items-center gap-2">
                      <span className={`h-7 w-7 rounded-md flex items-center justify-center ${meta?.tone ?? "bg-muted"}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <Select value={r.committee_type} onValueChange={(v) => updateRow(r.id, { committee_type: v as CommitteeType })}>
                        <SelectTrigger className="h-8 text-xs border-0 bg-transparent shadow-none px-1 hover:bg-muted/50"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COMMITTEES.map(c => <SelectItem key={c.type} value={c.type}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </td>
                  <td className="px-3 py-2 min-w-[260px]">
                    <Input className="h-9 text-xs" value={r.task}
                      onChange={(e) => updateRow(r.id, { task: e.target.value })}
                      placeholder="مثال: مراجعة الخطة الزمنية للجنة الإعلام" />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => updateRow(r.id, { done: !r.done })}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                        r.done
                          ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/40 hover:bg-emerald-500/25"
                          : "bg-rose-500/15 text-rose-700 border-rose-500/40 hover:bg-rose-500/25"
                      }`}
                      aria-label={r.done ? "تمت" : "لم تتم"}
                    >
                      {r.done ? <><CheckCircle2 className="h-4 w-4" /> تمت</> : <><XCircle className="h-4 w-4" /> لم تتم</>}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-500/10"
                      onClick={() => removeRow(r.id)} aria-label="حذف الصف">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Quality stamp footer */}
      <div className="px-5 py-5 border-t bg-gradient-to-l from-gold/5 via-transparent to-primary/5 flex flex-wrap items-center justify-between gap-4">
        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5" />
          آخر تحديث: {new Date().toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" })}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-end">
            <div className="text-[10px] text-muted-foreground">معتمد من</div>
            <div className="text-xs font-bold text-foreground">لجنة الجودة</div>
          </div>
          <div className="relative h-16 w-16 rounded-full border-2 border-gold/60 bg-gold/5 flex items-center justify-center rotate-[-8deg] shadow-elegant">
            <div className="absolute inset-1 rounded-full border border-dashed border-gold/40" />
            <Stamp className="h-6 w-6 text-gold" />
          </div>
        </div>
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

  const totalCount = rows.length;
  const doneCount = rows.filter(r => r.done).length;
  const pendingCount = totalCount - doneCount;
  const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  const sections = COMMITTEES
    .filter(c => grouped.has(c.type))
    .map(c => {
      const items = grouped.get(c.type)!;
      const cDone = items.filter(r => r.done).length;
      const tbody = items.map(r => `
        <tr class="${r.done ? 'row-done' : 'row-pending'}">
          <td>${escapeHtml(r.task) || "—"}</td>
          <td class="status">${r.done
            ? '<span class="badge done">✓ تمت</span>'
            : '<span class="badge pending">✗ لم تتم</span>'}</td>
        </tr>`).join("");
      return `
        <section class="committee">
          <header class="ch">
            <h3>${escapeHtml(c.label)}</h3>
            <span class="meta">${cDone} من ${items.length} منجزة</span>
          </header>
          <table>
            <thead><tr>
              <th style="width:75%">المهمة</th>
              <th style="width:25%">الحالة</th>
            </tr></thead>
            <tbody>${tbody}</tbody>
          </table>
        </section>`;
    }).join("");

  const printDate = new Date().toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const printTime = new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });

  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
<title>تقرير تقييم ومتابعة اللجان</title>
<style>
  *{box-sizing:border-box}
  body{font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif;background:#f7f8fb;color:#0f172a;margin:0;padding:24px}
  .wrap{max-width:1100px;margin:0 auto;background:#fff;border-radius:14px;padding:32px;box-shadow:0 4px 20px rgba(0,0,0,.06);position:relative;overflow:hidden}
  .wrap::before{content:'';position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(90deg,#C4A25C,#2A7E8B,#C4A25C)}
  .top{display:flex;align-items:center;gap:16px;border-bottom:2px solid #C4A25C;padding-bottom:16px;margin-bottom:20px}
  .top .logo{width:64px;height:64px;flex-shrink:0}
  .top h1{margin:0;font-size:22px;color:#0E3A42;font-weight:700}
  .top .sub{color:#64748b;font-size:12px;margin-top:4px}
  .top .org{margin-inline-start:auto;text-align:end;font-size:11px;color:#64748b}
  .top .org strong{display:block;color:#0E3A42;font-size:13px}

  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
  .kpi{border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;background:#fafafa}
  .kpi .l{font-size:10px;color:#64748b}
  .kpi .v{font-size:18px;font-weight:700;color:#0E3A42;margin-top:2px}
  .kpi.done{border-color:#86efac;background:#f0fdf4} .kpi.done .v{color:#15803d}
  .kpi.pending{border-color:#fca5a5;background:#fef2f2} .kpi.pending .v{color:#b91c1c}
  .kpi.gold{border-color:#C4A25C;background:#fdf8eb} .kpi.gold .v{color:#8C6E2E}

  .committee{margin:18px 0;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;page-break-inside:avoid}
  .ch{display:flex;justify-content:space-between;align-items:center;background:linear-gradient(90deg,#fdf8eb,#f1f5f9);padding:10px 14px;border-bottom:1px solid #e5e7eb}
  .ch h3{margin:0;font-size:14px;color:#0E3A42;font-weight:700}
  .ch .meta{font-size:11px;color:#475569;background:#fff;padding:2px 8px;border-radius:6px;border:1px solid #e5e7eb}

  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{padding:9px 10px;border-bottom:1px solid #eef2f7;text-align:right;vertical-align:middle}
  th{background:#fafafa;font-weight:700;color:#0E3A42;font-size:11px}
  td.num{white-space:nowrap;color:#334155}
  td.status{text-align:center}

  .row-done{background:#f0fdf4} .row-pending{background:#fff}
  .badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid}
  .badge.done{background:#dcfce7;color:#15803d;border-color:#86efac}
  .badge.pending{background:#fee2e2;color:#b91c1c;border-color:#fca5a5}

  .footer{margin-top:24px;display:flex;justify-content:space-between;align-items:flex-end;gap:20px;border-top:1px dashed #C4A25C;padding-top:16px}
  .meta-foot{font-size:11px;color:#64748b;line-height:1.7}
  .meta-foot strong{color:#0E3A42}
  .stamp{position:relative;width:120px;height:120px;border:3px double #8C6E2E;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(-8deg);background:rgba(196,162,92,0.06);text-align:center;flex-shrink:0}
  .stamp::before{content:'';position:absolute;inset:5px;border:1px dashed #8C6E2E;border-radius:50%}
  .stamp .t1{font-size:10px;color:#8C6E2E;font-weight:700;letter-spacing:1px}
  .stamp .t2{font-size:14px;color:#8C6E2E;font-weight:800;margin-top:2px}
  .stamp .t3{font-size:9px;color:#8C6E2E;margin-top:4px;opacity:.8}
  .sig{font-size:11px;color:#64748b;text-align:center}
  .sig .line{width:160px;border-bottom:1px solid #94a3b8;margin:0 auto 4px}

  @media print{
    body{background:#fff;padding:0}
    .wrap{box-shadow:none;border-radius:0;padding:18px}
    .committee{page-break-inside:avoid}
  }
</style></head><body><div class="wrap">
  <div class="top">
    <div class="logo">${BRAND_LOGO_SVG}</div>
    <div>
      <h1>تقرير تقييم ومتابعة اللجان</h1>
      <div class="sub">إعداد: لجنة الجودة — لجنة الزواج الجماعي</div>
    </div>
    <div class="org">
      <strong>تاريخ الطباعة</strong>
      ${escapeHtml(printDate)}
      <br/>الساعة ${escapeHtml(printTime)}
    </div>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="l">إجمالي المهام</div><div class="v">${totalCount}</div></div>
    <div class="kpi done"><div class="l">✓ تمت</div><div class="v">${doneCount}</div></div>
    <div class="kpi pending"><div class="l">✗ لم تتم</div><div class="v">${pendingCount}</div></div>
    <div class="kpi gold"><div class="l">نسبة الإنجاز</div><div class="v">${pct}%</div></div>
  </div>

  ${sections || '<p style="text-align:center;color:#64748b">لا توجد بيانات</p>'}

  <div class="footer">
    <div class="meta-foot">
      <strong>ملاحظات:</strong><br/>
      • هذا التقرير معتمد من لجنة الجودة ويعكس حالة المتابعة وقت الطباعة.<br/>
      • العلامة <span class="badge done">✓ تمت</span> تعني إنجاز المهمة، و <span class="badge pending">✗ لم تتم</span> تعني عدم الإنجاز.<br/>
      • مستند داخلي — منصة لجنة الزواج الجماعي.
    </div>
    <div style="display:flex;align-items:flex-end;gap:24px">
      <div class="sig">
        <div class="line"></div>
        رئيس لجنة الجودة
      </div>
      <div class="stamp">
        <div class="t1">QUALITY</div>
        <div class="t2">لجنة الجودة</div>
        <div class="t3">معتمد ✓</div>
      </div>
    </div>
  </div>
</div></body></html>`;
}