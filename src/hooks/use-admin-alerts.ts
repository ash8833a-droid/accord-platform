import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "admin_alerts_dismissed_v1";
const EVT = "admin-alerts:changed";

export interface AdminAlert {
  id: string;
  kind: "membership_request";
  title: string;
  body: string;
  link: string;
  createdAt: string;
}

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(set: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  window.dispatchEvent(new Event(EVT));
}

/**
 * Source of truth for the red badge on "الأداء العام":
 * pending membership requests (طلبات انضمام بانتظار المراجعة)
 * minus alerts the current admin has dismissed locally.
 */
export function useAdminAlerts(enabled: boolean) {
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!enabled) { setAlerts([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("membership_requests")
      .select("id, full_name, family_branch, phone, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setAlerts(
      (data ?? []).map((r: any) => ({
        id: `mr:${r.id}`,
        kind: "membership_request" as const,
        title: `طلب انضمام جديد — ${r.full_name}`,
        body: `${r.family_branch ?? ""}${r.phone ? " · " + r.phone : ""}`.trim() || "بانتظار المراجعة",
        link: "/admin/users",
        createdAt: r.created_at,
      })),
    );
    setLoading(false);
  }, [enabled]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!enabled) return;
    const ch = supabase
      .channel("admin_alerts_membership_requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "membership_requests" }, () => { void fetchAll(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [enabled, fetchAll]);

  useEffect(() => {
    const onChange = () => setDismissed(loadDismissed());
    const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) setDismissed(loadDismissed()); };
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const visible = alerts.filter((a) => !dismissed.has(a.id));

  const dismiss = useCallback((id: string) => {
    const next = new Set(loadDismissed());
    next.add(id);
    saveDismissed(next);
    setDismissed(next);
  }, []);

  const dismissAll = useCallback(() => {
    const next = new Set(loadDismissed());
    alerts.forEach((a) => next.add(a.id));
    saveDismissed(next);
    setDismissed(next);
  }, [alerts]);

  return { alerts: visible, count: visible.length, loading, dismiss, dismissAll, refresh: fetchAll };
}
