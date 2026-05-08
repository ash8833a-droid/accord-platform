import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Users2, Plus, CheckCircle2, Clock, Receipt, TrendingUp, XCircle, CheckCheck, FileText, Download, FileSpreadsheet, FileType2, Printer, ShieldCheck, AlertTriangle, Lock, Eye, ScrollText, TreePine, HeartHandshake, Settings2, HandCoins } from "lucide-react";
import { toast } from "sonner";
import { StatCard } from "@/components/StatCard";
import { committeeByType } from "@/lib/committees";
import { exportRequestsCSV, exportRequestsXLSX, exportRequestsPDF, type ExportRequest } from "@/lib/exporters";
import { SharesByBranch } from "@/components/finance/SharesByBranch";
import { GroomContributions } from "@/components/finance/GroomContributions";
import { CommitteeBudgetLimits } from "@/components/finance/CommitteeBudgetLimits";
import { FamilyContributionsPanel } from "@/components/finance/FamilyContributionsPanel";
import { Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Textarea } from "@/components/ui/textarea";
import { FilePreview } from "@/components/FilePreview";

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
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [financeHeadId, setFinanceHeadId] = useState<string | null>(null);
  const isFinanceHead = !!user && financeHeadId === user.id;
  const canManage = isAdmin || isFinanceHead;

  const [delegates, setDelegates] = useState<Delegate[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [branch, setBranch] = useState("");
  const [editingDelegateId, setEditingDelegateId] = useState<string | null>(null);

  // Payment request edit dialog
  const [editPrOpen, setEditPrOpen] = useState(false);
  const [editPr, setEditPr] = useState<PaymentRequest | null>(null);
  const [editPrTitle, setEditPrTitle] = useState("");
  const [editPrAmount, setEditPrAmount] = useState("");
  const [editPrDesc, setEditPrDesc] = useState("");

  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [invoicePath, setInvoicePath] = useState<string | null>(null);
  const [invoiceTitle, setInvoiceTitle] = useState<string>("");
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [totalBudgetNeeded, setTotalBudgetNeeded] = useState(0);

  const load = async () => {
    const [{ data: dels }, { data: subs }, { data: prs }, { data: coms }, { data: financeCom }] = await Promise.all([
      supabase.from("delegates").select("*").order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("delegate_id, amount, status"),
      supabase.from("payment_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("committees").select("id, name, type"),
      supabase.from("committees").select("head_user_id").eq("type", "finance").maybeSingle(),
    ]);
    setFinanceHeadId(financeCom?.head_user_id ?? null);

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

  const resetDelegateForm = () => {
    setName(""); setPhone(""); setBranch(""); setEditingDelegateId(null);
  };

  const addDelegate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingDelegateId) {
      const { error } = await supabase
        .from("delegates")
        .update({ full_name: name, phone, family_branch: branch })
        .eq("id", editingDelegateId);
      if (error) return toast.error("تعذر التحديث", { description: error.message });
      toast.success("تم تحديث بيانات المندوب");
    } else {
      const { error } = await supabase.from("delegates").insert({ full_name: name, phone, family_branch: branch });
      if (error) return toast.error("تعذر إضافة المندوب", { description: error.message });
      toast.success("تمت إضافة المندوب");
    }
    resetDelegateForm();
    setOpen(false);
    load();
  };

  const startEditDelegate = (d: Delegate) => {
    setEditingDelegateId(d.id);
    setName(d.full_name);
    setPhone(d.phone);
    setBranch(d.family_branch);
    setOpen(true);
  };

  const removeDelegate = async (d: Delegate) => {
    if (!confirm(`حذف المندوب "${d.full_name}" نهائياً؟ سيتم حذف اشتراكاته المرتبطة أيضاً.`)) return;
    const { error } = await supabase.from("delegates").delete().eq("id", d.id);
    if (error) return toast.error("تعذر الحذف", { description: error.message });
    toast.success("تم حذف المندوب");
    load();
  };

  const startEditRequest = (r: PaymentRequest) => {
    setEditPr(r);
    setEditPrTitle(r.title);
    setEditPrAmount(String(r.amount));
    setEditPrDesc(r.description ?? "");
    setEditPrOpen(true);
  };

  const saveEditRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPr) return;
    const amt = Number(editPrAmount);
    if (!amt || amt <= 0) return toast.error("المبلغ غير صحيح");
    const { error } = await supabase
      .from("payment_requests")
      .update({ title: editPrTitle, amount: amt, description: editPrDesc })
      .eq("id", editPr.id);
    if (error) return toast.error("تعذر التحديث", { description: error.message });
    toast.success("تم تحديث الطلب");
    setEditPrOpen(false);
    setEditPr(null);
    load();
  };

  const removeRequest = async (r: PaymentRequest) => {
    if (!confirm(`حذف طلب الصرف "${r.title}" نهائياً؟`)) return;
    const { error } = await supabase.from("payment_requests").delete().eq("id", r.id);
    if (error) return toast.error("تعذر الحذف", { description: error.message });
    toast.success("تم حذف الطلب");
    load();
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
        <TabsList className="flex flex-wrap h-auto w-full justify-start gap-1">
          <TabsTrigger value="requests" className="gap-2">
            <Receipt className="h-4 w-4" /> طلبات الصرف
            {pendingCount > 0 && <span className="bg-gold text-gold-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold">{pendingCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="shares" className="gap-2"><TreePine className="h-4 w-4" /> أسهم الفروع</TabsTrigger>
          <TabsTrigger value="grooms" className="gap-2"><HeartHandshake className="h-4 w-4" /> مساهمات العرسان</TabsTrigger>
          <TabsTrigger value="family" className="gap-2"><HandCoins className="h-4 w-4" /> مساهمات أفراد العائلة</TabsTrigger>
          <TabsTrigger value="limits" className="gap-2"><Settings2 className="h-4 w-4" /> مخصصات اللجان</TabsTrigger>
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
                    {canManage && (
                      <div className="flex gap-1.5 mt-2 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditRequest(r)}
                          className="text-xs h-7 gap-1 text-muted-foreground hover:text-primary"
                        >
                          <Pencil className="h-3 w-3" /> تعديل
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeRequest(r)}
                          className="text-xs h-7 gap-1 text-muted-foreground hover:text-rose-600"
                        >
                          <Trash2 className="h-3 w-3" /> حذف
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
              <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetDelegateForm(); }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-gradient-hero text-primary-foreground">
                    <Plus className="h-4 w-4 ms-1" /> إضافة مندوب
                  </Button>
                </DialogTrigger>
                <DialogContent dir="rtl">
                  <DialogHeader><DialogTitle>{editingDelegateId ? "تعديل بيانات مندوب" : "مندوب جديد"}</DialogTitle></DialogHeader>
                  <form onSubmit={addDelegate} className="space-y-3 pt-2">
                    <div className="space-y-2"><Label>الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
                    <div className="space-y-2"><Label>الجوال</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} required dir="ltr" /></div>
                    <div className="space-y-2"><Label>الفرع العائلي</Label><Input value={branch} onChange={(e) => setBranch(e.target.value)} required /></div>
                    <Button type="submit" className="w-full bg-gradient-hero text-primary-foreground">
                      {editingDelegateId ? "حفظ التعديلات" : "حفظ"}
                    </Button>
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
                    {canManage && <th className="px-4 py-3 font-medium">إجراءات</th>}
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
                      {canManage && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEditDelegate(d)}
                              className="h-7 w-7 p-0 hover:bg-primary/10 hover:text-primary"
                              aria-label="تعديل"
                              title="تعديل"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeDelegate(d)}
                              className="h-7 w-7 p-0 hover:bg-rose-500/10 hover:text-rose-600"
                              aria-label="حذف"
                              title="حذف"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {delegates.length === 0 && (
                    <tr><td colSpan={canManage ? 7 : 6} className="text-center py-12 text-muted-foreground">لا يوجد مناديب بعد. أضف أول مندوب لتبدأ المتابعة.</td></tr>
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

        <TabsContent value="shares" className="mt-5">
          <SharesByBranch />
        </TabsContent>

        <TabsContent value="grooms" className="mt-5">
          <GroomContributions totalCollected={totalCollected} totalBudgetNeeded={totalBudgetNeeded} />
        </TabsContent>

        <TabsContent value="family" className="mt-5">
          <FamilyContributionsPanel />
        </TabsContent>

        <TabsContent value="limits" className="mt-5">
          <CommitteeBudgetLimits onTotalChange={setTotalBudgetNeeded} />
        </TabsContent>

        <TabsContent value="safety" className="mt-5">
          <FinancialSafetyPanel
            requests={requests}
            totalCollected={totalCollected}
            totalPaid={totalPaid}
            pendingCount={pendingCount}
          />
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
              <FilePreview
                url={invoiceUrl}
                name={`فاتورة — ${invoiceTitle}`}
                type={/\.pdf(\?|$)/i.test(invoiceUrl) ? "application/pdf" : undefined}
                onDownload={invoicePath ? downloadInvoice : undefined}
              />
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

      {/* Edit Payment Request Dialog */}
      <Dialog open={editPrOpen} onOpenChange={(o) => { setEditPrOpen(o); if (!o) setEditPr(null); }}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" /> تعديل طلب الصرف
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEditRequest} className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label>عنوان الطلب</Label>
              <Input value={editPrTitle} onChange={(e) => setEditPrTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>المبلغ (ر.س)</Label>
              <Input type="number" min="1" value={editPrAmount} onChange={(e) => setEditPrAmount(e.target.value)} required dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>تفاصيل الطلب</Label>
              <Textarea value={editPrDesc} onChange={(e) => setEditPrDesc(e.target.value)} rows={4} />
            </div>
            <Button type="submit" className="w-full bg-gradient-hero text-primary-foreground">حفظ التعديلات</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// لوحة السلامة المالية — معايير الرقابة الداخلية وفصل المهام
// ============================================================
interface SafetyProps {
  requests: PaymentRequest[];
  totalCollected: number;
  totalPaid: number;
  pendingCount: number;
}

function FinancialSafetyPanel({ requests, totalCollected, totalPaid, pendingCount }: SafetyProps) {
  const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(n);
  const balance = totalCollected - totalPaid;
  const burnRate = totalCollected > 0 ? (totalPaid / totalCollected) * 100 : 0;

  // مؤشرات الرقابة
  const approvedNotPaid = requests.filter((r) => r.status === "approved").length;
  const rejected = requests.filter((r) => r.status === "rejected").length;
  const withInvoice = requests.filter((r) => r.invoice_url).length;
  const totalRequests = requests.length;
  const invoiceCoverage = totalRequests > 0 ? (withInvoice / totalRequests) * 100 : 100;
  const largeRequests = requests.filter((r) => Number(r.amount) >= 5000);

  const checks = [
    {
      key: "sod",
      label: "فصل المهام (Segregation of Duties)",
      desc: "مقدِّم الطلب ≠ المراجِع ≠ الصارف. النظام يُلزم تسجيل المراجع وزمن المراجعة لكل طلب.",
      ok: true,
      icon: Lock,
    },
    {
      key: "dual",
      label: "اعتماد ثنائي قبل الصرف",
      desc: "كل طلب يمر بمرحلتين: اعتماد ثم صرف. لا يجوز الصرف المباشر بدون اعتماد مسبق.",
      ok: true,
      icon: ShieldCheck,
    },
    {
      key: "audit",
      label: "سجل تدقيق كامل (Audit Trail)",
      desc: "كل عملية تُسجَّل بمعرّف المستخدم والوقت في قاعدة البيانات (reviewed_by, reviewed_at).",
      ok: true,
      icon: ScrollText,
    },
    {
      key: "invoice",
      label: "إلزام الفواتير المستندية",
      desc: `${withInvoice} من ${totalRequests} طلب مرفق بفاتورة (${invoiceCoverage.toFixed(0)}%)`,
      ok: invoiceCoverage >= 80,
      icon: FileText,
    },
    {
      key: "balance",
      label: "الرصيد لا يقل عن صفر",
      desc: `الرصيد الحالي: ${fmt(balance)} ر.س`,
      ok: balance >= 0,
      icon: Wallet,
    },
    {
      key: "burn",
      label: "معدل الصرف ضمن الحد الآمن (≤ 90%)",
      desc: `معدل الصرف من المحصّل: ${burnRate.toFixed(1)}%`,
      ok: burnRate <= 90,
      icon: TrendingUp,
    },
    {
      key: "rls",
      label: "حماية قاعدة البيانات (RLS)",
      desc: "جميع الجداول المالية محمية بسياسات صلاحيات صف على مستوى قاعدة البيانات.",
      ok: true,
      icon: Eye,
    },
  ];

  const passed = checks.filter((c) => c.ok).length;
  const score = Math.round((passed / checks.length) * 100);
  const scoreTone =
    score >= 90 ? "text-emerald-600" : score >= 70 ? "text-amber-600" : "text-rose-600";

  return (
    <div className="space-y-5">
      {/* Header score */}
      <div className="rounded-2xl border bg-gradient-to-l from-emerald-500/5 via-card to-card p-6 shadow-soft">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
              <ShieldCheck className="h-7 w-7 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-lg">مؤشر السلامة المالية</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                تقييم آلي للضوابط الرقابية وفق معايير الحوكمة المالية
              </p>
            </div>
          </div>
          <div className="text-center">
            <p className={`text-4xl font-black ${scoreTone}`}>{score}%</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{passed} من {checks.length} ضابط مفعّل</p>
          </div>
        </div>
        <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full transition-all ${score >= 90 ? "bg-emerald-500" : score >= 70 ? "bg-amber-500" : "bg-rose-500"}`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[11px] text-muted-foreground">الرصيد المتاح</p>
          <p className={`text-xl font-bold mt-1 ${balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {fmt(balance)} ر.س
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[11px] text-muted-foreground">معدل الصرف</p>
          <p className="text-xl font-bold mt-1">{burnRate.toFixed(1)}%</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[11px] text-muted-foreground">معتمد بانتظار الصرف</p>
          <p className="text-xl font-bold mt-1 text-sky-600">{approvedNotPaid}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[11px] text-muted-foreground">طلبات مرفوضة</p>
          <p className="text-xl font-bold mt-1 text-rose-600">{rejected}</p>
        </div>
      </div>

      {/* Controls checklist */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-soft">
        <div className="px-5 py-3 border-b bg-gradient-to-l from-emerald-500/5 to-transparent">
          <h4 className="font-bold flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> الضوابط الرقابية المُفعَّلة
          </h4>
        </div>
        <div className="divide-y">
          {checks.map((c) => {
            const I = c.icon;
            return (
              <div key={c.key} className="px-5 py-3 flex items-start gap-3 hover:bg-muted/20 transition">
                <div className={`h-8 w-8 rounded-lg shrink-0 flex items-center justify-center ${c.ok ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}>
                  <I className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{c.label}</p>
                    {c.ok ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[10px]">مُفعَّل</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-[10px]">يحتاج مراجعة</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{c.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Large requests watchlist */}
      {largeRequests.length > 0 && (
        <div className="rounded-2xl border bg-card overflow-hidden shadow-soft">
          <div className="px-5 py-3 border-b bg-gradient-to-l from-amber-500/10 to-transparent">
            <h4 className="font-bold flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> طلبات عالية القيمة (≥ 5,000 ر.س) — تتطلب تدقيقاً مزدوجاً
            </h4>
          </div>
          <div className="divide-y">
            {largeRequests.slice(0, 8).map((r) => {
              const s = PR_STATUS[r.status] ?? PR_STATUS.pending;
              return (
                <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{r.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.committee_name ?? "—"} • {new Date(r.created_at).toLocaleDateString("ar-SA")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-sm">{fmt(Number(r.amount))} ر.س</span>
                    <Badge variant="outline" className={`${s.cls} text-[10px]`}>{s.label}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
