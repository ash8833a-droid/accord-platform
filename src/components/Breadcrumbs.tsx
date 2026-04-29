import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, Home } from "lucide-react";
import { COMMITTEES } from "@/lib/committees";

const STATIC_LABELS: Record<string, string> = {
  admin: "الإدارة العليا",
  tasks: "مركز المهام",
  team: "فريق العمل",
  "task-responses": "ردود اللجان",
  ideas: "بنك الأفكار",
  grooms: "سجل العرسان",
  reports: "التقارير والجودة",
  communications: "التواصل",
  finance: "الشؤون المالية",
  dashboard: "لوحة التحكم",
  committee: "اللجان",
  "payment-requests": "طلبات الصرف",
  "procurement-requests": "طلبات الشراء",
  brand: "الهوية",
  pending: "قيد المراجعة",
};

function labelFor(segment: string, prev?: string): string {
  if (prev === "committee") {
    return COMMITTEES.find((c) => c.type === segment)?.label ?? segment;
  }
  return STATIC_LABELS[segment] ?? segment;
}

export function Breadcrumbs() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path === "/" || path === "/admin") return null;

  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  return (
    <nav
      aria-label="مسار التنقل"
      className="border-b bg-muted/20 px-4 lg:px-8 py-1.5 text-xs text-muted-foreground"
    >
      <ol className="flex items-center gap-1.5 flex-wrap">
        <li>
          <Link to="/admin" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
            <Home className="size-3.5" />
            <span>الرئيسية</span>
          </Link>
        </li>
        {parts.map((seg, i) => {
          const prev = parts[i - 1];
          const isLast = i === parts.length - 1;
          const label = labelFor(seg, prev);
          return (
            <li key={i} className="flex items-center gap-1.5">
              <ChevronLeft className="size-3.5 opacity-50" />
              <span className={isLast ? "font-bold text-foreground" : ""}>{label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}