import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  HeartHandshake, Calculator, AlertTriangle, CheckCircle2, Coins, TrendingDown,
  Download, Plus, Pencil, Trash2, FileSpreadsheet, FileText, FileJson, FileImage, FileType2,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { BRAND_LOGO_DATA_URI } from "@/assets/brand-logo";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FAMILY_BRANCHES } from "@/lib/family-branches";

const BASE_CONTRIBUTION = 10000;
const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(Math.round(n));
const escapeHtml = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );

interface Groom {
  id: string;
  full_name: string;
  family_branch: string;
  status: string;
  groom_contribution: number;
  deficit_share: number;
  contribution_paid: boolean;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "new", label: "جديد" },
  { value: "under_review", label: "قيد المراجعة" },
  { value: "approved", label: "معتمد" },
  { value: "rejected", label: "مرفوض" },
  { value: "completed", label: "مكتمل" },
];

type GroomForm = {
  full_name: string;
  phone: string;
  family_branch: string;
  status: string;
  groom_contribution: number;
  deficit_share: number;
  contribution_paid: boolean;
};

const emptyForm: GroomForm = {
  full_name: "",
  phone: "",
  family_branch: FAMILY_BRANCHES[0],
  status: "approved",
  groom_contribution: BASE_CONTRIBUTION,
  deficit_share: 0,
  contribution_paid: false,
};

interface Props {
  totalCollected: number; // total subscriptions
  totalBudgetNeeded: number; // sum of committee budgets
}

