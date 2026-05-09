import { ReactNode, useEffect, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Wallet,
  HeartHandshake,
  FileBarChart,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  Lightbulb,
  UserCog,
  KeyRound,
  Target,
} from "lucide-react";
import { ShoppingCart, Inbox, LayoutGrid } from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell } from "@/components/NotificationBell";
import { useBrand, applyBrandCssVars } from "@/lib/brand";
import { QuickPurchaseRequestDialog } from "@/components/QuickPurchaseRequestDialog";
import { useAllPageAccess } from "@/hooks/use-page-access";
import { PAGES } from "@/lib/pages";
import { committeeByType } from "@/lib/committees";
import { useAdminAlerts } from "@/hooks/use-admin-alerts";


const ADMIN_TOP = [
  { to: "/admin", label: "الأداء العام", icon: ShieldCheck },
  { to: "/admin/tasks", label: "مركز المهام", icon: Target },
] as const;

const ADMIN_BOTTOM = [
  { to: "/ideas", label: "بنك الأفكار", icon: Lightbulb },
  { to: "/grooms", label: "سجل العرسان", icon: HeartHandshake },
  { to: "/reports", label: "التقارير والجودة", icon: FileBarChart },
  { to: "/communications", label: "إدارة الطلبات", icon: Inbox },
  { to: "/finance-management", label: "إدارة المالية", icon: Wallet },
  { to: "/admin/users", label: "إدارة المستخدمين", icon: UserCog },
] as const;

