import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Receipt } from "lucide-react";
import { committeeByType } from "@/lib/committees";

export const Route = createFileRoute("/_app/payment-requests")({
  component: AllRequestsPage,
});

interface PR {
  id: string;
  title: string;
  amount: number;
  status: "pending" | "approved" | "rejected" | "paid";
  created_at: string;
  committee_id: string;
  committee_name?: string;
  committee_type?: string;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "قيد المراجعة", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  approved: { label: "معتمد", cls: "bg-sky-500/15 text-sky-700 border-sky-500/30" },
  paid: { label: "مصروف", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  rejected: { label: "مرفوض", cls: "bg-rose-500/15 text-rose-700 border-rose-500/30" },
};

function AllRequestsPage() {
  const [items, setItems] = useState<PR[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: prs }, { data: coms }] = await Promise.all([
        supabase.from("payment_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("committees").select("id, name, type"),
      ]);
      const map = new Map((coms ?? []).map((c) => [c.id, c]));
      setItems((prs ?? []).map((r) => {
        const c = map.get(r.committee_id);
        return { ...r, committee_name: c?.name, committee_type: c?.type } as PR;
      }));
    })();
  }, []);

  const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(n);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Receipt className="h-7 w-7 text-gold" /> طلبات الصرف
        </h1>
        <p className="text-muted-foreground mt-1">جميع طلبات الصرف المرفوعة من اللجان</p>
      </div>

      <div className="rounded-2xl border bg-card divide-y shadow-soft">
        {items.length === 0 && <p className="text-center py-12 text-muted-foreground text-sm">لا توجد طلبات</p>}
        {items.map((r) => {
          const s = STATUS[r.status] ?? STATUS.pending;
          const meta = r.committee_type ? committeeByType(r.committee_type) : null;
          const Icon = meta?.icon;
          return (
            <Link
              key={r.id}
              to="/committee/$type"
              params={{ type: r.committee_type ?? "finance" }}
              className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                {Icon && (
                  <span className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${meta!.tone}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="font-semibold truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.committee_name} • {new Date(r.created_at).toLocaleDateString("ar-SA")}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-bold text-sm">{fmt(Number(r.amount))} ر.س</span>
                <Badge variant="outline" className={s.cls}>{s.label}</Badge>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
