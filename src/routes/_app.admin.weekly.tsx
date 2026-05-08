import { createFileRoute } from "@tanstack/react-router";
import { WeeklyReport } from "@/components/admin/WeeklyReport";

export const Route = createFileRoute("/_app/admin/weekly")({
  component: WeeklyReport,
});