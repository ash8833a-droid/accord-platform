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
        <a
          href={roadmapAsset.url}
          download="خارطة-طريق-لجنة-المشتريات.png"
          className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-white/70 backdrop-blur px-3.5 py-2 text-[12px] font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-colors shadow-sm"
        >
          <Download className="h-4 w-4" />
          تحميل الخارطة
        </a>
      </div>

      {/* Stage chips (clickable) */}
      <div className="relative px-4 sm:px-6 pt-5">
        <div className="flex flex-wrap gap-2 justify-center">
          {STAGES.map((s) => {
            const isActive = s.id === activeId;
            const IconEl = s.icon;
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
