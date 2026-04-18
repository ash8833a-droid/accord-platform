import { ReactNode, useEffect, useState } from "react";
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
  Megaphone,
  ChevronDown,
  ShieldCheck,
  Users,
  Lightbulb,
  Inbox,
} from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { COMMITTEES } from "@/lib/committees";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell } from "@/components/NotificationBell";


const ADMIN_TOP = [
  { to: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { to: "/admin", label: "الإدارة العليا", icon: ShieldCheck },
  { to: "/team", label: "فريق العمل", icon: Users },
] as const;

const ADMIN_BOTTOM = [
  { to: "/ideas", label: "بنك الأفكار", icon: Lightbulb },
  { to: "/grooms", label: "سجل العرسان", icon: HeartHandshake },
  { to: "/reports", label: "التقارير والجودة", icon: FileBarChart },
] as const;

const RESTRICTED_EXTRA = [
  { to: "/ideas", label: "بنك الأفكار", icon: Lightbulb },
] as const;

interface AppShellProps {
  children: ReactNode;
  restricted?: boolean;
  restrictedToCommitteeType?: string | null;
}

export function AppShell({ children, restricted = false, restrictedToCommitteeType = null }: AppShellProps) {
  const { user, signOut, hasRole } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [committeesOpen, setCommitteesOpen] = useState(
    path.startsWith("/committee"),
  );
  const [pendingCount, setPendingCount] = useState(0);
  const isAdminUser = hasRole("admin");
  const TOP_NAV = restricted
    ? [{ to: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard } as const]
    : ADMIN_TOP;
  const BOTTOM_NAV = restricted ? RESTRICTED_EXTRA : ADMIN_BOTTOM;
  const visibleCommittees = restricted
    ? COMMITTEES.filter((c) => c.type === restrictedToCommitteeType)
    : COMMITTEES;

  useEffect(() => {
    if (!isAdminUser) return;
    const fetchPending = async () => {
      const { count } = await supabase
        .from("membership_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      setPendingCount(count ?? 0);
    };
    fetchPending();
    const channel = supabase
      .channel("membership_requests_badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "membership_requests" },
        () => fetchPending(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdminUser]);

  const handleLogout = async () => {
    await signOut();
    nav({ to: "/auth" });
  };

  const linkClass = (active: boolean) =>
    `group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
      active
        ? "bg-gradient-gold text-gold-foreground shadow-gold"
        : "hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground"
    }`;

  const SidebarInner = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-6 border-b border-sidebar-border">
        <Logo size={44} />
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {TOP_NAV.map(({ to, label, icon: Icon }) => {
          const active = path === to || path.startsWith(to + "/");
          const showBadge = to === "/admin" && pendingCount > 0;
          return (
            <Link key={to} to={to} onClick={() => setOpen(false)} className={linkClass(active)}>
              <Icon className="h-5 w-5" />
              <span className="flex-1 text-right">{label}</span>
              {showBadge && (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}

        {/* Committees collapsible */}
        <div>
          <button
            type="button"
            onClick={() => setCommitteesOpen((v) => !v)}
            className={linkClass(path.startsWith("/committee"))}
          >
            <Users2 className="h-5 w-5" />
            <span className="flex-1 text-right">اللجان والمهام</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${committeesOpen ? "rotate-180" : ""}`}
            />
          </button>
          {committeesOpen && (
            <div className="mt-1 mr-3 ps-2 border-s border-sidebar-border/60 space-y-0.5 animate-fade-up">
              {visibleCommittees.map(({ type, label, icon: Icon, tone }) => {
                const to = `/committee/${type}`;
                const active = path === to;
                return (
                  <Link
                    key={type}
                    to="/committee/$type"
                    params={{ type }}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                      active
                        ? "bg-sidebar-accent text-sidebar-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                    }`}
                  >
                    <span className={`h-7 w-7 rounded-md flex items-center justify-center ${tone}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex-1 text-right">{label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {BOTTOM_NAV.map(({ to, label, icon: Icon }) => {
          const active = path === to || path.startsWith(to + "/");
          return (
            <Link key={to} to={to} onClick={() => setOpen(false)} className={linkClass(active)}>
              <Icon className="h-5 w-5" />
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
      <aside className="hidden lg:flex w-72 shrink-0 sticky top-0 h-screen border-l border-sidebar-border">
        {SidebarInner}
      </aside>

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

        <main className="flex-1 px-4 lg:px-8 py-6 lg:py-8 max-w-7xl w-full me-auto animate-fade-up">
          {children}
        </main>
      </div>
    </div>
  );
}
