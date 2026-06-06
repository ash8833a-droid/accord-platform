import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, ShoppingCart } from "lucide-react";
import { z } from "zod";

const schema = z.object({
  item_name: z.string().trim().min(1, "اسم الغرض مطلوب").max(255),
  quantity: z.coerce.number().int().min(1, "الكمية يجب أن تكون 1 على الأقل"),
  justification: z.string().trim().min(1, "المبرر مطلوب").max(2000),
});

interface Props {
  /** Optional callback after a successful submission */
  onCreated?: () => void;
}

/**
 * نموذج إنشاء "طلب شراء" يُرسَل من اللجنة الطالبة إلى لجنة المشتريات
 * ويُخزَّن في جدول purchase_requests بحالة "قيد الانتظار".
 */
export function CreatePurchaseRequestForm({ onCreated }: Props) {
  const { user, committeeId } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    item_name: "",
    quantity: "1",
    justification: "",
  });

  const reset = () =>
    setForm({ item_name: "", quantity: "1", justification: "" });

  const submit = async () => {
    if (!user) return toast.error("يجب تسجيل الدخول");
    if (!committeeId)
      return toast.error("يجب أن تكون عضواً في لجنة لتقديم الطلب");

    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      return toast.error(parsed.error.issues[0]?.message ?? "بيانات غير صحيحة");
    }

    setSubmitting(true);
    const { error } = await supabase.from("purchase_requests").insert({
      committee_id: committeeId,
      item_name: parsed.data.item_name,
      quantity: parsed.data.quantity,
      justification: parsed.data.justification,
      status: "pending",
      created_by: user.id,
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم إرسال طلب الشراء إلى لجنة المشتريات بنجاح");
    reset();
    onCreated?.();
  };

  if (!committeeId) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
        لا يمكنك تقديم طلب شراء لأنك غير مرتبط بأي لجنة بعد. تواصل مع الإدارة لتفعيل عضويتك.
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-2 text-base font-semibold">
        <span className="rounded-lg bg-orange-500/10 p-1.5 text-orange-600">
          <ShoppingCart className="size-5" />
        </span>
        طلب شراء جديد
      </div>

      <div>
        <Label>اسم الغرض المطلوب *</Label>
        <Input
          value={form.item_name}
          onChange={(e) => setForm({ ...form, item_name: e.target.value })}
          placeholder="مثال: طابعة ليزر A4"
          maxLength={255}
        />
      </div>

      <div>
        <Label>الكمية *</Label>
        <Input
          type="number"
          min={1}
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
        />
      </div>

      <div>
        <Label>مبرر الشراء / التفاصيل *</Label>
        <Textarea
          rows={4}
          value={form.justification}
          onChange={(e) => setForm({ ...form, justification: e.target.value })}
          placeholder="اشرح سبب الحاجة وأي تفاصيل تساعد لجنة المشتريات"
          maxLength={2000}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={reset} disabled={submitting}>
          تفريغ
        </Button>
        <Button
          onClick={submit}
          disabled={submitting}
          className="bg-gradient-gold text-gold-foreground"
        >
          {submitting && <Loader2 className="ml-1 size-4 animate-spin" />}
          إرسال الطلب
        </Button>
      </div>
    </div>
  );
}