import { Outlet, createRootRoute, HeadContent, Scripts, Link } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";

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
      { property: "og:title", content: "منصة لجنة الزواج الجماعي" },
      { name: "twitter:title", content: "منصة لجنة الزواج الجماعي" },
      { property: "og:description", content: "منصة مؤسسية لإدارة برنامج الزواج الجماعي العائلي" },
      { name: "twitter:description", content: "منصة مؤسسية لإدارة برنامج الزواج الجماعي العائلي" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/138cf71b-16c8-4a68-b7b1-be5614a7e9e6" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/138cf71b-16c8-4a68-b7b1-be5614a7e9e6" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: () => (
    <AuthProvider>
      <Outlet />
      <Toaster richColors position="top-center" />
    </AuthProvider>
  ),
  notFoundComponent: NotFound,
});

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
