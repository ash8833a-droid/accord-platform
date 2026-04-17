import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Loader2 } from "lucide-react";
import { COMMITTEES } from "@/lib/committees";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, approved, hasRole, committeeId } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  // Fetch the type of the user's assigned committee (for committee members)
  const { data: myCommitteeType } = useQuery({
    enabled: !!committeeId,
    queryKey: ["my-committee-type", committeeId],
    queryFn: async () => {
      const { data } = await supabase.from("committees").select("type").eq("id", committeeId!).maybeSingle();
      return data?.type ?? null;
    },
  });

  const isAdmin = hasRole("admin");
  const isQuality = hasRole("quality");

  // Allowed paths for non-admin / non-quality committee members
  const allowedPath = useMemo(() => {
    if (isAdmin || isQuality) return null; // unrestricted
    const allowed = ["/dashboard"];
    if (myCommitteeType) allowed.push(`/committee/${myCommitteeType}`);
    return allowed;
  }, [isAdmin, isQuality, myCommitteeType]);

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
    // Restrict committee members to their own committee + dashboard
    if (allowedPath && committeeId !== undefined) {
      const ok = allowedPath.some((p) => path === p || path.startsWith(p + "/"));
      if (!ok) {
        if (myCommitteeType) nav({ to: "/committee/$type", params: { type: myCommitteeType } });
        else nav({ to: "/dashboard" });
      }
    }
  }, [user, loading, approved, nav, path, allowedPath, committeeId, myCommitteeType]);

  if (loading || !user || !approved) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

// Helper for AppShell to know which committees are visible
export function useVisibleCommittees() {
  const { hasRole, committeeId } = useAuth();
  const isAdmin = hasRole("admin");
  const isQuality = hasRole("quality");
  const { data: myType } = useQuery({
    enabled: !!committeeId,
    queryKey: ["my-committee-type", committeeId],
    queryFn: async () => {
      const { data } = await supabase.from("committees").select("type").eq("id", committeeId!).maybeSingle();
      return data?.type ?? null;
    },
  });
  if (isAdmin || isQuality) return COMMITTEES;
  if (myType) return COMMITTEES.filter((c) => c.type === myType);
  return [];
}
