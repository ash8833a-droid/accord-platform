import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Receipt, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MyCommittee { id: string; name: string; type: string }

export function QuickCreatePayment({
  committees,
  onCreated,
}: { committees: MyCommittee[]; onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [committeeId, setCommitteeId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setCommitteeId(""); setTitle(""); setDescription(""); setAmount(""); };

  const submit = async () => {
    const amt = Number(amount);
    if (!committeeId || !title.trim() || !amt || amt <= 0) {
      toast.error("اختر اللجنة وأدخل الوصف والمبلغ");
      return;
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("payment_requests").insert({
      committee_id: committeeId,
      title: title.trim(),
      description: description.trim() || null,
      amount: amt,
      status: "pending",
      requested_by: u.user?.id,
    });
    setSaving(false);
    if (error) {
      toast.error("تعذّر إنشاء الطلب: " + error.message);
      return;
    }
    toast.success("تم إرسال طلب الصرف");
    reset();
    setOpen(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Receipt className="h-4 w-4" /> طلب صرف
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>طلب صرف جديد</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>اللجنة</Label>
            <Select value={committeeId} onValueChange={setCommitteeId}>
              <SelectTrigger><SelectValue placeholder="اختر لجنة..." /></SelectTrigger>
              <SelectContent>
                {committees.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>وصف الطلب</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: شراء أدوات" />
          </div>
          <div className="space-y-1.5">
            <Label>تفاصيل (اختياري)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>المبلغ (ر.س)</Label>
            <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>إلغاء</Button>
          <Button onClick={submit} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            إرسال الطلب
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}