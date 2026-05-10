import {
  ShieldCheck, Users, Lightbulb,
  HeartHandshake, FileBarChart, Inbox, Wallet, ShoppingCart,
  Palette, Target, Banknote,
  Crown, Megaphone, CalendarRange, UtensilsCrossed, Sparkles, type LucideIcon,
} from "lucide-react";

export interface PageDef {
  key: string;          // unique stable key (used in DB)
  path: string;         // route path
  label: string;        // Arabic label
  icon: LucideIcon;
  category: "إدارة" | "عمل" | "محتوى" | "مالية" | "اللجان";
  description?: string;
}

// Registry of all controllable pages in the platform.
// To add a new gated page, add it here AND wrap that route with usePagePermission(key).
export const PAGES: PageDef[] = [
  { key: "admin",              path: "/admin",              label: "الأداء العام",     icon: ShieldCheck,    category: "إدارة" },
  { key: "admin-tasks",        path: "/admin/tasks",        label: "مركز المهام",         icon: Target,         category: "إدارة" },
  { key: "users",              path: "/admin/users",        label: "إدارة المستخدمين",   icon: Users,          category: "إدارة" },
  { key: "brand",              path: "/brand",              label: "الهوية البصرية",     icon: Palette,        category: "إدارة" },
  { key: "ideas",              path: "/ideas",              label: "بنك الأفكار",        icon: Lightbulb,      category: "محتوى" },
  { key: "grooms",             path: "/grooms",             label: "سجل العرسان",        icon: HeartHandshake, category: "محتوى" },
  { key: "reports",            path: "/reports",            label: "التقارير والجودة",   icon: FileBarChart,   category: "محتوى" },
  { key: "communications",     path: "/communications",     label: "إدارة الطلبات",      icon: Inbox,          category: "عمل" },
  { key: "finance",            path: "/finance",            label: "المالية",            icon: Wallet,         category: "مالية" },
  { key: "finance-management", path: "/finance-management", label: "إدارة المالية",      icon: Banknote,       category: "مالية" },
  { key: "payment-requests",   path: "/payment-requests",   label: "طلبات الصرف",        icon: Wallet,         category: "مالية" },
  { key: "procurement-requests", path: "/procurement-requests", label: "طلبات الشراء",   icon: ShoppingCart,   category: "مالية" },
  // ===== اللجان: صفحة كل لجنة (يمكن منح صلاحية مخصصة لكل عضو) =====
  { key: "committee-supreme",     path: "/committee/supreme",     label: "اللجنة العليا",            icon: Crown,            category: "اللجان" },
  { key: "committee-finance",     path: "/committee/finance",     label: "اللجنة المالية",           icon: Wallet,           category: "اللجان" },
  { key: "committee-media",       path: "/committee/media",       label: "اللجنة الإعلامية",         icon: Megaphone,        category: "اللجان" },
  { key: "committee-quality",     path: "/committee/quality",     label: "لجنة الجودة",              icon: ShieldCheck,      category: "اللجان" },
  { key: "committee-programs",    path: "/committee/programs",    label: "لجنة البرامج",             icon: CalendarRange,    category: "اللجان" },
  { key: "committee-dinner",      path: "/committee/dinner",      label: "لجنة العشاء",              icon: UtensilsCrossed,  category: "اللجان" },
  { key: "committee-procurement", path: "/committee/procurement", label: "لجنة المشتريات",           icon: ShoppingCart,     category: "اللجان" },
  { key: "committee-reception",   path: "/committee/reception",   label: "لجنة الاستقبال والضيافة", icon: HeartHandshake,   category: "اللجان" },
  { key: "committee-women",       path: "/committee/women",       label: "اللجنة النسائية",          icon: Sparkles,         category: "اللجان" },
];

export type AccessLevel = "hidden" | "read" | "edit";

export const ACCESS_LABELS: Record<AccessLevel, string> = {
  hidden: "مخفي",
  read: "قراءة فقط",
  edit: "تعديل كامل",
};
