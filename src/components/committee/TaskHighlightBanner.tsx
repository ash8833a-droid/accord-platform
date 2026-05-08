import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date?: string | null;
}

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export function TaskHighlightBanner({ tasks }: { tasks: Task[] }) {
  const top = useMemo(() => {
    const pending = tasks.filter((t) => t.status !== "completed");
    const sorted = [...pending].sort(
      (a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9),
    );
    const t = sorted[0];
    if (!t) return null;
    if (t.priority !== "urgent" && t.priority !== "high") return null;
    return t;
  }, [tasks]);

  if (!top) return null;
  const isUrgent = top.priority === "urgent";

  return (
    <div
      role="alert"
      className={`relative overflow-hidden rounded-2xl border p-4 flex items-start gap-3 shadow-sm ${
        isUrgent
          ? "border-destructive/40 bg-destructive/5"
          : "border-amber-500/40 bg-amber-500/10"
      }`}
    >
      <span
        className={`relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
          isUrgent
            ? "bg-destructive/15 text-destructive"
            : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
        }`}
      >
        <span
          className={`absolute inset-0 rounded-full ${
            isUrgent ? "bg-destructive/30" : "bg-amber-500/30"
          } animate-ping`}
        />
        <AlertTriangle className="relative h-5 w-5" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold tracking-wide text-muted-foreground mb-1">
          {isUrgent ? "مهمة عاجلة بانتظار التنفيذ" : "مهمة ذات أولوية عالية"}
        </div>
        <div className="text-base font-bold leading-snug truncate">{top.title}</div>
        {top.due_date && (
          <div className="text-xs text-muted-foreground mt-1">
            الموعد المستحق: {new Date(top.due_date).toLocaleDateString("ar-SA")}
          </div>
        )}
      </div>
      <span
        className={`shrink-0 self-center rounded-full px-2.5 py-1 text-[11px] font-bold ${
          isUrgent
            ? "bg-destructive text-destructive-foreground"
            : "bg-amber-500 text-white"
        }`}
      >
        {isUrgent ? "عاجلة" : "عالية"}
      </span>
    </div>
  );
}