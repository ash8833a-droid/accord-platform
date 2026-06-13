import { useEffect, useState } from "react";
import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import weddingLogo from "@/assets/wedding-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Star, Copy, ExternalLink, MessageSquareHeart, Loader2,
  Sparkles, FileSpreadsheet, FileText, Download,
  TrendingUp, AlertTriangle, Lightbulb, Target, Trash2, QrCode,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { analyzeWeddingFeedback, type FeedbackAnalysis } from "@/lib/analyze-wedding-feedback.functions";
import { printHtmlDocument } from "@/lib/print-frame";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Row {
  id: string;
  organization_score: number;
  hospitality_score: number;
  program_score: number;
  overall_score: number;
  suggestions: string | null;
  respondent_role: string | null;
  respondent_phone: string | null;
  created_at: string;
}

const LABELS: { key: keyof Row; label: string; tone: string }[] = [
  { key: "organization_score", label: "التنظيم والاستقبال", tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  { key: "program_score", label: "البرامج والفقرات", tone: "bg-violet-500/10 text-violet-700 border-violet-500/30" },
  { key: "hospitality_score", label: "الضيافة والعشاء", tone: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  { key: "overall_score", label: "الانطباع العام", tone: "bg-rose-500/10 text-rose-700 border-rose-500/30" },
];

const SENTIMENT_META: Record<FeedbackAnalysis["sentiment"], { label: string; tone: string }> = {
  positive: { label: "إيجابي", tone: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  neutral: { label: "محايد", tone: "bg-slate-500/15 text-slate-700 border-slate-500/30" },
  negative: { label: "سلبي", tone: "bg-rose-500/15 text-rose-700 border-rose-500/30" },
  mixed: { label: "متفاوت", tone: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export function WeddingFeedbackPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<FeedbackAnalysis | null>(null);
  const runAnalyze = useServerFn(analyzeWeddingFeedback);
  // Always share the public published URL so social platforms (WhatsApp/Twitter/…)
  // can fetch OG metadata. The internal *.lovableproject.com preview is auth-gated
  // and would show a generic "Internal Lovable project" card.
  const PUBLIC_ORIGIN = "https://www.lajnat-zawaj.org";
  const link = `${PUBLIC_ORIGIN}/wedding-feedback`;
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("wedding_feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, []);

  const avg = (k: keyof Row) =>
    rows.length ? (rows.reduce((a, r) => a + (r[k] as number), 0) / rows.length) : 0;

  const deleteOne = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("wedding_feedback").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      toast.error("تعذر حذف التقييم", { description: error.message });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success("تم حذف التقييم");
  };

  const deleteAll = async () => {
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return;
    const { error } = await supabase.from("wedding_feedback").delete().in("id", ids);
    if (error) {
      toast.error("تعذر حذف التقييمات", { description: error.message });
      return;
    }
    setRows([]);
    setAnalysis(null);
    toast.success(`تم حذف ${ids.length} تقييم`);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    toast.success("تم نسخ رابط الاستبيان");
  };

  const handleAnalyze = async () => {
    if (rows.length === 0) {
      toast.error("لا توجد تقييمات للتحليل بعد");
      return;
    }
    setAnalyzing(true);
    try {
      const res = await runAnalyze({ data: {} });
      setAnalysis(res.analysis);
      toast.success("اكتمل التحليل الذكي");
    } catch (e: any) {
      toast.error("تعذر التحليل", { description: e?.message });
    } finally {
      setAnalyzing(false);
    }
  };

  const buildRows = () =>
    rows.map((r, i) => ({
      "#": i + 1,
      "التاريخ": new Date(r.created_at).toLocaleDateString("ar-SA"),
      "الصفة": r.respondent_role || "—",
      "التنظيم والاستقبال": r.organization_score,
      "الضيافة والعشاء": r.hospitality_score,
      "البرامج والفقرات": r.program_score,
      "الانطباع العام": r.overall_score,
      "المتوسط": +(
        (r.organization_score + r.hospitality_score + r.program_score + r.overall_score) / 4
      ).toFixed(2),
      "المقترحات": r.suggestions || "",
    }));

  const exportCSV = () => {
    if (rows.length === 0) return toast.error("لا توجد بيانات للتصدير");
    const data = buildRows();
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    // BOM for Excel Arabic compatibility
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `wedding-feedback-${Date.now()}.csv`);
    toast.success("تم تصدير CSV");
  };

  const exportExcel = () => {
    if (rows.length === 0) return toast.error("لا توجد بيانات للتصدير");
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(buildRows());
    ws["!cols"] = [
      { wch: 5 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
      { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 60 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "التقييمات");

    // Summary sheet
    const sumData = [
      ["المحور", "المتوسط"],
      ["التنظيم والاستقبال", +avg("organization_score").toFixed(2)],
      ["الضيافة والعشاء", +avg("hospitality_score").toFixed(2)],
      ["البرامج والفقرات", +avg("program_score").toFixed(2)],
      ["الانطباع العام", +avg("overall_score").toFixed(2)],
      [],
      ["عدد التقييمات", rows.length],
    ];
    const sws = XLSX.utils.aoa_to_sheet(sumData);
    sws["!cols"] = [{ wch: 24 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, sws, "الملخص");
    XLSX.writeFile(wb, `wedding-feedback-${Date.now()}.xlsx`);
    toast.success("تم تصدير Excel");
  };

  const exportPDF = async () => {
    if (rows.length === 0) return toast.error("لا توجد بيانات للتصدير");
    const esc = (s: string) =>
      String(s ?? "").replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
      );
    const list = (arr?: string[]) =>
      arr && arr.length
        ? `<ul style="margin:6px 0;padding-inline-start:18px;">${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`
        : `<p style="color:#888;font-size:11px;">—</p>`;
    const avgCard = (label: string, v: number, color: string) => `
      <div style="border:1px solid #e5e7eb;border-top:4px solid ${color};border-radius:10px;padding:10px;flex:1;min-width:140px;">
        <div style="font-size:11px;color:#555;">${label}</div>
        <div style="font-size:22px;font-weight:800;color:${color};margin-top:4px;">${v.toFixed(2)} <span style="font-size:11px;color:#999;">/ 5</span></div>
      </div>`;
    const tableRows = rows
      .map(
        (r, i) => `<tr>
          <td>${i + 1}</td>
          <td>${esc(new Date(r.created_at).toLocaleDateString("ar-SA"))}</td>
          <td>${esc(r.respondent_role || "—")}</td>
          <td>${r.organization_score}</td>
          <td>${r.hospitality_score}</td>
          <td>${r.program_score}</td>
          <td>${r.overall_score}</td>
          <td style="text-align:start;">${esc(r.suggestions || "—")}</td>
        </tr>`,
      )
      .join("");

    const analysisBlock = analysis
      ? `<div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:18px 0;background:#fffaf3;">
          <h2 style="margin:0 0 8px;color:#0D7C66;font-size:16px;">🧠 التحليل الذكي</h2>
          <p style="margin:0 0 10px;line-height:1.8;">${esc(analysis.executive_summary)}</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div><h3 style="margin:6px 0;color:#16a34a;font-size:13px;">نقاط القوة</h3>${list(analysis.strengths)}</div>
            <div><h3 style="margin:6px 0;color:#dc2626;font-size:13px;">نقاط الضعف</h3>${list(analysis.weaknesses)}</div>
            <div><h3 style="margin:6px 0;color:#0ea5e9;font-size:13px;">فرص التحسين</h3>${list(analysis.opportunities)}</div>
            <div><h3 style="margin:6px 0;color:#7c3aed;font-size:13px;">التوصيات</h3>${list(analysis.recommendations)}</div>
          </div>
        </div>`
      : "";

    const html = `
      <style>
        @page { size: A4; margin: 14mm; }
        body { font-family: -apple-system, "Tahoma", "Arial", sans-serif; color:#222; }
        h1 { font-size: 20px; margin: 0; }
        table { width:100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
        th, td { border: 1px solid #e5e7eb; padding: 6px; text-align:center; }
        th { background:#f3f4f6; }
        tr:nth-child(even) td { background:#fafafa; }
      </style>
      <div style="text-align:center;margin-bottom:14px;">
        <h1>تقرير استبيان رضا ضيوف الزواج الجماعي</h1>
        <p style="color:#666;font-size:12px;margin:4px 0;">${rows.length} تقييم · ${new Date().toLocaleDateString("ar-SA")}</p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        ${avgCard("التنظيم والاستقبال", avg("organization_score"), "#059669")}
        ${avgCard("الضيافة والعشاء", avg("hospitality_score"), "#d97706")}
        ${avgCard("البرامج والفقرات", avg("program_score"), "#7c3aed")}
        ${avgCard("الانطباع العام", avg("overall_score"), "#e11d48")}
      </div>
      ${analysisBlock}
      <h2 style="font-size:14px;margin:18px 0 4px;">تفاصيل التقييمات</h2>
      <table>
        <thead><tr>
          <th>#</th><th>التاريخ</th><th>الصفة</th>
          <th>التنظيم</th><th>الضيافة</th><th>البرامج</th><th>الانطباع</th><th>المقترحات</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    `;
    await printHtmlDocument(html, "تقرير رضا الضيوف");
    toast.success("تم تجهيز ملف PDF (اختر حفظ كـ PDF من نافذة الطباعة)");
  };

  return (
    <div className="rounded-2xl border bg-card shadow-soft overflow-hidden">
      <div className="px-6 py-4 border-b bg-gradient-to-l from-rose-500/5 via-amber-500/5 to-emerald-500/5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <MessageSquareHeart className="h-5 w-5 text-rose-600" />
          <h2 className="font-bold">استبيان رضا الضيوف عن الزواج الجماعي</h2>
          <Badge variant="outline" className="text-[10px]">{rows.length} تقييم</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={copy} className="gap-1.5 text-xs">
            <Copy className="h-3.5 w-3.5" /> نسخ رابط الاستبيان
          </Button>
          {rows.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs text-rose-700 border-rose-300 hover:bg-rose-50">
                  <Trash2 className="h-3.5 w-3.5" /> حذف التقييمات التجريبية
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle>حذف جميع التقييمات؟</AlertDialogTitle>
                  <AlertDialogDescription>
                    سيتم حذف {rows.length} تقييم بشكل نهائي. هذا الإجراء لا يمكن التراجع عنه.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteAll} className="bg-rose-600 hover:bg-rose-700">
                    حذف الكل
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" /> تصدير
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportExcel} className="gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel (xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportCSV} className="gap-2">
                <FileText className="h-4 w-4 text-sky-600" /> CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportPDF} className="gap-2">
                <FileText className="h-4 w-4 text-rose-600" /> PDF (طباعة)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            onClick={handleAnalyze}
            disabled={analyzing || rows.length === 0}
            className="gap-1.5 text-xs bg-gradient-to-l from-violet-600 to-fuchsia-600 text-white"
          >
            {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            تحليل ذكي
          </Button>
          <Button size="sm" asChild className="gap-1.5 text-xs bg-gradient-to-l from-emerald-600 to-amber-500 text-white">
            <a href="/wedding-feedback" target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" /> فتح الاستبيان
            </a>
          </Button>
        </div>
      </div>

      <QrCard link={link} />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {LABELS.map((l) => {
            const v = avg(l.key);
            return (
              <div key={l.key} className={`rounded-xl border p-4 ${l.tone}`}>
                <p className="text-xs font-bold">{l.label}</p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold">{v.toFixed(1)}</span>
                  <span className="text-xs opacity-70">/ 5</span>
                </div>
                <div className="flex gap-0.5 mt-1" dir="ltr">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`h-3.5 w-3.5 ${n <= Math.round(v) ? "fill-current" : "opacity-30"}`} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {analysis && (
          <div className="rounded-2xl border-2 border-violet-500/30 bg-gradient-to-br from-violet-50 via-fuchsia-50 to-rose-50 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-600" />
                التحليل الذكي للنتائج
              </h3>
              <div className="flex items-center gap-2">
                <Badge className={SENTIMENT_META[analysis.sentiment].tone}>
                  الانطباع العام: {SENTIMENT_META[analysis.sentiment].label}
                </Badge>
                {analysis.overall_satisfaction_label && (
                  <Badge variant="outline" className="bg-white/70">
                    {analysis.overall_satisfaction_label}
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-sm leading-relaxed bg-white/70 rounded-xl p-3 border">
              {analysis.executive_summary}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <AnalysisList title="نقاط القوة" items={analysis.strengths} icon={TrendingUp} color="text-emerald-700" />
              <AnalysisList title="نقاط الضعف" items={analysis.weaknesses} icon={AlertTriangle} color="text-rose-700" />
              <AnalysisList title="فرص التحسين" items={analysis.opportunities} icon={Lightbulb} color="text-sky-700" />
              <AnalysisList title="التوصيات العملية" items={analysis.recommendations} icon={Target} color="text-violet-700" />
            </div>
          </div>
        )}

        <div>
          <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
            <MessageSquareHeart className="h-4 w-4 text-rose-600" /> آخر المقترحات
          </h3>
          {loading ? (
            <div className="py-6 text-center"><Loader2 className="h-5 w-5 inline animate-spin text-muted-foreground" /></div>
          ) : rows.filter((r) => r.suggestions).length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
              لا توجد مقترحات بعد. شارك رابط الاستبيان مع الحضور لجمع آراءهم.
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {rows.filter((r) => r.suggestions).slice(0, 50).map((r) => (
                <div key={r.id} className="rounded-xl border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
                      {r.respondent_role && <Badge variant="outline" className="text-[10px]">{r.respondent_role}</Badge>}
                      <span>{new Date(r.created_at).toLocaleDateString("ar-SA")}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-0.5">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                        {((r.organization_score + r.hospitality_score + r.program_score + r.overall_score) / 4).toFixed(1)}
                      </span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-rose-600 hover:bg-rose-50"
                      disabled={deletingId === r.id}
                      onClick={() => deleteOne(r.id)}
                      aria-label="حذف"
                    >
                      {deletingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{r.suggestions}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {rows.length > 0 && (
          <div>
            <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
              <MessageSquareHeart className="h-4 w-4 text-rose-600" /> كل التقييمات ({rows.length})
            </h3>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto rounded-xl border divide-y">
              {rows.map((r, i) => {
                const m = (r.organization_score + r.hospitality_score + r.program_score + r.overall_score) / 4;
                return (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <Badge variant="outline" className="text-[10px]">#{i + 1}</Badge>
                      <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString("ar-SA")}</span>
                      {r.respondent_role && <span className="text-muted-foreground">· {r.respondent_role}</span>}
                      <span className="inline-flex items-center gap-0.5">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                        {m.toFixed(1)}
                      </span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-rose-600 hover:bg-rose-50 shrink-0"
                      disabled={deletingId === r.id}
                      onClick={() => deleteOne(r.id)}
                      aria-label="حذف"
                    >
                      {deletingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AnalysisList({
  title,
  items,
  icon: Icon,
  color,
}: {
  title: string;
  items: string[];
  icon: any;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-white/70 border p-3">
      <h4 className={`font-bold text-sm flex items-center gap-1.5 mb-2 ${color}`}>
        <Icon className="h-4 w-4" /> {title}
      </h4>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-1.5 text-sm leading-relaxed">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${color.replace("text-", "bg-")}`} />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QrCard({ link }: { link: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const BRAND_GOLD = "#C9A24C";
  const BRAND_TEAL = "#0E7C6B";

  const downloadPng = async () => {
    const svg = wrapRef.current?.querySelector("svg");
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    // Ensure xmlns so the SVG renders standalone
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const xml = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const size = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size + 140;
    const ctx = canvas.getContext("2d")!;
    // transparent background, draw QR centered
    ctx.drawImage(img, 0, 0, size, size);
    // caption
    ctx.fillStyle = BRAND_TEAL;
    ctx.font = "bold 64px system-ui, 'Segoe UI', Tahoma, sans-serif";
    ctx.textAlign = "center";
    ctx.direction = "rtl";
    ctx.fillText("رأيك يهمّنا", size / 2, size + 80);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "wedding-feedback-qr.png";
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  };

  return (
    <div className="px-6 pt-6">
      <div className="rounded-2xl border bg-gradient-to-br from-emerald-50/60 via-white to-amber-50/60 p-6 flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 text-sm font-bold" style={{ color: BRAND_TEAL }}>
          <QrCode className="h-4 w-4" />
          باركود الاستبيان
        </div>

        <div
          ref={wrapRef}
          className="relative rounded-2xl p-5 bg-white"
          style={{ border: `2px solid ${BRAND_GOLD}` }}
        >
          {["top-1.5 right-1.5 border-t-4 border-r-4 rounded-tr-lg",
            "top-1.5 left-1.5 border-t-4 border-l-4 rounded-tl-lg",
            "bottom-1.5 right-1.5 border-b-4 border-r-4 rounded-br-lg",
            "bottom-1.5 left-1.5 border-b-4 border-l-4 rounded-bl-lg",
          ].map((c, i) => (
            <span key={i} className={`absolute w-5 h-5 ${c}`} style={{ borderColor: BRAND_TEAL }} />
          ))}
          <QRCodeSVG
            value={link}
            size={220}
            level="H"
            bgColor="#ffffff"
            fgColor={BRAND_TEAL}
            imageSettings={{
              src: weddingLogo.url,
              height: 48,
              width: 48,
              excavate: true,
            }}
          />
        </div>

        <p className="text-lg font-extrabold tracking-wide" style={{ color: BRAND_TEAL }}>
          رأيك يهمّنا
        </p>
        <p className="text-[11px] text-muted-foreground -mt-2 text-center">
          امسح الباركود للمشاركة في استبيان تقييم الزواج الجماعي
        </p>

        <Button size="sm" variant="outline" onClick={downloadPng} className="gap-1.5 text-xs">
          <Download className="h-3.5 w-3.5" /> تحميل كصورة PNG
        </Button>
      </div>
    </div>
  );
}