// للأعضاء العاديين: لجنتهم هي المدخل (تظهر تلقائياً ضمن "لجاني")
const RESTRICTED_TOP: ReadonlyArray<{ to: string; label: string; icon: typeof LayoutGrid }> = [];

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
  const [profileName, setProfileName] = useState<string | null>(null);
  const [isCommitteeHead, setIsCommitteeHead] = useState(false);

  useEffect(() => {
    if (!user) { setProfileName(null); return; }
    supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setProfileName(data?.full_name ?? null));
  }, [user]);
  useEffect(() => {
    if (!user) { setIsCommitteeHead(false); return; }
    supabase.from("committees").select("id", { count: "exact", head: true })
      .eq("head_user_id", user.id)
      .then(({ count }) => setIsCommitteeHead((count ?? 0) > 0));
  }, [user]);
  const isAdminUser = hasRole("admin");
  const { count: pendingCount } = useAdminAlerts(isAdminUser);
  const { map: accessMap, isAdmin: isAdminMap } = useAllPageAccess();
  const isPathHidden = (to: string) => {
    if (isAdminMap) return false;
    const page = PAGES.find((p) => p.path === to);
    if (!page) return false;
    return accessMap[page.key] === "hidden";
  };
  const myCommitteeMeta = restrictedToCommitteeType ? committeeByType(restrictedToCommitteeType) : null;
  const restrictedNav: Array<{ to: string; label: string; icon: typeof LayoutGrid; params?: Record<string, string> }> = [];
  if (canSeeDashboard) {
    restrictedNav.push({ to: "/admin", label: "الأداء العام", icon: ShieldCheck });
  }
  if (restrictedToCommitteeType && myCommitteeMeta) {
    restrictedNav.push({
      to: "/committee/$type",
      params: { type: restrictedToCommitteeType },
      label: myCommitteeMeta.label,
      icon: myCommitteeMeta.icon,
    });
  }
  restrictedNav.push({ to: "/admin/tasks", label: "مركز المهام", icon: Target });
  // Media Committee: grant permanent unrestricted access to the Grooms Registry
  if (restrictedToCommitteeType === "media") {
    restrictedNav.push({ to: "/grooms", label: "سجل العرسان", icon: HeartHandshake });
  }
  // Standard Committee Members (not admin/quality, not committee head): show ONLY Task Center.
  const isStandardMember = restricted && !isCommitteeHead && !hasRole("quality");
  const standardMemberNav: typeof restrictedNav = [];
  // Unified entry-point for regular members: Task Center is auto-filtered to their committee.
  standardMemberNav.push({ to: "/admin/tasks", label: "مركز المهام", icon: Target });
  standardMemberNav.push({ to: "/ideas", label: "بنك الأفكار", icon: Lightbulb });
  const TOP_NAV = isStandardMember
    ? standardMemberNav
    : restricted
      ? restrictedNav
      : ADMIN_TOP.filter((n) => !isPathHidden(n.to));
  const BOTTOM_NAV = restricted ? [] : ADMIN_BOTTOM.filter((n) => !isPathHidden(n.to));

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
          // Exact-match for parent routes that have children (e.g. /admin vs /admin/tasks)
          const hasChildRoute = TOP_NAV.some(
            (n) => n.to !== to && n.to.startsWith(to + "/"),
          );
          const item = TOP_NAV.find((n) => n.to === to)!;
          const params = (item as any).params as Record<string, string> | undefined;
          const resolvedPath = params
            ? to.replace(/\$(\w+)/g, (_, k) => params[k] ?? "")
            : to;
          const active = hasChildRoute
            ? path === resolvedPath
            : path === resolvedPath || path.startsWith(resolvedPath + "/");
          const showBadge = to === "/admin" && pendingCount > 0;
          return (
            <Link key={to} to={to as any} params={params as any} onClick={() => setOpen(false)} className={linkClass(active)}>
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
        {/* Mobile-only top header. Standard committee members rely solely on the bottom bar (no hamburger). */}
        <div className="lg:hidden sticky top-0 z-30 bg-background/80 backdrop-blur border-b flex items-center justify-between px-3 h-14">
          {isStandardMember ? (
            <>
              {/* Minimalist top header — Idea Bank lives in the bottom nav, no duplication */}
              <span aria-hidden />
              <button
                onClick={handleLogout}
                aria-label="تسجيل خروج"
                className="inline-flex items-center justify-center h-10 w-10 rounded-xl text-muted-foreground hover:bg-accent active:scale-95 transition-transform"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </>
          ) : (
            <>
              <button
                className="p-2 rounded-lg hover:bg-accent"
                onClick={() => setOpen(true)}
                aria-label="فتح القائمة"
              >
                <Menu className="h-5 w-5" />
              </button>
              <NotificationBell />
            </>
          )}
        </div>

        <main key={path} className="flex-1 px-4 lg:px-8 py-6 lg:py-8 pb-24 lg:pb-8 max-w-7xl w-full me-auto animate-route-fade">
          {children}
        </main>

        <nav
          dir="rtl"
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-card border-t border-border shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className={`grid h-16 ${isStandardMember ? "grid-cols-2" : "grid-cols-5"}`}>
            {(isStandardMember
              ? [
                  { to: "/admin/tasks", label: "مركز المهام", icon: Target },
                  { to: "/ideas", label: "بنك الأفكار", icon: Lightbulb },
                ]
              : [
                  ...(isAdminUser && canSeeDashboard
                    ? [{ to: "/admin", label: "الإدارة", icon: ShieldCheck }]
                    : []),
                  { to: "/ideas", label: "الأفكار", icon: Lightbulb },
                  ...(committeeId
                    ? [{ to: "__purchase", label: "طلب شراء", icon: ShoppingCart }]
                    : [{ to: "/grooms", label: "العرسان", icon: HeartHandshake }]),
                  { to: "/communications", label: "الطلبات", icon: Inbox },
                  { to: "__menu", label: "القائمة", icon: Menu },
                ]
            ).map((item) => {
              const isMenu = item.to === "__menu";
              const isPurchase = item.to === "__purchase";
              const active =
                !isMenu &&
                !isPurchase &&
                (item.to === "/admin"
                  ? path === item.to
                  : path === item.to || path.startsWith(item.to + "/"));
              const Icon = item.icon;
              const inner = (
                <>
                  <Icon className={`h-5 w-5 ${active ? "text-[#064e3b]" : "text-muted-foreground"}`} />
                  <span className={`text-[11px] mt-1 leading-none ${active ? "text-[#064e3b] font-bold" : "text-muted-foreground"}`}>{item.label}</span>
                </>
              );
              if (isMenu) {
                return (
                  <button
                    key="menu"
                    onClick={() => setOpen(true)}
                    className="flex flex-col items-center justify-center gap-0 active:scale-95 transition-transform"
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
                    className="flex flex-col items-center justify-center gap-0 active:scale-95 transition-transform"
                  >
                    {inner}
                  </button>
                );
              }
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex flex-col items-center justify-center gap-0 active:scale-95 transition-transform"
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
