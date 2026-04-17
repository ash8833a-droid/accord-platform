import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HeartHandshake, Plus, FileCheck2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/grooms")({
  component: GroomsPage,
});

interface Groom {
  id: string;
  full_name: string;
  phone: string;
  family_branch: string;
  bride_name: string | null;
  wedding_date: string | null;
  status: string;
  notes: string | null;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  new: { label: "جديد", cls: "bg-muted text-foreground" },
  under_review: { label: "قيد المراجعة", cls: "bg-warning/20 text-warning-foreground" },
  approved: { label: "معتمد", cls: "bg-success text-success-foreground" },
  rejected: { label: "مرفوض", cls: "bg-destructive text-destructive-foreground" },
  completed: { label: "مكتمل", cls: "bg-gradient-gold text-gold-foreground" },
};

function GroomsPage() {
  const [grooms, setGrooms] = useState<Groom[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", family_branch: "", bride_name: "", notes: "" });

  const load = async () => {
    const { data } = await supabase.from("grooms").select("*").order("created_at", { ascending: false });
    setGrooms((data ?? []) as Groom[]);
  };
  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("grooms").insert(form);
    if (error) {
      toast.error("تعذر الحفظ", { description: error.message });
      return;
    }
    toast.success("تم تسجيل العريس");
    setForm({ full_name: "", phone: "", family_branch: "", bride_name: "", notes: "" });
    setOpen(false);
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("grooms").update({ status }).eq("id", id);
    load();
  };

  const stats = {
    total: grooms.length,
    approved: grooms.filter((g) => g.status === "approved" || g.status === "completed").length,
    pending: grooms.filter((g) => g.status === "new" || g.status === "under_review").length,
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">سجل العرسان</h1>
          <p className="text-muted-foreground mt-1">قاعدة بيانات شاملة لطلبات العرسان والمستندات</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-hero text-primary-foreground shadow-elegant">
              <Plus className="h-4 w-4 ms-1" /> تسجيل عريس
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>تسجيل عريس جديد</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3 pt-2">
              <div className="space-y-2"><Label>الاسم الكامل</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
              <div className="space-y-2"><Label>الجوال</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required dir="ltr" /></div>
              <div className="space-y-2"><Label>الفرع العائلي</Label><Input value={form.family_branch} onChange={(e) => setForm({ ...form, family_branch: e.target.value })} required /></div>
              <div className="space-y-2"><Label>اسم العروس (اختياري)</Label><Input value={form.bride_name} onChange={(e) => setForm({ ...form, bride_name: e.target.value })} /></div>
              <div className="space-y-2"><Label>ملاحظات</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <Button type="submit" className="w-full bg-gradient-hero text-primary-foreground">حفظ</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-gradient-to-br from-primary/15 to-transparent p-5">
          <HeartHandshake className="h-6 w-6 text-primary mb-2" />
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-sm text-muted-foreground">إجمالي العرسان</p>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-success/15 to-transparent p-5">
          <FileCheck2 className="h-6 w-6 text-success mb-2" />
          <p className="text-2xl font-bold">{stats.approved}</p>
          <p className="text-sm text-muted-foreground">معتمدون</p>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-gold/15 to-transparent p-5">
          <FileCheck2 className="h-6 w-6 text-gold mb-2" />
          <p className="text-2xl font-bold">{stats.pending}</p>
          <p className="text-sm text-muted-foreground">قيد المراجعة</p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="text-right">
                <th className="px-4 py-3 font-medium">العريس</th>
                <th className="px-4 py-3 font-medium">الفرع</th>
                <th className="px-4 py-3 font-medium">الجوال</th>
                <th className="px-4 py-3 font-medium">العروس</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {grooms.map((g) => {
                const b = STATUS_BADGE[g.status] ?? STATUS_BADGE.new;
                return (
                  <tr key={g.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{g.full_name}</td>
                    <td className="px-4 py-3">{g.family_branch}</td>
                    <td className="px-4 py-3 text-muted-foreground" dir="ltr">{g.phone}</td>
                    <td className="px-4 py-3">{g.bride_name ?? "—"}</td>
                    <td className="px-4 py-3"><Badge className={b.cls}>{b.label}</Badge></td>
                    <td className="px-4 py-3">
                      <Select value={g.status} onValueChange={(v) => updateStatus(g.id, v)}>
                        <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_BADGE).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                );
              })}
              {grooms.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">لم يُسجّل أي عريس بعد.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
