import { Outlet, createRootRoute, HeadContent, Scripts, Link, useRouterState } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { AnnouncementsBanner } from "@/components/AnnouncementsBanner";

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
      { title: "منصة لجنة الزواج الجماعي" },
      { name: "description", content: "منصة مؤسسية لإدارة برنامج الزواج الجماعي العائلي" },
      { property: "og:url", content: "https://lajnat-zawaj.org" },
      { property: "og:site_name", content: "لجنة الزواج الجماعي" },
      { property: "og:title", content: "منصة لجنة الزواج الجماعي" },
      { name: "twitter:title", content: "منصة لجنة الزواج الجماعي" },
      { property: "og:description", content: "منصة مؤسسية لإدارة برنامج الزواج الجماعي العائلي" },
      { name: "twitter:description", content: "منصة مؤسسية لإدارة برنامج الزواج الجماعي العائلي" },
      { property: "og:image", content: "https://lajnat-zawaj.org/og-register-groom.jpg" },
      { property: "og:image:secure_url", content: "https://lajnat-zawaj.org/og-register-groom.jpg" },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:width", content: "640" },
      { property: "og:image:height", content: "640" },
      { property: "og:image:alt", content: "شعار لجنة الزواج الجماعي" },
      { name: "twitter:image", content: "https://lajnat-zawaj.org/og-register-groom.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "canonical", href: "https://lajnat-zawaj.org" },
      { rel: "stylesheet", href: appCss },
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
