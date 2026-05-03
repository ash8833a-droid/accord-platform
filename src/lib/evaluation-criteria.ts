/**
 * معايير وبنود تقييم لجان الزواج الجماعي الثاني عشر
 * مرتبة حسب الأهمية والأولوية. مجموع أوزان كل لجنة = 100.
 */
import type { CommitteeType } from "@/lib/committees";
import { PMP_TEMPLATES, type PmpPhase, type PmpTaskTemplate } from "@/lib/pmp-tasks";
import { COMMITTEES } from "@/lib/committees";

export type CriterionPriority = "critical" | "high" | "medium";

export interface EvaluationCriterion {
  code: string;
  title: string;
  description: string;
  weight: number;
  priority: CriterionPriority;
  phase: PmpPhase;
}

export const PRIORITY_LABELS: Record<CriterionPriority, string> = {
  critical: "حرجة",
  high: "عالية",
  medium: "متوسطة",
};

export const PRIORITY_TONE: Record<CriterionPriority, string> = {
  critical: "bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-300",
  high: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300",
  medium: "bg-sky-500/15 text-sky-700 border-sky-500/30 dark:text-sky-300",
};

/**
 * Map PMP task priority → criterion priority + raw weight unit.
 * urgent  → critical (4)
 * high    → critical (3)
 * medium  → high     (2)
 * low     → medium   (1)
 */
const PRIORITY_MAP: Record<PmpTaskTemplate["priority"], { p: CriterionPriority; w: number }> = {
  urgent: { p: "critical", w: 4 },
  high:   { p: "critical", w: 3 },
  medium: { p: "high",     w: 2 },
  low:    { p: "medium",   w: 1 },
};

const COMMITTEE_PREFIX: Record<CommitteeType, string> = {
  supreme: "S",
  finance: "F",
  media: "M",
  quality: "Q",
  programs: "P",
  dinner: "D",
  procurement: "PR",
  reception: "R",
  women: "W",
};

/**
 * يحوّل مهام PMP لكل لجنة إلى بنود تقييم بحيث يكون لكل مهمة بند تقييم مطابق
 * (نفس العنوان والوصف والمرحلة)، مع توزيع أوزان مجموعها 100 حسب أولوية المهمة.
 */
function buildCriteriaFromTemplates(): Record<CommitteeType, EvaluationCriterion[]> {
  const result = {} as Record<CommitteeType, EvaluationCriterion[]>;
  for (const c of COMMITTEES) {
    const tasks = PMP_TEMPLATES[c.type] ?? [];
    const totalUnits = tasks.reduce((acc, t) => acc + PRIORITY_MAP[t.priority].w, 0) || 1;
    // حساب الأوزان الأولية كأرقام عشرية ثم التقريب ثم تعديل البند الأخير ليصبح المجموع = 100
    const rawWeights = tasks.map((t) => (PRIORITY_MAP[t.priority].w / totalUnits) * 100);
    const rounded = rawWeights.map((w) => Math.max(1, Math.round(w)));
    const sum = rounded.reduce((a, b) => a + b, 0);
    const diff = 100 - sum;
    if (rounded.length > 0) rounded[rounded.length - 1] = Math.max(1, rounded[rounded.length - 1] + diff);

    result[c.type] = tasks.map((t, i) => {
      const map = PRIORITY_MAP[t.priority];
      return {
        code: `${COMMITTEE_PREFIX[c.type]}${i + 1}`,
        title: t.title,
        description: t.description,
        weight: rounded[i],
        priority: map.p,
        phase: t.phase,
      };
    });
  }
  return result;
}

export const EVALUATION_CRITERIA: Record<CommitteeType, EvaluationCriterion[]> =
  buildCriteriaFromTemplates();

export const SCORE_SCALE = [
  { value: 5, label: "ممتاز", desc: "تجاوز التوقعات (≥95%)" },
  { value: 4, label: "جيد جداً", desc: "إنجاز عالٍ (80–94%)" },
  { value: 3, label: "جيد", desc: "إنجاز مقبول (65–79%)" },
  { value: 2, label: "مقبول", desc: "إنجاز جزئي (50–64%)" },
  { value: 1, label: "ضعيف", desc: "أقل من المتوقع (<50%)" },
  { value: 0, label: "لم يُنفّذ", desc: "لم يُنفّذ البند" },
];

export function getCriteriaForCommittee(type: CommitteeType): EvaluationCriterion[] {
  return EVALUATION_CRITERIA[type] ?? [];
}
