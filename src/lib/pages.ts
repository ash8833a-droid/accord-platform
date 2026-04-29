import {
  ShieldCheck, LayoutGrid, Users, ClipboardCheck, Lightbulb,
  HeartHandshake, FileBarChart, MessagesSquare, Wallet, ShoppingCart,
  Palette, Target, type LucideIcon,
} from "lucide-react";

export interface PageDef {
  key: string;          // unique stable key (used in DB)
  path: string;         // route path
  label: string;        // Arabic label
  icon: LucideIcon;
  category: "إدارة" | "عمل" | "محتوى" | "مالية";
  description?: string;
}

// Registry of all controllable pages in the platform.
// To add a new gated page, add it here AND wrap that route with usePagePermission(key).
export const PAGES: PageDef[] = [
  { key: "admin",              path: "/admin",              label: "الإدارة العليا",     icon: ShieldCheck,    category: "إدارة" },
  { key: "admin-tasks",        path: "/admin/tasks",        label: "مركز المهام",         icon: Target,         category: "إدارة" },
  { key: "users",              path: "/admin/users",        label: "إدارة المستخدمين",   icon: Users,          category: "إدارة" },
  { key: "brand",              path: "/brand",              label: "الهوية البصرية",     icon: Palette,        category: "إدارة" },
  { key: "portal",             path: "/portal",             label: "بوابتي",             icon: LayoutGrid,     category: "عمل" },
  { key: "task-responses",     path: "/task-responses",     label: "متابعة أداء اللجان", icon: ClipboardCheck, category: "عمل" },
  { key: "ideas",              path: "/ideas",              label: "بنك الأفكار",        icon: Lightbulb,      category: "محتوى" },
  { key: "grooms",             path: "/grooms",             label: "سجل العرسان",        icon: HeartHandshake, category: "محتوى" },
  { key: "reports",            path: "/reports",            label: "التقارير والجودة",   icon: FileBarChart,   category: "محتوى" },
  { key: "communications",     path: "/communications",     label: "التواصل",            icon: MessagesSquare, category: "محتوى" },
  { key: "finance",            path: "/finance",            label: "المالية",            icon: Wallet,         category: "مالية" },
  { key: "payment-requests",   path: "/payment-requests",   label: "طلبات الصرف",        icon: Wallet,         category: "مالية" },
  { key: "procurement-requests", path: "/procurement-requests", label: "طلبات الشراء",   icon: ShoppingCart,   category: "مالية" },
];

export type AccessLevel = "hidden" | "read" | "edit";

export const ACCESS_LABELS: Record<AccessLevel, string> = {
  hidden: "مخفي",
  read: "قراءة فقط",
  edit: "تعديل كامل",
};
