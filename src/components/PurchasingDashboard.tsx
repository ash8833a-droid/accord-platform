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
  Printer,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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
  const [editing, setEditing] = useState<PurchaseRequestRow | null>(null);
  const [editItem, setEditItem] = useState("");
  const [editQty, setEditQty] = useState<number>(1);
  const [editJust, setEditJust] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const openEdit = (r: PurchaseRequestRow) => {
    setEditing(r);
    setEditItem(r.item_name);
    setEditQty(r.quantity);
    setEditJust(r.justification ?? "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editItem.trim() || editQty < 1) {
      toast.error("يرجى إدخال اسم الصنف وكمية صحيحة");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("purchase_requests")
      .update({
        item_name: editItem.trim(),
        quantity: editQty,
        justification: editJust.trim() || null,
      })
      .eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم تحديث الطلب");
    setRows((prev) =>
      prev.map((r) =>
        r.id === editing.id
          ? { ...r, item_name: editItem.trim(), quantity: editQty, justification: editJust.trim() || null }
          : r,
      ),
    );
    setEditing(null);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    const id = deletingId;
    const { error } = await supabase.from("purchase_requests").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم حذف الطلب");
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const printRequest = (r: PurchaseRequestRow) => {
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) {
      toast.error("تعذر فتح نافذة الطباعة");
      return;
    }
    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const date = new Date(r.created_at).toLocaleDateString("ar-SA");
    const itemName = escapeHtml(r.item_name ?? "");
    const committeeName = escapeHtml(r.committee?.name ?? "—");
    const qty = escapeHtml(String(r.quantity ?? ""));
    const statusLabel = escapeHtml(STATUS_LABEL[r.status] ?? "");
    const justification = r.justification ? escapeHtml(r.justification) : "";
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>طلب شراء - ${itemName}</title>
      <style>
        body{font-family:'Segoe UI',Tahoma,sans-serif;padding:32px;color:#111;}
        h1{font-size:22px;margin:0 0 4px;}
        .muted{color:#666;font-size:12px;margin-bottom:24px;}
        table{width:100%;border-collapse:collapse;margin-top:12px;}
        th,td{border:1px solid #ddd;padding:10px;text-align:right;font-size:14px;}
        th{background:#f6f6f6;width:160px;}
        .just{margin-top:18px;padding:14px;border:1px solid #eee;border-radius:8px;background:#fafafa;white-space:pre-wrap;}
        .footer{margin-top:40px;display:flex;justify-content:space-between;font-size:12px;color:#555;}
      </style></head><body>
      <h1>طلب شراء</h1>
      <div class="muted">تاريخ الطلب: ${date}</div>
      <table>
        <tr><th>اللجنة</th><td>${committeeName}</td></tr>
        <tr><th>الصنف</th><td>${itemName}</td></tr>
        <tr><th>الكمية</th><td>${qty}</td></tr>
        <tr><th>الحالة</th><td>${statusLabel}</td></tr>
      </table>
      ${justification ? `<div class="just"><b>المبرر:</b><br/>${justification}</div>` : ""}
      <div class="footer"><span>توقيع مقدم الطلب: ___________</span><span>توقيع لجنة المشتريات: ___________</span></div>
      <script>window.onload=()=>{window.print();}<\/script>
      </body></html>`);
    w.document.close();
  };

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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => printRequest(r)}
                    title="طباعة"
                  >
                    <Printer className="ml-1 size-4" />
                    طباعة
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(r)}
                    title="تعديل"
                  >
                    <Pencil className="ml-1 size-4" />
                    تعديل
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDeletingId(r.id)}
                    className="border-rose-500/40 text-rose-600 hover:bg-rose-500/10"
                    title="حذف"
                  >
                    <Trash2 className="ml-1 size-4" />
                    حذف
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

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل طلب الشراء</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>اسم الصنف</Label>
              <Input value={editItem} onChange={(e) => setEditItem(e.target.value)} />
            </div>
            <div>
              <Label>الكمية</Label>
              <Input
                type="number"
                min={1}
                value={editQty}
                onChange={(e) => setEditQty(parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <Label>المبرر</Label>
              <Textarea
                rows={4}
                value={editJust}
                onChange={(e) => setEditJust(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              إلغاء
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving && <Loader2 className="ml-1 size-4 animate-spin" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الطلب</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}