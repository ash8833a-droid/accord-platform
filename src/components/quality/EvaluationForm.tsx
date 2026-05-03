import { useMemo, useState } from "react";
import { COMMITTEES, committeeByType, type CommitteeType } from "@/lib/committees";
import {
  EVALUATION_CRITERIA,
  PRIORITY_LABELS,
  PRIORITY_TONE,
  SCORE_SCALE,
  type EvaluationCriterion,
} from "@/lib/evaluation-criteria";
import { PHASE_LABELS } from "@/lib/pmp-tasks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  ClipboardCheck,
  Printer,
  FileSpreadsheet,
  RotateCcw,
  Trophy,
  TrendingUp,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type ScoreMap = Record<string, number>; // code -> 0..5

const sortByPriority = (rows: EvaluationCriterion[]) =>
  [...rows].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2 } as const;
    if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority];
    return b.weight - a.weight;
  });

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}

function gradeFromPct(pct: number) {
  if (pct >= 95) return { label: "ممتاز", tone: "text-emerald-600", bg: "bg-emerald-500/15" };
  if (pct >= 80) return { label: "جيد جداً", tone: "text-sky-600", bg: "bg-sky-500/15" };
  if (pct >= 65) return { label: "جيد", tone: "text-amber-600", bg: "bg-amber-500/15" };
  if (pct >= 50) return { label: "مقبول", tone: "text-orange-600", bg: "bg-orange-500/15" };
  return { label: "ضعيف", tone: "text-rose-600", bg: "bg-rose-500/15" };
}

