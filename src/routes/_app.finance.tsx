import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Wallet, Users2, Plus, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { StatCard } from "@/components/StatCard";

export const Route = createFileRoute("/_app/finance")({
  component: FinancePage,
});

interface Delegate {
  id: string;
  full_name: string;
  phone: string;
  family_branch: string;
  subs_count?: number;
  collected?: number;
}

function FinancePage() {
  const [delegates, setDelegates] = useState<Delegate[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [branch, setBranch] = useState("");

  const load = async () => {
    const { data: dels } = await supabase.from("delegates").select("*").order("created_at", { ascending: false });
    const { data: subs } = await supabase.from("subscriptions").select("delegate_id, amount, status");
    const enriched =
      dels?.map((d) => {
        const own = (subs ?? []).filter((s) => s.delegate_id === d.id && s.status === "confirmed");
        return {
          ...d,
          subs_count: own.length,
          collected: own.reduce((a, s) => a + Number(s.amount), 0),
        };
      }) ?? [];
    setDelegates(enriched);
  };

  useEffect(() => {
    load();
  }, []);

  const addDelegate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("delegates").insert({ full_name: name, phone, family_branch: branch });
    if (error) {
      toast.error("تعذر إضافة المندوب", { description: error.message });
      return;
    }
    toast.success("تمت إضافة المندوب");
    setName("");
    setPhone("");
    setBranch("");
    setOpen(false);
    load();
  };

  const totalCollected = delegates.reduce((a, d) => a + (d.collected ?? 0), 0);
  const totalSubs = delegates.reduce((a, d) => a + (d.subs_count ?? 0), 0);
  const target = 300;
  const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(n);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">المالية والمناديب</h1>
          <p className="text-muted-foreground mt-1">المحفظة الرقمية للمناديب وتتبع التحصيل</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-hero text-primary-foreground shadow-elegant">
              <Plus className="h-4 w-4 ms-1" /> إضافة مندوب
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>مندوب جديد</DialogTitle>
            </DialogHeader>
            <form onSubmit={addDelegate} className="space-y-3 pt-2">
              <div className="space-y-2"><Label>الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div className="space-y-2"><Label>الجوال</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} required dir="ltr" /></div>
              <div className="space-y-2"><Label>الفرع العائلي</Label><Input value={branch} onChange={(e) => setBranch(e.target.value)} required /></div>
              <Button type="submit" className="w-full bg-gradient-hero text-primary-foreground">حفظ</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard variant="teal" label="إجمالي المحصّل" value={`${fmt(totalCollected)} ر.س`} icon={Wallet} hint="مدفوعات مؤكدة" />
        <StatCard variant="gold" label="عدد المناديب" value={delegates.length} icon={Users2} hint="نشطون في النظام" />
        <StatCard label="اشتراكات سنوية" value={totalSubs} icon={CheckCircle2} hint={`${target} ر.س لكل عضو`} />
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden shadow-soft">
        <div className="px-6 py-4 border-b bg-gradient-to-l from-primary/5 to-transparent">
          <h2 className="font-bold">جدول المناديب</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="text-right">
                <th className="px-4 py-3 font-medium">المندوب</th>
                <th className="px-4 py-3 font-medium">الجوال</th>
                <th className="px-4 py-3 font-medium">الفرع</th>
                <th className="px-4 py-3 font-medium">عدد الاشتراكات</th>
                <th className="px-4 py-3 font-medium">المحصّل</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {delegates.map((d) => (
                <tr key={d.id} className="border-t hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{d.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground" dir="ltr">{d.phone}</td>
                  <td className="px-4 py-3">{d.family_branch}</td>
                  <td className="px-4 py-3">{d.subs_count}</td>
                  <td className="px-4 py-3 font-semibold">{fmt(d.collected ?? 0)} ر.س</td>
                  <td className="px-4 py-3">
                    {(d.subs_count ?? 0) > 0 ? (
                      <Badge className="bg-success text-success-foreground">نشط</Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />بانتظار التحصيل</Badge>
                    )}
                  </td>
                </tr>
              ))}
              {delegates.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    لا يوجد مناديب بعد. أضف أول مندوب لتبدأ المتابعة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
