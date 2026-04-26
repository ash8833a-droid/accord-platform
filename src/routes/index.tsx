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
  // Format currency with bidi isolation so digits + "ر.س" render correctly in RTL
  const fmtSAR = (n: number) => `\u2066${fmt(n)}\u2069\u00A0ر.س`;
  const totalContributors = s.historicalShareholders + s.confirmedSubs;
  const totalAmount = s.historicalAmount + s.confirmedAmount;
  const avgContribution = totalContributors
    ? Math.round(totalAmount / totalContributors)
    : 0;

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
        <div className="relative w-full min-h-[480px] md:min-h-[520px] lg:min-h-[560px] overflow-hidden bg-gradient-hero text-primary-foreground">
          {/* Brand-aligned ornamental rings (gold + primary glow) */}
          <div className="absolute -bottom-40 -left-32 w-[460px] h-[460px] rounded-full border-[14px] border-gold/20 pointer-events-none" />
          <div className="absolute -bottom-24 -left-16 w-[280px] h-[280px] rounded-full border-[10px] border-gold/15 pointer-events-none" />
          <div className="absolute -top-40 -right-40 w-[420px] h-[420px] rounded-full border-[12px] border-primary-glow/30 pointer-events-none" />
          <div className="absolute top-1/3 right-10 w-2 h-2 rounded-full bg-gold/70 animate-pulse pointer-events-none" />
          <div className="absolute bottom-24 right-1/3 w-1.5 h-1.5 rounded-full bg-gold/60 animate-pulse pointer-events-none" />
          {/* Soft gold halo behind content */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.78_0.13_85/0.18),transparent_60%)] pointer-events-none" />

          {/* Sliding track */}
          <div
            className="flex h-full transition-transform duration-[1000ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ transform: `translateX(${pillarIdx * 100}%)` }}
          >
            {HERO_PILLARS.map((p, i) => {
              const isActive = i === pillarIdx;
              const Icon = p.icon;
              return (
                <div key={p.key} className="relative w-full h-full shrink-0 overflow-hidden">
                  {/* Two-column composition: text right (RTL leading) + giant gold icon left */}
                  <div className="relative h-full max-w-7xl mx-auto px-12 sm:px-14 md:px-20 lg:px-24 pt-10 pb-20 grid grid-cols-1 md:grid-cols-[1.2fr,1fr] items-center gap-6 md:gap-10">
                    {/* RIGHT — Text column */}
                    <div className="text-right order-1 min-w-0 max-w-full">
                      {/* Kicker — chapter label */}
                      <div
                        className={`inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 backdrop-blur px-3 py-1 mb-4 text-[11px] md:text-xs font-bold text-gold tracking-wider transition-all duration-700 ${
                          isActive ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
                        }`}
                      >
                        <Sparkles className="h-3 w-3" />
                        {p.kicker}
                      </div>

                      {/* Verse — gold preface */}
                      <p
                        className={`text-sm md:text-base lg:text-lg text-gold/90 font-semibold mb-3 md:mb-4 transition-all duration-700 ${
                          isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
                        }`}
                      >
                        {p.verse}
                      </p>

                      {/* Monumental gold title */}
                      <h1
                        className={`font-extrabold leading-[1.1] tracking-tight text-4xl sm:text-5xl md:text-6xl lg:text-7xl break-words transition-all duration-1000 delay-100 ${
                          isActive ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"
                        }`}
                        style={{
                          background:
                            "linear-gradient(180deg, oklch(0.92 0.14 90) 0%, oklch(0.82 0.15 85) 45%, oklch(0.68 0.14 80) 100%)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          backgroundClip: "text",
                          filter: "drop-shadow(0 6px 14px oklch(0.6 0.18 75 / 0.45))",
                        }}
                      >
                        {p.title}
                      </h1>

                      {/* Decorative divider */}
                      <div
                        className={`mt-5 mb-4 flex items-center gap-3 transition-all duration-700 delay-150 ${
                          isActive ? "opacity-100" : "opacity-0"
                        }`}
                      >
                        <span className="h-px w-16 bg-gradient-to-l from-transparent via-gold/70 to-gold" />
                        <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                        <span className="h-px w-8 bg-gradient-to-r from-gold/70 to-transparent" />
                      </div>

                      {/* Subtitle */}
                      <p
                        className={`max-w-xl text-sm md:text-base lg:text-[17px] text-primary-foreground/85 leading-loose transition-all duration-1000 delay-200 ${
                          isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                        }`}
                      >
                        {p.subtitle}
                      </p>

                      {/* Icon badges row — like reference */}
                      <div
                        className={`mt-5 md:mt-6 flex flex-wrap gap-2 md:gap-3 transition-all duration-1000 delay-300 ${
                          isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                        }`}
                      >
                        {p.badges.map((b) => {
                          const BIcon = b.icon;
                          return (
                            <span
                              key={b.label}
                              className="inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/15 backdrop-blur-md border border-gold/40 px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-bold text-primary-foreground shadow-soft transition-colors"
                            >
                              <span className="inline-flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded-full bg-gradient-gold text-gold-foreground shadow-gold">
                                <BIcon className="h-3.5 w-3.5 md:h-4 md:w-4" strokeWidth={2.4} />
                              </span>
                              {b.label}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* LEFT — Hero icon medallion (replaces 3D number) */}
                    <div className="hidden md:flex items-center justify-center order-2">
                      <div
                        className={`relative transition-all duration-1000 delay-200 ${
                          isActive ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-90 -rotate-6"
                        }`}
                      >
                        {/* Outer glow ring */}
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gold/50 via-gold/20 to-transparent blur-3xl scale-125" />
                        {/* Concentric medallion */}
                        <div className="relative h-44 w-44 lg:h-60 lg:w-60 rounded-full bg-white/5 backdrop-blur-md border-[6px] border-gold/50 shadow-elegant flex items-center justify-center">
                          {/* rotating dashed ring */}
                          <div className="absolute inset-2 rounded-full border-2 border-dashed border-gold/30 animate-[spin_30s_linear_infinite]" />
                          <div className="h-28 w-28 lg:h-40 lg:w-40 rounded-full bg-gradient-gold flex items-center justify-center shadow-[inset_0_4px_16px_rgba(0,0,0,0.25),0_14px_36px_oklch(0.6_0.18_75/0.5)]">
                            <Icon
                              className="h-14 w-14 lg:h-20 lg:w-20 text-gold-foreground drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)]"
                              strokeWidth={1.4}
                            />
                          </div>
                          {/* Decorative dots around medallion */}
                          <span className="absolute top-1 right-1/2 translate-x-1/2 h-2 w-2 rounded-full bg-gold shadow-gold" />
                          <span className="absolute bottom-1 right-1/2 translate-x-1/2 h-2 w-2 rounded-full bg-gold shadow-gold" />
                          <span className="absolute right-1 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-gold shadow-gold" />
                          <span className="absolute left-1 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-gold shadow-gold" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Side navigation arrows — like reference (purple thin chevrons) */}
          <button
            onClick={() =>
              setPillarIdx((i) => (i - 1 + HERO_PILLARS.length) % HERO_PILLARS.length)
            }
            aria-label="السابق"
            className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 md:h-12 md:w-12 rounded-full bg-white/10 border border-gold/40 backdrop-blur-md text-gold hover:bg-gold hover:text-gold-foreground hover:border-gold transition-all flex items-center justify-center shadow-soft"
          >
            <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
          </button>
          <button
            onClick={() => setPillarIdx((i) => (i + 1) % HERO_PILLARS.length)}
            aria-label="التالي"
            className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 md:h-12 md:w-12 rounded-full bg-white/10 border border-gold/40 backdrop-blur-md text-gold hover:bg-gold hover:text-gold-foreground hover:border-gold transition-all flex items-center justify-center shadow-soft"
          >
            <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
          </button>

          {/* Bottom dot indicators — like reference */}
          <div className="absolute bottom-5 md:bottom-7 inset-x-0 flex items-center justify-center gap-2.5 z-10">
            {HERO_PILLARS.map((p, i) => (
              <button
                key={p.key}
                onClick={() => setPillarIdx(i)}
                aria-label={`الانتقال إلى ${p.title}`}
                className={`transition-all duration-500 rounded-full ${
                  i === pillarIdx
                    ? "h-2.5 w-10 bg-gradient-gold shadow-gold"
                    : "h-2.5 w-2.5 bg-primary-foreground/30 hover:bg-primary-foreground/50"
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Hero KPIs — the 4 headline numbers (the only place these 4 appear) */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 mt-8 lg:mt-12 relative z-10">
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
            label="المساهمون عبر السنين"
            value={fmt(totalContributors)}
            hint={s.firstYear ? `منذ عام ${s.firstYear}هـ` : "سجلّ تاريخي"}
            icon={Users}
            tone="teal"
            loading={!loaded}
            delay="0.1s"
          />
          <HeroKpi
            label="إجمالي المساهمات"
            value={fmtSAR(totalAmount)}
            hint="تاريخية ومؤكدة هذا العام"
            icon={Wallet}
            tone="emerald"
            loading={!loaded}
            delay="0.2s"
          />
          <HeroKpi
            label="اللجان المُشاركة"
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
      <section className="max-w-7xl mx-auto px-4 lg:px-8 pt-14 lg:pt-20 pb-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
              قراءةٌ أعمق
            </p>
            <h2 className="text-2xl lg:text-3xl font-bold">
              تفاصيلُ تكشفُ امتدادَ المسيرة
            </h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl">
              مؤشّراتٌ مكمِّلةٌ تُبرزُ عُمقَ التراكم عبر السنين وتوزّعَ الجهد بين الفروع.
            </p>
          </div>
          <TrendingUp className="hidden md:block h-8 w-8 text-gold" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <DetailCard
            icon={CalendarRange}
            label="سنوات هجرية موثّقة"
            value={fmt(s.historicalYears)}
            sub={s.firstYear ? `بدأت من عام ${s.firstYear}هـ` : "سجلٌّ ينمو"}
          />
          <DetailCard
            icon={Building2}
            label="فروع العائلة المساهمة"
            value={fmt(s.branches)}
            sub="موزَّعةٌ على امتدادِ السجل التاريخي"
          />
          <DetailCard
            icon={HandHeart}
            label="متوسط المساهمة"
            value={fmtSAR(avgContribution)}
            sub="لكلِّ مساهمٍ عبر السنين"
          />
          <DetailCard
            icon={Wallet}
            label="اشتراكاتُ هذا العام"
            value={fmt(s.confirmedSubs)}
            sub={`بقيمة ${fmtSAR(s.confirmedAmount)}`}
          />
          <DetailCard
            icon={Star}
            label="المساهمات التاريخية"
            value={fmt(s.historicalShareholders)}
            sub={`بإجمالي ${fmtSAR(s.historicalAmount)}`}
          />
          <DetailCard
            icon={Gift}
            label="معدّل العرسان لكلِّ لجنة"
            value={
              s.committees ? fmt(Math.round((s.grooms / s.committees) * 10) / 10) : "—"
            }
            sub="يعكسُ توزُّعَ الجهد بين اللجان"
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
              دعوةٌ كريمة
            </div>
            <h3 className="text-2xl lg:text-3xl font-bold leading-tight">
              كُنْ شريكاً في صناعةِ الفرح
            </h3>
            <p className="text-sm lg:text-base text-muted-foreground mt-3 leading-loose">
              مساهمتُك — مهما صغرت — تُسهمُ في تأسيسِ بيتٍ جديد، وتُكتبُ في ميزانِ
              <span className="font-bold text-foreground"> صدقةٍ جارية</span> ما دامتِ
              الذرّيةُ تُولَدُ والفرحةُ تتجدَّد. سجِّلْ مساهمتَك، أو رشِّحْ عريساً من
              ذوي الحاجة، فالعطاءُ يبدأُ من خطوةٍ واحدة.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold bg-gradient-hero text-primary-foreground shadow-elegant hover:opacity-90 transition-opacity"
              >
                <HandHeart className="h-4 w-4" />
                ساهِمْ معنا
              </Link>
              <Link
                to="/register-groom"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold border border-gold/40 bg-gold/10 text-foreground hover:bg-gold/20 transition-colors"
              >
                <HeartHandshake className="h-4 w-4" />
                ترشيح عريس
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t bg-card/50">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} لجنة الزواج الجماعي · جميع الحقوق محفوظة</p>
          <p className="flex items-center gap-1.5">
            <HandHeart className="h-3.5 w-3.5 text-gold" />
            صُنِعَ بمحبّةٍ لخدمةِ العائلة
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
