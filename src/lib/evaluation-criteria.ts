/**
 * معايير وبنود تقييم لجان الزواج الجماعي الثاني عشر
 * مرتبة حسب الأهمية والأولوية. مجموع أوزان كل لجنة = 100.
 */
import type { CommitteeType } from "@/lib/committees";
import type { PmpPhase } from "@/lib/pmp-tasks";

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

export const EVALUATION_CRITERIA: Record<CommitteeType, EvaluationCriterion[]> = {
  supreme: [
    { code: "S1", title: "اعتماد الخطة الاستراتيجية والميثاق", description: "وضوح الرؤية والأهداف ومؤشرات النجاح، واعتمادها رسمياً قبل بدء التنفيذ.", weight: 25, priority: "critical", phase: "planning" },
    { code: "S2", title: "اعتماد موازنات اللجان", description: "مراجعة موازنات اللجان واعتمادها وفق سياسة واضحة وقبل البدء.", weight: 20, priority: "critical", phase: "planning" },
    { code: "S3", title: "متابعة أداء اللجان دوريًا", description: "انتظام الاجتماعات الدورية وتوثيق المحاضر والقرارات.", weight: 20, priority: "high", phase: "monitoring" },
    { code: "S4", title: "حسم القرارات المصيرية", description: "سرعة وفعالية اتخاذ القرارات في القضايا التي تتجاوز صلاحيات اللجان.", weight: 15, priority: "high", phase: "executing" },
    { code: "S5", title: "إدارة المخاطر العامة للحفل", description: "وجود سجل مخاطر محدّث وخطط استجابة للمخاطر الكبرى.", weight: 10, priority: "medium", phase: "monitoring" },
    { code: "S6", title: "التقرير الختامي والدروس المستفادة", description: "إعداد تقرير ختامي شامل ودروس مستفادة موثقة.", weight: 10, priority: "medium", phase: "closing" },
  ],
  finance: [
    { code: "F1", title: "إعداد الموازنة التقديرية واعتمادها", description: "موازنة تفصيلية ببنود واضحة معتمدة من اللجنة العليا قبل بدء الصرف.", weight: 20, priority: "critical", phase: "planning" },
    { code: "F2", title: "ضوابط الصرف ومسار الاعتماد", description: "وجود سياسة صرف موثقة وحدود صلاحيات ومسار اعتماد واضح.", weight: 15, priority: "critical", phase: "planning" },
    { code: "F3", title: "تحصيل الاشتراكات (300 ر.س)", description: "نسبة التحصيل الفعلي مقارنة بالمستهدف ومتابعة المناديب أسبوعياً.", weight: 20, priority: "critical", phase: "executing" },
    { code: "F4", title: "سرعة معالجة طلبات الصرف", description: "الالتزام بمهلة الاعتماد والصرف (لا تتجاوز 5 أيام عمل).", weight: 15, priority: "high", phase: "executing" },
    { code: "F5", title: "مراقبة الانحراف عن الموازنة (CV/CPI)", description: "متابعة الفروقات بين المخطط والمنصرف لكل لجنة وإصدار تنبيهات.", weight: 15, priority: "high", phase: "monitoring" },
    { code: "F6", title: "التقرير المالي الشهري", description: "إصدار تقرير شهري بالإيرادات والمصروفات والتدفقات النقدية.", weight: 10, priority: "medium", phase: "monitoring" },
    { code: "F7", title: "الإقفال المالي والتسليم", description: "إقفال الحسابات وتسليم التقارير النهائية والمستندات للأرشيف.", weight: 5, priority: "medium", phase: "closing" },
  ],
  media: [
    { code: "M1", title: "خطة التواصل والهوية الإعلامية", description: "وثيقة معتمدة للرسائل والقنوات والجمهور وجدول النشر.", weight: 15, priority: "critical", phase: "planning" },
    { code: "M2", title: "إنتاج المحتوى البصري والمرئي", description: "جودة وكمية المنشورات والفيديوهات الترويجية والالتزام بجدول النشر.", weight: 20, priority: "high", phase: "executing" },
    { code: "M3", title: "التغطية المباشرة للحفل", description: "اكتمال التغطية المصورة (صور/فيديو) ونشرها في الوقت المناسب.", weight: 25, priority: "critical", phase: "executing" },
    { code: "M4", title: "قياس الوصول والتفاعل", description: "تقارير دورية بمؤشرات الانتشار والتفاعل لكل منشور.", weight: 15, priority: "high", phase: "monitoring" },
    { code: "M5", title: "إدارة المخاطر الإعلامية", description: "رصد المحتوى السلبي والاستجابة المهنية في وقت قياسي.", weight: 10, priority: "medium", phase: "monitoring" },
    { code: "M6", title: "أرشفة المحتوى الإعلامي", description: "أرشفة جميع المواد المنتجة (صور/فيديو/تصاميم) للسنوات القادمة.", weight: 10, priority: "medium", phase: "closing" },
    { code: "M7", title: "تحديد أصحاب المصلحة الإعلاميين", description: "حصر شامل للجهات الإعلامية الشريكة وتنسيق التغطية.", weight: 5, priority: "medium", phase: "initiating" },
  ],
  quality: [
    { code: "Q1", title: "خطة إدارة الجودة ومعايير القبول", description: "وثيقة معتمدة بمعايير الجودة لكل لجنة ومخرجاتها.", weight: 20, priority: "critical", phase: "planning" },
    { code: "Q2", title: "قوائم التحقق (Checklist) لكل لجنة", description: "إعداد قوائم تحقق شاملة قبل تنفيذ التدقيقات.", weight: 15, priority: "high", phase: "planning" },
    { code: "Q3", title: "تنفيذ تدقيقات دورية ميدانية", description: "زيارات ميدانية موثقة وتدقيق مخرجات اللجان أسبوعياً.", weight: 25, priority: "critical", phase: "executing" },
    { code: "Q4", title: "قياس رضا الضيوف والعرسان", description: "استبيان رضا منشور وتحليل النتائج بعد الحفل.", weight: 15, priority: "high", phase: "monitoring" },
    { code: "Q5", title: "متابعة الإجراءات التصحيحية", description: "إغلاق نقاط عدم المطابقة في وقت زمني محدد.", weight: 15, priority: "high", phase: "monitoring" },
    { code: "Q6", title: "تقرير الجودة الختامي", description: "تقرير ختامي يلخص نتائج التدقيق والتوصيات والدروس المستفادة.", weight: 10, priority: "medium", phase: "closing" },
  ],
  programs: [
    { code: "P1", title: "هيكل تجزئة العمل (WBS) للحفل", description: "تفصيل دقيق لفقرات الحفل مع مسؤول لكل فقرة.", weight: 15, priority: "critical", phase: "planning" },
    { code: "P2", title: "الجدول الزمني للفقرات", description: "جدول دقيق بالدقائق مع هامش زمني لكل فقرة.", weight: 20, priority: "critical", phase: "planning" },
    { code: "P3", title: "تأكيد المنشدين والمتحدثين والتعاقد", description: "عقود رسمية موقّعة قبل الحفل بوقت كافٍ.", weight: 15, priority: "high", phase: "executing" },
    { code: "P4", title: "البروفة الشاملة قبل الحفل", description: "تنفيذ بروفة كاملة قبل الحفل بأسبوع على الأقل.", weight: 15, priority: "critical", phase: "executing" },
    { code: "P5", title: "إدارة سير الحفل يوم التنفيذ", description: "ضبط التوقيت والتعامل مع التأخيرات بكفاءة.", weight: 20, priority: "critical", phase: "monitoring" },
    { code: "P6", title: "متابعة ملفات العرسان", description: "اكتمال ملفات العرسان واستيفاء المتطلبات.", weight: 10, priority: "high", phase: "executing" },
    { code: "P7", title: "إقفال البرنامج وتسليم المخرجات", description: "تسليم تقرير سير الفقرات والتوصيات للسنوات القادمة.", weight: 5, priority: "medium", phase: "closing" },
  ],
  dinner: [
    { code: "D1", title: "تقدير عدد الضيوف وحساب الكميات", description: "دقة التقدير وتجنّب النقص أو الهدر.", weight: 20, priority: "critical", phase: "planning" },
    { code: "D2", title: "اختيار المورد والتعاقد", description: "اختيار مورد موثوق وعقد محكم بشروط جودة وضمانات.", weight: 20, priority: "critical", phase: "planning" },
    { code: "D3", title: "تجهيز قاعة العشاء", description: "ترتيب الطاولات والكراسي والديكور قبل الحفل بوقت كافٍ.", weight: 15, priority: "high", phase: "executing" },
    { code: "D4", title: "تقديم الوجبات يوم الحفل", description: "الالتزام بجدول التقديم بالتنسيق مع لجنة البرامج.", weight: 20, priority: "critical", phase: "executing" },
    { code: "D5", title: "ضبط جودة الطعام والاشتراطات الصحية", description: "التحقق من سلامة الطعام والشهادات الصحية للمورد.", weight: 15, priority: "critical", phase: "monitoring" },
    { code: "D6", title: "إدارة الفائض والتقرير الختامي", description: "التعامل المسؤول مع الفائض وإصدار تقرير ختامي.", weight: 10, priority: "medium", phase: "closing" },
  ],
  procurement: [
    { code: "PR1", title: "خطة المشتريات الشاملة", description: "حصر دقيق للمستلزمات والمواصفات والكميات والتكاليف.", weight: 15, priority: "critical", phase: "planning" },
    { code: "PR2", title: "حصر طلبات اللجان المستفيدة", description: "تجميع منظم لاحتياجات (عشاء/ضيافة/استقبال/نسائية) بمواصفات وتواريخ.", weight: 15, priority: "critical", phase: "planning" },
    { code: "PR3", title: "دراسة العروض والمفاضلة", description: "استدراج 3 عروض على الأقل ومفاضلة موثقة.", weight: 15, priority: "high", phase: "planning" },
    { code: "PR4", title: "العقود وأوامر الشراء", description: "عقود معتمدة وأوامر شراء منظمة بالتنسيق مع المالية.", weight: 10, priority: "high", phase: "executing" },
    { code: "PR5", title: "استلام المشتريات وفحص المطابقة", description: "محاضر استلام موثقة وفحص جودة قبل القبول.", weight: 15, priority: "critical", phase: "executing" },
    { code: "PR6", title: "تسليم العهد للجان المستفيدة", description: "محاضر تسليم رسمية لكل لجنة.", weight: 10, priority: "high", phase: "executing" },
    { code: "PR7", title: "متابعة التزام الموردين", description: "رصد التأخير وعدم المطابقة وإصدار إنذارات.", weight: 10, priority: "high", phase: "monitoring" },
    { code: "PR8", title: "تحليل الانحراف السعري والإقفال", description: "تقرير بفروق الأسعار وإقفال جميع أوامر الشراء.", weight: 10, priority: "medium", phase: "closing" },
  ],
  reception: [
    { code: "R1", title: "خطة استقبال الضيوف والعرسان", description: "تصميم مسار الاستقبال واللوحات الإرشادية.", weight: 15, priority: "critical", phase: "planning" },
    { code: "R2", title: "قائمة الضيوف وتأكيد الحضور", description: "قائمة معتمدة وتأكيدات حضور قبل الحفل.", weight: 15, priority: "high", phase: "planning" },
    { code: "R3", title: "استقبال العرسان وكبار الضيوف", description: "استقبال متميز ومنظم مع ضيافة لائقة.", weight: 25, priority: "critical", phase: "executing" },
    { code: "R4", title: "توجيه الحضور داخل الموقع", description: "إرشاد سلس وتنظيم حركة الحضور داخل القاعة.", weight: 20, priority: "high", phase: "executing" },
    { code: "R5", title: "متابعة رضا الضيوف والشكاوى", description: "رصد الملاحظات والاستجابة الفورية لأي شكوى.", weight: 15, priority: "high", phase: "monitoring" },
    { code: "R6", title: "التقرير الختامي للاستقبال", description: "تقرير بأبرز الملاحظات والتوصيات.", weight: 10, priority: "medium", phase: "closing" },
  ],
  women: [
    { code: "W1", title: "خطة القسم النسائي الشاملة", description: "وثيقة معتمدة لجميع متطلبات القسم النسائي.", weight: 15, priority: "critical", phase: "planning" },
    { code: "W2", title: "حصر مشتريات القسم النسائي", description: "حصر تفصيلي بالتنسيق مع المشتريات.", weight: 10, priority: "high", phase: "planning" },
    { code: "W3", title: "ميزانية الزفّات والتعاقد مع المنسقات", description: "ميزانية معتمدة وعقود رسمية مع منسقات الزفّات.", weight: 10, priority: "high", phase: "planning" },
    { code: "W4", title: "تجهيز قاعة النساء", description: "اكتمال الديكور والإضاءة والصوت قبل الحفل.", weight: 15, priority: "critical", phase: "executing" },
    { code: "W5", title: "ضيافة النساء", description: "تقديم متكامل للطعام والحلويات والمشروبات حسب الجدول.", weight: 10, priority: "high", phase: "executing" },
    { code: "W6", title: "استقبال العرائس وكبار الضيفات", description: "استقبال متميز ومنظم مع ضيافة خاصة.", weight: 15, priority: "critical", phase: "executing" },
    { code: "W7", title: "تنفيذ الزفّات بدقة التوقيت", description: "ضبط التوقيت بالتنسيق مع لجنة البرامج.", weight: 15, priority: "critical", phase: "executing" },
    { code: "W8", title: "متابعة رضا الضيفات والعرائس", description: "رصد الملاحظات والاستجابة الفورية.", weight: 5, priority: "medium", phase: "monitoring" },
    { code: "W9", title: "ضبط الانحراف عن ميزانية القسم", description: "متابعة الصرف الفعلي وإصدار تنبيهات.", weight: 5, priority: "medium", phase: "monitoring" },
  ],
};

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
