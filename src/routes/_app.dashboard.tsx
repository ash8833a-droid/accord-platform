import { createFileRoute, redirect } from "@tanstack/react-router";

// لوحة التحكم مدمجة الآن داخل صفحة الإدارة العليا — نحوّل أي زيارة لها إلى /admin
export const Route = createFileRoute("/_app/dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
});
