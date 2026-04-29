import { createFileRoute } from "@tanstack/react-router";
import { TaskCenterPage } from "@/components/admin/TaskCenterPage";

export const Route = createFileRoute("/_app/admin/tasks")({
  component: TaskCenterPage,
});
