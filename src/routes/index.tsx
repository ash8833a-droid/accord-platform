import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import {
  HeartHandshake,
  Users,
  Wallet,
  CalendarRange,
  Sparkles,
  TrendingUp,
  Building2,
  ShieldCheck,
  HandHeart,
  Star,
  Gift,
  ChevronLeft,
  ChevronRight,
  Crown,
  Heart,
  Moon,
  BookOpen,
  Home as HomeIcon,
  Users2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "لجنة الزواج الجماعي — لوحة المؤشرات العامة" },
      {
        name: "description",
        content:
          "أرقام وإحصائيات برنامج الزواج الجماعي العائلي: عدد العرسان، المساهمين، المبالغ المجموعة، واللجان منذ انطلاق البرنامج.",
      },
      { property: "og:title", content: "لجنة الزواج الجماعي — لوحة المؤشرات" },
      {
        property: "og:description",
        content:
          "أرقام تروي قصة برنامج الزواج الجماعي: مساهمون وعرسان ولجان تعمل بروح الفريق.",
      },
    ],
  }),
  component: PublicHome,
});

const HERO_PILLARS = [
  {
    key: "athar",
    icon: Crown,
    title: "ويبقى الأثر",
    verse: "بفضل الله وتوفيقه",
    subtitle:
      "ما تُقدّمونه اليوم يَعبرُ حدودَ الليلة ليصير ذكرى راسخةً في بيتٍ جديد، ودعاءً مستجاباً يبقى أثرُه ممتداً.",
    badges: [
      { icon: Heart, label: "محبّة باقية" },
      { icon: HomeIcon, label: "بيوتٌ تُؤسَّس" },
      { icon: BookOpen, label: "ذكرى تُروى" },
    ],
  },
  {
    key: "ataa",
    icon: HandHeart,
    title: "العطاء",
    verse: "يدٌ تمتدّ في صمت",
    subtitle:
      "ريالٌ يُعطى بصدق، ووقتٌ يُبذل بإخلاص — أنهارٌ صغيرةٌ من الكَرَم تجتمع فتصير بحراً واسعاً من الفرح.",
    badges: [
      { icon: HandHeart, label: "كفالة عريس" },
      { icon: Users2, label: "تكافل عائلي" },
      { icon: Gift, label: "هديةُ فرح" },
    ],
  },
  {
    key: "niyya",
    icon: Moon,
    title: "النيّة",
    verse: "قبل العطاءِ قلبٌ نقيّ",
    subtitle:
      "نيّةٌ خالصةٌ لله، بها تُبارَك الأعمالُ الصغيرة فتغدو صدقةً جارية، وبها يُكتَب الأجرُ ويبقى الجزاء.",
    badges: [
      { icon: Moon, label: "إخلاصٌ خفيّ" },
      { icon: Sparkles, label: "بركةٌ نازلة" },
      { icon: Star, label: "أجرٌ مضاعف" },
    ],
  },
] as const;

