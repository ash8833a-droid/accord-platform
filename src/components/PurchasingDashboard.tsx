import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Loader2,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  Building2,
  Calendar,
  Package,
} from "lucide-react";

type Status = "pending" | "approved" | "rejected" | "completed";

interface PurchaseRequestRow {
  id: string;
  item_name: string;
  quantity: number;
  justification: string | null;
  status: Status;
  created_at: string;
  committee_id: string;
  committee?: { name: string | null } | null;
}

const STATUS_LABEL: Record<Status, string> = {
  pending: "قيد الانتظار",
  approved: "تمت الموافقة",
  rejected: "مرفوض",
  completed: "منجز",
};

const STATUS_TONE: Record<Status, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  rejected: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  completed: "bg-sky-500/10 text-sky-600 border-sky-500/30",
};

/**
 * لوحة لجنة المشتريات: عرض الطلبات المعلقة (purchase_requests)
 * مع إجراءات موافقة / رفض.
 */
export function PurchasingDashboard() {
  const [rows, setRows] = useState<PurchaseRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("purchase_requests")
      .select("id,item_name,quantity,justification,status,created_at,committee_id,committee:committees(name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as unknown as PurchaseRequestRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = async (id: string, status: Status, successMsg: string) => {
    setActingOn(id);
    const { error } = await supabase
      .from("purchase_requests")
      .update({ status })
      .eq("id", id);
    setActingOn(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(successMsg);
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const approve = (id: string) =>
    updateStatus(id, "approved", "تمت الموافقة على الطلب وجاري الشراء");
  const reject = (id: string) => updateStatus(id, "rejected", "تم رفض الطلب");

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-orange-500/10 p-2 text-orange-600">
            <ShoppingCart className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">طلبات الشراء — قيد الانتظار</h2>
            <p className="text-xs text-muted-foreground">
              راجع الطلبات الواردة من اللجان واعتمدها أو ارفضها
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading && <Loader2 className="ml-1 size-4 animate-spin" />}
          تحديث
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          لا توجد طلبات معلقة حالياً.
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Package className="size-4 text-orange-600" />
                    <span className="font-semibold">{r.item_name}</span>
                    <Badge variant="outline" className={STATUS_TONE[r.status]}>
                      {STATUS_LABEL[r.status]}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Building2 className="size-3.5" />
                      {r.committee?.name ?? "—"}
                    </span>
                    <span>الكمية: <b className="text-foreground">{r.quantity}</b></span>
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3.5" />
                      {new Date(r.created_at).toLocaleDateString("ar-SA")}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => approve(r.id)}
                    disabled={actingOn === r.id}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {actingOn === r.id ? (
                      <Loader2 className="ml-1 size-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="ml-1 size-4" />
                    )}
                    موافقة
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reject(r.id)}
                    disabled={actingOn === r.id}
                    className="border-rose-500/40 text-rose-600 hover:bg-rose-500/10"
                  >
                    <XCircle className="ml-1 size-4" />
                    رفض
                  </Button>
                </div>
              </div>

              {r.justification && (
                <p className="mt-3 rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                  {r.justification}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}