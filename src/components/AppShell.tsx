import { ReactNode, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Wallet,
  Users2,
  HeartHandshake,
  FileBarChart,
  LogOut,
  Menu,
  X,
  Bell,
  Megaphone,
} from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { to: "/finance", label: "المالية والمناديب", icon: Wallet },
  { to: "/committees", label: "اللجان والمهام", icon: Users2 },
  { to: "/grooms", label: "سجل العرسان", icon: HeartHandshake },
  { to: "/reports", label: "التقارير والجودة", icon: FileBarChart },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    nav({ to: "/auth" });
  };

  const SidebarInner = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-6 border-b border-sidebar-border">
        <Logo size={44} />
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = path === to || path.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                active
                  ? "bg-gradient-gold text-gold-foreground shadow-gold"
                  : "hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "" : "group-hover:scale-110 transition-transform"}`} />
              <span className="flex-1 text-right">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4 space-y-3">
        <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/50 px-3 py-2">
          <div className="h-9 w-9 rounded-full bg-gradient-gold flex items-center justify-center text-gold-foreground font-bold">
            {user?.email?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{user?.email}</p>
            <p className="text-[10px] text-sidebar-foreground/60">عضو في المنصة</p>
          </div>
        </div>
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start gap-2 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4" />
          تسجيل خروج
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex" dir="rtl">
      {/* Right sidebar (RTL means right is start) */}
      <aside className="hidden lg:flex w-72 shrink-0 sticky top-0 h-screen border-l border-sidebar-border">
        {SidebarInner}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative w-72 ms-auto h-full animate-fade-up">{SidebarInner}</aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 glass border-b">
          <div className="flex items-center justify-between px-4 lg:px-8 h-16">
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-accent"
              onClick={() => setOpen(true)}
              aria-label="فتح القائمة"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
              <Megaphone className="h-4 w-4 text-gold" />
              مرحباً بك في منصة البرنامج
            </div>
            <div className="flex items-center gap-2">
              <button className="relative p-2 rounded-lg hover:bg-accent transition-colors">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-gold rounded-full animate-pulse" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 lg:px-8 py-6 lg:py-8 max-w-7xl w-full mx-auto animate-fade-up">
          {children}
        </main>
      </div>
    </div>
  );
}
