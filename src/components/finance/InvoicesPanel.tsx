import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Receipt, Plus, FileText, Pencil, Trash2, Download, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Invoice {
  id: string;
  invoice_number: string;
  vendor: string;
  amount: number;
  invoice_date: string;
  committee_id: string | null;
  description: string | null;
  attachment_url: string | null;
  notes: string | null;
  created_at: string;
}

interface Committee {
  id: string;
  name: string;
}

const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(Math.round(n));

interface Props {
  canManage: boolean;
}

export function InvoicesPanel({ canManage }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    invoice_number: "",
    vendor: "",
    amount: "",
    invoice_date: new Date().toISOString().slice(0, 10),
    committee_id: "none",
    description: "",
    notes: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [existingAttachment, setExistingAttachment] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: invs, error }, { data: coms }] = await Promise.all([
      supabase.from("invoices").select("*").order("invoice_date", { ascending: false }),
      supabase.from("committees").select("id, name"),
    ]);
    setLoading(false);
    if (error) {
      toast.error("تعذر تحميل الفواتير", { description: error.message });
      return;
    }
    setRows((invs ?? []) as any);
    setCommittees((coms ?? []) as any);
  };

  useEffect(() => { load(); }, []);

  const committeeName = (id: string | null) =>
    id ? committees.find((c) => c.id === id)?.name ?? "—" : "—";

  const grouped = useMemo(() => {
    const map = new Map<number, Invoice[]>();
    rows.forEach((r) => {
      const y = new Date(r.invoice_date).getFullYear();
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(r);
    });
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [rows]);

  const years = grouped.map(([y]) => y);
  const defaultYear = years[0] ?? new Date().getFullYear();

  const resetForm = () => {
    setForm({
      invoice_number: "",
      vendor: "",
      amount: "",
      invoice_date: new Date().toISOString().slice(0, 10),
      committee_id: "none",
      description: "",
      notes: "",
    });
    setFile(null);
    setExistingAttachment(null);
    setEditingId(null);
  };

  const startEdit = (r: Invoice) => {
    setEditingId(r.id);
    setForm({
      invoice_number: r.invoice_number,
      vendor: r.vendor,
      amount: String(r.amount),
      invoice_date: r.invoice_date,
      committee_id: r.committee_id ?? "none",
      description: r.description ?? "",
      notes: r.notes ?? "",
    });
    setExistingAttachment(r.attachment_url);
    setFile(null);
    setOpen(true);
  };

  const uploadFile = async (): Promise<string | null> => {
    if (!file) return existingAttachment;
    const ext = file.name.split(".").pop() || "pdf";
    const path = `invoices/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("invoices").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      toast.error("تعذر رفع المرفق", { description: error.message });
      throw error;
    }
    return path;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return toast.error("يجب تسجيل الدخول");
    const amt = Number(form.amount);
    if (!form.invoice_number.trim()) return toast.error("رقم الفاتورة مطلوب");
    if (!form.vendor.trim()) return toast.error("اسم المورد مطلوب");
    if (!amt || amt <= 0) return toast.error("المبلغ غير صحيح");
    if (!form.invoice_date) return toast.error("تاريخ الفاتورة مطلوب");

    setSaving(true);
    try {
      const attachment_url = await uploadFile();
      const payload = {
        invoice_number: form.invoice_number.trim(),
        vendor: form.vendor.trim(),
        amount: amt,
        invoice_date: form.invoice_date,
        committee_id: form.committee_id === "none" ? null : form.committee_id,
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
        attachment_url,
      };
      if (editingId) {
        const { error } = await supabase.from("invoices").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("تم تحديث الفاتورة");
      } else {
        const { error } = await supabase.from("invoices").insert({ ...payload, created_by: user.id });
        if (error) throw error;
        toast.success("تمت إضافة الفاتورة");
      }
      setOpen(false);
      resetForm();
      load();
    } catch (err: any) {
      if (err?.message) toast.error("تعذر الحفظ", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: Invoice) => {
    if (!confirm(`حذف الفاتورة "${r.invoice_number}" نهائياً؟`)) return;
    const { error } = await supabase.from("invoices").delete().eq("id", r.id);
    if (error) return toast.error("تعذر الحذف", { description: error.message });
    if (r.attachment_url) {
      await supabase.storage.from("invoices").remove([r.attachment_url]);
    }
    toast.success("تم حذف الفاتورة");
    load();
  };

  const openAttachment = async (path: string) => {
    const { data, error } = await supabase.storage.from("invoices").createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) return toast.error("تعذر فتح المرفق", { description: error?.message });
    window.open(data.signedUrl, "_blank");
  };

  const yearTotal = (list: Invoice[]) => list.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-soft" dir="rtl">
      <div className="px-6 py-4 border-b bg-gradient-to-l from-primary/5 to-transparent flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-bold flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" /> سجل الفواتير السنوي
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            أرشيف كامل للفواتير مصنف حسب السنة الميلادية — رقم الفاتورة، المورد، المبلغ، والمرفق.
          </p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-hero text-primary-foreground gap-1.5">
                <Plus className="h-4 w-4" /> فاتورة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "تعديل الفاتورة" : "فاتورة جديدة"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>رقم الفاتورة *</Label>
                    <Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>تاريخ الفاتورة *</Label>
                    <Input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} required dir="ltr" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>اسم المورد *</Label>
                  <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="مثال: مؤسسة الأمانة للتجارة" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>المبلغ (ر.س) *</Label>
                    <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label>اللجنة المرتبطة</Label>
                    <Select value={form.committee_id} onValueChange={(v) => setForm({ ...form, committee_id: v })}>
                      <SelectTrigger><SelectValue placeholder="اختر (اختياري)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— بدون لجنة —</SelectItem>
                        {committees.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>وصف الفاتورة</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="ماذا تشمل هذه الفاتورة؟" />
                </div>
                <div className="space-y-2">
                  <Label>ملاحظات</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>مرفق الفاتورة (PDF/صورة)</Label>
                  <Input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  {existingAttachment && !file && (
                    <p className="text-xs text-muted-foreground">مرفق حالي محفوظ — اترك الحقل فارغاً للإبقاء عليه.</p>
                  )}
                </div>
                <Button type="submit" className="w-full bg-gradient-hero text-primary-foreground" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 ms-1 animate-spin" />}
                  {editingId ? "حفظ التعديلات" : "إضافة الفاتورة"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="p-4">
        {loading ? (
          <div className="py-12 flex items-center justify-center text-muted-foreground text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحميل…
          </div>
        ) : grouped.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">لا توجد فواتير مسجلة بعد.</p>
        ) : (
          <Tabs defaultValue={String(defaultYear)} dir="rtl">
            <TabsList className="flex flex-wrap h-auto justify-start gap-1">
              {grouped.map(([year, list]) => (
                <TabsTrigger key={year} value={String(year)} className="gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  {year}
                  <Badge variant="outline" className="text-[10px] bg-primary/10 border-primary/30">
                    {list.length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {grouped.map(([year, list]) => (
              <TabsContent key={year} value={String(year)} className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3 px-2 py-3 rounded-xl bg-muted/40 border">
                  <span className="text-sm text-muted-foreground">إجمالي فواتير عام {year}</span>
                  <span className="text-lg font-black tabular-nums text-primary">
                    {fmt(yearTotal(list))} <span className="text-xs font-bold">ر.س</span>
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs">
                      <tr>
                        <th className="text-right px-3 py-2 font-semibold">رقم الفاتورة</th>
                        <th className="text-right px-3 py-2 font-semibold">التاريخ</th>
                        <th className="text-right px-3 py-2 font-semibold">المورد</th>
                        <th className="text-right px-3 py-2 font-semibold">اللجنة</th>
                        <th className="text-right px-3 py-2 font-semibold">الوصف</th>
                        <th className="text-left px-3 py-2 font-semibold">المبلغ</th>
                        <th className="text-center px-3 py-2 font-semibold">المرفق</th>
                        {canManage && <th className="text-center px-3 py-2 font-semibold">إجراءات</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((r) => (
                        <tr key={r.id} className="border-t hover:bg-muted/20">
                          <td className="px-3 py-2 font-mono text-xs">{r.invoice_number}</td>
                          <td className="px-3 py-2 text-xs">{new Date(r.invoice_date).toLocaleDateString("ar-SA")}</td>
                          <td className="px-3 py-2 font-semibold">{r.vendor}</td>
                          <td className="px-3 py-2 text-xs">
                            <Badge variant="outline" className="text-[10px]">{committeeName(r.committee_id)}</Badge>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground max-w-[220px] truncate">{r.description ?? "—"}</td>
                          <td className="px-3 py-2 text-left font-bold tabular-nums">{fmt(Number(r.amount))} ر.س</td>
                          <td className="px-3 py-2 text-center">
                            {r.attachment_url ? (
                              <Button size="sm" variant="ghost" onClick={() => openAttachment(r.attachment_url!)} className="h-7 gap-1 text-xs">
                                <FileText className="h-3.5 w-3.5" /> عرض
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          {canManage && (
                            <td className="px-3 py-2 text-center">
                              <div className="flex gap-1 justify-center">
                                <Button size="sm" variant="ghost" onClick={() => startEdit(r)} className="h-7 w-7 p-0">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => remove(r)} className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </div>
  );
}