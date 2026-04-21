import { Target, Lightbulb, Flag, ListChecks, Compass } from "lucide-react";
import type { CommitteeMeta } from "@/lib/committees";
import { PHASE_LABELS } from "@/lib/pmp-tasks";

/**
 * PMP Charter card — shown at the top of each committee page.
 * Displays: name, idea (description), strategic goals, measurable targets,
 * and the PMP 5-phase lifecycle the committee operates within.
 */

// Measurable targets (KPIs) per committee — aligned to PMP "Success Criteria".
const COMMITTEE_TARGETS: Record<string, string[]> = {
  supreme: [
    "اعتماد 100% من الخطط التنفيذية للجان قبل بدء الحفل بـ 60 يوماً",
    "عقد اجتماع شهري دوري لمتابعة أداء اللجان",
    "إغلاق 95% من المخاطر الحرجة المرصودة",
  ],
  finance: [
    "تحصيل 95% من الاشتراكات قبل موعد الحفل بشهر",
    "الالتزام بالموازنة المعتمدة بانحراف لا يتجاوز 5%",
    "صرف الطلبات خلال 72 ساعة كحد أقصى",
    "إصدار تقرير مالي شهري في أول 5 أيام من كل شهر",
  ],
  media: [
    "تغطية 100% من فقرات الحفل (صور + فيديو)",
    "نشر 3 منشورات تعريفية أسبوعياً قبل الحفل",
    "تسليم أرشيف الحفل النهائي خلال 10 أيام من انتهائه",
  ],
  quality: [
    "تنفيذ تدقيق واحد على الأقل لكل لجنة قبل الحفل",
    "قياس رضا الضيوف والعرسان ≥ 85%",
    "إغلاق 100% من الإجراءات التصحيحية قبل الحفل",
  ],
  programs: [
    "اعتماد جدول فقرات نهائي قبل الحفل بـ 30 يوماً",
    "تنفيذ بروفة شاملة قبل الحفل بأسبوع",
    "انحراف التوقيت يوم الحفل لا يتجاوز 10 دقائق",
  ],
  dinner: [
    "تقدير عدد الضيوف بدقة ≥ 95%",
    "اعتماد مورد الإعاشة قبل الحفل بـ 45 يوماً",
    "صفر ملاحظات صحية على الطعام يوم الحفل",
  ],
  procurement: [
    "توقيع عقود الموردين قبل الحفل بـ 45 يوماً",
    "تسليم 100% من المستلزمات قبل الحفل بأسبوع",
    "ضبط تكاليف الشراء ضمن الموازنة المعتمدة",
  ],
  reception: [
    "تأكيد قائمة كبار الضيوف قبل الحفل بأسبوعين",
    "رضا الحضور عن الاستقبال ≥ 90%",
    "صفر بلاغات تأخير أو فوضى في الاستقبال",
  ],
  women: [
    "تجهيز القسم النسائي بالكامل قبل الحفل بـ 3 أيام",
    "انسجام التنسيق مع اللجان الرئيسية ≥ 95%",
    "ضبط تكاليف القسم ضمن الموازنة المعتمدة",
  ],
};

const PHASE_DESC: Record<string, string> = {
  initiating: "اعتماد ميثاق اللجنة وتحديد أصحاب المصلحة",
  planning: "إعداد خطة النطاق والجدول والموازنة والمخاطر",
  executing: "تنفيذ الأنشطة وتسليم المخرجات",
  monitoring: "متابعة الأداء وضبط الانحرافات",
  closing: "تسليم المخرجات النهائية وأرشفة الدروس المستفادة",
};

const PHASE_TONE: Record<string, string> = {
  initiating: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
  planning: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
  executing: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  monitoring: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  closing: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
};

export function PmpCharter({ meta }: { meta: CommitteeMeta }) {
  const Icon = meta.icon;
  const targets = COMMITTEE_TARGETS[meta.type] ?? [];
  const goals = meta.goals ?? [];
  const phases: Array<keyof typeof PHASE_LABELS> = [
    "initiating",
    "planning",
    "executing",
    "monitoring",
    "closing",
  ];

  return (
    <section
      dir="rtl"
      className="relative overflow-hidden rounded-3xl border bg-gradient-to-bl from-primary/5 via-card to-card shadow-soft"
      aria-label="ميثاق اللجنة وفق منهجية PMP"
    >
      {/* Decorative corner */}
      <div className="pointer-events-none absolute -top-16 -start-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative p-5 md:p-7 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4 flex-wrap">
          <span className={`h-14 w-14 md:h-16 md:w-16 rounded-2xl flex items-center justify-center shrink-0 ${meta.tone}`}>
            <Icon className="h-7 w-7 md:h-8 md:w-8" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] font-bold mb-2">
              <Compass className="h-3.5 w-3.5" />
              ميثاق اللجنة وفق منهجية PMP
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold leading-tight">{meta.label}</h2>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{meta.description}</p>
          </div>
        </div>

        {/* Targets / KPIs */}
        <div className="rounded-2xl border bg-background/70 backdrop-blur-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-8 w-8 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center">
                <Target className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-bold">المستهدفات ومؤشرات النجاح</h3>
            </div>
            {targets.length === 0 ? (
              <p className="text-xs text-muted-foreground">لم تُحدَّد مستهدفات بعد.</p>
            ) : (
              <ul className="space-y-2">
                {targets.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            )}
        </div>

        {/* Idea / Mission banner */}
        <div className="rounded-2xl border bg-gradient-to-bl from-primary/5 to-transparent p-4">
          <div className="flex items-start gap-3">
            <span className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Lightbulb className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold mb-1">فكرة اللجنة ورسالتها</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {meta.description} — تعمل اللجنة ضمن منظومة الزواج الجماعي وفق منهجية إدارة المشاريع
                الاحترافية (PMP) لضمان تسليم مخرجات عالية الجودة في الوقت والتكلفة المحددين.
              </p>
            </div>
          </div>
        </div>

        {/* PMP Phases lifecycle */}
        <div className="rounded-2xl border bg-background/70 backdrop-blur-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <ListChecks className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-bold">مراحل عمل اللجنة وفق PMP</h3>
          </div>
          <div className="grid gap-2 md:grid-cols-5 sm:grid-cols-2">
            {phases.map((p, i) => (
              <div
                key={p}
                className={`rounded-xl border p-3 ${PHASE_TONE[p]} flex flex-col gap-1`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold opacity-70">المرحلة {i + 1}</span>
                  <span className="h-5 w-5 rounded-md bg-background/60 text-[10px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <p className="text-sm font-bold leading-tight">{PHASE_LABELS[p]}</p>
                <p className="text-[11px] opacity-80 leading-snug">{PHASE_DESC[p]}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}