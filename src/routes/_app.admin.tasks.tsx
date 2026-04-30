import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const TaskCenterPage = lazy(() =>
  import("@/components/admin/TaskCenterPage").then((m) => ({ default: m.TaskCenterPage }))
);

function TaskCenterFallback() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-muted-foreground" dir="rtl">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm">جارٍ تحميل مركز المهام…</p>
    </div>
  );
}

export const Route = createFileRoute("/_app/admin/tasks")({
  pendingComponent: TaskCenterFallback,
  pendingMs: 0,
  component: () => (
    <Suspense fallback={<TaskCenterFallback />}>
      <TaskCenterPage />
    </Suspense>
  ),
});