export function GroomContributions({ totalCollected, totalBudgetNeeded }: Props) {
  const [grooms, setGrooms] = useState<Groom[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Groom | null>(null);
  const [form, setForm] = useState<GroomForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("grooms")
      .select("id, full_name, family_branch, status, groom_contribution, deficit_share, contribution_paid")
      .order("created_at", { ascending: false });
    setGrooms((data ?? []) as Groom[]);
  };

  useEffect(() => { load(); }, []);

  // Eligible grooms = approved or completed (deficit distributed among them)
  const eligible = grooms.filter((g) => g.status === "approved" || g.status === "completed");
  const baseTotal = eligible.length * BASE_CONTRIBUTION;
  const totalAvailable = totalCollected + baseTotal;
  const deficit = Math.max(0, totalBudgetNeeded - totalAvailable);
  const perGroomExtra = eligible.length > 0 ? deficit / eligible.length : 0;
  const totalCollectedFromGrooms = grooms.reduce(
    (a, g) => a + (g.contribution_paid ? Number(g.groom_contribution) + Number(g.deficit_share) : 0),
    0,
  );

  const applyDistribution = async () => {
    if (eligible.length === 0) return toast.error("لا يوجد عرسان معتمدون لتوزيع العجز عليهم");
    const updates = eligible.map((g) =>
      supabase
        .from("grooms")
        .update({ groom_contribution: BASE_CONTRIBUTION, deficit_share: Math.round(perGroomExtra) })
        .eq("id", g.id),
    );
    const results = await Promise.all(updates);
    const fail = results.find((r) => r.error);
    if (fail?.error) return toast.error("تعذر التوزيع", { description: fail.error.message });
    toast.success(`تم توزيع ${fmt(deficit)} ر.س على ${eligible.length} عريس بالتساوي`);
    load();
  };

  const togglePaid = async (id: string, paid: boolean) => {
    await supabase.from("grooms").update({ contribution_paid: paid }).eq("id", id);
    load();
  };

  const updateGroomShare = async (id: string, field: "groom_contribution" | "deficit_share", v: number) => {
    const payload = field === "groom_contribution" ? { groom_contribution: v } : { deficit_share: v };
    await supabase.from("grooms").update(payload).eq("id", id);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (g: Groom) => {
    setEditing(g);
    setForm({
      full_name: g.full_name,
      phone: "",
      family_branch: g.family_branch,
      status: g.status,
      groom_contribution: Number(g.groom_contribution),
      deficit_share: Number(g.deficit_share),
      contribution_paid: g.contribution_paid,
    });
    setDialogOpen(true);
  };

  const saveForm = async () => {
    if (!form.full_name.trim()) return toast.error("اسم العريس مطلوب");
    setSaving(true);
    if (editing) {
      const { error } = await supabase.from("grooms").update({
        full_name: form.full_name.trim(),
        family_branch: form.family_branch,
        status: form.status as any,
        groom_contribution: form.groom_contribution,
        deficit_share: form.deficit_share,
        contribution_paid: form.contribution_paid,
      }).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error("تعذّر التحديث", { description: error.message });
      toast.success("تم تحديث بيانات العريس");
    } else {
      if (!form.phone.trim()) { setSaving(false); return toast.error("رقم الجوال مطلوب"); }
      const { error } = await supabase.from("grooms").insert({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        family_branch: form.family_branch,
        status: form.status as any,
        groom_contribution: form.groom_contribution,
        deficit_share: form.deficit_share,
        contribution_paid: form.contribution_paid,
      });
      setSaving(false);
      if (error) return toast.error("تعذّر الإضافة", { description: error.message });
      toast.success("تمت إضافة العريس");
    }
    setDialogOpen(false);
    load();
  };

  const removeGroom = async (g: Groom) => {
    if (!confirm(`حذف بيانات العريس "${g.full_name}"؟ لا يمكن التراجع.`)) return;
    const { error } = await supabase.from("grooms").delete().eq("id", g.id);
    if (error) return toast.error("تعذّر الحذف", { description: error.message });
    toast.success("تم الحذف");
    load();
  };

  const exportRows = () => grooms.map((g) => ({
    "العريس": g.full_name,
    "الأسرة": g.family_branch,
    "الحالة": (STATUS_OPTIONS.find((s) => s.value === g.status)?.label) ?? g.status,
    "المقدم": Number(g.groom_contribution),
    "حصة العجز": Number(g.deficit_share),
    "الإجمالي": Number(g.groom_contribution) + Number(g.deficit_share),
    "الدفع": g.contribution_paid ? "مدفوع" : "غير مدفوع",
  }));

  const downloadFile = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "مساهمات العرسان");
    XLSX.writeFile(wb, `groom-contributions-${new Date().toISOString().slice(0,10)}.xlsx`);
  };
  const exportCsv = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const csv = XLSX.utils.sheet_to_csv(ws);
    downloadFile(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
      `groom-contributions-${new Date().toISOString().slice(0,10)}.csv`);
  };
  const exportJson = () => {
    downloadFile(new Blob([JSON.stringify(exportRows(), null, 2)], { type: "application/json" }),
      `groom-contributions-${new Date().toISOString().slice(0,10)}.json`);
  };

  const buildBrandedReportEl = () => {
    const today = new Date().toLocaleDateString("ar-SA-u-ca-gregory");
    const totalContrib = grooms.reduce((a, g) => a + Number(g.groom_contribution), 0);
    const totalDef = grooms.reduce((a, g) => a + Number(g.deficit_share), 0);
    const totalAll = totalContrib + totalDef;
    const rowsHtml = grooms.map((g) => {
      const status = STATUS_OPTIONS.find((s) => s.value === g.status)?.label ?? g.status;
      const total = Number(g.groom_contribution) + Number(g.deficit_share);
      const paid = g.contribution_paid
        ? `<span style="color:#047857;font-weight:700">مدفوع</span>`
        : `<span style="color:#b91c1c;font-weight:700">غير مدفوع</span>`;
      return `<tr>
        <td>${escapeHtml(g.full_name)}</td>
        <td>${escapeHtml(g.family_branch)}</td>
        <td>${escapeHtml(status)}</td>
        <td style="text-align:left">${fmt(Number(g.groom_contribution))}</td>
        <td style="text-align:left">${fmt(Number(g.deficit_share))}</td>
        <td style="text-align:left;font-weight:700">${fmt(total)}</td>
        <td>${paid}</td>
      </tr>`;
    }).join("");

    const container = document.createElement("div");
    container.setAttribute("dir", "rtl");
    container.style.cssText = [
      "position:fixed","top:-10000px","right:0","width:1100px","padding:32px",
      "background:#ffffff","color:#111827",
      "font-family:'Segoe UI',Tahoma,Arial,'Noto Naskh Arabic','Geeza Pro',sans-serif",
      "font-size:13px","line-height:1.7","direction:rtl","text-align:right",
    ].join(";");
    container.innerHTML = `
      <style>
        .gc-hdr { display:flex; align-items:center; gap:16px; border-bottom:3px solid #C4A25C; padding-bottom:14px; margin-bottom:16px; }
        .gc-hdr img { height:72px; width:auto; }
        .gc-hdr h1 { margin:0; font-size:22px; color:#1B4F58; font-weight:800; }
        .gc-hdr p  { margin:4px 0 0; font-size:12px; color:#6b7280; }
        .gc-meta { display:flex; justify-content:space-between; font-size:11px; color:#6b7280; margin-bottom:10px; }
        .gc-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:8px 0 18px; }
        .gc-kpi  { border:1px solid #e5e7eb; border-radius:10px; padding:10px 12px; background:#FAFAF7; }
        .gc-kpi .k { font-size:10px; color:#6b7280; }
        .gc-kpi .v { font-size:16px; font-weight:800; color:#1B4F58; margin-top:2px; }
        table { border-collapse:collapse; width:100%; }
        th { background:#1B4F58; color:#fff; padding:8px; text-align:right; font-weight:700; font-size:12px; }
        td { border:1px solid #e5e7eb; padding:7px 8px; }
        tbody tr:nth-child(even) td { background:#FAFAF7; }
        .gc-foot { margin-top:18px; padding-top:10px; border-top:1px dashed #C4A25C; font-size:10px; color:#6b7280; display:flex; justify-content:space-between; }
      </style>
      <div class="gc-hdr">
        <img src="${BRAND_LOGO_DATA_URI}" alt="شعار اللجنة" />
        <div>
          <h1>لجنة الزواج الجماعي — اللجنة المالية</h1>
          <p>سجل مساهمات العرسان</p>
        </div>
      </div>
      <div class="gc-meta">
        <span>تاريخ التقرير: ${today}</span>
        <span>عدد العرسان: ${grooms.length}</span>
      </div>
      <div class="gc-kpis">
        <div class="gc-kpi"><div class="k">إجمالي المقدم</div><div class="v">${fmt(totalContrib)} ر.س</div></div>
        <div class="gc-kpi"><div class="k">إجمالي حصص العجز</div><div class="v">${fmt(totalDef)} ر.س</div></div>
        <div class="gc-kpi"><div class="k">الإجمالي المستحق</div><div class="v">${fmt(totalAll)} ر.س</div></div>
        <div class="gc-kpi"><div class="k">المحصّل فعلياً</div><div class="v">${fmt(totalCollectedFromGrooms)} ر.س</div></div>
      </div>
      <table>
        <thead><tr>
          <th>العريس</th><th>الأسرة</th><th>الحالة</th>
          <th>المقدم (ر.س)</th><th>حصة العجز (ر.س)</th><th>الإجمالي (ر.س)</th><th>الدفع</th>
        </tr></thead>
        <tbody>${rowsHtml || `<tr><td colspan="7" style="text-align:center;padding:20px;color:#6b7280">لا توجد بيانات</td></tr>`}</tbody>
      </table>
      <div class="gc-foot">
        <span>© لجنة الزواج الجماعي — قبيلة الهملة من قريش</span>
        <span>وثيقة رسمية صادرة عن النظام</span>
      </div>
    `;
    document.body.appendChild(container);
    return container;
  };

  const renderBrandedCanvas = async () => {
    const html2canvas = (await import("html2canvas")).default;
    const el = buildBrandedReportEl();
    try {
      // wait one frame so the logo image is laid out
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const canvas = await html2canvas(el, {
        scale: 2, useCORS: true, backgroundColor: "#ffffff", windowWidth: el.scrollWidth,
      });
      return canvas;
    } finally {
      el.remove();
    }
  };

  const exportImage = async () => {
    try {
      const canvas = await renderBrandedCanvas();
      canvas.toBlob((blob) => {
        if (!blob) return toast.error("تعذّر إنشاء الصورة");
        downloadFile(blob, `groom-contributions-${new Date().toISOString().slice(0,10)}.png`);
      }, "image/png");
    } catch (e: any) {
      toast.error("تعذّر إنشاء الصورة", { description: e?.message });
    }
  };

  const exportPdf = async () => {
    try {
      const canvas = await renderBrandedCanvas();
      const orientation = canvas.width >= canvas.height ? "landscape" : "portrait";
      const pdf = new jsPDF({ unit: "pt", format: "a4", orientation });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 18;
      const usableW = pageW - margin * 2;
      const pxPerPage = (canvas.width * (pageH - margin * 2)) / usableW;
      let rendered = 0, page = 0;
      while (rendered < canvas.height) {
        const sliceH = Math.min(pxPerPage, canvas.height - rendered);
        const c = document.createElement("canvas");
        c.width = canvas.width; c.height = sliceH;
        const ctx = c.getContext("2d"); if (!ctx) break;
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(canvas, 0, rendered, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        const data = c.toDataURL("image/jpeg", 0.92);
        if (page > 0) pdf.addPage();
        pdf.addImage(data, "JPEG", margin, margin, usableW, (sliceH * usableW) / canvas.width, undefined, "FAST");
        rendered += sliceH; page += 1;
      }
      pdf.save(`groom-contributions-${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (e: any) {
      toast.error("تعذّر إنشاء PDF", { description: e?.message });
    }
  };

  return (
    <div className="space-y-5">
      {/* Equation explanation */}
      <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-gold/5 p-5">
        <div className="flex items-start gap-3">
          <Calculator className="h-6 w-6 text-primary shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="font-bold">معادلة توزيع العجز</h3>
            <p className="text-xs text-muted-foreground mt-1">
              كل عريس يدفع <span className="font-bold text-primary">{fmt(BASE_CONTRIBUTION)} ر.س</span> كمقدم ثابت. عند وجود عجز،
              يُوزَّع المبلغ <span className="font-bold">بالتساوي</span> على جميع العرسان المعتمدين.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <KPI label="الميزانية المطلوبة" value={`${fmt(totalBudgetNeeded)} ر.س`} tone="amber" />
          <KPI label="المتوفر (اشتراكات + مقدم)" value={`${fmt(totalAvailable)} ر.س`} tone="emerald" />
          <KPI
            label="العجز"
            value={`${fmt(deficit)} ر.س`}
            tone={deficit > 0 ? "rose" : "emerald"}
            icon={deficit > 0 ? TrendingDown : CheckCircle2}
          />
          <KPI label="حصة كل عريس من العجز" value={`${fmt(perGroomExtra)} ر.س`} tone="primary" />
        </div>

        <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-muted-foreground">
            عدد العرسان المعتمدين: <span className="font-bold text-foreground">{eligible.length}</span>
            {" • "}
            إجمالي المحصّل من العرسان: <span className="font-bold text-foreground">{fmt(totalCollectedFromGrooms)} ر.س</span>
          </p>
          <Button onClick={applyDistribution} disabled={eligible.length === 0} className="bg-gradient-hero text-primary-foreground gap-2">
            <Calculator className="h-4 w-4" /> توزيع العجز بالتساوي
          </Button>
        </div>
      </div>

      {/* Grooms table */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-soft">
        <div className="px-5 py-4 border-b bg-gradient-to-l from-rose-500/5 to-transparent flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-bold flex items-center gap-2">
              <HeartHandshake className="h-4 w-4 text-rose-600" /> سجل مساهمات العرسان
            </h3>
            <p className="text-xs text-muted-foreground mt-1">يظهر هنا العرسان المعتمدون فقط</p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" /> تصدير
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportExcel} className="gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportCsv} className="gap-2">
                  <FileText className="h-4 w-4 text-sky-600" /> CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportJson} className="gap-2">
                  <FileJson className="h-4 w-4 text-amber-600" /> JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportPdf} className="gap-2">
                  <FileType2 className="h-4 w-4 text-rose-600" /> PDF بهوية اللجنة
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportImage} className="gap-2">
                  <FileImage className="h-4 w-4 text-violet-600" /> صورة PNG بهوية اللجنة
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <Plus className="h-4 w-4" /> إضافة عريس
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="text-right">
                <th className="px-4 py-3 font-medium">العريس</th>
                <th className="px-4 py-3 font-medium">الأسرة</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">المقدم</th>
                <th className="px-4 py-3 font-medium">حصة العجز</th>
                <th className="px-4 py-3 font-medium">الإجمالي</th>
                <th className="px-4 py-3 font-medium">الدفع</th>
                <th className="px-4 py-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {grooms.map((g) => {
                const total = Number(g.groom_contribution) + Number(g.deficit_share);
                const isEligible = g.status === "approved" || g.status === "completed";
                const statusMap: Record<string, { label: string; cls: string }> = {
                  new: { label: "جديد", cls: "bg-muted text-foreground" },
                  under_review: { label: "قيد المراجعة", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
                  approved: { label: "معتمد", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
                  rejected: { label: "مرفوض", cls: "bg-rose-500/15 text-rose-700 border-rose-500/30" },
                  completed: { label: "مكتمل", cls: "bg-gold/15 text-gold-foreground border-gold/30" },
                };
                const s = statusMap[g.status] ?? statusMap.new;
                return (
                  <tr key={g.id} className={`border-t hover:bg-muted/20 ${!isEligible ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3 font-medium">{g.full_name}</td>
                    <td className="px-4 py-3"><Badge variant="outline" className="bg-primary/5">{g.family_branch}</Badge></td>
                    <td className="px-4 py-3"><Badge variant="outline" className={s.cls}>{s.label}</Badge></td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        defaultValue={g.groom_contribution}
                        onBlur={(e) => updateGroomShare(g.id, "groom_contribution", Number(e.target.value))}
                        className="h-8 w-28"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        defaultValue={g.deficit_share}
                        onBlur={(e) => updateGroomShare(g.id, "deficit_share", Number(e.target.value))}
                        className="h-8 w-28"
                        disabled={!isEligible}
                      />
                    </td>
                    <td className="px-4 py-3 font-bold">
                      <span className="inline-flex items-center gap-1">
                        <Coins className="h-3.5 w-3.5 text-gold" /> {fmt(total)} ر.س
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant={g.contribution_paid ? "default" : "outline"}
                        className={g.contribution_paid ? "bg-emerald-600 hover:bg-emerald-700 text-white gap-1" : "gap-1"}
                        onClick={() => togglePaid(g.id, !g.contribution_paid)}
                      >
                        {g.contribution_paid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                        {g.contribution_paid ? "مدفوع" : "غير مدفوع"}
                      </Button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(g)} title="تعديل">
                          <Pencil className="h-4 w-4 text-sky-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeGroom(g)} title="حذف">
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {grooms.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">
                  لا يوجد عرسان مسجلون بعد.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل بيانات العريس" : "إضافة عريس جديد"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>اسم العريس</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            {!editing && (
              <div className="md:col-span-2">
                <Label>رقم الجوال</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="05xxxxxxxx" />
              </div>
            )}
            <div>
              <Label>الأسرة</Label>
              <Select value={form.family_branch} onValueChange={(v) => setForm({ ...form, family_branch: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FAMILY_BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>الحالة</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>المقدم (ر.س)</Label>
              <Input type="number" value={form.groom_contribution}
                onChange={(e) => setForm({ ...form, groom_contribution: Number(e.target.value) })} />
            </div>
            <div>
              <Label>حصة العجز (ر.س)</Label>
              <Input type="number" value={form.deficit_share}
                onChange={(e) => setForm({ ...form, deficit_share: Number(e.target.value) })} />
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <input id="paid" type="checkbox" checked={form.contribution_paid}
                onChange={(e) => setForm({ ...form, contribution_paid: e.target.checked })}
                className="h-4 w-4" />
              <Label htmlFor="paid" className="cursor-pointer">تم الدفع</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={saveForm} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? "جارٍ الحفظ..." : (editing ? "حفظ التعديلات" : "إضافة")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KPI({ label, value, tone, icon: Icon }: { label: string; value: string; tone: string; icon?: any }) {
  const map: Record<string, string> = {
    amber: "from-amber-500/15 to-amber-500/5 border-amber-500/30 text-amber-700",
    emerald: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/30 text-emerald-700",
    rose: "from-rose-500/15 to-rose-500/5 border-rose-500/30 text-rose-700",
    primary: "from-primary/15 to-primary/5 border-primary/30 text-primary",
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-3 ${map[tone]}`}>
      <p className="text-[10px] font-medium opacity-80">{label}</p>
      <p className="font-bold text-lg leading-tight mt-1 inline-flex items-center gap-1">
        {Icon && <Icon className="h-4 w-4" />} {value}
      </p>
    </div>
  );
}
