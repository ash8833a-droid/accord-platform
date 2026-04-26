import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import heroBanner from "@/assets/hero-banner.jpg";
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
  GitBranch,
  Coins,
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

      {/* Hero — split layout: text right, image card left, calm cream background */}
      <section className="relative overflow-hidden bg-background">
        {/* Soft brand-tinted blobs */}
        <div className="absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full bg-gold/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-24 w-[460px] h-[460px] rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-2 items-center gap-10 lg:gap-14">
          {/* RIGHT — Text */}
          <div className="text-right order-2 lg:order-1 animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 mb-5 text-[11px] sm:text-xs font-semibold text-gold tracking-wider">
              <Sparkles className="h-3 w-3" />
              منصّة لجنة الزواج الجماعي
            </div>

            <h1 className="font-extrabold leading-[1.2] tracking-tight text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] text-foreground mb-5">
              حيثُ تَلتقي <span className="text-primary">الهِمَمُ</span>
              <br className="hidden sm:block" />
              ويَكتمِلُ <span className="text-gold">الفَرَح</span>
            </h1>

            {/* Subtle divider */}
            <div className="flex items-center gap-2 mb-5 justify-end">
              <span className="h-px w-12 bg-gradient-to-l from-transparent to-gold/50" />
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              <span className="h-px w-6 bg-gradient-to-r from-gold/50 to-transparent" />
            </div>

            <p className="text-sm sm:text-base lg:text-[17px] text-muted-foreground leading-loose mb-7 max-w-xl">
              منصّةٌ مؤسَّسيّةٌ راقيةٌ تُنظِّمُ عملَ اللجان وتُديرُ مسيرةَ الزواج الجماعي
              بكلِّ شفافيّةٍ وإتقان؛ من تسجيلِ العرسان وتوثيقِ المساهمات إلى متابعةِ المهامّ
              وإصدارِ التقارير، ليَبقى الأَثَرُ مُمتدّاً وفَرَحُ العائلةِ مُكتمِلاً.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/register-groom"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold bg-gradient-gold text-gold-foreground shadow-gold hover:opacity-95 transition-opacity"
              >
                <HeartHandshake className="h-4 w-4" />
                تسجيل عريس
              </Link>
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold border border-primary/30 bg-card text-primary hover:bg-primary/5 transition-colors"
              >
                <ShieldCheck className="h-4 w-4" />
                دخول الأعضاء
              </Link>
            </div>
          </div>

          {/* LEFT — Image card */}
          <div className="order-1 lg:order-2 animate-fade-up" style={{ animationDelay: "0.15s" }}>
            <div className="relative">
              {/* Single thin gold frame for elegance */}
              <div className="absolute -inset-2 rounded-[1.25rem] border border-gold/30 pointer-events-none" />

              <div className="relative rounded-2xl overflow-hidden shadow-soft border border-border bg-card">
                <img
                  src={heroBanner}
                  alt="لجنة الزواج الجماعي — حيث تجتمع الهِمَم على صناعة الفرح"
                  width={1920}
                  height={1080}
                  loading="eager"
                  className="w-full h-[280px] sm:h-[340px] lg:h-[440px] object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Hero KPIs — the 4 headline numbers (the only place these 4 appear) */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 mt-10 lg:mt-14 relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
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
            tone="gold"
            loading={!loaded}
            delay="0.2s"
          />
          <HeroKpi
            label="اللجان المُشاركة"
            value={fmt(s.committees)}
            hint="فريق يعمل بروح واحدة"
            icon={Building2}
            tone="teal"
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
  tone: "gold" | "teal";
  loading: boolean;
  delay?: string;
}) {
  // هوية الشعار: ذهبي + تركواز — بلمسة واحدة هادئة فقط
  const accent: Record<string, { dot: string; iconColor: string }> = {
    gold: {
      dot: "bg-gold",
      iconColor: "text-gold",
    },
    teal: {
      dot: "bg-primary",
      iconColor: "text-primary",
    },
  };
  const a = accent[tone];
  return (
    <div
      className="group relative rounded-2xl border border-border/70 bg-card p-5 lg:p-6 shadow-soft hover:border-gold/30 transition-colors duration-300 animate-fade-up"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`h-1.5 w-1.5 rounded-full ${a.dot}`} />
            <p className="text-xs font-medium text-muted-foreground leading-snug">
              {label}
            </p>
          </div>
          <p
            className="text-2xl lg:text-[1.85rem] font-bold tracking-tight tabular-nums text-foreground truncate"
            title={value}
          >
            {loading ? (
              <span className="inline-block h-7 w-20 rounded-md bg-muted animate-pulse align-middle" />
            ) : (
              value
            )}
          </p>
          <p className="text-[11px] lg:text-xs text-muted-foreground/80 mt-1.5 leading-snug">
            {hint}
          </p>
        </div>
        <Icon className={`h-5 w-5 lg:h-6 lg:w-6 shrink-0 ${a.iconColor} opacity-70`} />
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
    <div className="group relative rounded-2xl border border-border/70 bg-card p-5 lg:p-6 shadow-soft hover:border-primary/30 transition-colors duration-300 animate-fade-up">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          <p className="text-sm font-medium text-muted-foreground leading-snug">{label}</p>
        </div>
        <Icon className="h-5 w-5 shrink-0 text-primary opacity-70" />
      </div>
      <p className="text-2xl lg:text-3xl font-bold tracking-tight tabular-nums text-foreground truncate" title={value}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground/80 mt-1.5 leading-snug">{sub}</p>
    </div>
  );
}
