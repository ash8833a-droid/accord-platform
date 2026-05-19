import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Upload, Trash2, FileText, Search, TreePine, Users2, Coins, Download, Calendar, Sparkles, CheckCircle2, X, Printer } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { FAMILY_BRANCHES, AMOUNT_OPTIONS, HIJRI_YEARS } from "@/lib/family-branches";

interface HRow {
  id: string;
  full_name: string;
  family_branch: string;
  hijri_year: number;
  amount: number;
  notes: string | null;
  source_file_url: string | null;
  created_at: string;
}

const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(n);

export function HistoricalShares() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [rows, setRows] = useState<HRow[]>([]);
  const [activeYear, setActiveYear] = useState<number>(HIJRI_YEARS[0]);
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // form state
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    family_branch: FAMILY_BRANCHES[0] as string,
    hijri_year: HIJRI_YEARS[0],
    amount: 300,
    notes: "",
  });
  const [customAmount, setCustomAmount] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // file upload state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadYear, setUploadYear] = useState<number>(HIJRI_YEARS[0]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadAmount, setUploadAmount] = useState<number>(300);

  // preview state (extracted rows awaiting confirmation)
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<Array<{ full_name: string; family_branch: string; amount: number; hijri_year: number }>>([]);
  const [confirming, setConfirming] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("historical_shareholders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("تعذّر تحميل البيانات");
    setRows((data ?? []) as HRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const yearRows = useMemo(
    () => rows.filter((r) => r.hijri_year === activeYear),
    [rows, activeYear],
  );

  const branchAgg = useMemo(() => {
    const m = new Map<string, { count: number; total: number }>();
    FAMILY_BRANCHES.forEach((b) => m.set(b, { count: 0, total: 0 }));
    yearRows.forEach((r) => {
      const a = m.get(r.family_branch) ?? { count: 0, total: 0 };
      a.count += 1;
      a.total += Number(r.amount);
      m.set(r.family_branch, a);
    });
    return Array.from(m.entries()).map(([branch, v]) => ({ branch, ...v }));
  }, [yearRows]);

  const filtered = useMemo(() => {
    const branchOrder = new Map<string, number>(FAMILY_BRANCHES.map((b, i) => [b as string, i]));
    return yearRows
      .filter((r) => (branchFilter === "all" ? true : r.family_branch === branchFilter))
      .filter((r) => (search ? r.full_name.toLowerCase().includes(search.toLowerCase()) : true))
      .sort((a, b) => {
        const oa = branchOrder.get(a.family_branch) ?? 999;
        const ob = branchOrder.get(b.family_branch) ?? 999;
        return oa - ob || a.full_name.localeCompare(b.full_name, "ar");
      });
  }, [yearRows, branchFilter, search]);

  const totals = useMemo(
    () => filtered.reduce((acc, r) => ({ count: acc.count + 1, total: acc.total + Number(r.amount) }), { count: 0, total: 0 }),
    [filtered],
  );

  const resetForm = () => {
    setForm({
      full_name: "",
      family_branch: FAMILY_BRANCHES[0] as string,
      hijri_year: activeYear,
      amount: 300,
      notes: "",
    });
    setCustomAmount(false);
    setEditingId(null);
  };

  const submit = async () => {
    if (!form.full_name.trim()) {
      toast.error("الرجاء إدخال اسم المساهم");
      return;
    }
    if (!form.family_branch) {
      toast.error("الرجاء اختيار الفرع");
      return;
    }
    if (!form.amount || form.amount <= 0) {
      toast.error("الرجاء إدخال مبلغ صحيح");
      return;
    }
    const payload = {
      full_name: form.full_name.trim(),
      family_branch: form.family_branch,
      hijri_year: form.hijri_year,
      amount: form.amount,
      notes: form.notes.trim() || null,
    };
    if (editingId) {
      const { error } = await supabase.from("historical_shareholders").update(payload).eq("id", editingId);
      if (error) {
        toast.error("تعذّر التحديث");
        return;
      }
      toast.success("تم تحديث البيانات");
    } else {
      const { error } = await supabase.from("historical_shareholders").insert(payload);
      if (error) {
        toast.error("تعذّر الحفظ");
        return;
      }
      toast.success("تم إضافة المساهم");
    }
    setOpen(false);
    resetForm();
    load();
  };

  const startEdit = (r: HRow) => {
    setForm({
      full_name: r.full_name,
      family_branch: r.family_branch,
      hijri_year: r.hijri_year,
      amount: Number(r.amount),
      notes: r.notes ?? "",
    });
    setCustomAmount(!AMOUNT_OPTIONS.includes(Number(r.amount)));
    setEditingId(r.id);
    setOpen(true);
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذا السجل نهائياً؟")) return;
    const { error } = await supabase.from("historical_shareholders").delete().eq("id", id);
    if (error) {
      toast.error("الحذف يحتاج صلاحية إدارية");
      return;
    }
    toast.success("تم الحذف");
    load();
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1] ?? "";
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const extractFromFile = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      // 1) رفع للأرشيف (مسار ASCII آمن)
      const { safeStorageKey, safeExt } = await import("@/lib/uploads");
      const ext = safeExt(uploadFile.name, "pdf");
      const path = safeStorageKey(uploadFile.name, String(uploadYear));
      await supabase.storage.from("historical-shares").upload(path, uploadFile, {
        cacheControl: "3600",
        upsert: false,
      });

      // 2) تحويل لـ base64 + استدعاء edge function
      const fileBase64 = await fileToBase64(uploadFile);
      const mimeType = uploadFile.type || (ext === "pdf" ? "application/pdf" : "application/octet-stream");

      toast.info("جارٍ استخراج الأسماء بالذكاء الاصطناعي... قد يستغرق 30-60 ثانية");

      const { data, error } = await supabase.functions.invoke("extract-shareholders", {
        body: { fileBase64, mimeType, hijriYear: uploadYear, defaultAmount: uploadAmount },
      });

      if (error) {
        toast.error("فشل الاستخراج: " + error.message);
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      const rows = (data?.rows ?? []) as Array<{ full_name: string; family_branch: string; amount: number; hijri_year: number }>;
      if (rows.length === 0) {
        toast.warning("لم يتم العثور على أسماء في الملف");
        return;
      }

      setPreviewRows(rows);
      setUploadOpen(false);
      setPreviewOpen(true);
      toast.success(`تم استخراج ${rows.length} اسم — راجعهم ثم اضغط تأكيد الإدراج`);
    } catch (e) {
      toast.error("خطأ غير متوقع: " + (e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const confirmInsert = async () => {
    if (previewRows.length === 0) return;
    setConfirming(true);
    const payload = previewRows.map((r) => ({
      full_name: r.full_name,
      family_branch: r.family_branch,
      hijri_year: r.hijri_year,
      amount: r.amount,
    }));
    const { error } = await supabase.from("historical_shareholders").insert(payload);
    setConfirming(false);
    if (error) {
      toast.error("تعذّر الإدراج: " + error.message);
      return;
    }
    toast.success(`تم إدراج ${payload.length} مساهم بنجاح`);
    setPreviewOpen(false);
    setPreviewRows([]);
    setUploadFile(null);
    load();
  };

  const removePreviewRow = (idx: number) => {
    setPreviewRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const updatePreviewBranch = (idx: number, branch: string) => {
    setPreviewRows((prev) => prev.map((r, i) => (i === idx ? { ...r, family_branch: branch } : r)));
  };

  const downloadCSV = () => {
    const header = ["الاسم", "الفرع", "السنة الهجرية", "المبلغ", "ملاحظات"];
    const lines = filtered.map((r) =>
      [r.full_name, r.family_branch, r.hijri_year, r.amount, r.notes ?? ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = "\uFEFF" + [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `مساهمون-${activeYear}هـ.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = () => {
    if (filtered.length === 0) {
      toast.error("لا توجد بيانات للتصدير");
      return;
    }
    const esc = (s: unknown) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    const today = new Date().toLocaleDateString("ar-SA");
    const totalAmount = filtered.reduce((s, r) => s + Number(r.amount), 0);
    const logoUrl = `${window.location.origin}/brand/zawaj-logo.png`;
    // Interlocking rings motif — derived from the brand logo, ultra-light, generous spacing
    const patternSvg = encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260' viewBox='0 0 260 260'>
        <g fill='none' stroke-width='0.9' opacity='0.55'>
          <circle cx='110' cy='130' r='34' stroke='#C4A25C'/>
          <circle cx='150' cy='130' r='34' stroke='#1B4F58'/>
        </g>
        <g fill='#C4A25C' opacity='0.35'>
          <circle cx='130' cy='40' r='1.2'/>
          <circle cx='130' cy='220' r='1.2'/>
        </g>
      </svg>`
    );
    const patternBg = `url("data:image/svg+xml;utf8,${patternSvg}")`;
    const rowsHtml = filtered
      .map(
        (r, i) => `<tr>
          <td>${i + 1}</td>
          <td style="text-align:right;font-weight:600">${esc(r.full_name)}</td>
          <td><span class="branch">${esc(r.family_branch)}</span></td>
          <td class="num">${fmt(Number(r.amount))} ر.س</td>
          <td style="text-align:right;color:#64748b">${esc(r.notes ?? "—")}</td>
        </tr>`,
      )
      .join("");
    const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
<title>سجل المساهمين ${activeYear}هـ</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;800&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 12mm; }
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
  font-family:'Tajawal',Arial,sans-serif;color:#1B2A2E;
  background:
    ${patternBg},
    linear-gradient(180deg,#FFFFFF 0%,#FBFAF6 100%);
  background-size:260px 260px, auto;
  background-position:center top, center top;
  -webkit-print-color-adjust:exact;print-color-adjust:exact;
}
.sheet{padding:6px 4px 24px;background:rgba(255,255,255,0.55)}
.header{
  position:relative;overflow:hidden;
  background:linear-gradient(135deg,#1B4F58 0%,#0D7C66 55%,#1B4F58 100%);
  color:#fff;padding:22px 26px;border-radius:16px;margin-bottom:16px;
  display:flex;justify-content:space-between;align-items:center;gap:18px;
  box-shadow:0 6px 18px rgba(27,79,88,.18);
  border:1px solid rgba(196,162,92,.45);
}
.header::before{
  content:"";position:absolute;inset:0;background:${patternBg};background-size:220px 220px;opacity:.08;pointer-events:none;mix-blend-mode:screen;
}
.header::after{
  content:"";position:absolute;left:-40px;bottom:-40px;width:180px;height:180px;border-radius:50%;
  background:radial-gradient(circle,#C4A25C 0%,transparent 65%);opacity:.35;
}
.brand{display:flex;align-items:center;gap:16px;position:relative;z-index:1}
.brand .logo-medal{
  width:78px;height:78px;border-radius:50%;
  background:radial-gradient(circle at 35% 30%,#FFFDF6 0%,#F5EBD0 75%,#E8D7A8 100%);
  border:2px solid #C4A25C;
  box-shadow:0 4px 12px rgba(0,0,0,.25), inset 0 0 0 4px rgba(255,255,255,.6);
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
}
.brand .logo-medal img{width:62px;height:62px;object-fit:contain;display:block}
.brand .titles h1{margin:0;font-size:18pt;font-weight:800;letter-spacing:-0.2px}
.brand .titles p{margin:4px 0 0;font-size:10pt;opacity:.92}
.meta{font-size:9.5pt;text-align:left;line-height:1.7;position:relative;z-index:1;
  background:rgba(255,255,255,.08);padding:10px 14px;border-radius:10px;
  border:1px solid rgba(196,162,92,.35);backdrop-filter:blur(2px)}
.meta b{color:#F5DFA8}
.gold-rule{height:3px;background:linear-gradient(90deg,transparent,#C4A25C,transparent);margin:0 0 14px;border-radius:2px}
.summary{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.chip{background:#fff;color:#1B4F58;padding:9px 16px;border-radius:12px;font-size:10pt;font-weight:800;
  border:1px solid rgba(27,79,88,.18);box-shadow:0 2px 6px rgba(27,79,88,.06)}
.chip.gold{background:linear-gradient(135deg,#FBF1D9,#F5E3B5);color:#7A5418;border-color:#E9CE8A}
.chip.teal{background:linear-gradient(135deg,#E6F2F1,#CFE6E3);color:#0D5C53;border-color:#A7D2CB}
.tablewrap{background:#fff;border-radius:14px;padding:6px;border:1px solid rgba(27,79,88,.12);
  box-shadow:0 4px 14px rgba(27,79,88,.08)}
table{width:100%;border-collapse:separate;border-spacing:0;font-size:10pt;overflow:hidden;border-radius:10px}
thead th{background:linear-gradient(135deg,#1B4F58,#0D7C66);color:#fff;padding:11px 6px;text-align:center;font-weight:700;border-bottom:2px solid #C4A25C}
thead th:first-child{border-top-right-radius:10px}
thead th:last-child{border-top-left-radius:10px}
tbody td{padding:9px 6px;text-align:center;border-bottom:1px solid #EDE6D2;vertical-align:middle}
tbody tr:nth-child(even) td{background:#FBF7EE}
tbody tr:hover td{background:#F5EEDC}
.num{font-weight:800;color:#0D5C53;direction:ltr;unicode-bidi:embed}
.branch{background:#1B4F58;color:#F5DFA8;padding:3px 12px;border-radius:999px;font-size:8.5pt;font-weight:700;letter-spacing:.2px}
tfoot td{background:linear-gradient(135deg,#C4A25C,#D9B873);color:#1B2A2E;font-weight:800;padding:11px 6px;text-align:center;border-top:2px solid #1B4F58}
tfoot td:first-child{border-bottom-right-radius:10px}
tfoot td:last-child{border-bottom-left-radius:10px}
.footer{margin-top:18px;display:flex;justify-content:space-between;align-items:center;
  font-size:8.5pt;color:#5C6B6E;padding:10px 14px;border-top:1px dashed #C4A25C}
.footer .seal{display:flex;align-items:center;gap:8px;font-weight:700;color:#1B4F58}
.footer .seal::before{content:"";display:inline-block;width:10px;height:10px;border-radius:50%;background:#C4A25C}
.toolbar{position:fixed;top:12px;left:12px;display:flex;gap:8px;z-index:50}
.toolbar button{background:#1B4F58;color:#fff;border:0;padding:10px 18px;border-radius:10px;font-family:inherit;font-weight:700;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,.18)}
.toolbar button.alt{background:#C4A25C;color:#1B2A2E}
@media print{.toolbar{display:none} body{background-size:260px 260px, auto}}
</style></head><body>
<div class="toolbar">
  <button onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
  <button class="alt" onclick="window.close()">إغلاق</button>
</div>
<div class="sheet">
  <div class="header">
    <div class="brand">
      <div class="logo-medal">
        <img src="${logoUrl}" alt="شعار الزواج الجماعي" crossorigin="anonymous"/>
      </div>
      <div class="titles">
        <h1>سجل المساهمين للسنة ${activeYear}هـ</h1>
        <p>منصة لجنة الزواج الجماعي العائلية</p>
      </div>
    </div>
    <div class="meta">
      <div>الفرع: <b>${branchFilter === "all" ? "جميع الفروع" : esc(branchFilter)}</b></div>
      <div>تاريخ التصدير: <b>${esc(today)}</b></div>
    </div>
  </div>
  <div class="gold-rule"></div>
  <div class="summary">
    <div class="chip teal">عدد المساهمين: ${fmt(filtered.length)}</div>
    <div class="chip gold">إجمالي المبالغ: ${fmt(totalAmount)} ر.س</div>
  </div>
  <div class="tablewrap">
    <table>
      <thead><tr><th style="width:40px">#</th><th>المساهم</th><th>الفرع</th><th>المبلغ</th><th>ملاحظات</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot><tr><td colspan="3">الإجمالي</td><td>${fmt(totalAmount)} ر.س</td><td>—</td></tr></tfoot>
    </table>
  </div>
  <div class="footer">
    <div class="seal">منصة لجنة الزواج الجماعي العائلية</div>
    <div>وثيقة مُصدّرة آلياً — ${esc(today)}</div>
  </div>
</div>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),600));</script>
</body></html>`;
    const win = window.open("", "_blank", "width=1100,height=800");
    if (!win) {
      toast.error("يرجى السماح بالنوافذ المنبثقة لإكمال التصدير");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    toast.success("تم تجهيز ملف PDF");
  };

  return (
    <div className="space-y-5">
      {/* Header & Actions */}
      <div className="rounded-2xl border bg-gradient-to-l from-emerald-500/10 via-card to-card p-5 shadow-soft">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-600" />
              <h3 className="font-bold text-lg">سجل المساهمين للسنوات السابقة</h3>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              إدارة وعرض أسماء المساهمين لكل سنة هجرية مفروزة على الفروع العائلية
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <Sparkles className="h-4 w-4" /> رفع واستخراج تلقائي
                </Button>
              </DialogTrigger>
              <DialogContent dir="rtl" className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    استخراج تلقائي بالذكاء الاصطناعي
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground">
                    ارفع ملف PDF / صورة / Excel وسيتم استخراج الأسماء وفرزها على الفروع تلقائياً، ثم ستظهر شاشة معاينة قبل الإدراج النهائي.
                  </div>
                  <div>
                    <Label>السنة الهجرية</Label>
                    <Select value={String(uploadYear)} onValueChange={(v) => setUploadYear(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {HIJRI_YEARS.map((y) => (
                          <SelectItem key={y} value={String(y)}>{y}هـ</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>المبلغ الافتراضي لكل مساهم (إذا لم يُذكر صراحة)</Label>
                    <Select value={String(uploadAmount)} onValueChange={(v) => setUploadAmount(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {AMOUNT_OPTIONS.map((a) => (
                          <SelectItem key={a} value={String(a)}>{fmt(a)} ر.س</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>الملف (PDF / صورة / Excel)</Label>
                    <Input
                      type="file"
                      accept=".pdf,.xlsx,.xls,.csv,image/*"
                      onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={extractFromFile} disabled={!uploadFile || uploading} className="gap-1">
                    {uploading ? (
                      <>جارٍ الاستخراج...</>
                    ) : (
                      <><Sparkles className="h-4 w-4" /> ارفع واستخرج</>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1" onClick={() => { resetForm(); setForm((f) => ({ ...f, hijri_year: activeYear })); }}>
                  <Plus className="h-4 w-4" /> إضافة مساهم
                </Button>
              </DialogTrigger>
              <DialogContent dir="rtl" className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingId ? "تعديل بيانات المساهم" : "إضافة مساهم جديد"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>اسم المساهم *</Label>
                    <Input
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      placeholder="الاسم الرباعي"
                      maxLength={120}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>الفرع العائلي *</Label>
                      <Select value={form.family_branch} onValueChange={(v) => setForm({ ...form, family_branch: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FAMILY_BRANCHES.map((b) => (
                            <SelectItem key={b} value={b}>{b}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>السنة الهجرية *</Label>
                      <Select value={String(form.hijri_year)} onValueChange={(v) => setForm({ ...form, hijri_year: Number(v) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {HIJRI_YEARS.map((y) => (
                            <SelectItem key={y} value={String(y)}>{y}هـ</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label>المبلغ (ر.س) *</Label>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => setCustomAmount(!customAmount)}
                      >
                        {customAmount ? "اختر من القائمة" : "إدخال مبلغ مخصص"}
                      </button>
                    </div>
                    {customAmount ? (
                      <Input
                        type="number"
                        min={1}
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })}
                      />
                    ) : (
                      <Select value={String(form.amount)} onValueChange={(v) => setForm({ ...form, amount: Number(v) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AMOUNT_OPTIONS.map((a) => (
                            <SelectItem key={a} value={String(a)}>{fmt(a)} ر.س</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div>
                    <Label>ملاحظات (اختياري)</Label>
                    <Textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      rows={2}
                      maxLength={300}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                  <Button onClick={submit}>{editingId ? "حفظ التعديلات" : "إضافة"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Year Tabs */}
      <Tabs value={String(activeYear)} onValueChange={(v) => setActiveYear(Number(v))}>
        <TabsList className="w-full justify-start overflow-x-auto h-auto flex-wrap gap-1">
          {HIJRI_YEARS.map((y) => {
            const count = rows.filter((r) => r.hijri_year === y).length;
            return (
              <TabsTrigger key={y} value={String(y)} className="gap-1.5">
                <span>{y}هـ</span>
                {count > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{count}</Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {HIJRI_YEARS.map((y) => (
          <TabsContent key={y} value={String(y)} className="space-y-4 mt-4">
            {/* Branch summary */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {branchAgg.filter((b) => b.count > 0).map((b) => (
                <button
                  key={b.branch}
                  onClick={() => setBranchFilter(b.branch === branchFilter ? "all" : b.branch)}
                  className={`text-right rounded-xl border p-3 transition-all hover:shadow-soft ${
                    branchFilter === b.branch
                      ? "bg-primary/10 border-primary/40"
                      : "bg-card hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <TreePine className="h-3.5 w-3.5 text-emerald-600" />
                    <Badge variant="outline" className="text-[10px]">{b.count}</Badge>
                  </div>
                  <p className="font-semibold text-xs mt-1.5 truncate">{b.branch}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmt(b.total)} ر.س</p>
                </button>
              ))}
              {branchAgg.every((b) => b.count === 0) && (
                <div className="col-span-full text-center py-8 text-muted-foreground text-sm rounded-xl border border-dashed">
                  لا توجد بيانات لسنة {y}هـ بعد — أضف مساهمين أو ارفع ملف PDF
                </div>
              )}
            </div>

            {/* Filters & Table */}
            <div className="rounded-2xl border bg-card overflow-hidden shadow-soft">
              <div className="px-4 py-3 border-b bg-muted/20 flex items-center gap-2 flex-wrap">
                <div className="flex-1 min-w-[180px] relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="بحث بالاسم..."
                    className="pe-9 h-9"
                  />
                </div>
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الفروع</SelectItem>
                    {FAMILY_BRANCHES.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1" disabled={filtered.length === 0}>
                      <Download className="h-3.5 w-3.5" /> تصدير
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuLabel>اختر صيغة التصدير</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={downloadCSV} className="gap-2 cursor-pointer">
                      <FileText className="h-4 w-4 text-blue-600" /> CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={downloadPDF} className="gap-2 cursor-pointer">
                      <Printer className="h-4 w-4 text-rose-600" /> PDF / طباعة
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr className="text-right">
                      <th className="px-4 py-2.5 font-medium">#</th>
                      <th className="px-4 py-2.5 font-medium">المساهم</th>
                      <th className="px-4 py-2.5 font-medium">الفرع</th>
                      <th className="px-4 py-2.5 font-medium">المبلغ</th>
                      <th className="px-4 py-2.5 font-medium">ملاحظات</th>
                      <th className="px-4 py-2.5 font-medium text-left">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">جارٍ التحميل...</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-muted-foreground">
                          <Users2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          لا توجد بيانات مطابقة
                        </td>
                      </tr>
                    ) : (
                      filtered.map((r, i) => (
                        <tr key={r.id} className="border-t hover:bg-muted/20">
                          <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                          <td className="px-4 py-2.5 font-medium">{r.full_name}</td>
                          <td className="px-4 py-2.5">
                            <Badge variant="outline" className="bg-emerald-500/5 text-xs">{r.family_branch}</Badge>
                          </td>
                          <td className="px-4 py-2.5 font-semibold">
                            <span className="inline-flex items-center gap-1">
                              <Coins className="h-3.5 w-3.5 text-gold" /> {fmt(Number(r.amount))} ر.س
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate">{r.notes ?? "—"}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1 justify-end">
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => startEdit(r)}>
                                تعديل
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                  onClick={() => remove(r.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filtered.length > 0 && (
                    <tfoot className="bg-gradient-to-l from-emerald-500/10 to-gold/10 font-bold">
                      <tr>
                        <td colSpan={3} className="px-4 py-3">
                          الإجمالي ({totals.count} مساهم) — سنة {activeYear}هـ
                        </td>
                        <td className="px-4 py-3">{fmt(totals.total)} ر.س</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Preview Dialog — معاينة قبل التأكيد */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent dir="rtl" className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              معاينة الأسماء المستخرجة ({previewRows.length})
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded-lg border">
            {/* Branch summary chips */}
            <div className="p-3 border-b bg-muted/30 flex flex-wrap gap-2">
              {FAMILY_BRANCHES.map((b) => {
                const c = previewRows.filter((r) => r.family_branch === b).length;
                if (c === 0) return null;
                return (
                  <Badge key={b} variant="outline" className="bg-primary/5">
                    <TreePine className="h-3 w-3 ml-1" /> {b}: {c}
                  </Badge>
                );
              })}
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr className="text-right">
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">الاسم</th>
                  <th className="px-3 py-2 font-medium">الفرع</th>
                  <th className="px-3 py-2 font-medium">المبلغ</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {previewRows
                  .map((r, idx) => ({ r, idx }))
                  .sort((a, b) => {
                    const oa = FAMILY_BRANCHES.indexOf(a.r.family_branch as never);
                    const ob = FAMILY_BRANCHES.indexOf(b.r.family_branch as never);
                    return oa - ob;
                  })
                  .map(({ r, idx }, i) => (
                    <tr key={idx} className="border-t hover:bg-muted/20">
                      <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-1.5">{r.full_name}</td>
                      <td className="px-3 py-1.5">
                        <Select value={r.family_branch} onValueChange={(v) => updatePreviewBranch(idx, v)}>
                          <SelectTrigger className="h-7 text-xs w-44"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {FAMILY_BRANCHES.map((b) => (
                              <SelectItem key={b} value={b}>{b}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-1.5 font-semibold text-xs">{fmt(r.amount)} ر.س</td>
                      <td className="px-3 py-1.5">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removePreviewRow(idx)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>إلغاء</Button>
            <Button onClick={confirmInsert} disabled={confirming || previewRows.length === 0} className="gap-1">
              <CheckCircle2 className="h-4 w-4" />
              {confirming ? "جارٍ الإدراج..." : `تأكيد إدراج ${previewRows.length} مساهم`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
