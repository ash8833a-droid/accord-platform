import {
  Wallet,
  Megaphone,
  ShieldCheck,
  CalendarRange,
  UtensilsCrossed,
  ShoppingCart,
  HeartHandshake,
  Sparkles,
  Crown,
  type LucideIcon,
} from "lucide-react";

export type CommitteeType =
  | "supreme"
  | "finance"
  | "media"
  | "quality"
  | "programs"
  | "dinner"
  | "procurement"
  | "reception"
  | "women";

export interface CommitteeMeta {
  type: CommitteeType;
  label: string;
  icon: LucideIcon;
  tone: string; // tailwind classes for icon background
  description: string;
  /** أهم أهداف اللجنة الاستراتيجية */
  goals?: string[];
}

export const COMMITTEES: CommitteeMeta[] = [
  {
    type: "supreme",
    label: "اللجنة العليا",
    icon: Crown,
    tone: "bg-gold/15 text-gold",
    description: "القيادة العليا والإشراف على جميع اللجان واتخاذ القرارات الاستراتيجية",
    goals: [
      "رسم التوجهات الاستراتيجية العامة للحفل",
      "اعتماد الموازنات والخطط التنفيذية",
      "متابعة أداء جميع اللجان وتذليل العقبات",
      "اتخاذ القرارات النهائية في القضايا المصيرية",
    ],
  },
  {
    type: "finance",
    label: "اللجنة المالية",
    icon: Wallet,
    tone: "bg-emerald-500/15 text-emerald-600",
    description: "الميزانية والتحصيل والمناديب وطلبات الصرف",
    goals: [
      "إعداد موازنة سنوية معتمدة لجميع اللجان",
      "تحصيل اشتراكات أبناء العائلة في الوقت المحدد",
      "صرف الطلبات خلال 72 ساعة من الاعتماد",
      "إصدار تقرير مالي شهري دقيق",
    ],
  },
  {
    type: "media",
    label: "اللجنة الإعلامية",
    icon: Megaphone,
    tone: "bg-rose-500/15 text-rose-600",
    description: "الحملات الإعلامية والتغطية والمحتوى",
    goals: [
      "بناء هوية إعلامية موحدة للحفل",
      "تغطية احترافية مباشرة لجميع الفقرات",
      "نشر محتوى دوري لزيادة الوصول",
      "توثيق الحفل بأرشيف صور وفيديو عالي الجودة",
    ],
  },
  {
    type: "quality",
    label: "لجنة الجودة",
    icon: ShieldCheck,
    tone: "bg-sky-500/15 text-sky-600",
    description: "الرقابة والمتابعة وتقييم الأداء",
    goals: [
      "اعتماد معايير جودة قابلة للقياس لكل لجنة",
      "تنفيذ تدقيقات دورية على المخرجات",
      "قياس رضا الضيوف والعرسان",
      "متابعة الإجراءات التصحيحية حتى الإغلاق",
    ],
  },
  {
    type: "programs",
    label: "لجنة البرامج",
    icon: CalendarRange,
    tone: "bg-violet-500/15 text-violet-600",
    description: "تنظيم الفعاليات وبرامج الحفل",
    goals: [
      "إعداد جدول زمني دقيق لفقرات الحفل",
      "تنسيق المتحدثين والمنشدين",
      "تنفيذ بروفة شاملة قبل الحفل بأسبوع",
      "ضبط التوقيت يوم الحفل",
    ],
  },
  {
    type: "dinner",
    label: "لجنة العشاء",
    icon: UtensilsCrossed,
    tone: "bg-amber-500/15 text-amber-600",
    description: "ترتيبات الطعام والضيافة",
    goals: [
      "تقدير دقيق لعدد الضيوف وكميات الوجبات",
      "اختيار مورد إعاشة ذي جودة معتمدة",
      "تجهيز قاعة العشاء قبل وقت كافٍ",
      "ضمان الالتزام بالاشتراطات الصحية",
    ],
  },
  {
    type: "procurement",
    label: "لجنة المشتريات",
    icon: ShoppingCart,
    tone: "bg-orange-500/15 text-orange-600",
    description: "إدارة المشتريات والموردين وضبط التكاليف وتسليم المستلزمات في الوقت المحدد",
    goals: [
      "حصر شامل للمستلزمات وتحديد المواصفات",
      "اختيار الموردين الأنسب سعراً وجودة",
      "ضبط تكاليف الشراء ضمن الموازنة المعتمدة",
      "تسليم جميع المستلزمات قبل الحفل بوقت كافٍ",
      "أرشفة العقود والفواتير لكل عملية شراء",
    ],
  },
  {
    type: "reception",
    label: "لجنة الاستقبال والضيافة",
    icon: HeartHandshake,
    tone: "bg-pink-500/15 text-pink-600",
    description: "استقبال الضيوف والعرسان",
    goals: [
      "تصميم مسار استقبال منظم وواضح",
      "تأكيد قائمة الضيوف وكبار الحضور",
      "استقبال خاص للعرسان وكبار الضيوف",
      "متابعة رضا الحضور خلال الحفل",
    ],
  },
  {
    type: "women",
    label: "اللجنة النسائية",
    icon: Sparkles,
    tone: "bg-fuchsia-500/15 text-fuchsia-600",
    description: "القسم النسائي للحفل: المشتريات والتجهيزات والضيافة وتكاليف الزفّات",
    goals: [
      "إدارة كاملة للقسم النسائي بالتنسيق مع لجان الحفل الرئيسية",
      "ترتيب ضيافة كاملة للنساء (طعام، حلويات، مشروبات)",
      "تنسيق الزفّات وضبط جدولها وتكاليفها",
      "ضبط تكاليف القسم النسائي ضمن الموازنة المعتمدة",
    ],
  },
];

export const committeeByType = (t: string) => COMMITTEES.find((c) => c.type === t);
