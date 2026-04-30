import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, approved, hasRole, committeeId } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [myCommitteeType, setMyCommitteeType] = useState<string | null>(null);
  const [typeLoaded, setTypeLoaded] = useState(false);

  const isAdmin = hasRole("admin");
  const isQuality = hasRole("quality");
  const restricted = !isAdmin && !isQuality;

  useEffect(() => {
    if (!committeeId) {
      setMyCommitteeType(null);
      setTypeLoaded(true);
      return;
    }
    setTypeLoaded(false);
    supabase
      .from("committees")
      .select("type")
      .eq("id", committeeId)
      .maybeSingle()
      .then(({ data }) => {
        setMyCommitteeType(data?.type ?? null);
        setTypeLoaded(true);
      });
  }, [committeeId]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/auth" });
      return;
    }
    if (!approved) {
      nav({ to: "/pending" });
      return;
    }
    if (!restricted || !typeLoaded) return;

    const isSupreme = myCommitteeType === "supreme";
    // الإدارة العليا (تشمل لوحة التحكم) متاحة فقط للجنة العليا/المدير/الجودة
    if (path === "/admin" || path.startsWith("/admin/")) {
      if (!isSupreme) {
        if (myCommitteeType) {
          nav({ to: "/committee/$type", params: { type: myCommitteeType } });
        } else {
          nav({ to: "/ideas" });
        }
        return;
      }
    }

    // المسارات المسموحة للأعضاء العاديين — لجنتهم + الطلبات
    const allowed: string[] = ["/payment-requests", "/procurement-requests", "/ideas"];
    if (isSupreme) allowed.push("/admin");
    if (myCommitteeType === "finance" || isSupreme) allowed.push("/finance-management");
    if (myCommitteeType) allowed.push(`/committee/${myCommitteeType}`);
    const ok = allowed.some((p) => path === p || path.startsWith(p + "/"));
    if (!ok) {
      // الافتراضي: لجنة العضو، وإلا صفحة الأفكار
      if (myCommitteeType) {
        nav({ to: "/committee/$type", params: { type: myCommitteeType } });
      } else {
        nav({ to: "/ideas" });
      }
    }
  }, [user, loading, approved, nav, path, restricted, typeLoaded, myCommitteeType]);

  if (loading || !user || !approved) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppShell
      restrictedToCommitteeType={restricted ? myCommitteeType : null}
      restricted={restricted}
      canSeeDashboard={isAdmin || isQuality || myCommitteeType === "supreme"}
    >
      <Outlet />
    </AppShell>
  );
}