export function EvaluationForm() {
  const { user, profile } = useAuth();
  const [active, setActive] = useState<CommitteeType>("supreme");
  const [scores, setScores] = useState<Record<CommitteeType, ScoreMap>>(() =>
    Object.fromEntries(COMMITTEES.map((c) => [c.type, {}])) as Record<CommitteeType, ScoreMap>,
  );
  const [notesMap, setNotesMap] = useState<Record<CommitteeType, Record<string, string>>>(() =>
    Object.fromEntries(COMMITTEES.map((c) => [c.type, {}])) as Record<CommitteeType, Record<string, string>>,
  );
  const [evaluator, setEvaluator] = useState("");
  const [generalNote, setGeneralNote] = useState("");
  const [saving, setSaving] = useState(false);

  const meta = committeeByType(active)!;
  const Icon = meta.icon;
  const rows = useMemo(() => sortByPriority(EVALUATION_CRITERIA[active]), [active]);
  const currentScores = scores[active] ?? {};
  const currentNotes = notesMap[active] ?? {};

  const stats = useMemo(() => {
    let weightedSum = 0;
    let totalWeight = 0;
    let answered = 0;
    rows.forEach((r) => {
      totalWeight += r.weight;
      if (currentScores[r.code] !== undefined) {
        weightedSum += currentScores[r.code] * r.weight;
        answered++;
      }
    });
    const maxPossible = totalWeight * 5;
    const pct = maxPossible ? (weightedSum / maxPossible) * 100 : 0;
    const finalScore = totalWeight ? weightedSum / 5 : 0; // 0..100 scale
    return {
      answered,
      total: rows.length,
      pct,
      finalScore,
      complete: answered === rows.length,
      totalWeight,
    };
  }, [rows, currentScores]);

  const grade = gradeFromPct(stats.pct);

  const saveEvaluation = async (silent = false) => {
    if (stats.answered === 0) return;
    setSaving(true);
    const evaluatorName = evaluator.trim() || profile?.full_name || "مُقيِّم";
    const { error } = await supabase.from("committee_evaluations").insert({
      committee_type: active,
      evaluator_id: user?.id ?? null,
      evaluator_name: evaluatorName,
      scores: currentScores,
      notes: currentNotes,
      general_note: generalNote || null,
      final_score: Number(stats.finalScore.toFixed(2)),
      percentage: Number(stats.pct.toFixed(2)),
      grade: grade.label,
      total_weight: stats.totalWeight,
      answered_count: stats.answered,
      total_count: stats.total,
      is_complete: stats.complete,
    });
    setSaving(false);
    if (error) {
      toast.error("تعذر حفظ التقييم", { description: error.message });
      return false;
    }
    if (!silent) toast.success("تم حفظ التقييم وربطه بصفحة التقارير والجودة");
    return true;
  };

  const setScore = (code: string, val: number) => {
    setScores((prev) => ({ ...prev, [active]: { ...(prev[active] ?? {}), [code]: val } }));
  };
  const setNote = (code: string, val: string) => {
    setNotesMap((prev) => ({ ...prev, [active]: { ...(prev[active] ?? {}), [code]: val } }));
  };

  const resetCurrent = () => {
    setScores((prev) => ({ ...prev, [active]: {} }));
    setNotesMap((prev) => ({ ...prev, [active]: {} }));
    toast.success("تم تفريغ التقييم لهذه اللجنة");
  };

  const fillExcellent = () => {
    setScores((prev) => ({
      ...prev,
      [active]: Object.fromEntries(rows.map((r) => [r.code, 5])),
    }));
  };

  const exportXLSX = () => {
    const wb = XLSX.utils.book_new();
    const data = rows.map((r, i) => {
      const sc = currentScores[r.code] ?? 0;
      const weighted = (sc * r.weight) / 5;
      return {
        "#": i + 1,
        "الرمز": r.code,
        "البند": r.title,
        "الوصف": r.description,
        "الأولوية": PRIORITY_LABELS[r.priority],
        "المرحلة": PHASE_LABELS[r.phase],
        "الوزن (%)": r.weight,
        "التقييم (0-5)": sc,
        "النقاط المحسوبة": Number(weighted.toFixed(2)),
        "ملاحظات": currentNotes[r.code] ?? "",
      };
    });
    data.push({
      "#": "" as any,
      "الرمز": "" as any,
      "البند": "الإجمالي" as any,
      "الوصف": "" as any,
      "الأولوية": "" as any,
      "المرحلة": "" as any,
      "الوزن (%)": stats.totalWeight,
      "التقييم (0-5)": "" as any,
      "النقاط المحسوبة": Number(stats.finalScore.toFixed(2)),
      "ملاحظات": `النسبة: ${stats.pct.toFixed(1)}% — ${grade.label}`,
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 4 }, { wch: 8 }, { wch: 36 }, { wch: 50 }, { wch: 10 },
      { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, meta.label.slice(0, 28));

    // Summary sheet
    const summary = [
      { "البند": "اللجنة", "القيمة": meta.label },
      { "البند": "المُقيِّم", "القيمة": evaluator || "—" },
      { "البند": "تاريخ التقييم", "القيمة": new Date().toLocaleString("ar-SA-u-ca-gregory") },
      { "البند": "عدد البنود", "القيمة": stats.total },
      { "البند": "البنود المُقيّمة", "القيمة": stats.answered },
      { "البند": "إجمالي الأوزان", "القيمة": stats.totalWeight + "%" },
      { "البند": "النتيجة (من 100)", "القيمة": stats.finalScore.toFixed(2) },
      { "البند": "النسبة المئوية", "القيمة": stats.pct.toFixed(1) + "%" },
      { "البند": "التقدير", "القيمة": grade.label },
      { "البند": "ملاحظات عامة", "القيمة": generalNote || "—" },
    ];
    const wsSum = XLSX.utils.json_to_sheet(summary);
    wsSum["!cols"] = [{ wch: 22 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, wsSum, "ملخص");

    XLSX.writeFile(wb, `تقييم-${meta.label}.xlsx`);
    toast.success("تم تصدير التقييم");
  };

  const printReport = () => {
    const w = window.open("", "_blank", "width=1100,height=800");
    if (!w) return;
    const date = new Date().toLocaleString("ar-SA-u-ca-gregory");
    const tableRows = rows
      .map((r, i) => {
        const sc = currentScores[r.code] ?? 0;
        const weighted = ((sc * r.weight) / 5).toFixed(2);
        const note = currentNotes[r.code] ?? "";
        return `<tr class="${r.priority}">
          <td>${i + 1}</td>
          <td><b>${r.code}</b></td>
          <td>
            <div><b>${escapeHtml(r.title)}</b></div>
            <div class="desc">${escapeHtml(r.description)}</div>
            ${note ? `<div class="note">📝 ${escapeHtml(note)}</div>` : ""}
          </td>
          <td style="text-align:center">${PRIORITY_LABELS[r.priority]}</td>
          <td style="text-align:center">${r.weight}%</td>
          <td style="text-align:center"><b>${sc}</b> / 5</td>
          <td style="text-align:center"><b>${weighted}</b></td>
        </tr>`;
      })
      .join("");

    w.document.write(`<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
<title>تقرير تقييم — ${escapeHtml(meta.label)}</title>
<style>
  *{box-sizing:border-box} body{font-family:'Segoe UI',Tahoma,sans-serif;margin:24px;color:#1a1a1a}
  header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #B8860B;padding-bottom:12px;margin-bottom:18px}
  h1{margin:0;color:#0E3A42;font-size:22px}
  h2{color:#0E3A42;font-size:16px;margin:18px 0 8px}
  .meta{font-size:12px;color:#555}
  .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}
  .kpi{border:1px solid #E5E5E5;border-radius:8px;padding:10px;background:#FAF6EE}
  .kpi .lbl{font-size:11px;color:#666}
  .kpi .val{font-size:20px;font-weight:700;color:#0E3A42;margin-top:4px}
  .grade{font-size:14px;color:#fff;background:linear-gradient(90deg,#0E3A42,#1B5560);padding:6px 14px;border-radius:20px;display:inline-block}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
  th{background:#F4F0E6;color:#0E3A42;padding:8px 6px;border:1px solid #DDD;text-align:right}
  td{padding:8px 6px;border:1px solid #DDD;vertical-align:top}
  .desc{color:#666;font-size:11px;margin-top:2px}
  .note{color:#0E3A42;font-size:11px;margin-top:4px;background:#F4F0E6;padding:4px 6px;border-radius:4px}
  tr.critical{background:#FEF1F1}
  tr.high{background:#FFF8EC}
  .info-box{background:#FAF6EE;border:1px solid #E8DAB6;border-radius:8px;padding:10px 14px;margin:10px 0;font-size:12px}
  footer{margin-top:30px;border-top:2px solid #B8860B;padding-top:14px;display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#555}
  .stamp{border:2px dashed #0E3A42;color:#0E3A42;padding:14px 26px;border-radius:50%;font-weight:700;text-align:center;line-height:1.3}
</style></head>
<body>
  <header>
    <div>
      <h1>تقرير تقييم اللجنة</h1>
      <div class="meta">${escapeHtml(meta.label)} · لجان الزواج الجماعي الثاني عشر</div>
    </div>
    <div class="meta">${escapeHtml(date)}</div>
  </header>

  <div class="info-box">
    <b>المُقيِّم:</b> ${escapeHtml(evaluator || "—")}
    &nbsp;•&nbsp; <b>عدد البنود:</b> ${stats.total}
    &nbsp;•&nbsp; <b>المُقيّم:</b> ${stats.answered}
    ${generalNote ? `<div style="margin-top:6px"><b>ملاحظات عامة:</b> ${escapeHtml(generalNote)}</div>` : ""}
  </div>

  <div class="summary">
    <div class="kpi"><div class="lbl">النتيجة (من 100)</div><div class="val">${stats.finalScore.toFixed(2)}</div></div>
    <div class="kpi"><div class="lbl">النسبة المئوية</div><div class="val">${stats.pct.toFixed(1)}%</div></div>
    <div class="kpi"><div class="lbl">إجمالي الأوزان</div><div class="val">${stats.totalWeight}%</div></div>
    <div class="kpi"><div class="lbl">التقدير</div><div class="val"><span class="grade">${grade.label}</span></div></div>
  </div>

  <h2>تفاصيل التقييم</h2>
  <table>
    <thead>
      <tr>
        <th style="width:36px">#</th>
        <th style="width:60px">الرمز</th>
        <th>البند والوصف</th>
        <th style="width:80px">الأولوية</th>
        <th style="width:60px">الوزن</th>
        <th style="width:70px">التقييم</th>
        <th style="width:80px">النقاط</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
    <tfoot>
      <tr style="background:#F4F0E6;font-weight:700">
        <td colspan="4" style="text-align:center">الإجمالي</td>
        <td style="text-align:center">${stats.totalWeight}%</td>
        <td></td>
        <td style="text-align:center">${stats.finalScore.toFixed(2)} / 100</td>
      </tr>
    </tfoot>
  </table>

  <footer>
    <div>
      <div>المعادلة: Σ (التقييم × الوزن) ÷ 5</div>
      <div style="margin-top:4px">توقيع المُقيِّم: ${escapeHtml(evaluator || "............................")}</div>
    </div>
    <div class="stamp">ختم<br/>لجنة الجودة</div>
  </footer>

  <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body></html>`);
    w.document.close();
  };

  return (
    <Card className="border-primary/20 shadow-elegant">
      <CardHeader className="border-b bg-gradient-to-l from-primary/5 to-transparent">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <ClipboardCheck className="size-6" />
            </div>
            <div>
              <CardTitle className="text-lg">نموذج التقييم التلقائي للجان</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                قيّم كل بند بدرجة من 0 إلى 5 — تُحسب النتيجة فوراً وتُتاح أزرار التصدير عند الاكتمال
              </p>
            </div>
          </div>
        </div>

        {/* Committee selector + evaluator */}
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <Label className="text-xs">اللجنة المُقيَّمة</Label>
            <Select value={active} onValueChange={(v) => setActive(v as CommitteeType)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMITTEES.map((c) => (
                  <SelectItem key={c.type} value={c.type}>
                    {c.label} ({EVALUATION_CRITERIA[c.type].length} بنود)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">اسم المُقيِّم</Label>
            <Input
              className="mt-1"
              placeholder="اكتب اسمك الكامل"
              value={evaluator}
              onChange={(e) => setEvaluator(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">ملاحظات عامة (اختياري)</Label>
            <Input
              className="mt-1"
              placeholder="ملاحظات إضافية حول التقييم"
              value={generalNote}
              onChange={(e) => setGeneralNote(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 md:p-5 space-y-4">
        {/* Live KPI bar */}
        <div className="rounded-xl border bg-gradient-to-l from-primary/5 to-transparent p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Icon className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold">{meta.label}</h3>
                <p className="text-xs text-muted-foreground">
                  {stats.answered} / {stats.total} بنود مُقيَّمة
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={fillExcellent} title="ملء سريع: ممتاز">
                <Sparkles className="ml-1 size-4" /> ملء سريع
              </Button>
              <Button variant="outline" size="sm" onClick={resetCurrent}>
                <RotateCcw className="ml-1 size-4" /> تفريغ
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI
              icon={<TrendingUp className="size-4" />}
              label="النتيجة (من 100)"
              value={stats.finalScore.toFixed(1)}
            />
            <KPI
              icon={<CheckCircle2 className="size-4" />}
              label="النسبة المئوية"
              value={`${stats.pct.toFixed(1)}%`}
            />
            <KPI
              icon={<ClipboardCheck className="size-4" />}
              label="نسبة الإكمال"
              value={`${Math.round((stats.answered / Math.max(stats.total, 1)) * 100)}%`}
            />
            <div className={`rounded-lg border p-2.5 ${grade.bg}`}>
              <div className="flex items-center gap-2 text-[11px] opacity-80">
                <Trophy className="size-4" />
                <span>التقدير</span>
              </div>
              <div className={`mt-1 text-lg font-bold ${grade.tone}`}>{grade.label}</div>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>التقدم</span>
              <span>
                {stats.answered}/{stats.total}
              </span>
            </div>
            <Progress value={(stats.answered / Math.max(stats.total, 1)) * 100} className="h-2" />
          </div>

          {/* Action buttons — only when complete */}
          {stats.complete ? (
            <div className="mt-4 rounded-lg border-2 border-emerald-500/30 bg-emerald-500/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="size-5" />
                  اكتمل التقييم — جاهز للتصدير والطباعة
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => saveEvaluation()} disabled={saving}>
                    {saving ? "جارٍ الحفظ…" : "حفظ في التقارير"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportXLSX}>
                    <FileSpreadsheet className="ml-1 size-4" /> تصدير Excel
                  </Button>
                  <Button
                    size="sm"
                    onClick={printReport}
                    className="bg-gradient-hero text-primary-foreground"
                  >
                    <Printer className="ml-1 size-4" /> طباعة التقرير
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
              قيّم جميع البنود ({stats.total - stats.answered} متبقي) لتفعيل أزرار التصدير والطباعة. يمكنك أيضاً
              تصدير التقييم الجزئي:
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" onClick={exportXLSX} disabled={stats.answered === 0}>
                  <FileSpreadsheet className="ml-1 size-3.5" /> تصدير جزئي
                </Button>
                <Button variant="ghost" size="sm" onClick={printReport} disabled={stats.answered === 0}>
                  <Printer className="ml-1 size-3.5" /> طباعة جزئية
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Score scale legend */}
        <div className="flex flex-wrap gap-2 text-[11px]">
          {SCORE_SCALE.map((s) => (
            <span
              key={s.value}
              className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-muted-foreground"
            >
              <b className="text-foreground">{s.value}</b> · {s.label}
            </span>
          ))}
        </div>

        {/* Criteria list */}
        <div className="space-y-3">
          {rows.map((r, i) => {
            const sc = currentScores[r.code];
            const answered = sc !== undefined;
            return (
              <div
                key={r.code}
                className={`rounded-lg border p-3 transition ${
                  answered
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "bg-card hover:border-primary/30"
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-primary/10 px-2 text-xs font-bold text-primary shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-primary">{r.code}</span>
                        <b className="text-sm">{r.title}</b>
                        <Badge variant="outline" className={`text-[10px] ${PRIORITY_TONE[r.priority]}`}>
                          {PRIORITY_LABELS[r.priority]}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {PHASE_LABELS[r.phase]}
                        </Badge>
                        <span className="text-[11px] font-bold text-shimmer-gold">{r.weight}%</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{r.description}</p>
                    </div>
                  </div>
                </div>

                {/* Score buttons */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {SCORE_SCALE.map((s) => {
                    const selected = sc === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setScore(r.code, s.value)}
                        title={s.desc}
                        className={`h-9 min-w-14 rounded-md border px-2 text-xs font-medium transition ${
                          selected
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "bg-card hover:border-primary/40 hover:bg-primary/5"
                        }`}
                      >
                        <div className="font-bold">{s.value}</div>
                        <div className="text-[9px] opacity-80">{s.label}</div>
                      </button>
                    );
                  })}
                  {answered && (
                    <span className="ms-auto text-xs text-muted-foreground">
                      نقاط:{" "}
                      <b className="text-foreground">{((sc * r.weight) / 5).toFixed(2)}</b> من{" "}
                      {r.weight}
                    </span>
                  )}
                </div>

                {/* Notes */}
                <Textarea
                  placeholder="ملاحظة على هذا البند (اختياري)"
                  value={currentNotes[r.code] ?? ""}
                  onChange={(e) => setNote(r.code, e.target.value)}
                  className="mt-2 text-xs min-h-[60px]"
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function KPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-2.5">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-lg font-bold text-foreground">{value}</div>
    </div>
  );
}
