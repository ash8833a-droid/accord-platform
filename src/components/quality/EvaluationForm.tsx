import { useEffect, useMemo, useState } from "react";
import { COMMITTEES, committeeByType, type CommitteeType } from "@/lib/committees";
import {
  EVALUATION_CRITERIA,
  PRIORITY_LABELS,
  PRIORITY_TONE,
  SCORE_SCALE,
  type EvaluationCriterion,
} from "@/lib/evaluation-criteria";
import { PHASE_LABELS } from "@/lib/pmp-tasks";
import type { PmpPhase } from "@/lib/pmp-tasks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  ClipboardCheck, Printer, FileSpreadsheet, RotateCcw, Trophy, CheckCircle2,
  ChevronRight, ChevronLeft, Save, FileText, ListChecks, Sparkles, Trash2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type ScoreMap = Record<string, number>;
type NotesMap = Record<string, string>;

const PHASE_ORDER: PmpPhase[] = ["initiating", "planning", "executing", "monitoring", "closing"];

function gradeFromPct(pct: number) {
  if (pct >= 95) return { label: "ممتاز", tone: "text-emerald-600", bg: "bg-emerald-500/15" };
  if (pct >= 80) return { label: "جيد جداً", tone: "text-sky-600", bg: "bg-sky-500/15" };
  if (pct >= 65) return { label: "جيد", tone: "text-amber-600", bg: "bg-amber-500/15" };
  if (pct >= 50) return { label: "مقبول", tone: "text-orange-600", bg: "bg-orange-500/15" };
  return { label: "ضعيف", tone: "text-rose-600", bg: "bg-rose-500/15" };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

const DRAFT_KEY = "quality:evaluation:draft:v2";

interface DraftShape {
  active: CommitteeType;
  evaluator: string;
  generalNote: string;
  scores: ScoreMap;
  notes: NotesMap;
  step: number;
  savedAt: string;
}

export function EvaluationForm() {
  const { user } = useAuth();
  const [active, setActive] = useState<CommitteeType>("supreme");
  const [evaluator, setEvaluator] = useState("");
  const [generalNote, setGeneralNote] = useState("");
  const [scores, setScores] = useState<ScoreMap>({});
  const [notes, setNotes] = useState<NotesMap>({});
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  // ===== Load draft on mount =====
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as DraftShape;
      setActive(d.active);
      setEvaluator(d.evaluator || "");
      setGeneralNote(d.generalNote || "");
      setScores(d.scores || {});
      setNotes(d.notes || {});
      setStep(d.step ?? 0);
      setDraftSavedAt(d.savedAt);
      toast.info("تم استرجاع المسودة المحفوظة");
    } catch { /* ignore */ }
  }, []);

  // ===== Auto-save draft =====
  useEffect(() => {
    const t = setTimeout(() => {
      const draft: DraftShape = {
        active, evaluator, generalNote, scores, notes, step,
        savedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        setDraftSavedAt(draft.savedAt);
      } catch { /* ignore */ }
    }, 800);
    return () => clearTimeout(t);
  }, [active, evaluator, generalNote, scores, notes, step]);

  const meta = committeeByType(active)!;
  const allRows = EVALUATION_CRITERIA[active];

  // Group criteria by PMP phase
  const phaseGroups = useMemo(() => {
    const map: Record<PmpPhase, EvaluationCriterion[]> = {
      initiating: [], planning: [], executing: [], monitoring: [], closing: [],
    };
    allRows.forEach((r) => map[r.phase].push(r));
    return PHASE_ORDER
      .filter((p) => map[p].length > 0)
      .map((p) => ({ phase: p, label: PHASE_LABELS[p], rows: map[p] }));
  }, [allRows]);

  // Wizard steps: 0 = setup, 1..N = phase steps, last = review
  const stepDefs = useMemo(() => {
    const arr: Array<{ key: string; title: string; icon: any }> = [
      { key: "setup", title: "البيانات الأساسية", icon: ClipboardCheck },
    ];
    phaseGroups.forEach((g) => arr.push({ key: g.phase, title: g.label, icon: ListChecks }));
    arr.push({ key: "review", title: "المراجعة والتصدير", icon: FileText });
    return arr;
  }, [phaseGroups]);

  const totalSteps = stepDefs.length;
  const currentDef = stepDefs[Math.min(step, totalSteps - 1)];
  const currentPhaseGroup = step >= 1 && step <= phaseGroups.length ? phaseGroups[step - 1] : null;

  // ===== Stats =====
  const stats = useMemo(() => {
    let weightedSum = 0, totalWeight = 0, answered = 0;
    allRows.forEach((r) => {
      totalWeight += r.weight;
      if (scores[r.code] !== undefined) {
        weightedSum += scores[r.code] * r.weight;
        answered++;
      }
    });
    const maxPossible = totalWeight * 5;
    const pct = maxPossible ? (weightedSum / maxPossible) * 100 : 0;
    const finalScore = totalWeight ? weightedSum / 5 : 0;
    return {
      answered, total: allRows.length, pct, finalScore, totalWeight,
      complete: answered === allRows.length,
    };
  }, [allRows, scores]);
  const grade = gradeFromPct(stats.pct);

  const phaseStats = (rows: EvaluationCriterion[]) => {
    const ans = rows.filter((r) => scores[r.code] !== undefined).length;
    return { answered: ans, total: rows.length, pct: rows.length ? (ans / rows.length) * 100 : 0 };
  };

  // ===== Actions =====
  const setScore = (code: string, val: number) => setScores((p) => ({ ...p, [code]: val }));
  const setNote = (code: string, val: string) => setNotes((p) => ({ ...p, [code]: val }));

  const resetAll = () => {
    if (!confirm("سيتم حذف كل التقييم والمسودة. متابعة؟")) return;
    setScores({}); setNotes({}); setGeneralNote(""); setStep(0);
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    toast.success("تم تفريغ النموذج");
  };

  const saveDraftNow = () => {
    const draft: DraftShape = {
      active, evaluator, generalNote, scores, notes, step,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    setDraftSavedAt(draft.savedAt);
    toast.success("تم حفظ المسودة محلياً");
  };

  const fillPhaseExcellent = () => {
    if (!currentPhaseGroup) return;
    setScores((p) => {
      const next = { ...p };
      currentPhaseGroup.rows.forEach((r) => { next[r.code] = 5; });
      return next;
    });
  };

  const submitEvaluation = async () => {
    if (stats.answered === 0) { toast.error("لم يتم تقييم أي بند"); return; }
    setSaving(true);
    const evaluatorName = evaluator.trim() || user?.user_metadata?.full_name || "مُقيِّم";
    const { error } = await supabase.from("committee_evaluations").insert({
      committee_type: active,
      evaluator_id: user?.id ?? null,
      evaluator_name: evaluatorName,
      scores, notes,
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
    if (error) { toast.error("تعذر الحفظ", { description: error.message }); return; }
    toast.success("تم إرسال التقييم وحفظه في التقارير");
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  };

  // ===== Export (kept from previous) =====
  const exportXLSX = () => {
    const wb = XLSX.utils.book_new();
    const data = allRows.map((r, i) => {
      const sc = scores[r.code] ?? 0;
      return {
        "#": i + 1, "الرمز": r.code, "البند": r.title, "الوصف": r.description,
        "الأولوية": PRIORITY_LABELS[r.priority], "المرحلة": PHASE_LABELS[r.phase],
        "الوزن (%)": r.weight, "التقييم (0-5)": sc,
        "النقاط": Number(((sc * r.weight) / 5).toFixed(2)),
        "ملاحظات": notes[r.code] ?? "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, meta.label.slice(0, 28));
    XLSX.writeFile(wb, `تقييم-${meta.label}.xlsx`);
    toast.success("تم تصدير التقييم");
  };

  const printReport = () => {
    const w = window.open("", "_blank", "width=1100,height=800");
    if (!w) return;
    const date = new Date().toLocaleString("ar-SA-u-ca-gregory");
    const tableRows = allRows.map((r, i) => {
      const sc = scores[r.code] ?? 0;
      const weighted = ((sc * r.weight) / 5).toFixed(2);
      return `<tr><td>${i + 1}</td><td><b>${r.code}</b></td><td><b>${escapeHtml(r.title)}</b><div style="color:#666;font-size:11px">${escapeHtml(r.description)}</div></td><td style="text-align:center">${r.weight}%</td><td style="text-align:center"><b>${sc}</b>/5</td><td style="text-align:center">${weighted}</td></tr>`;
    }).join("");
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>تقييم — ${escapeHtml(meta.label)}</title><style>body{font-family:Tahoma;margin:24px}h1{color:#0E3A42}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:6px;border:1px solid #ddd;text-align:right}th{background:#F4F0E6}</style></head><body><h1>تقرير تقييم — ${escapeHtml(meta.label)}</h1><p>المُقيِّم: ${escapeHtml(evaluator || "—")} | التاريخ: ${escapeHtml(date)}</p><p><b>النتيجة:</b> ${stats.finalScore.toFixed(1)}/100 (${stats.pct.toFixed(1)}%) — <b>${grade.label}</b></p><table><thead><tr><th>#</th><th>الرمز</th><th>البند</th><th>الوزن</th><th>التقييم</th><th>النقاط</th></tr></thead><tbody>${tableRows}</tbody></table><script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`);
    w.document.close();
  };

  // ===== Navigation =====
  const goNext = () => setStep((s) => Math.min(s + 1, totalSteps - 1));
  const goPrev = () => setStep((s) => Math.max(s - 1, 0));
  const canGoNext = step < totalSteps - 1;
  const canGoPrev = step > 0;

  const overallProgress = ((step + 1) / totalSteps) * 100;

  return (
    <Card className="border-primary/20 shadow-sm">
      {/* ===== Header & Wizard Stepper ===== */}
      <CardHeader className="border-b bg-muted/30 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <ClipboardCheck className="size-6" />
            </div>
            <div>
              <CardTitle className="text-lg">نموذج التقييم — معالج خطوة بخطوة</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                املأ كل قسم ثم انتقل للتالي. يتم حفظ تقدمك تلقائياً.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {draftSavedAt && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Save className="h-3 w-3" />
                مُحفَّظ تلقائياً
              </span>
            )}
            <Button variant="outline" size="sm" onClick={saveDraftNow} className="gap-1">
              <Save className="h-4 w-4" />حفظ مسودة
            </Button>
            <Button variant="ghost" size="sm" onClick={resetAll} className="gap-1 text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />تفريغ
            </Button>
          </div>
        </div>

        {/* Top progress bar */}
        <div>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold">الخطوة {step + 1} من {totalSteps}: {currentDef.title}</span>
            <span className="text-muted-foreground">{Math.round(overallProgress)}%</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>

        {/* Step pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {stepDefs.map((s, i) => {
            const Icon = s.icon;
            const isDone = i < step;
            const isActive = i === step;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setStep(i)}
                className={`shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  isActive ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : isDone ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                  : "bg-card text-muted-foreground hover:bg-accent"
                }`}
              >
                <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${
                  isActive ? "bg-primary-foreground/20" : isDone ? "bg-emerald-600 text-white" : "bg-muted"
                }`}>
                  {isDone ? <CheckCircle2 className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                </span>
                {s.title}
              </button>
            );
          })}
        </div>
      </CardHeader>

      {/* ===== Step Body ===== */}
      <CardContent className="p-4 md:p-6 space-y-5">
        {/* STEP 0: Setup */}
        {step === 0 && (
          <div className="space-y-4">
            <SectionCard title="بيانات التقييم" subtitle="اختر اللجنة وأدخل بياناتك قبل البدء">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">اللجنة المُقيَّمة *</Label>
                  <Select value={active} onValueChange={(v) => setActive(v as CommitteeType)}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COMMITTEES.map((c) => (
                        <SelectItem key={c.type} value={c.type}>
                          {c.label} ({EVALUATION_CRITERIA[c.type].length} بنود)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">اسم المُقيِّم *</Label>
                  <Input
                    className="h-11"
                    placeholder="اكتب اسمك الكامل"
                    value={evaluator}
                    onChange={(e) => setEvaluator(e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm font-medium">ملاحظات عامة (اختياري)</Label>
                  <Textarea
                    className="min-h-[90px]"
                    placeholder="ملاحظات إضافية حول التقييم تُدرج في التقرير النهائي"
                    value={generalNote}
                    onChange={(e) => setGeneralNote(e.target.value)}
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="نظام التقييم" subtitle="درجات من 0 إلى 5 لكل بند">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {SCORE_SCALE.map((s) => (
                  <div key={s.value} className="rounded-lg border bg-card p-3 text-center">
                    <div className="text-2xl font-bold text-primary">{s.value}</div>
                    <div className="text-xs font-medium mt-1">{s.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{s.desc}</div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* PHASE STEPS */}
        {currentPhaseGroup && (
          <div className="space-y-4">
            <SectionCard
              title={`مرحلة ${currentPhaseGroup.label}`}
              subtitle={`${currentPhaseGroup.rows.length} بنود — قيّم كل بند بدرجة من 0 إلى 5`}
              actions={
                <Button variant="outline" size="sm" onClick={fillPhaseExcellent} className="gap-1">
                  <Sparkles className="h-3.5 w-3.5" />تعبئة سريعة (ممتاز)
                </Button>
              }
            >
              {(() => { const ps = phaseStats(currentPhaseGroup.rows); return (
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">تقدم هذه المرحلة</span>
                    <span className="font-semibold">{ps.answered} / {ps.total}</span>
                  </div>
                  <Progress value={ps.pct} className="h-1.5" />
                </div>
              ); })()}

              <div className="space-y-3">
                {currentPhaseGroup.rows.map((r, i) => {
                  const sc = scores[r.code];
                  const answered = sc !== undefined;
                  return (
                    <div
                      key={r.code}
                      className={`rounded-xl border p-4 transition ${
                        answered ? "border-emerald-500/30 bg-emerald-500/5" : "bg-card hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-primary/10 px-2 text-sm font-bold text-primary shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] font-bold text-primary">{r.code}</span>
                            <b className="text-sm">{r.title}</b>
                            <Badge variant="outline" className={`text-[10px] ${PRIORITY_TONE[r.priority]}`}>
                              {PRIORITY_LABELS[r.priority]}
                            </Badge>
                            <span className="text-[11px] font-bold text-primary ms-auto">وزن {r.weight}%</span>
                          </div>
                          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{r.description}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {SCORE_SCALE.map((s) => {
                          const selected = sc === s.value;
                          return (
                            <button
                              key={s.value}
                              type="button"
                              onClick={() => setScore(r.code, s.value)}
                              title={s.desc}
                              className={`h-12 min-w-16 rounded-lg border-2 px-3 text-xs font-medium transition ${
                                selected
                                  ? "border-primary bg-primary text-primary-foreground shadow-md scale-105"
                                  : "bg-card border-border hover:border-primary/50 hover:bg-primary/5"
                              }`}
                            >
                              <div className="text-base font-bold">{s.value}</div>
                              <div className="text-[9px] opacity-80">{s.label}</div>
                            </button>
                          );
                        })}
                      </div>

                      <Textarea
                        placeholder="ملاحظة على هذا البند (اختياري)"
                        value={notes[r.code] ?? ""}
                        onChange={(e) => setNote(r.code, e.target.value)}
                        className="mt-3 text-sm min-h-[60px]"
                      />
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </div>
        )}

        {/* REVIEW STEP */}
        {step === totalSteps - 1 && (
          <div className="space-y-4">
            <SectionCard title="ملخص النتيجة" subtitle="مراجعة قبل الإرسال النهائي">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiBox label="النتيجة (من 100)" value={stats.finalScore.toFixed(1)} />
                <KpiBox label="النسبة المئوية" value={`${stats.pct.toFixed(1)}%`} />
                <KpiBox label="البنود المُقيّمة" value={`${stats.answered} / ${stats.total}`} />
                <div className={`rounded-xl border-2 p-3 ${grade.bg}`}>
                  <div className="flex items-center gap-1.5 text-xs opacity-80">
                    <Trophy className="h-4 w-4" />التقدير
                  </div>
                  <div className={`mt-1 text-2xl font-bold ${grade.tone}`}>{grade.label}</div>
                </div>
              </div>

              {!stats.complete && (
                <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                  لم يكتمل التقييم بعد ({stats.total - stats.answered} بنود متبقية). يمكنك المتابعة على أي حال أو الرجوع لإكمالها.
                </div>
              )}
            </SectionCard>

            <SectionCard title="بيانات التقييم">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <Field label="اللجنة" value={meta.label} />
                <Field label="المُقيِّم" value={evaluator || "—"} />
                <Field label="إجمالي الأوزان" value={`${stats.totalWeight}%`} />
                <Field label="عدد البنود" value={String(stats.total)} />
                {generalNote && <Field label="ملاحظات عامة" value={generalNote} className="sm:col-span-2" />}
              </dl>
            </SectionCard>

            <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-sm">جاهز للإرسال؟</p>
                  <p className="text-xs text-muted-foreground mt-1">سيتم حفظ التقييم في التقارير وحذف المسودة المحلية.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={exportXLSX} className="gap-1">
                    <FileSpreadsheet className="h-4 w-4" />Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={printReport} className="gap-1">
                    <Printer className="h-4 w-4" />طباعة
                  </Button>
                  <Button onClick={submitEvaluation} disabled={saving || stats.answered === 0} className="gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    {saving ? "جارٍ الإرسال..." : "إرسال التقييم"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== Wizard Footer Nav ===== */}
        <div className="flex items-center justify-between gap-2 border-t pt-4">
          <Button variant="outline" onClick={goPrev} disabled={!canGoPrev} className="gap-1">
            <ChevronRight className="h-4 w-4 rtl:hidden" />
            <ChevronLeft className="h-4 w-4 hidden rtl:inline" />
            السابق
          </Button>
          <div className="text-xs text-muted-foreground">
            تم الإنجاز: <b className="text-foreground">{stats.answered}</b> / {stats.total} بند
          </div>
          {canGoNext ? (
            <Button onClick={goNext} className="gap-1">
              التالي
              <ChevronLeft className="h-4 w-4 rtl:hidden" />
              <ChevronRight className="h-4 w-4 hidden rtl:inline" />
            </Button>
          ) : (
            <Button onClick={submitEvaluation} disabled={saving || stats.answered === 0} className="gap-1">
              <CheckCircle2 className="h-4 w-4" />إرسال
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SectionCard({
  title, subtitle, actions, children,
}: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <div>
          <h3 className="font-bold text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

function KpiBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
    </div>
  );
}

function Field({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="font-medium mt-0.5">{value}</dd>
    </div>
  );
}