function PublicHome() {
  const [s, setS] = useState({
    grooms: 0,
    historicalShareholders: 0,
    historicalAmount: 0,
    historicalYears: 0,
    firstYear: 0,
    confirmedSubs: 0,
    confirmedAmount: 0,
    committees: 0,
    branches: 0,
  });
  const [loaded, setLoaded] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_public_stats");
      const d = (data ?? {}) as Record<string, number>;
      setS({
        grooms: Number(d.grooms ?? 0),
        historicalShareholders: Number(d.historical_shareholders ?? 0),
        historicalAmount: Number(d.historical_amount ?? 0),
        historicalYears: Number(d.historical_years ?? 0),
        firstYear: Number(d.first_year ?? 0),
        confirmedSubs: Number(d.confirmed_subs ?? 0),
        confirmedAmount: Number(d.confirmed_amount ?? 0),
        committees: Number(d.committees ?? 0),
        branches: Number(d.historical_branches ?? 0),
      });
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(n);
  const totalContributors = s.historicalShareholders + s.confirmedSubs;
  const totalAmount = s.historicalAmount + s.confirmedAmount;
  const avgContribution = totalContributors
    ? Math.round(totalAmount / totalContributors)
    : 0;

  // Auto-rotating hero pillar (ويبقى الأثر / العطاء / النيّة)
  const [pillarIdx, setPillarIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setPillarIdx((i) => (i + 1) % HERO_PILLARS.length),
      7000,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Sticky header — single source of CTAs */}
      <header
        className={`sticky top-0 z-30 backdrop-blur transition-all duration-300 ${
          scrolled
            ? "bg-background/90 border-b shadow-soft"
            : "bg-background/60 border-b border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 lg:px-8 h-16">
          <Logo size={40} />
          <nav className="flex items-center gap-2">
            <Link
              to="/register-groom"
              className="hidden sm:inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold border hover:bg-accent transition-colors"
            >
              <HeartHandshake className="h-4 w-4" />
              تسجيل عريس
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold bg-gradient-hero text-primary-foreground shadow-elegant hover:opacity-90 transition-opacity"
            >
              <ShieldCheck className="h-4 w-4" />
              دخول الأعضاء
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero — wide banner slider (inspired layout): pills on the right, big title in center, side arrows */}
      <section className="relative">
        <div className="relative w-full h-[360px] md:h-[420px] lg:h-[460px] overflow-hidden bg-gradient-hero">
          {/* Sliding track */}
          <div
            className="flex h-full transition-transform duration-[1000ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ transform: `translateX(${pillarIdx * 100}%)` }}
          >
            {HERO_PILLARS.map((p, i) => {
              const isActive = i === pillarIdx;
              return (
                <div key={p.key} className="relative w-full h-full shrink-0 overflow-hidden">
                  {/* Per-slide gradient wash */}
                  <div className={`absolute inset-0 bg-gradient-to-bl ${p.accent}`} />
                  {/* Ambient glows */}
                  <div className="absolute -top-24 right-1/4 w-[28rem] h-[28rem] bg-gold/20 rounded-full blur-[120px] animate-float pointer-events-none" />
                  <div
                    className="absolute -bottom-32 left-1/4 w-[26rem] h-[26rem] bg-primary-glow/25 rounded-full blur-[120px] animate-float pointer-events-none"
                    style={{ animationDelay: "1.4s" }}
                  />
                  {/* Arabesque dot grid */}
                  <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:28px_28px] pointer-events-none" />

                  {/* Centered monumental title */}
                  <div className="relative h-full flex flex-col items-center justify-center text-center text-primary-foreground px-6">
                    <span
                      className={`text-[10px] md:text-xs tracking-[0.45em] font-bold text-gold uppercase mb-3 md:mb-4 transition-all duration-700 ${
                        isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
                      }`}
                    >
                      {p.eyebrow}
                    </span>
                    <div
                      className={`flex items-center gap-4 mb-3 md:mb-5 transition-all duration-700 delay-100 ${
                        isActive ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      <span className="h-px w-12 md:w-20 bg-gold/70" />
                      <p className="text-sm md:text-lg text-primary-foreground/85 font-medium whitespace-nowrap">
                        {p.verse}
                      </p>
                      <span className="h-px w-12 md:w-20 bg-gold/70" />
                    </div>
                    <h1
                      className={`text-shimmer-gold font-extrabold leading-none tracking-tight text-6xl md:text-8xl lg:text-[7.5rem] transition-all duration-1000 delay-200 ${
                        isActive ? "opacity-100 scale-100" : "opacity-0 scale-95"
                      }`}
                    >
                      {p.title}
                    </h1>
                    <p
                      className={`mt-4 md:mt-6 max-w-2xl text-sm md:text-base text-primary-foreground/80 leading-relaxed transition-all duration-1000 delay-300 ${
                        isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                      }`}
                    >
                      {p.subtitle}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Vertical pill buttons — right side (RTL leading edge), like reference image */}
          <div className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-20">
            {HERO_PILLARS.map((p, i) => {
              const isActive = i === pillarIdx;
              return (
                <button
                  key={p.key}
                  onClick={() => setPillarIdx(i)}
                  aria-label={p.title}
                  className={`group relative min-w-[140px] md:min-w-[180px] rounded-full border px-5 md:px-7 py-2.5 md:py-3 text-sm md:text-base font-bold transition-all duration-500 backdrop-blur-md text-center ${
                    isActive
                      ? "bg-gold/95 text-gold-foreground border-gold shadow-[0_0_24px_oklch(var(--gold)/0.55)] scale-105"
                      : "bg-background/10 text-primary-foreground/90 border-white/30 hover:bg-background/20 hover:border-gold/60"
                  }`}
                >
                  {p.title}
                </button>
              );
            })}
          </div>

          {/* Side navigation arrows */}
          <button
            onClick={() => setPillarIdx((i) => (i + 1) % HERO_PILLARS.length)}
            aria-label="التالي"
            className="absolute right-1 md:right-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 md:h-12 md:w-12 rounded-full bg-background/20 border border-white/20 backdrop-blur text-primary-foreground hover:bg-gold/80 hover:text-gold-foreground hover:border-gold transition-all flex items-center justify-center opacity-0 pointer-events-none"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            onClick={() =>
              setPillarIdx((i) => (i - 1 + HERO_PILLARS.length) % HERO_PILLARS.length)
            }
            aria-label="السابق"
            className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 z-20 h-10 w-10 md:h-12 md:w-12 rounded-full bg-background/15 border border-white/25 backdrop-blur text-primary-foreground hover:bg-gold/90 hover:text-gold-foreground hover:border-gold transition-all flex items-center justify-center"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Bottom progress bar — segments fill over 7s */}
          <div className="absolute bottom-3 md:bottom-4 inset-x-0 px-6 md:px-12 flex items-center gap-2 z-10">
            {HERO_PILLARS.map((p, i) => (
              <span
                key={p.key}
                className="relative flex-1 h-[3px] rounded-full bg-white/20 overflow-hidden"
              >
                <span
                  className={`absolute inset-y-0 right-0 bg-gold rounded-full ${
                    i === pillarIdx
                      ? "animate-[heroFill_7s_linear_forwards]"
                      : i < pillarIdx
                      ? "w-full"
                      : "w-0"
                  }`}
                  style={{
                    boxShadow:
                      i === pillarIdx ? "0 0 10px oklch(var(--gold) / 0.7)" : undefined,
                  }}
                />
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Hero KPIs — the 4 headline numbers (the only place these 4 appear) */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 -mt-10 lg:-mt-14 relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
          <HeroKpi
            label="إجمالي العرسان"
            value={fmt(s.grooms)}
            hint="منذ انطلاق البرنامج"
            icon={HeartHandshake}
            tone="gold"
            loading={!loaded}
            delay="0s"
          />
          <HeroKpi
            label="المساهمون عبر السنوات"
            value={fmt(totalContributors)}
            hint={s.firstYear ? `منذ عام ${s.firstYear}هـ` : "سجلّ تاريخي"}
            icon={Users}
            tone="teal"
            loading={!loaded}
            delay="0.1s"
          />
          <HeroKpi
            label="إجمالي المبالغ المجموعة"
            value={`${fmt(totalAmount)} ر.س`}
            hint="مساهمات وأقساط مؤكدة"
            icon={Wallet}
            tone="emerald"
            loading={!loaded}
            delay="0.2s"
          />
          <HeroKpi
            label="اللجان العاملة"
            value={fmt(s.committees)}
            hint="فريق يعمل بروح واحدة"
            icon={Building2}
            tone="violet"
            loading={!loaded}
            delay="0.3s"
          />
        </div>
      </section>

      {/* Detailed grid — DIFFERENT metrics only (no overlap with hero KPIs) */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-14 lg:py-20">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
              تفاصيل أعمق
            </p>
            <h2 className="text-2xl lg:text-3xl font-bold">
              ما وراء الأرقام الكبرى
            </h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl">
              مؤشرات مكمِّلة تُظهر امتداد البرنامج عبر الزمن والفروع.
            </p>
          </div>
          <TrendingUp className="hidden md:block h-8 w-8 text-gold" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <DetailCard
            icon={CalendarRange}
            label="سنوات هجرية موثّقة"
            value={fmt(s.historicalYears)}
            sub={s.firstYear ? `أقدمها عام ${s.firstYear}هـ` : "سجلّ ينمو"}
          />
          <DetailCard
            icon={Building2}
            label="فروع العائلة المساهمة"
            value={fmt(s.branches)}
            sub="موزَّعة عبر السجل التاريخي"
          />
          <DetailCard
            icon={HandHeart}
            label="متوسط المساهمة"
            value={`${fmt(avgContribution)} ر.س`}
            sub="لكل مساهم على مرّ السنوات"
          />
          <DetailCard
            icon={Wallet}
            label="اشتراكات سنوية مؤكدة"
            value={fmt(s.confirmedSubs)}
            sub={`بقيمة ${fmt(s.confirmedAmount)} ر.س`}
          />
          <DetailCard
            icon={Star}
            label="مساهمات تاريخية"
            value={fmt(s.historicalShareholders)}
            sub={`بإجمالي ${fmt(s.historicalAmount)} ر.س`}
          />
          <DetailCard
            icon={Gift}
            label="معدّل العرسان لكل لجنة"
            value={
              s.committees ? fmt(Math.round((s.grooms / s.committees) * 10) / 10) : "—"
            }
            sub="مؤشر توزيع الجهد بين اللجان"
          />
        </div>
      </section>

      {/* Closing strip — different message, no repeated buttons */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-16">
        <div className="relative overflow-hidden rounded-3xl border bg-gradient-card p-8 lg:p-12 shadow-soft">
          <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gold/15 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full bg-gold/15 text-gold-foreground px-4 py-1.5 text-xs font-bold mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              ويبقى الأثر
            </div>
            <h3 className="text-2xl lg:text-3xl font-bold leading-tight">
              تنقضي الليلةُ… ويبقى الأثرُ شاهداً على نُبلِكم
            </h3>
            <p className="text-sm lg:text-base text-muted-foreground mt-3 leading-relaxed">
              ما تُقدّمونه اليوم من جُهدٍ خفيٍّ، أو دعمٍ صادق، أو دعوةٍ في ظهرِ الغيب —
              يَعبرُ حدودَ الحفل ليصير ذكرى راسخةً في وجدانِ كلِّ عريسٍ، ودعاءً مستجاباً
              في بيتٍ جديد. <span className="font-bold text-foreground">أثرُكم باقٍ ما بقيت الفرحةُ تُروى</span>،
              وأجرُكم عند الله أوفى وأبقى.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t bg-card/50">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} لجنة الزواج الجماعي · جميع الحقوق محفوظة</p>
          <p className="flex items-center gap-1.5">
            <HandHeart className="h-3.5 w-3.5 text-gold" />
            صُنع بمحبة لخدمة العائلة
          </p>
        </div>
      </footer>
    </div>
  );
}

function HeroKpi({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  loading,
  delay = "0s",
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "gold" | "teal" | "emerald" | "violet";
  loading: boolean;
  delay?: string;
}) {
  const tones: Record<string, string> = {
    gold: "from-gold/20 to-gold/5 border-gold/30",
    teal: "from-primary/20 to-primary-glow/5 border-primary/30",
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
    violet: "from-violet-500/20 to-violet-500/5 border-violet-500/30",
  };
  const iconBg: Record<string, string> = {
    gold: "bg-gradient-gold text-gold-foreground shadow-gold",
    teal: "bg-gradient-hero text-primary-foreground shadow-elegant",
    emerald: "bg-emerald-500 text-white",
    violet: "bg-violet-500 text-white",
  };
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${tones[tone]} backdrop-blur-md bg-card/90 p-4 lg:p-5 shadow-elegant animate-fade-up hover:-translate-y-1 transition-transform duration-300`}
      style={{ animationDelay: delay }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-muted-foreground mb-1">{label}</p>
          <p className="text-xl lg:text-3xl font-extrabold tracking-tight truncate" title={value}>
            {loading ? "…" : value}
          </p>
          <p className="text-[10px] lg:text-xs text-muted-foreground mt-1">{hint}</p>
        </div>
        <div className={`h-10 w-10 lg:h-12 lg:w-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg[tone]}`}>
          <Icon className="h-5 w-5 lg:h-6 lg:w-6" />
        </div>
      </div>
    </div>
  );
}

function DetailCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft hover:shadow-elegant transition-all hover:-translate-y-0.5 animate-fade-up">
      <div className="flex items-center gap-3 mb-3">
        <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </span>
        <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      </div>
      <p className="text-3xl font-extrabold tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}
