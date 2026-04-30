import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { AccessLevel } from "@/lib/pages";

interface PageAccess {
  level: AccessLevel;
  loading: boolean;
  canRead: boolean;
  canEdit: boolean;
  isHidden: boolean;
}

// Returns the current user's access level for a given page key.
// Admins always get 'edit'. Other users default to 'read' unless overridden.
export function usePageAccess(pageKey: string): PageAccess {
  const { user, hasRole, loading: authLoading } = useAuth();
  const [level, setLevel] = useState<AccessLevel>("read");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (authLoading) return;
    if (!user) {
      setLevel("hidden");
      setLoading(false);
      return;
    }
    if (hasRole("admin")) {
      setLevel("edit");
      setLoading(false);
      return;
    }
    supabase
      .from("page_permissions")
      .select("access_level")
      .eq("user_id", user.id)
      .eq("page_key", pageKey)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        // Default for "admin-tasks" is "edit" so committee members can manage
        // their own committee tasks (RLS already restricts visibility per committee).
        const fallback: AccessLevel = pageKey === "admin-tasks" ? "edit" : "read";
        setLevel((data?.access_level as AccessLevel) ?? fallback);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user, pageKey, authLoading, hasRole]);

  return {
    level,
    loading,
    canRead: level === "read" || level === "edit",
    canEdit: level === "edit",
    isHidden: level === "hidden",
  };
}

// Returns a map of all page keys → access level for the current user.
export function useAllPageAccess() {
  const { user, hasRole } = useAuth();
  const [map, setMap] = useState<Record<string, AccessLevel>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setMap({}); setLoading(false); return; }
    if (hasRole("admin")) { setMap({}); setLoading(false); return; } // admin = edit everywhere
    supabase
      .from("page_permissions")
      .select("page_key, access_level")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancelled) return;
        const m: Record<string, AccessLevel> = {};
        (data ?? []).forEach((r) => { m[r.page_key] = r.access_level as AccessLevel; });
        setMap(m);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user, hasRole]);

  return { map, loading, isAdmin: hasRole("admin") };
}
