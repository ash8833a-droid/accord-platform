import { ReactNode, useEffect, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Wallet,
  Users2,
  HeartHandshake,
  FileBarChart,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ShieldCheck,
  Users,
  Lightbulb,
  ClipboardCheck,
  Home,
  UserCog,
  KeyRound,
  Target,
} from "lucide-react";
import { ShoppingCart, MessagesSquare, LayoutGrid } from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { COMMITTEES } from "@/lib/committees";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell } from "@/components/NotificationBell";
import { useBrand, brandLogoSrc, applyBrandCssVars } from "@/lib/brand";
import { QuickPurchaseRequestDialog } from "@/components/QuickPurchaseRequestDialog";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useAllPageAccess } from "@/hooks/use-page-access";
import { PAGES } from "@/lib/pages";


const ADMIN_TOP = [
  { to: "/admin", label: "الإدارة العليا", icon: ShieldCheck },
  { to: "/admin/tasks", label: "مركز المهام", icon: Target },
  { to: "/portal", label: "بوابتي", icon: LayoutGrid },
  { to: "/task-responses", label: "متابعة أداء اللجان", icon: ClipboardCheck },
] as const;

const ADMIN_BOTTOM = [
  { to: "/ideas", label: "بنك الأفكار", icon: Lightbulb },
  { to: "/grooms", label: "سجل العرسان", icon: HeartHandshake },
  { to: "/reports", label: "التقارير والجودة", icon: FileBarChart },
  { to: "/communications", label: "التواصل", icon: MessagesSquare },
  { to: "/admin/users", label: "إدارة المستخدمين", icon: UserCog },
] as const;

// للأعضاء العاديين: بوابتي هي المدخل الوحيد + قائمة "لجاني" المنسدلة
// (نخفي بنك الأفكار والتواصل وغيرها لتقليل التشتت)
const RESTRICTED_TOP = [
  { to: "/portal", label: "بوابتي", icon: LayoutGrid },
] as const;

interface AppShellProps {
  children: ReactNode;
  restricted?: boolean;
  restrictedToCommitteeType?: string | null;
  canSeeDashboard?: boolean;
}

export function AppShell({ children, restricted = false, restrictedToCommitteeType = null, canSeeDashboard = true }: AppShellProps) {
  const { user, signOut, hasRole, committeeId } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const { brand } = useBrand();
  useEffect(() => { applyBrandCssVars(brand); }, [brand]);
  const [committeesOpen, setCommitteesOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setProfileName(null); return; }
    supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setProfileName(data?.full_name ?? null));
  }, [user]);
  const isAdminUser = hasRole("admin");
  const { map: accessMap, isAdmin: isAdminMap } = useAllPageAccess();
  const isPathHidden = (to: string) => {
    if (isAdminMap) return false;
    const page = PAGES.find((p) => p.path === to);
    if (!page) return false;
    return accessMap[page.key] === "hidden";
  };
  const TOP_NAV = restricted
    ? (canSeeDashboard
        ? [
            { to: "/admin", label: "الإدارة العليا", icon: ShieldCheck } as const,
            ...RESTRICTED_TOP,
          ]
        : RESTRICTED_TOP)
    : ADMIN_TOP.filter((n) => !isPathHidden(n.to));
  const BOTTOM_NAV = restricted ? [] : ADMIN_BOTTOM.filter((n) => !isPathHidden(n.to));
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
    `group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
      active
        ? "bg-gradient-gold text-gold-foreground"
        : "hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground"
    }`;

  const SidebarInner = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-4 py-3 border-b border-sidebar-border">
        <Logo size={32} />
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto no-scrollbar">
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

        <div>
          <button
            type="button"
            onClick={() => setCommitteesOpen((v) => !v)}
            className={linkClass(path.startsWith("/committee"))}
          >
            <Users2 className="h-5 w-5" />
            <span className="flex-1 text-right">{restricted ? "لجاني" : "اللجان والمهام"}</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${committeesOpen ? "rotate-180" : ""}`}
            />
          </button>
          {committeesOpen && (
            <div className="mt-1 mr-3 ps-2 border-s border-sidebar-border/60 space-y-0.5">
              {visibleCommittees.map(({ type, label, icon: Icon, tone }) => {
                const to = `/committee/${type}`;
                const active = path === to;
                return (
                  <Link
                    key={type}
                    to="/committee/$type"
                    params={{ type }}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
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

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center justify-between gap-2 rounded-lg bg-sidebar-accent/50 px-3 py-2">
          <p className="text-sm font-bold truncate flex-1">
            {(profileName ?? user?.email ?? "").split(" ")[0] || "عضو"}
          </p>
          <button
            onClick={handleLogout}
            aria-label="تسجيل خروج"
            title="تسجيل خروج"
            className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
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
          <aside className="relative w-72 ms-auto h-full">{SidebarInner}</aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile-only floating menu trigger (top header removed per request) */}
        <div className="lg:hidden sticky top-0 z-30 bg-background/80 backdrop-blur border-b flex items-center justify-between px-3 h-12">
          <button
            className="p-2 rounded-lg hover:bg-accent"
            onClick={() => setOpen(true)}
            aria-label="فتح القائمة"
          >
            <Menu className="h-5 w-5" />
          </button>
          <NotificationBell />
        </div>

        <main className="flex-1 px-4 lg:px-8 py-6 lg:py-8 pb-24 lg:pb-8 max-w-7xl w-full me-auto">
          {children}
        </main>

        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-background border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
          <div className="grid grid-cols-5 h-16">
            {[
              ...(isAdminUser && canSeeDashboard
                ? [{ to: "/admin", label: "الإدارة", icon: ShieldCheck }]
                : []),
              { to: "/ideas", label: "الأفكار", icon: Lightbulb },
              ...(committeeId
                ? [{ to: "__purchase", label: "طلب شراء", icon: ShoppingCart }]
                : [{ to: "/grooms", label: "العرسان", icon: HeartHandshake }]),
              { to: "/communications", label: "التواصل", icon: MessagesSquare },
              { to: "__menu", label: "القائمة", icon: Menu },
            ].map((item) => {
              const isMenu = item.to === "__menu";
              const isPurchase = item.to === "__purchase";
              const active = !isMenu && !isPurchase && (path === item.to || path.startsWith(item.to + "/"));
              const Icon = item.icon;
              const inner = (
                <>
                  <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-[10px] mt-0.5 ${active ? "text-primary font-bold" : "text-muted-foreground"}`}>{item.label}</span>
                </>
              );
              if (isMenu) {
                return (
                  <button
                    key="menu"
                    onClick={() => setOpen(true)}
                    className="flex flex-col items-center justify-center gap-0"
                  >
                    {inner}
                  </button>
                );
              }
              if (isPurchase) {
                return (
                  <button
                    key="purchase"
                    onClick={() => setPurchaseOpen(true)}
                    className="flex flex-col items-center justify-center gap-0"
                  >
                    {inner}
                  </button>
                );
              }
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex flex-col items-center justify-center gap-0"
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
      <QuickPurchaseRequestDialog open={purchaseOpen} onOpenChange={setPurchaseOpen} />
    </div>
  );
}
