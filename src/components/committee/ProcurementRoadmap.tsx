import roadmapAsset from "@/assets/procurement-roadmap.png.asset.json";
import {
  Download, Map, Sparkles, ClipboardList, Target, Users, ClipboardCheck,
  Truck, BarChart3, ShieldCheck, AlertTriangle, TrendingUp, X, ZoomIn,
  ChevronDown, FileSpreadsheet, Printer, Circle, Loader2, CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { printHtmlDocument } from "@/lib/print-frame";
import { BRAND_LOGO_DATA_URI } from "@/assets/brand-logo";

type StageStatus = "todo" | "in_progress" | "completed";

const STATUS_META: Record<StageStatus, { label: string; cls: string; icon: LucideIcon; hex: string }> = {
  todo:        { label: "قائمة الانتظار", cls: "bg-slate-100 text-slate-700 border-slate-300",   icon: Circle,        hex: "#64748b" },
  in_progress: { label: "قيد التنفيذ",    cls: "bg-sky-100 text-sky-800 border-sky-300",         icon: Loader2,       hex: "#0284c7" },
  completed:   { label: "مكتملة",         cls: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: CheckCircle2, hex: "#059669" },
};
const STATUS_ORDER: StageStatus[] = ["todo", "in_progress", "completed"];

type Stage = {
  id: string;
  num: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tone: string;        // text + border
  chip: string;        // background gradient for number chip
  ring: string;        // ring color when active
  items: string[];
  /** Normalized crop box of the roadmap image (0..1) to zoom into on click */
  crop: { x: number; y: number; w: number; h: number };
};

const STAGES: Stage[] = [
  {
    id: "exec",
    num: "1",
    title: "الملخص التنفيذي",
    subtitle: "الإطار العام لعمل اللجنة",
    icon: ClipboardList,
    tone: "text-teal-800 border-teal-500/40",
    chip: "from-teal-700 to-teal-500",
    ring: "ring-teal-500/40",
    crop: { x: 0.62, y: 0.02, w: 0.38, h: 0.28 },
    items: [
      "تأمين المستلزمات في الوقت المحدّد",
      "كفاءة الإنفاق وضبط التكاليف",
      "ضبط الجودة عند الاستلام",
      "الالتزام بالمواعيد والجداول",
      "الشفافية والحوكمة في القرارات",
      "إدارة المخاطر ومعالجتها مبكّرًا",
    ],
  },
  {
    id: "goals",
    num: "2",
    title: "الأهداف التشغيلية",
    subtitle: "خمسة أهداف موجّهة",
    icon: Target,
    tone: "text-amber-800 border-amber-500/40",
    chip: "from-amber-600 to-amber-400",
    ring: "ring-amber-500/40",
    crop: { x: 0.6, y: 0.25, w: 0.4, h: 0.28 },
    items: [
      "حصر الاحتياجات وتوحيد المواصفات",
      "اختيار الموردين الأنسب سعرًا وجودة",
      "ضبط التكاليف ضمن الموازنة المعتمدة",
      "التسليم قبل الحفل بوقت كافٍ",
      "أرشفة العقود والفواتير لكل عملية",
    ],
  },
  {
    id: "phase1",
    num: "3",
    title: "المرحلة الأولى: التمهيد والتأهيل",
    subtitle: "بناء قاعدة الموردين",
    icon: Users,
    tone: "text-teal-800 border-teal-600/40",
    chip: "from-teal-800 to-teal-600",
    ring: "ring-teal-600/40",
    crop: { x: 0.55, y: 0.48, w: 0.45, h: 0.24 },
    items: [
      "استقصاء السوق ومسح الموردين",
      "بناء قاعدة بيانات موردين معتمدة",
      "التأهيل المسبق وفق معايير مالية وفنية",
      "إعداد النماذج المعيارية للطلبات والعقود",
      "اتفاقيات إطارية للمواد المتكررة",
    ],
  },
  {
    id: "phase2",
    num: "4",
    title: "المرحلة الثانية: طرح العروض والتقييم",
    subtitle: "تنافسية وشفافية",
    icon: ClipboardCheck,
    tone: "text-orange-800 border-orange-500/40",
    chip: "from-orange-600 to-orange-400",
    ring: "ring-orange-500/40",
    crop: { x: 0.6, y: 0.7, w: 0.4, h: 0.26 },
    items: [
      "إعداد كرّاسة الشروط والمواصفات",
      "دعوة 3 موردين على الأقل لتقديم العرض",
      "استلام العروض بسرية تامة",
      "التقييم عبر مصفوفة ترجيح موحّدة",
      "التفاوض والترسية وتوثيق القرار",
    ],
  },
  {
    id: "phase3",
    num: "5",
    title: "المرحلة الثالثة: التنفيذ واللوجستيات",
    subtitle: "تشغيل واستلام",
    icon: Truck,
    tone: "text-emerald-800 border-emerald-600/40",
    chip: "from-emerald-700 to-emerald-500",
    ring: "ring-emerald-600/40",
    crop: { x: 0.32, y: 0.68, w: 0.32, h: 0.3 },
    items: [
      "إصدار أمر شراء رسمي موثّق",
      "متابعة حالة الطلبات مع الموردين",
      "فحص الجودة عند الاستلام",
      "التنسيق مع اللجان المعنية للتسلّم",
      "إعادة البنود غير المطابقة",
      "الاحتفاظ بمخزون احتياطي 5–10%",
    ],
  },
  {
    id: "phase4",
    num: "6",
    title: "المرحلة الرابعة: التقييم والإغلاق",
    subtitle: "قفل الملف باحتراف",
    icon: BarChart3,
    tone: "text-violet-800 border-violet-600/40",
    chip: "from-violet-700 to-violet-500",
    ring: "ring-violet-600/40",
    crop: { x: 0, y: 0.55, w: 0.32, h: 0.28 },
    items: [
      "تقييم أداء الموردين بعد التنفيذ",
      "المطابقة المالية النهائية للفواتير",
      "الأرشفة الكاملة للعقود والمستندات",
      "إعداد التقرير الختامي للموسم",
      "تحديث قاعدة الموردين للأعوام القادمة",
    ],
  },
  {
    id: "gov",
    num: "7",
    title: "الحوكمة وضبط الجودة",
    subtitle: "ضوابط لا يُتنازل عنها",
    icon: ShieldCheck,
    tone: "text-yellow-800 border-yellow-600/40",
    chip: "from-yellow-700 to-yellow-500",
    ring: "ring-yellow-600/40",
    crop: { x: 0, y: 0.38, w: 0.34, h: 0.22 },
    items: [
      "اعتماد مالي متدرّج بحسب قيمة الشراء",
      "فصل الأدوار بين الطلب والاعتماد والصرف",
      "الإفصاح عن تعارض المصالح",
      "حظر الهدايا والعمولات من الموردين",
      "إتاحة الأرشيف للمراجعة والتدقيق",
      "تقرير سنوي مختصر عن الأداء",
    ],
  },
  {
    id: "risks",
    num: "8",
    title: "إدارة المخاطر",
    subtitle: "استباق وعلاج",
    icon: AlertTriangle,
    tone: "text-slate-800 border-slate-600/40",
    chip: "from-slate-700 to-slate-500",
    ring: "ring-slate-600/40",
    crop: { x: 0, y: 0.18, w: 0.34, h: 0.24 },
    items: [
      "تأخر المورد → موردون بدلاء جاهزون",
      "ارتفاع الأسعار → اتفاقيات إطارية مسبقة",
      "ضعف الجودة → فحص عيّني عند الاستلام",
      "نقص الكمية → مخزون احتياطي دائم",
      "نزاع مع المورد → آلية شكاوى موثّقة",
      "فقدان المستندات → أرشفة رقمية موازية",
    ],
  },
  {
    id: "kpis",
    num: "9",
    title: "مؤشرات الأداء (KPIs)",
    subtitle: "قياس سنوي دقيق",
    icon: TrendingUp,
    tone: "text-amber-900 border-amber-500/50",
    chip: "from-amber-500 to-yellow-400",
    ring: "ring-amber-500/50",
    crop: { x: 0.2, y: 0, w: 0.5, h: 0.24 },
    items: [
      "توفير مقابل الموازنة ≥ 10%",
      "الالتزام بالسقف المالي 100%",
      "دقة التسليم في الموعد ≥ 95%",
      "مطابقة الجودة ≥ 98%",
      "تعدد العروض لكل عملية 100%",
      "اكتمال الأرشفة 100%",
      "متوسط دورة الشراء ≤ 14 يومًا",
      "رضا اللجان المستفيدة ≥ 4.5/5",
    ],
  },
];

/**
 * Interactive visual roadmap for the Procurement Committee.
 * Displays the strategic mind-map poster in a framed, decorative container,
 * with clickable stage chips that reveal detailed content and zoom into the map.
 */
export function ProcurementRoadmap() {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>(STAGES[0].id);
  const active = STAGES.find((s) => s.id === activeId) ?? STAGES[0];

  // ---------- Progress persistence ----------
  const [progress, setProgress] = useState<Record<string, StageStatus>>(() =>
    Object.fromEntries(STAGES.map((s) => [s.id, "todo" as StageStatus])),
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("procurement_roadmap_progress" as any)
        .select("stage_id, status");
      if (cancelled || error || !data) return;
      setProgress((prev) => {
        const next = { ...prev };
        (data as Array<{ stage_id: string; status: StageStatus }>).forEach((r) => {
          if (r.stage_id in next) next[r.stage_id] = r.status;
        });
        return next;
      });
    })();

    const ch = supabase
      .channel("procurement_roadmap_progress")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "procurement_roadmap_progress" },
        (payload: any) => {
          const row = (payload.new ?? payload.old) as { stage_id?: string; status?: StageStatus } | undefined;
          if (!row?.stage_id) return;
          setProgress((prev) => ({ ...prev, [row.stage_id!]: (row.status as StageStatus) ?? "todo" }));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, []);

  const saveStatus = async (stageId: string, status: StageStatus) => {
    const prev = progress[stageId];
    setProgress((p) => ({ ...p, [stageId]: status }));
    setSavingId(stageId);
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("procurement_roadmap_progress" as any)
      .upsert(
        { stage_id: stageId, status, updated_by: userRes.user?.id ?? null } as any,
        { onConflict: "stage_id" },
      );
    setSavingId(null);
    if (error) {
      setProgress((p) => ({ ...p, [stageId]: prev }));
      toast.error("تعذّر حفظ حالة المرحلة (تحقق من الصلاحيات)");
    } else {
      toast.success("تم حفظ حالة المرحلة");
    }
  };

  const stats = useMemo(() => {
    const total = STAGES.length;
    const done = STAGES.filter((s) => progress[s.id] === "completed").length;
    const inProg = STAGES.filter((s) => progress[s.id] === "in_progress").length;
    const pct = Math.round((done / total) * 100);
    return { total, done, inProg, pct };
  }, [progress]);

  // ---------- Export ----------
  const exportExcel = () => {
    const rows = STAGES.map((s, i) => ({
      "الترتيب": i + 1,
      "المرحلة": s.title,
      "العنوان الفرعي": s.subtitle,
      "الحالة": STATUS_META[progress[s.id]].label,
      "عدد البنود": s.items.length,
      "التفاصيل": s.items.map((it, k) => `${k + 1}. ${it}`).join("\n"),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 8 }, { wch: 34 }, { wch: 26 }, { wch: 14 }, { wch: 10 }, { wch: 80 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "خارطة الطريق");
    XLSX.writeFile(wb, "خارطة-طريق-لجنة-المشتريات.xlsx");
    toast.success("تم تصدير ملف Excel");
  };

  const exportPdf = async () => {
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => (
      c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
    ));
    const stagesHtml = STAGES.map((s, i) => {
      const st = STATUS_META[progress[s.id]];
      return `
        <section class="stage">
          <div class="stage-head">
            <div class="num">${i + 1}</div>
            <div class="title">
              <div class="t">${esc(s.title)}</div>
              <div class="sub">${esc(s.subtitle)}</div>
            </div>
            <div class="status" style="background:${st.hex}20;color:${st.hex};border-color:${st.hex}55">
              ${esc(st.label)}
            </div>
          </div>
          <ul>${s.items.map((it) => `<li>${esc(it)}</li>`).join("")}</ul>
        </section>`;
    }).join("");

    const html = `
      <style>
        .doc { max-width: 190mm; margin: 0 auto; color: #1f2937; font-size: 12.5px; line-height: 1.7; }
        .header {
          display:flex;align-items:center;gap:14px;padding:14px 16px;
          border:1px solid #e5e7eb;border-radius:14px;
          background:linear-gradient(180deg,#f0fdfa,#ffffff);
        }
        .header img { width: 58px; height: 58px; object-fit: contain; }
        .header .meta { font-size: 11px; color:#64748b; }
        .header h1 { margin: 2px 0 0; font-size: 19px; color:#0f172a; }
        .cover { margin: 10px 0 6px; }
        .cover img { width: 100%; border: 1px solid #e5e7eb; border-radius: 10px; }
        .kpis { display:flex; gap:10px; margin: 10px 0 6px; }
        .kpi { flex:1; border:1px solid #e5e7eb; border-radius:10px; padding:8px 10px; text-align:center; }
        .kpi .v { font-size:18px; font-weight:800; color:#0e7490; }
        .kpi .l { font-size:10.5px; color:#64748b; }
        .stage { break-inside: avoid; margin-top: 10px; border:1px solid #e5e7eb; border-radius:12px; padding: 10px 12px; }
        .stage-head { display:flex; align-items:center; gap:10px; }
        .stage-head .num {
          width:28px;height:28px;border-radius:50%;
          background:#0e7490;color:#fff;font-weight:800;
          display:flex;align-items:center;justify-content:center;font-size:12px;
        }
        .stage-head .title .t { font-weight:800; color:#0f172a; font-size:13.5px; }
        .stage-head .title .sub { font-size:11px; color:#64748b; }
        .stage-head .status {
          margin-inline-start:auto;border:1px solid;border-radius:999px;
          padding:2px 10px;font-size:11px;font-weight:700;
        }
        .stage ul { padding-inline-start:20px; margin: 6px 0 0; }
        .stage li { margin: 2px 0; }
        .footer { margin-top:10px; padding-top:6px; border-top:1px dashed #cbd5e1;
          font-size:10px; color:#94a3b8; display:flex; justify-content:space-between; }
      </style>
      <div class="doc">
        <div class="header">
          <img src="${BRAND_LOGO_DATA_URI}" alt="شعار" />
          <div style="flex:1">
            <div class="meta">لجنة الزواج الجماعي · لجنة المشتريات</div>
            <h1>خارطة طريق لجنة المشتريات</h1>
          </div>
        </div>
        <div class="kpis">
          <div class="kpi"><div class="v">${stats.pct}%</div><div class="l">نسبة الإنجاز</div></div>
          <div class="kpi"><div class="v">${stats.done}</div><div class="l">مكتملة</div></div>
          <div class="kpi"><div class="v">${stats.inProg}</div><div class="l">قيد التنفيذ</div></div>
          <div class="kpi"><div class="v">${stats.total}</div><div class="l">إجمالي المراحل</div></div>
        </div>
        <div class="cover"><img src="${roadmapAsset.url}" alt="خارطة" /></div>
        ${stagesHtml}
        <div class="footer">
          <span>وثيقة مؤسسية — لجنة الزواج الجماعي</span>
          <span>${new Date().toLocaleDateString("ar-SA")}</span>
        </div>
      </div>
    `;
    await printHtmlDocument(html, "خارطة طريق لجنة المشتريات");
  };

  // Compute background zoom for the map crop
  const zoomStyle = {
    backgroundImage: `url(${roadmapAsset.url})`,
    backgroundSize: `${100 / active.crop.w}% ${100 / active.crop.h}%`,
    backgroundPosition: `${(active.crop.x / (1 - active.crop.w)) * 100}% ${
      (active.crop.y / (1 - active.crop.h)) * 100
    }%`,
    backgroundRepeat: "no-repeat",
  } as React.CSSProperties;

  const ActiveIcon = active.icon;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-[#f8fafc] via-white to-[#f0fdfa] shadow-soft">
      {/* Decorative glow */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-gold/10 blur-3xl" />

      {/* Header */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 px-6 pt-6">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center shadow-elegant">
            <Map className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 leading-tight">
              خارطة طريق لجنة المشتريات
            </h3>
            <p className="text-[12px] text-slate-500 flex items-center gap-1.5 mt-0.5">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              اضغط أي مرحلة لعرض تفاصيلها والتكبير على موقعها في الخارطة
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportPdf}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-white/80 backdrop-blur px-3 py-2 text-[12px] font-semibold text-rose-700 hover:bg-rose-500 hover:text-white transition-colors shadow-sm"
          >
            <Printer className="h-4 w-4" /> PDF
          </button>
          <button
            type="button"
            onClick={exportExcel}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-white/80 backdrop-blur px-3 py-2 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-500 hover:text-white transition-colors shadow-sm"
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </button>
          <a
            href={roadmapAsset.url}
            download="خارطة-طريق-لجنة-المشتريات.png"
            className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-white/70 backdrop-blur px-3 py-2 text-[12px] font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-colors shadow-sm"
          >
            <Download className="h-4 w-4" /> صورة
          </a>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="relative px-6 pt-4">
        <div className="rounded-2xl border bg-white/70 backdrop-blur p-3 shadow-sm">
          <div className="flex items-center justify-between text-[12px] font-semibold text-slate-700 mb-2">
            <span>الإنجاز الإجمالي للخارطة</span>
            <span className="text-primary">{stats.done} / {stats.total} · {stats.pct}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-500 to-primary transition-[width] duration-700 ease-out"
              style={{ width: `${stats.pct}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> مكتملة {stats.done}</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" /> قيد التنفيذ {stats.inProg}</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400" /> بالانتظار {stats.total - stats.done - stats.inProg}</span>
          </div>
        </div>
      </div>

      {/* Stage chips (clickable) */}
      <div className="relative px-4 sm:px-6 pt-5">
        <div className="flex flex-wrap gap-2 justify-center">
          {STAGES.map((s) => {
            const isActive = s.id === activeId;
            const IconEl = s.icon;
            const st = STATUS_META[progress[s.id]];
            const StIcon = st.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveId(s.id)}
                className={cn(
                  "group inline-flex items-center gap-2 rounded-full border bg-white/85 backdrop-blur px-3 py-1.5 text-[12px] font-semibold shadow-sm transition-all duration-300",
                  s.tone,
                  isActive
                    ? `ring-2 ${s.ring} scale-105 shadow-md`
                    : "hover:scale-[1.03] hover:shadow-md opacity-90",
                )}
                aria-pressed={isActive}
              >
                <span
                  className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-white text-[11px] font-extrabold bg-gradient-to-br shadow-sm",
                    s.chip,
                  )}
                >
                  {s.num}
                </span>
                <IconEl className="h-3.5 w-3.5" />
                <span className="whitespace-nowrap">{s.title}</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold",
                    st.cls,
                  )}
                  title={st.label}
                >
                  <StIcon className={cn("h-3 w-3", progress[s.id] === "in_progress" && "animate-spin")} />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive split: zoomed crop + detail panel */}
      <div className="relative px-4 sm:px-6 pt-5 pb-6 grid lg:grid-cols-5 gap-5">
        {/* Zoomed map crop */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="lg:col-span-3 group relative block w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-md hover:shadow-elegant transition-shadow"
          aria-label="فتح الخارطة الكاملة"
        >
          {/* Corner ornaments */}
          <span aria-hidden className="absolute top-0 right-0 h-8 w-8 border-t-2 border-r-2 border-gold rounded-tr-2xl z-10" />
          <span aria-hidden className="absolute top-0 left-0 h-8 w-8 border-t-2 border-l-2 border-gold rounded-tl-2xl z-10" />
          <span aria-hidden className="absolute bottom-0 right-0 h-8 w-8 border-b-2 border-r-2 border-gold rounded-br-2xl z-10" />
          <span aria-hidden className="absolute bottom-0 left-0 h-8 w-8 border-b-2 border-l-2 border-gold rounded-bl-2xl z-10" />

          <div
            key={active.id}
            className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-slate-50 animate-fade-in transition-all duration-500 ease-out"
            style={zoomStyle}
          >
            {/* subtle overlay + label */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/25 via-transparent to-transparent" />
            <div className={cn(
              "absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur px-2.5 py-1 text-[11px] font-bold border",
              active.tone,
            )}>
              <ActiveIcon className="h-3.5 w-3.5" />
              {active.title}
            </div>
            <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 text-slate-700 text-[11px] px-2.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn className="h-3.5 w-3.5" /> عرض الخارطة كاملةً
            </div>
          </div>
        </button>

        {/* Detail panel */}
        <div
          key={`d-${active.id}`}
          className={cn(
            "lg:col-span-2 relative rounded-2xl border bg-white p-5 shadow-md animate-fade-in overflow-hidden",
            active.tone,
          )}
        >
          <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", active.chip)} />
          <div className="flex items-start gap-3">
            <div className={cn(
              "h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-br text-white flex items-center justify-center shadow-md",
              active.chip,
            )}>
              <ActiveIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-slate-500">
                المرحلة {active.num}
              </div>
              <h4 className="text-[15px] font-extrabold text-slate-900 leading-snug">
                {active.title}
              </h4>
              <p className="text-[12px] text-slate-500 mt-0.5">{active.subtitle}</p>
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {active.items.map((it, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-[13px] leading-6 text-slate-700 animate-fade-in"
                style={{ animationDelay: `${i * 40}ms`, animationFillMode: "backwards" }}
              >
                <span className={cn(
                  "mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br",
                  active.chip,
                )} />
                <span>{it}</span>
              </li>
            ))}
          </ul>

          {/* Status controls */}
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="text-[11px] font-bold text-slate-600 mb-2 flex items-center justify-between">
              <span>حالة هذه المرحلة</span>
              {savingId === active.id && (
                <span className="inline-flex items-center gap-1 text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" /> جاري الحفظ
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {STATUS_ORDER.map((s) => {
                const meta = STATUS_META[s];
                const Icon = meta.icon;
                const isOn = progress[active.id] === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => saveStatus(active.id, s)}
                    className={cn(
                      "inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11.5px] font-semibold transition-all",
                      isOn
                        ? `${meta.cls} ring-2 ring-offset-1 shadow-sm scale-[1.02]`
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                    )}
                    aria-pressed={isOn}
                  >
                    <Icon className={cn("h-3.5 w-3.5", isOn && s === "in_progress" && "animate-spin")} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* nav arrows */}
          <div className="mt-5 flex items-center justify-between text-[12px]">
            <button
              type="button"
              onClick={() => {
                const idx = STAGES.findIndex((s) => s.id === activeId);
                setActiveId(STAGES[(idx - 1 + STAGES.length) % STAGES.length].id);
              }}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-primary transition-colors font-semibold"
            >
              <ChevronDown className="h-4 w-4 rotate-90" />
              السابق
            </button>
            <span className="text-[11px] text-slate-400">
              {STAGES.findIndex((s) => s.id === activeId) + 1} / {STAGES.length}
            </span>
            <button
              type="button"
              onClick={() => {
                const idx = STAGES.findIndex((s) => s.id === activeId);
                setActiveId(STAGES[(idx + 1) % STAGES.length].id);
              }}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-primary transition-colors font-semibold"
            >
              التالي
              <ChevronDown className="h-4 w-4 -rotate-90" />
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl p-2 bg-white">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-3 left-3 h-8 w-8 rounded-full bg-white/90 border shadow flex items-center justify-center hover:bg-white z-10"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
          <img
            src={roadmapAsset.url}
            alt="خارطة طريق لجنة المشتريات"
            className="w-full h-auto rounded-lg animate-scale-in"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
