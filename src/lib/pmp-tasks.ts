/**
 * PMP-aligned task templates for each committee.
 * Each template follows the 5 PMP process groups:
 *  - Initiating
 *  - Planning
 *  - Executing
 *  - Monitoring & Controlling
 *  - Closing
 *
 * Tasks are tailored to the committee's specialty so the dashboard
 * can show meaningful KPIs per committee.
 */
import type { CommitteeType } from "@/lib/committees";

export type PmpPhase =
  | "initiating"
  | "planning"
  | "executing"
  | "monitoring"
  | "closing";

export const PHASE_LABELS: Record<PmpPhase, string> = {
  initiating: "البدء",
  planning: "التخطيط",
  executing: "التنفيذ",
  monitoring: "المراقبة والضبط",
  closing: "الإغلاق",
};

export interface PmpTaskTemplate {
  title: string;
  description: string;
  phase: PmpPhase;
  priority: "low" | "medium" | "high" | "urgent";
}

const COMMON_INIT = (committeeName: string): PmpTaskTemplate[] => [
  {
    title: `ميثاق المشروع — ${committeeName}`,
    description: "اعتماد ميثاق اللجنة وتحديد النطاق والأهداف وأصحاب المصلحة.",
    phase: "initiating",
    priority: "high",
  },
  {
    title: "تحديد أصحاب المصلحة وتحليل التوقعات",
    description: "تسجيل جميع الأطراف المعنية وتحديد متطلباتهم ومستوى تأثيرهم.",
    phase: "initiating",
    priority: "medium",
  },
];

const COMMON_CLOSING: PmpTaskTemplate[] = [
  {
    title: "إقفال المشروع وتسليم المخرجات",
    description: "اعتماد المخرجات النهائية وتسليمها رسمياً للإدارة العليا.",
    phase: "closing",
    priority: "high",
  },
  {
    title: "الدروس المستفادة والأرشفة",
    description: "توثيق الدروس المستفادة وأرشفة وثائق اللجنة للسنوات القادمة.",
    phase: "closing",
    priority: "medium",
  },
];

