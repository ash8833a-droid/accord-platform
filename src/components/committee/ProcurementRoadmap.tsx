import roadmapAsset from "@/assets/procurement-roadmap.png.asset.json";
import { Download, Map, Sparkles } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

/**
 * Visual roadmap for the Procurement Committee.
 * Displays the strategic mind-map poster in a framed, decorative container.
 */
export function ProcurementRoadmap() {
  const [open, setOpen] = useState(false);
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
              إطار حوكمي دائم ومستدام للعمليات الموسمية والسنوية
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

      {/* Image frame */}
      <div className="relative px-4 sm:px-6 pt-5 pb-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative block w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 sm:p-3 shadow-md hover:shadow-elegant transition-shadow"
          aria-label="تكبير الخارطة"
        >
          {/* Corner ornaments */}
          <span aria-hidden className="absolute top-0 right-0 h-8 w-8 border-t-2 border-r-2 border-gold rounded-tr-2xl" />
          <span aria-hidden className="absolute top-0 left-0 h-8 w-8 border-t-2 border-l-2 border-gold rounded-tl-2xl" />
          <span aria-hidden className="absolute bottom-0 right-0 h-8 w-8 border-b-2 border-r-2 border-gold rounded-br-2xl" />
          <span aria-hidden className="absolute bottom-0 left-0 h-8 w-8 border-b-2 border-l-2 border-gold rounded-bl-2xl" />

          <img
            src={roadmapAsset.url}
            alt="خارطة طريق لجنة المشتريات — لجنة الزواج الجماعي"
            loading="lazy"
            className="w-full h-auto rounded-xl transition-transform duration-500 group-hover:scale-[1.015]"
          />
          <span className="absolute bottom-4 left-4 rounded-full bg-slate-900/70 text-white text-[11px] px-3 py-1 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur">
            اضغط للتكبير
          </span>
        </button>

        {/* Legend chips */}
        <div className="mt-5 flex flex-wrap gap-2 justify-center">
          {[
            { c: "bg-[#0E3A42]", t: "الملخص التنفيذي" },
            { c: "bg-amber-500", t: "الأهداف التشغيلية" },
            { c: "bg-teal-600", t: "التمهيد والتأهيل" },
            { c: "bg-orange-500", t: "العروض والتقييم" },
            { c: "bg-emerald-600", t: "التنفيذ واللوجستيات" },
            { c: "bg-violet-600", t: "التقييم والإغلاق" },
            { c: "bg-yellow-600", t: "الحوكمة" },
            { c: "bg-slate-700", t: "إدارة المخاطر" },
            { c: "bg-gold", t: "مؤشرات الأداء" },
          ].map((x) => (
            <span
              key={x.t}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-slate-200 px-2.5 py-1 text-[11px] text-slate-700 shadow-sm"
            >
              <span className={`h-2 w-2 rounded-full ${x.c}`} />
              {x.t}
            </span>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl p-2 bg-white">
          <img
            src={roadmapAsset.url}
            alt="خارطة طريق لجنة المشتريات"
            className="w-full h-auto rounded-lg"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
