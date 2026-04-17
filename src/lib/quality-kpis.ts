/**
 * Quality Committee — Comprehensive KPI catalogue
 * Each item is short, actionable, and directly linked to a measurable
 * performance indicator computed from existing tables.
 *
 * Categories (PMP-aligned):
 *  - delivery   : Schedule / تنفيذ المهام والجدول الزمني
 *  - cost       : Cost performance / الأداء المالي
 *  - process    : Process compliance / التزام اللجان بالعملية
 *  - stakeholder: Beneficiaries / العرسان والمشتركين
 *  - governance : Documentation & archiving / التوثيق والأرشيف
 */

export type KpiCategory =
  | "delivery"
  | "cost"
  | "process"
  | "stakeholder"
  | "governance";

export interface QualityKpi {
  id: string;
  title: string;          // short bullet — يظهر في الداشبورد
  detail: string;         // longer explanation — يظهر في صفحة اللجنة
  category: KpiCategory;
  /** Target value (0..100). Score is compared against this. */
  target: number;
  /** Relative weight in the overall quality score */
  weight: number;
  /** Higher unit hint shown next to the value */
  unit?: string;
}

export const KPI_CATEGORY_LABEL: Record<KpiCategory, string> = {
  delivery: "الإنجاز والجدول",
  cost: "الأداء المالي",
  process: "الالتزام بالعملية",
  stakeholder: "المستفيدون",
  governance: "الحوكمة والتوثيق",
};

export const KPI_CATEGORY_TONE: Record<KpiCategory, string> = {
  delivery: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  cost: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  process: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  stakeholder: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  governance: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
};

export const QUALITY_KPIS: QualityKpi[] = [
  {
    id: "task_completion",
    title: "نسبة إنجاز المهام",
    detail: "نسبة المهام المكتملة من إجمالي مهام جميع اللجان — مؤشر مباشر على التقدم في التنفيذ (SPI).",
    category: "delivery",
    target: 80,
    weight: 20,
    unit: "%",
  },
  {
    id: "on_time_tasks",
    title: "الالتزام بالمواعيد",
    detail: "نسبة المهام المنجزة قبل أو في تاريخ الاستحقاق — يقيس انضباط اللجان زمنياً.",
    category: "delivery",
    target: 85,
    weight: 12,
    unit: "%",
  },
  {
    id: "budget_discipline",
    title: "ضبط الميزانية",
    detail: "نسبة بقاء الصرف ضمن الحد المعتمد لكل لجنة — كلما اقترب الصرف من 100% دون تجاوز، كان الأداء أفضل (CPI).",
    category: "cost",
    target: 90,
    weight: 15,
    unit: "%",
  },
  {
    id: "payment_turnaround",
    title: "سرعة معالجة طلبات الصرف",
    detail: "نسبة طلبات الصرف التي تمت معالجتها (اعتماد/صرف/رفض) من إجمالي الطلبات — يقلل الطلبات المعلقة.",
    category: "process",
    target: 90,
    weight: 10,
    unit: "%",
  },
  {
    id: "active_committees",
    title: "نشاط اللجان",
    detail: "نسبة اللجان التي لديها مهام جارية أو منجزة — يكشف اللجان المتوقفة عن العمل.",
    category: "process",
    target: 100,
    weight: 8,
    unit: "%",
  },
  {
    id: "grooms_progress",
    title: "تقدم ملفات العرسان",
    detail: "نسبة ملفات العرسان التي تجاوزت مرحلة المراجعة (معتمد/مكتمل) — مؤشر جاهزية الحفل.",
    category: "stakeholder",
    target: 70,
    weight: 12,
    unit: "%",
  },
  {
    id: "subscription_collection",
    title: "تحصيل الاشتراكات",
    detail: "نسبة الاشتراكات المؤكدة من إجمالي الاشتراكات — يعكس قوة شبكة المناديب وثقة المشتركين.",
    category: "stakeholder",
    target: 75,
    weight: 10,
    unit: "%",
  },
  {
    id: "documentation",
    title: "أرشفة التقارير",
    detail: "نسبة التقارير المُسكَّنة في الأرشيف من إجمالي التقارير المرفوعة — يضمن استدامة المعرفة وحفظ الذاكرة المؤسسية.",
    category: "governance",
    target: 80,
    weight: 8,
    unit: "%",
  },
  {
    id: "team_coverage",
    title: "اكتمال فرق العمل",
    detail: "نسبة اللجان التي لديها أعضاء معينون — يضمن وجود مسؤول واضح لكل مخرج.",
    category: "governance",
    target: 100,
    weight: 5,
    unit: "%",
  },
];

