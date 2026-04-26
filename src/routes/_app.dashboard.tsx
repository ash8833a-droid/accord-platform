import { createFileRoute } from "@tanstack/react-router";
import { DashboardOverview } from "@/components/DashboardOverview";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  return <DashboardOverview />;
}
