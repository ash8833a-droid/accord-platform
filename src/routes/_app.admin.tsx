import { createFileRoute, Outlet, useMatches } from "@tanstack/react-router";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";

export const Route = createFileRoute("/_app/admin")({
  component: AdminCenter,
});

function AdminCenter() {
  const matches = useMatches();
  const hasChildRoute = matches.some(
    (m) => m.routeId !== "/_app/admin" && m.routeId.startsWith("/_app/admin/")
  );
  if (hasChildRoute) return <Outlet />;
  return <AnalyticsDashboard />;
}