export interface KpiResult {
  kpi: QualityKpi;
  /** Achieved value 0..100 */
  value: number;
  /** Achievement vs target, capped at 100 */
  achievement: number;
  /** Raw helper string e.g. "12 / 30" */
  raw?: string;
}

export interface KpiSummary {
  results: KpiResult[];
  /** Weighted overall score 0..100 */
  overall: number;
  /** Letter rating */
  rating: "ممتاز" | "جيد جداً" | "جيد" | "مقبول" | "يحتاج تحسين";
}

const ratingFor = (score: number): KpiSummary["rating"] => {
  if (score >= 90) return "ممتاز";
  if (score >= 80) return "جيد جداً";
  if (score >= 70) return "جيد";
  if (score >= 55) return "مقبول";
  return "يحتاج تحسين";
};

export interface KpiInputs {
  totalTasks: number;
  doneTasks: number;
  /** Tasks with due_date <= today still not completed */
  overdueTasks: number;
  /** Tasks completed where updated_at <= due_date (proxy for on-time) */
  onTimeDoneTasks: number;
  /** Tasks that have a due_date set (denominator for on-time) */
  tasksWithDueDate: number;

  totalBudget: number;
  spentBudget: number;

  totalRequests: number;
  pendingRequests: number;

  committees: number;
  activeCommittees: number;
  committeesWithTeam: number;

  totalGrooms: number;
  /** approved + completed */
  progressedGrooms: number;

  totalSubs: number;
  confirmedSubs: number;

  totalReports: number;
  archivedReports: number;
}

export function computeQualityKpis(input: KpiInputs): KpiSummary {
  const pct = (n: number, d: number) => (d > 0 ? Math.min(100, (n / d) * 100) : 0);

  // Budget discipline: reward staying under 100% spent. If over budget, penalty.
  const budgetUsage = input.totalBudget > 0 ? (input.spentBudget / input.totalBudget) * 100 : 0;
  const budgetScore = budgetUsage <= 100
    ? Math.max(0, 100 - Math.abs(85 - budgetUsage)) // peaks around 85% utilization
    : Math.max(0, 100 - (budgetUsage - 100) * 2);

  const taskCompletion = pct(input.doneTasks, input.totalTasks);
  const onTime = pct(input.onTimeDoneTasks, Math.max(input.tasksWithDueDate, 1));
  const processed = input.totalRequests - input.pendingRequests;
  const payTurnaround = pct(processed, input.totalRequests);
  const active = pct(input.activeCommittees, input.committees);
  const groomsP = pct(input.progressedGrooms, input.totalGrooms);
  const subs = pct(input.confirmedSubs, input.totalSubs);
  const arch = pct(input.archivedReports, input.totalReports);
  const team = pct(input.committeesWithTeam, input.committees);

  const valuesMap: Record<string, { value: number; raw?: string }> = {
    task_completion: { value: taskCompletion, raw: `${input.doneTasks} / ${input.totalTasks}` },
    on_time_tasks: { value: onTime, raw: `${input.onTimeDoneTasks} / ${input.tasksWithDueDate || 0}` },
    budget_discipline: { value: budgetScore, raw: `${budgetUsage.toFixed(0)}% استخدام` },
    payment_turnaround: { value: payTurnaround, raw: `${processed} / ${input.totalRequests}` },
    active_committees: { value: active, raw: `${input.activeCommittees} / ${input.committees}` },
    grooms_progress: { value: groomsP, raw: `${input.progressedGrooms} / ${input.totalGrooms}` },
    subscription_collection: { value: subs, raw: `${input.confirmedSubs} / ${input.totalSubs}` },
    documentation: { value: arch, raw: `${input.archivedReports} / ${input.totalReports}` },
    team_coverage: { value: team, raw: `${input.committeesWithTeam} / ${input.committees}` },
  };

  const results: KpiResult[] = QUALITY_KPIS.map((kpi) => {
    const v = valuesMap[kpi.id]?.value ?? 0;
    const achievement = kpi.target > 0 ? Math.min(100, (v / kpi.target) * 100) : v;
    return { kpi, value: Math.round(v), achievement: Math.round(achievement), raw: valuesMap[kpi.id]?.raw };
  });

  const totalWeight = QUALITY_KPIS.reduce((a, k) => a + k.weight, 0);
  const overall = Math.round(
    results.reduce((a, r) => a + r.achievement * r.kpi.weight, 0) / Math.max(1, totalWeight),
  );

  return { results, overall, rating: ratingFor(overall) };
}
