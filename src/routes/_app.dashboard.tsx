import { createFileRoute, redirect } from "@tanstack/react-router";

// لوحة التحكم لم تعد تستخدم — نُحوّل دائماً إلى بوابتي
// (الأدوار العليا توجَّه لصفحاتها الخاصة من شاشة الدخول مباشرة)
export const Route = createFileRoute("/_app/dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/portal" });
  },
});
