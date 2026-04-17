import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Users2, Plus, CheckCircle2, Clock, Receipt, TrendingUp, XCircle, CheckCheck, FileText, Download, FileSpreadsheet, FileType2, Printer, ShieldCheck, AlertTriangle, Lock, Eye, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { StatCard } from "@/components/StatCard";
import { committeeByType } from "@/lib/committees";
import { exportRequestsCSV, exportRequestsXLSX, exportRequestsPDF, type ExportRequest } from "@/lib/exporters";

interface Delegate {
  id: string;
  full_name: string;
  phone: string;
  family_branch: string;
  subs_count?: number;
  collected?: number;
}

interface PaymentRequest {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  status: "pending" | "approved" | "rejected" | "paid";
  created_at: string;
  committee_id: string;
  invoice_url: string | null;
  committee_name?: string;
  committee_type?: string;
}

const PR_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "قيد المراجعة", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  approved: { label: "معتمد", cls: "bg-sky-500/15 text-sky-700 border-sky-500/30" },
  paid: { label: "مصروف", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  rejected: { label: "مرفوض", cls: "bg-rose-500/15 text-rose-700 border-rose-500/30" },
};

export function FinanceModule() {
  const [delegates, setDelegates] = useState<Delegate[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [branch, setBranch] = useState("");

  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [invoicePath, setInvoicePath] = useState<string | null>(null);
  const [invoiceTitle, setInvoiceTitle] = useState<string>("");
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const load = async () => {
    const [{ data: dels }, { data: subs }, { data: prs }, { data: coms }] = await Promise.all([
      supabase.from("delegates").select("*").order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("delegate_id, amount, status"),
      supabase.from("payment_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("committees").select("id, name, type"),
    ]);

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

    const comMap = new Map((coms ?? []).map((c) => [c.id, c]));
    setRequests(
      (prs ?? []).map((r) => {
        const c = comMap.get(r.committee_id);
        return { ...r, committee_name: c?.name, committee_type: c?.type } as PaymentRequest;
      }),
    );
  };

  useEffect(() => { load(); }, []);

  const addDelegate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("delegates").insert({ full_name: name, phone, family_branch: branch });
    if (error) return toast.error("تعذر إضافة المندوب", { description: error.message });
    toast.success("تمت إضافة المندوب");
    setName(""); setPhone(""); setBranch(""); setOpen(false); load();
  };

  const reviewRequest = async (id: string, status: "approved" | "rejected" | "paid") => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("payment_requests").update({
      status,
      reviewed_by: u.user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return toast.error("تعذر التحديث", { description: error.message });
    toast.success("تم تحديث حالة الطلب");
    load();
  };

  const openInvoice = async (path: string, title: string) => {
    setInvoiceTitle(title);
    setInvoicePath(path);
    setInvoiceUrl(null);
    setInvoiceLoading(true);
    const { data, error } = await supabase.storage.from("invoices").createSignedUrl(path, 60 * 10);
    setInvoiceLoading(false);
    if (error || !data?.signedUrl) {
      return toast.error("تعذر فتح الفاتورة", { description: error?.message });
    }
    setInvoiceUrl(data.signedUrl);
  };

  const downloadInvoice = async () => {
    if (!invoicePath) return;
    const { data, error } = await supabase.storage.from("invoices").download(invoicePath);
    if (error || !data) return toast.error("تعذر التحميل", { description: error?.message });
    const url = URL.createObjectURL(data);
    const ext = invoicePath.split(".").pop() || "pdf";
    const a = document.createElement("a");
    a.href = url;
    a.download = `فاتورة-${invoiceTitle.replace(/[^\p{L}\p{N} -]/gu, "")}.${ext}`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const totalCollected = delegates.reduce((a, d) => a + (d.collected ?? 0), 0);
  const totalSubs = delegates.reduce((a, d) => a + (d.subs_count ?? 0), 0);
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const totalPaid = requests.filter((r) => r.status === "paid").reduce((a, r) => a + Number(r.amount), 0);
  const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(n);

  const exportRows: ExportRequest[] = requests.map((r) => ({
    title: r.title,
    committee: r.committee_name ?? "—",
    amount: Number(r.amount),
    status: PR_STATUS[r.status]?.label ?? r.status,
    date: new Date(r.created_at).toLocaleDateString("ar-SA"),
    description: r.description ?? "",
  }));

  const handleExport = (kind: "csv" | "xlsx" | "pdf") => {
    if (exportRows.length === 0) return toast.error("لا توجد بيانات للتصدير");
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `تقرير-طلبات-الصرف-${stamp}`;
    const summary = {
      totalCollected,
      totalSubs,
      pendingCount,
      totalPaid,
      delegatesCount: delegates.length,
    };
    if (kind === "csv") exportRequestsCSV(exportRows, filename);
    if (kind === "xlsx") exportRequestsXLSX(exportRows, filename, summary);
    if (kind === "pdf") exportRequestsPDF(exportRows, filename, summary);
    toast.success(`تم تصدير التقرير (${kind.toUpperCase()})`);
  };

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">إدارة المالية</h2>
          <p className="text-muted-foreground text-sm mt-1">المحفظة، المناديب، الاشتراكات، وطلبات الصرف الواردة</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="bg-gradient-gold text-gold-foreground shadow-gold gap-2">
              <Download className="h-4 w-4" /> تصدير التقرير
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>اختر صيغة التصدير</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleExport("pdf")} className="gap-2 cursor-pointer">
              <FileType2 className="h-4 w-4 text-rose-600" /> PDF — تقرير رسمي
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("xlsx")} className="gap-2 cursor-pointer">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel — جدول كامل
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("csv")} className="gap-2 cursor-pointer">
              <FileText className="h-4 w-4 text-sky-600" /> CSV — بيانات خام
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => window.print()} className="gap-2 cursor-pointer">
              <Printer className="h-4 w-4" /> طباعة الصفحة
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard variant="teal" label="إجمالي المحصّل" value={`${fmt(totalCollected)} ر.س`} icon={Wallet} hint={`${totalSubs} اشتراك مؤكد`} />
        <StatCard variant="gold" label="المناديب النشطون" value={delegates.length} icon={Users2} hint="في قاعدة البيانات" />
        <StatCard label="طلبات قيد المراجعة" value={pendingCount} icon={Clock} hint="بانتظار قرار المالية" />
        <StatCard label="إجمالي المصروف" value={`${fmt(totalPaid)} ر.س`} icon={TrendingUp} hint="طلبات تم صرفها" />
      </div>

      <Tabs defaultValue="requests" dir="rtl">
        <TabsList className="grid grid-cols-4 w-full max-w-3xl">
          <TabsTrigger value="requests" className="gap-2">
            <Receipt className="h-4 w-4" /> طلبات الصرف
            {pendingCount > 0 && <span className="bg-gold text-gold-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold">{pendingCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="delegates" className="gap-2"><Users2 className="h-4 w-4" /> المناديب</TabsTrigger>
          <TabsTrigger value="subs" className="gap-2"><CheckCircle2 className="h-4 w-4" /> الاشتراكات</TabsTrigger>
          <TabsTrigger value="safety" className="gap-2"><ShieldCheck className="h-4 w-4" /> السلامة المالية</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-5">
          <div className="rounded-2xl border bg-card overflow-hidden shadow-soft">
            <div className="px-6 py-4 border-b bg-gradient-to-l from-gold/5 to-transparent">
              <h3 className="font-bold flex items-center gap-2">
                <Receipt className="h-4 w-4 text-gold" /> الطلبات الواردة من اللجان
              </h3>
              <p className="text-xs text-muted-foreground mt-1">راجع واعتمد طلبات الصرف والعهد المالية</p>
            </div>
            <div className="divide-y">
              {requests.length === 0 && (
                <p className="text-center text-muted-foreground py-12 text-sm">لا توجد طلبات صرف حالياً</p>
              )}
              {requests.map((r) => {
                const s = PR_STATUS[r.status] ?? PR_STATUS.pending;
                const meta = r.committee_type ? committeeByType(r.committee_type) : null;
                const Icon = meta?.icon;
                return (
                  <div key={r.id} className="px-6 py-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {Icon && (
                          <span className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${meta!.tone}`}>
                            <Icon className="h-5 w-5" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold">{r.title}</p>
                            <Badge variant="outline" className="text-[10px]">{r.committee_name ?? "—"}</Badge>
                          </div>
                          {r.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(r.created_at).toLocaleDateString("ar-SA")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        {r.invoice_url && (
                          <Button type="button" size="sm" variant="outline" onClick={() => openInvoice(r.invoice_url!, r.title)} className="gap-1.5">
                            <FileText className="h-3.5 w-3.5" /> عرض الفاتورة
                          </Button>
                        )}
                        <span className="font-bold">{fmt(Number(r.amount))} ر.س</span>
                        <Badge variant="outline" className={s.cls}>{s.label}</Badge>
                      </div>
                    </div>
                    {r.status === "pending" && (
                      <div className="flex gap-2 mt-3 justify-end">
                        <Button size="sm" variant="outline" onClick={() => reviewRequest(r.id, "rejected")} className="text-rose-600 hover:text-rose-700">
                          <XCircle className="h-3.5 w-3.5 ms-1" /> رفض
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => reviewRequest(r.id, "approved")} className="text-sky-600 hover:text-sky-700">
                          <CheckCircle2 className="h-3.5 w-3.5 ms-1" /> اعتماد
                        </Button>
                        <Button size="sm" onClick={() => reviewRequest(r.id, "paid")} className="bg-gradient-hero text-primary-foreground">
                          <CheckCheck className="h-3.5 w-3.5 ms-1" /> صرف
                        </Button>
                      </div>
                    )}
                    {r.status === "approved" && (
                      <div className="flex justify-end mt-3">
                        <Button size="sm" onClick={() => reviewRequest(r.id, "paid")} className="bg-gradient-hero text-primary-foreground">
                          <CheckCheck className="h-3.5 w-3.5 ms-1" /> تأكيد الصرف
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="delegates" className="mt-5">
          <div className="rounded-2xl border bg-card overflow-hidden shadow-soft">
            <div className="px-6 py-4 border-b bg-gradient-to-l from-primary/5 to-transparent flex items-center justify-between">
              <div>
                <h3 className="font-bold">جدول المناديب</h3>
                <p className="text-xs text-muted-foreground mt-1">المناديب المسؤولون عن تحصيل الاشتراكات (300 ر.س)</p>
              </div>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-gradient-hero text-primary-foreground">
                    <Plus className="h-4 w-4 ms-1" /> إضافة مندوب
                  </Button>
                </DialogTrigger>
                <DialogContent dir="rtl">
                  <DialogHeader><DialogTitle>مندوب جديد</DialogTitle></DialogHeader>
                  <form onSubmit={addDelegate} className="space-y-3 pt-2">
                    <div className="space-y-2"><Label>الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
                    <div className="space-y-2"><Label>الجوال</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} required dir="ltr" /></div>
                    <div className="space-y-2"><Label>الفرع العائلي</Label><Input value={branch} onChange={(e) => setBranch(e.target.value)} required /></div>
                    <Button type="submit" className="w-full bg-gradient-hero text-primary-foreground">حفظ</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr className="text-right">
                    <th className="px-4 py-3 font-medium">المندوب</th>
                    <th className="px-4 py-3 font-medium">الجوال</th>
                    <th className="px-4 py-3 font-medium">الفرع</th>
                    <th className="px-4 py-3 font-medium">الاشتراكات</th>
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
                          <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30" variant="outline">نشط</Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />بانتظار التحصيل</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                  {delegates.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">لا يوجد مناديب بعد. أضف أول مندوب لتبدأ المتابعة.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="subs" className="mt-5">
          <div className="rounded-2xl border bg-card p-8 text-center shadow-soft">
            <CheckCircle2 className="h-10 w-10 mx-auto text-primary mb-3" />
            <p className="text-2xl font-bold">{totalSubs} اشتراك مؤكد</p>
            <p className="text-muted-foreground text-sm mt-1">إجمالي محصّل: {fmt(totalCollected)} ر.س</p>
            <p className="text-xs text-muted-foreground mt-4">يقوم كل مندوب بإدخال اشتراكات أبناء فرعه (300 ر.س لكل عضو)</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Invoice preview */}
      <Dialog open={!!invoiceUrl || invoiceLoading} onOpenChange={(o) => { if (!o) { setInvoiceUrl(null); setInvoicePath(null); setInvoiceLoading(false); } }}>
        <DialogContent dir="rtl" className="max-w-5xl w-[95vw] h-[88vh] p-0 flex flex-col gap-0 overflow-hidden">
          <DialogHeader className="px-5 py-3 border-b bg-gradient-to-l from-gold/5 to-transparent shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-gold" />
              معاينة الفاتورة — {invoiceTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 bg-muted/30 overflow-hidden">
            {invoiceLoading && (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">جاري تحميل الفاتورة...</div>
            )}
            {invoiceUrl && (
              <iframe src={invoiceUrl} title="معاينة الفاتورة" className="w-full h-full border-0" />
            )}
          </div>
          <div className="px-5 py-3 border-t flex items-center justify-between gap-2 shrink-0 bg-card flex-wrap">
            <p className="text-[11px] text-muted-foreground">رابط مؤقت صالح لمدة 10 دقائق</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={downloadInvoice} disabled={!invoicePath} className="bg-gradient-gold text-gold-foreground gap-1.5">
                <Download className="h-3.5 w-3.5" /> تحميل الفاتورة
              </Button>
              {invoiceUrl && (
                <a href={invoiceUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline">فتح في تبويب جديد</Button>
                </a>
              )}
              <Button size="sm" variant="ghost" onClick={() => { setInvoiceUrl(null); setInvoicePath(null); setInvoiceLoading(false); }}>إغلاق</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
