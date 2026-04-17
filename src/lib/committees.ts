import {
  Wallet,
  Megaphone,
  ShieldCheck,
  CalendarRange,
  UtensilsCrossed,
  Truck,
  HeartHandshake,
  type LucideIcon,
} from "lucide-react";

export type CommitteeType =
  | "finance"
  | "media"
  | "quality"
  | "programs"
  | "dinner"
  | "logistics"
  | "reception";

export interface CommitteeMeta {
  type: CommitteeType;
  label: string;
  icon: LucideIcon;
  tone: string; // tailwind classes for icon background
  description: string;
}

export const COMMITTEES: CommitteeMeta[] = [
  { type: "finance",   label: "اللجنة المالية", icon: Wallet,           tone: "bg-emerald-500/15 text-emerald-600", description: "الميزانية والتحصيل والمناديب وطلبات الصرف" },
  { type: "media",     label: "اللجنة الإعلامية", icon: Megaphone,       tone: "bg-rose-500/15 text-rose-600",       description: "الحملات الإعلامية والتغطية والمحتوى" },
  { type: "quality",   label: "لجنة الجودة",     icon: ShieldCheck,     tone: "bg-sky-500/15 text-sky-600",         description: "الرقابة والمتابعة وتقييم الأداء" },
  { type: "programs",  label: "لجنة البرامج",    icon: CalendarRange,   tone: "bg-violet-500/15 text-violet-600",   description: "تنظيم الفعاليات وبرامج الحفل" },
  { type: "dinner",    label: "لجنة العشاء",     icon: UtensilsCrossed, tone: "bg-amber-500/15 text-amber-600",     description: "ترتيبات الطعام والضيافة" },
  { type: "logistics", label: "لجنة التجهيزات",  icon: Truck,           tone: "bg-orange-500/15 text-orange-600",   description: "النقل والتجهيزات اللوجستية" },
  { type: "reception", label: "لجنة الاستقبال",  icon: HeartHandshake,  tone: "bg-pink-500/15 text-pink-600",       description: "استقبال الضيوف والعرسان" },
];

export const committeeByType = (t: string) => COMMITTEES.find((c) => c.type === t);
