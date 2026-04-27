import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/procurement-requests")({
  // تم نقل هذه الصفحة إلى داخل صفحة لجنة المشتريات
  beforeLoad: () => {
    throw redirect({ to: "/committee/$type", params: { type: "procurement" } });
  },
});