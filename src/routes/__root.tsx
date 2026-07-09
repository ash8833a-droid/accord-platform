import { Outlet, createRootRoute, HeadContent, Scripts, Link, useRouterState } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { AnnouncementsBanner } from "@/components/AnnouncementsBanner";
import { InstallAppButton } from "@/components/InstallAppButton";

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-shimmer-gold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">لم نجد الصفحة التي تبحث عنها.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-gradient-hero px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant hover:opacity-90 transition"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "لجنة الزواج الجماعي" },
      { name: "description", content: "منصة لجنة الزواج الجماعي العائلي: تسجيل العرسان، تنظيم المساهمات، متابعة اللجان، والإشراف على البرامج والفعاليات." },
      { property: "og:url", content: "https://lajnat-zawaj.org" },
      { property: "og:site_name", content: "لجنة الزواج الجماعي" },
      { property: "og:title", content: "لجنة الزواج الجماعي" },
      { name: "twitter:title", content: "لجنة الزواج الجماعي" },
      { property: "og:description", content: "منصة لجنة الزواج الجماعي العائلي: تسجيل العرسان، تنظيم المساهمات، متابعة اللجان، والإشراف على البرامج والفعاليات." },
      { name: "twitter:description", content: "منصة لجنة الزواج الجماعي العائلي: تسجيل العرسان، تنظيم المساهمات، متابعة اللجان، والإشراف على البرامج والفعاليات." },
      { property: "og:image", content: "https://lajnat-zawaj.org/og-register-groom.jpg" },
      { property: "og:image:alt", content: "شعار لجنة الزواج الجماعي" },
      { name: "twitter:image", content: "https://lajnat-zawaj.org/og-register-groom.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#0E3A42" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "لجنة الزواج الجماعي" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;900&display=swap" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "لجنة الزواج الجماعي",
          url: "https://lajnat-zawaj.org",
          logo: "https://lajnat-zawaj.org/icon-512.png",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "لجنة الزواج الجماعي",
          url: "https://lajnat-zawaj.org",
          inLanguage: "ar",
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
});

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideBanner = pathname.startsWith("/register-groom") || pathname === "/";
  return (
    <AuthProvider>
      {!hideBanner && (
        <div className="z-50 md:sticky md:top-0">
          <AnnouncementsBanner />
        </div>
      )}
      <Outlet />
      <Toaster richColors position="top-center" />
      <InstallAppButton />
    </AuthProvider>
  );
}

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
