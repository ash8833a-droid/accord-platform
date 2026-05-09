import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";

interface Task {
  id: string;
  title: string;
  status: string;
  due_date?: string | null;
  created_at?: string;
}

export function TaskHighlightBanner({ tasks }: { tasks: Task[] }) {
  const top = useMemo(() => {
    const pending = tasks.filter((t) => t.status !== "completed");
    const sorted = [...pending].sort((a, b) => {
      const at = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
      return at - bt;
    });
    return sorted[0] ?? null;
  }, [tasks]);

  if (!top) return null;

  return (
    <div
      role="alert"
      className="relative overflow-hidden rounded-2xl border border-primary/40 bg-primary/5 p-4 flex items-start gap-3 shadow-sm"
    >
      <span
        className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
      >
        <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
        <AlertTriangle className="relative h-5 w-5" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold tracking-wide text-muted-foreground mb-1">
          المهمة الحالية (الأقدم في قائمة الانتظار)
        </div>
        <div className="text-base font-bold leading-snug truncate">{top.title}</div>
        {top.due_date && (
          <div className="text-xs text-muted-foreground mt-1">
            الموعد المستحق: {new Date(top.due_date).toLocaleDateString("ar-SA")}
          </div>
        )}
      </div>
    </div>
  );
}