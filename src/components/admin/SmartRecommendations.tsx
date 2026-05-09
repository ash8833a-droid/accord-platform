import {
  Lightbulb, ShieldAlert, TrendingUp, Sparkles, AlertTriangle,
  CheckCircle2, Wallet, Users, Target,
} from "lucide-react";

type Committee = {
  name: string;
  total: number;
  done: number;
  overdue: number;
  rate: number;
  savings: number;
};

type Tone = "ok" | "warn" | "crit";

type Insight = {
  tone: Tone;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  analysis: string;
  recommendation: string;
};

const TONE_STYLES: Record<Tone, {
  border: string; dot: string; chip: string; chipText: string; iconBg: string; iconText: string; label: string;
}> = {
  ok: {
    border: "border-t-teal-500",
    dot: "bg-teal-500",
    chip: "bg-teal-50",
    chipText: "text-teal-700",
    iconBg: "bg-teal-50",
    iconText: "text-teal-700",
    label: "نمو ومحافظة",
  },
  warn: {
    border: "border-t-amber-500",
    dot: "bg-amber-500",
    chip: "bg-amber-50",
    chipText: "text-amber-700",
    iconBg: "bg-amber-50",
    iconText: "text-amber-700",
    label: "إنذار مبكر",
  },
  crit: {
    border: "border-t-rose-400",
    dot: "bg-rose-400",
    chip: "bg-rose-50",
    chipText: "text-rose-700",
    iconBg: "bg-rose-50",
    iconText: "text-rose-600",
    label: "إجراء عاجل",
  },
};

function buildInsights(args: {
  committees: Committee[];
  completionRate: number;
  netBalance: number;
  totalMarriages: number;
  allocatedFunds: number;
  revenues: number;
}): Insight[] {
  const { committees, completionRate, netBalance, revenues, allocatedFunds } = args;
  const out: Insight[] = [];

  // Critical: low-performing committees with many overdue
  const critCommittees = committees.filter((c) => c.total >= 3 && (c.rate < 40 || c.overdue >= 3));
  if (critCommittees.length > 0) {
    const worst = [...critCommittees].sort((a, b) => a.rate - b.rate)[0];
    out.push({
      tone: "crit",
      category: "أداء اللجان",
      icon: ShieldAlert,
      analysis: `تأخّر ملحوظ في «${worst.name}» — نسبة إنجاز ${worst.rate}% و${worst.overdue} مهمة متأخرة`,
      recommendation: "يُنصح بتكليف عضو إضافي لدعم اللجنة وإعادة جدولة المهام المتعثّرة وفق الأولوية",
    });
  }

  // Warn: mid-tier committees needing attention
  const warnCommittees = committees.filter(
    (c) => c.total >= 2 && c.rate >= 40 && c.rate < 70 && !critCommittees.includes(c),
  );
  if (warnCommittees.length > 0) {
    out.push({
      tone: "warn",
      category: "متابعة تشغيلية",
      icon: AlertTriangle,
      analysis: `${warnCommittees.length} ${warnCommittees.length === 1 ? "لجنة تحتاج" : "لجان تحتاج"} متابعة لرفع نسبة الإنجاز فوق 70%`,
      recommendation: "تكثيف اجتماعات المتابعة الأسبوعية ومراجعة جداول التسليم للجان ذات الأداء المتوسط",
    });
  }

  // Financial deficit
  if (netBalance < 0) {
    out.push({
      tone: "crit",
      category: "الوضع المالي",
      icon: Wallet,
      analysis: `الرصيد المالي يسجّل عجزاً مقارنةً بحجم الالتزامات المخصصة للعرسان`,
      recommendation: "تفعيل حملة استقطاب مساهمات إضافية من أبناء العائلة ومراجعة بنود الصرف غير الأساسية",
    });
  } else if (revenues > 0 && allocatedFunds / Math.max(1, revenues) > 0.85) {
    out.push({
      tone: "warn",
      category: "كفاءة الموارد",
      icon: Target,
      analysis: "نسبة الالتزامات المخصصة للعرسان تقترب من سقف الإيرادات المتاحة",
      recommendation: "بناء احتياطي مالي بنسبة 15% من الإيرادات لضمان استدامة الدعم في المواسم القادمة",
    });
  }

  // Growth: high overall completion
  if (completionRate >= 75) {
    out.push({
      tone: "ok",
      category: "أداء مؤسسي",
      icon: TrendingUp,
      analysis: `نسبة الإنجاز العامة ${completionRate}% تعكس انضباطاً تشغيلياً جيداً`,
      recommendation: "توثيق أفضل الممارسات للجان المتميّزة وتعميمها كنموذج معياري على باقي اللجان",
    });
  }

  // Top performers
  const topPerformers = committees.filter((c) => c.total >= 3 && c.rate >= 85 && c.overdue === 0);
  if (topPerformers.length > 0) {
    const best = topPerformers[0];
    out.push({
      tone: "ok",
      category: "تحفيز وتمكين",
      icon: CheckCircle2,
      analysis: `لجنة «${best.name}» حقّقت ${best.rate}% دون أي تأخير`,
      recommendation: "إبراز إنجاز اللجنة في التقرير الأسبوعي ومنحها صلاحيات تطويرية إضافية",
    });
  }

  // Empty committees
  const idleCommittees = committees.filter((c) => c.total === 0);
  if (idleCommittees.length > 0) {
    out.push({
      tone: "warn",
      category: "تفعيل اللجان",
      icon: Users,
      analysis: `${idleCommittees.length} ${idleCommittees.length === 1 ? "لجنة لم تُسجّل" : "لجان لم تُسجّل"} أي مهام في الفترة الحالية`,
      recommendation: "عقد جلسة تنشيطية مع رؤساء اللجان غير المُفعّلة لتحديد الأهداف وخطط التنفيذ",
    });
  }

  // Default fallback insight
  if (out.length === 0) {
    out.push({
      tone: "ok",
      category: "نظرة عامة",
      icon: Sparkles,
      analysis: "المؤشرات العامة ضمن النطاق المستهدف",
      recommendation: "الاستمرار في المتابعة الدورية وتعزيز قنوات التواصل بين اللجان",
    });
  }

  return out;
}

export function SmartRecommendations(props: {
  committees: Committee[];
  completionRate: number;
  netBalance: number;
  totalMarriages: number;
  allocatedFunds: number;
  revenues: number;
}) {
  const insights = buildInsights(props);

  return (
    <section dir="rtl" className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center">
            <Lightbulb className="h-5 w-5 text-teal-700" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              التحليل الذكي وتوصيات الإدارة
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              قراءات مؤسسية مستندة إلى أداء اللجان والمؤشرات المالية
            </p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-white border border-slate-100 rounded-full px-3 py-1.5 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
          تحديث لحظي
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {insights.map((ins, i) => {
          const s = TONE_STYLES[ins.tone];
          const Icon = ins.icon;
          return (
            <article
              key={i}
              className={`bg-white rounded-2xl shadow-sm border-t-4 ${s.border} p-6 hover:shadow-md transition-shadow`}
            >
              <div className="flex items-start gap-4">
                <div className={`h-11 w-11 rounded-xl ${s.iconBg} ${s.iconText} flex items-center justify-center shrink-0`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-xs font-semibold text-slate-500 tracking-wide">
                      {ins.category}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${s.chip} ${s.chipText} rounded-full px-2.5 py-1`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">التحليل</p>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-relaxed">
                      {ins.analysis}
                    </h3>
                  </div>
                  <div className="pt-3 border-t border-slate-50">
                    <p className="text-xs text-slate-400 mb-1">التوصية</p>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {ins.recommendation}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}