export const PMP_TEMPLATES: Record<CommitteeType, PmpTaskTemplate[]> = {
  finance: [
    ...COMMON_INIT("اللجنة المالية"),
    { title: "إعداد الموازنة التقديرية السنوية", description: "تجميع احتياجات اللجان وإعداد موازنة معتمدة بنود وتفاصيل.", phase: "planning", priority: "urgent" },
    { title: "خطة إدارة التكاليف وضوابط الصرف", description: "وضع سياسة الصرف وحدود الصلاحيات ومسار اعتماد طلبات الصرف.", phase: "planning", priority: "high" },
    { title: "تحصيل اشتراكات أبناء العائلة", description: "متابعة المناديب لتحصيل اشتراك 300 ر.س وتحديث حالة كل مشترك.", phase: "executing", priority: "high" },
    { title: "مراجعة طلبات الصرف وصرفها", description: "اعتماد الطلبات المطابقة للسياسة وصرفها ضمن المهلة المحددة.", phase: "executing", priority: "high" },
    { title: "مراقبة الانحراف عن الموازنة (CV/CPI)", description: "تحليل الفرق بين المخطط والمنصرف لكل لجنة وإصدار تنبيهات الانحراف.", phase: "monitoring", priority: "high" },
    { title: "تقرير مالي شهري للإدارة العليا", description: "إعداد تقرير شهري بالإيرادات والمصروفات والتدفقات النقدية.", phase: "monitoring", priority: "medium" },
    ...COMMON_CLOSING,
  ],
  media: [
    ...COMMON_INIT("لجنة الإعلام"),
    { title: "خطة التواصل والهوية الإعلامية", description: "تحديد الرسائل الرئيسية والقنوات والجمهور المستهدف وجدول النشر.", phase: "planning", priority: "high" },
    { title: "إنتاج المحتوى البصري والمرئي", description: "تصميم المنشورات وتسجيل الفيديوهات الترويجية للحفل.", phase: "executing", priority: "high" },
    { title: "تغطية مباشرة لفعاليات الحفل", description: "تغطية مصورة للحفل ونشرها على المنصات الرسمية.", phase: "executing", priority: "urgent" },
    { title: "قياس الوصول والتفاعل", description: "متابعة مؤشرات الانتشار والتفاعل لكل منشور وإعداد تقرير دوري.", phase: "monitoring", priority: "medium" },
    { title: "إدارة المخاطر الإعلامية", description: "رصد أي محتوى سلبي أو خاطئ والرد المهني المناسب.", phase: "monitoring", priority: "medium" },
    ...COMMON_CLOSING,
  ],
  quality: [
    ...COMMON_INIT("لجنة الجودة"),
    { title: "خطة إدارة الجودة ومعايير القبول", description: "تحديد معايير الجودة لكل لجنة ومخرجاتها مع مؤشرات قابلة للقياس.", phase: "planning", priority: "high" },
    { title: "قائمة التدقيق (Checklist) لكل لجنة", description: "إعداد قوائم تحقق لمراجعة جودة عمل اللجان قبل الحفل.", phase: "planning", priority: "high" },
    { title: "تنفيذ تدقيقات دورية على اللجان", description: "زيارات ميدانية وتدقيق المخرجات وتسجيل الملاحظات.", phase: "executing", priority: "high" },
    { title: "قياس رضا الضيوف والعرسان", description: "تصميم استبيان رضا وتوزيعه بعد الحفل وتحليل النتائج.", phase: "monitoring", priority: "high" },
    { title: "متابعة الإجراءات التصحيحية", description: "متابعة معالجة الملاحظات والتأكد من إغلاق نقاط عدم المطابقة.", phase: "monitoring", priority: "medium" },
    ...COMMON_CLOSING,
  ],
  programs: [
    ...COMMON_INIT("لجنة البرامج"),
    { title: "هيكل تجزئة العمل (WBS) لبرنامج الحفل", description: "تفصيل برنامج الحفل إلى فقرات وأنشطة فرعية ومسؤول لكل نشاط.", phase: "planning", priority: "urgent" },
    { title: "الجدول الزمني للفقرات (Schedule)", description: "إعداد جدول زمني دقيق بالدقائق لكل فقرة من فقرات الحفل.", phase: "planning", priority: "high" },
    { title: "تنسيق الفقرات مع المنشدين والمتحدثين", description: "تأكيد حضور جميع المشاركين والتعاقد معهم رسمياً.", phase: "executing", priority: "high" },
    { title: "بروفة شاملة قبل الحفل بأسبوع", description: "تنفيذ بروفة كاملة لجميع الفقرات والتأكد من التوقيت.", phase: "executing", priority: "urgent" },
    { title: "متابعة سير الفقرات يوم الحفل", description: "ضبط التوقيت أثناء الحفل وإدارة أي تأخير.", phase: "monitoring", priority: "high" },
    { title: "تسجيل ملف العرسان وتحديث الحالة", description: "متابعة استكمال ملفات العرسان وتحديث قائمة المتطلبات.", phase: "executing", priority: "high" },
    ...COMMON_CLOSING,
  ],
  dinner: [
    ...COMMON_INIT("لجنة العشاء"),
    { title: "تقدير عدد الضيوف وحساب الكميات", description: "تقدير العدد المتوقع وحساب كميات الطعام والمشروبات.", phase: "planning", priority: "high" },
    { title: "اختيار المورد وعقد الإمداد الغذائي", description: "اختيار جهة الإعاشة المناسبة وتوقيع العقد ومتطلبات الجودة.", phase: "planning", priority: "high" },
    { title: "تجهيز قاعة العشاء وترتيب الطاولات", description: "إعداد قاعة الطعام وتوزيع الطاولات والكراسي قبل وقت كافٍ.", phase: "executing", priority: "high" },
    { title: "تقديم الوجبات يوم الحفل", description: "ضبط جدول التقديم بالتنسيق مع لجنة البرامج.", phase: "executing", priority: "urgent" },
    { title: "ضبط جودة الطعام والاشتراطات الصحية", description: "التأكد من سلامة الطعام والاشتراطات الصحية.", phase: "monitoring", priority: "high" },
    ...COMMON_CLOSING,
  ],
  procurement: [
    ...COMMON_INIT("لجنة المشتريات"),
    { title: "خطة المشتريات وحصر المستلزمات (Procurement Plan)", description: "حصر شامل للمستلزمات والمواصفات والكميات وتقدير التكاليف.", phase: "planning", priority: "urgent" },
    { title: "دراسة عروض الموردين والمفاضلة", description: "استدراج عروض من ٣ موردين على الأقل والمفاضلة من حيث السعر والجودة والمدة.", phase: "planning", priority: "high" },
    { title: "توقيع عقود الشراء والتوريد", description: "اعتماد العقود مع الموردين وفق السياسات وضمانات التسليم.", phase: "planning", priority: "high" },
    { title: "إصدار أوامر الشراء ومتابعة الدفع", description: "إصدار أوامر الشراء بالتنسيق مع المالية ومتابعة الدفعات.", phase: "executing", priority: "high" },
    { title: "استلام المستلزمات وفحص المطابقة", description: "استلام المشتريات وفحص جودتها ومطابقتها للمواصفات قبل القبول.", phase: "executing", priority: "high" },
    { title: "تسليم المستلزمات للجان المستفيدة", description: "تسليم العهد للجان (عشاء، استقبال، برامج) بمحضر تسليم رسمي.", phase: "executing", priority: "medium" },
    { title: "متابعة التزام الموردين بالجدول والمواصفات", description: "رصد أي تأخير أو عدم مطابقة وإصدار إنذارات للموردين.", phase: "monitoring", priority: "high" },
    { title: "تحليل الانحراف بين السعر المخطط والفعلي", description: "إعداد تقرير دوري بالفروق السعرية وضبط الموازنة.", phase: "monitoring", priority: "medium" },
    ...COMMON_CLOSING,
  ],
  reception: [
    ...COMMON_INIT("لجنة الاستقبال والضيافة"),
    { title: "خطة استقبال الضيوف والعرسان", description: "تصميم مسار الاستقبال وتحديد نقاط التوجيه واللوحات الإرشادية.", phase: "planning", priority: "high" },
    { title: "إعداد قائمة الضيوف وتأكيد الحضور", description: "تجميع قائمة الضيوف وتأكيد حضورهم قبل الحفل.", phase: "planning", priority: "medium" },
    { title: "استقبال العرسان وكبار الضيوف", description: "استقبال خاص للعرسان وكبار الضيوف وتقديم الضيافة.", phase: "executing", priority: "urgent" },
    { title: "توجيه الحضور داخل الموقع", description: "إرشاد الضيوف لأماكنهم وتنظيم الحركة داخل القاعة.", phase: "executing", priority: "high" },
    { title: "متابعة رضا الضيوف خلال الحفل", description: "رصد ملاحظات الضيوف والتعامل الفوري مع أي شكوى.", phase: "monitoring", priority: "medium" },
    ...COMMON_CLOSING,
  ],
  women: [
    ...COMMON_INIT("اللجنة النسائية"),
    { title: "خطة القسم النسائي الشاملة", description: "تحديد جميع متطلبات القسم النسائي: التجهيز، الضيافة، الزفّات، الاستقبال.", phase: "planning", priority: "urgent" },
    { title: "حصر مشتريات القسم النسائي", description: "حصر تفصيلي لاحتياجات القسم النسائي بالتنسيق مع لجنة المشتريات.", phase: "planning", priority: "high" },
    { title: "تخطيط ميزانية الزفّات وتكاليفها", description: "تقدير تكلفة كل زفّة (إضاءة، صوت، تنسيق) واعتماد الميزانية.", phase: "planning", priority: "high" },
    { title: "اختيار منسقات الزفّات والتعاقد معهن", description: "اختيار منسقات الزفّات المناسبات والتعاقد معهن رسمياً.", phase: "planning", priority: "high" },
    { title: "تجهيز قاعة النساء (ديكور، إضاءة، صوت)", description: "تركيب الديكور والإضاءة والصوت في قاعة النساء قبل الحفل.", phase: "executing", priority: "high" },
    { title: "تنفيذ ضيافة النساء (طعام، حلويات، مشروبات)", description: "ترتيب الضيافة الكاملة للنساء وتقديمها وفق جدول البرامج.", phase: "executing", priority: "high" },
    { title: "استقبال العرائس وكبار الضيفات", description: "استقبال خاص للعرائس وأمهاتهن وكبار الضيفات وتوجيههن.", phase: "executing", priority: "urgent" },
    { title: "تنفيذ الزفّات حسب الجدول", description: "متابعة سير الزفّات بالتنسيق مع لجنة البرامج وضبط التوقيت.", phase: "executing", priority: "urgent" },
    { title: "متابعة رضا الضيفات والعرائس", description: "رصد ملاحظات الحضور النسائي والاستجابة الفورية لأي طلب.", phase: "monitoring", priority: "high" },
    { title: "ضبط الانحراف عن ميزانية القسم النسائي", description: "متابعة الصرف الفعلي مقارنة بالموازنة وإصدار تنبيهات الانحراف.", phase: "monitoring", priority: "medium" },
    ...COMMON_CLOSING,
  ],
};

