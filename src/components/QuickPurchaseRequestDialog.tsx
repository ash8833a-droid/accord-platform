import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ShoppingCart, ArrowLeft } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

type Priority = "low" | "medium" | "high" | "urgent";
const UNITS = ["قطعة", "كرتون", "علبة", "كيلو", "لتر", "متر", "حزمة", "أخرى"];
const PRIORITY_LABEL: Record<Priority, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  urgent: "عاجلة",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function QuickPurchaseRequestDialog({ open, onOpenChange }: Props) {
  const { user, committeeId } = useAuth();
  const navigate = useNavigate();
  const [committeeName, setCommitteeName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    item_name: "",
    description: "",
    quantity: "1",
    unit: "قطعة",
    needed_by: "",
    priority: "medium" as Priority,
    notes: "",
  });

  useEffect(() => {
    if (!open || !committeeId) return;
    supabase
      .from("committees")
      .select("name")
      .eq("id", committeeId)
      .maybeSingle()
      .then(({ data }) => setCommitteeName(data?.name ?? null));
  }, [open, committeeId]);

  const reset = () =>
    setForm({
      item_name: "",
      description: "",
      quantity: "1",
      unit: "قطعة",
      needed_by: "",
      priority: "medium",
      notes: "",
    });

  const submit = async () => {
    if (!user) return toast.error("يجب تسجيل الدخول");
    if (!committeeId) return toast.error("يجب أن تكون عضواً في لجنة لتقديم الطلب");
    if (!form.item_name.trim()) return toast.error("اكتب اسم الصنف");
    const qty = Number(form.quantity);
    if (!qty || qty <= 0) return toast.error("الكمية غير صحيحة");

    setSubmitting(true);
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const { error } = await supabase.from("procurement_requests").insert({
      requesting_committee_id: committeeId,
      requested_by: user.id,
      requester_name: prof?.full_name ?? user.email ?? "عضو",
      item_name: form.item_name.trim(),
      description: form.description.trim() || null,
      quantity: qty,
      unit: form.unit,
      needed_by: form.needed_by || null,
      priority: form.priority,
      notes: form.notes.trim() || null,
      status: "new",
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم إرسال الطلب إلى لجنة المشتريات", {
      action: {
        label: "عرض طلباتي",
        onClick: () => navigate({ to: "/committee/$type", params: { type: "procurement" } }),
      },
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="rounded-lg bg-orange-500/10 p-1.5 text-orange-600">
              <ShoppingCart className="size-5" />
            </span>
            طلب شراء جديد
          </DialogTitle>
          <DialogDescription>
            يُرسَل النموذج مباشرة إلى لجنة المشتريات لمراجعته واعتماده.
          </DialogDescription>
        </DialogHeader>

        {!committeeId ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            لا يمكنك تقديم طلب شراء لأنك غير مرتبط بأي لجنة بعد. تواصل مع الإدارة لتفعيل عضويتك.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/30 p-2.5 text-xs">
              <span className="text-muted-foreground">اللجنة الطالبة:</span>{" "}
              <b>{committeeName ?? "—"}</b>
            </div>
            <div>
              <Label>الصنف / الوصف المختصر *</Label>
              <Input
                value={form.item_name}
                onChange={(e) => setForm({ ...form, item_name: e.target.value })}
                placeholder="مثال: كراسي بلاستيكية بيضاء"
                maxLength={150}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>الكمية *</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>
              <div>
                <Label>الوحدة</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>تاريخ الحاجة</Label>
                <Input
                  type="date"
                  value={form.needed_by}
                  onChange={(e) => setForm({ ...form, needed_by: e.target.value })}
                />
              </div>
              <div>
                <Label>الأولوية</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm({ ...form, priority: v as Priority })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_LABEL[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>وصف تفصيلي / مواصفات</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="النوع، اللون، المقاس، أي مواصفات تساعد المشتريات"
                maxLength={1000}
              />
            </div>
            <div>
              <Label>ملاحظات إضافية</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                maxLength={500}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
              navigate({ to: "/committee/$type", params: { type: "procurement" } });
            }}
            className="gap-1"
          >
            <ArrowLeft className="size-4" />
            متابعة طلباتي
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            onClick={submit}
            disabled={submitting || !committeeId}
            className="bg-gradient-gold text-gold-foreground"
          >
            {submitting && <Loader2 className="ml-1 size-4 animate-spin" />}
            إرسال الطلب
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}