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
  ArrowLeft,
  ShieldCheck,
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
    firstYear: 0 as number | 0,
    confirmedSubs: 0,
    confirmedAmount: 0,
    committees: 0,
    branches: 0,
  });
  const [loaded, setLoaded] = useState(false);

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

  const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(n);
  const totalContributors = s.historicalShareholders + s.confirmedSubs;
  const totalAmount = s.historicalAmount + s.confirmedAmount;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur bg-background/80 border-b">
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

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-95" />
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-gold/25 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-20 w-96 h-96 bg-primary-glow/30 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 lg:px-8 py-16 lg:py-24 text-primary-foreground">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-4 py-1.5 text-xs font-semibold mb-5">
            <Sparkles className="h-3.5 w-3.5 text-gold" />
            مسيرة عائلية مستمرة
          </div>
          <h1 className="text-3xl lg:text-5xl font-extrabold leading-tight max-w-3xl">
            لجنة <span className="text-shimmer-gold">الزواج الجماعي</span>
            <br />
            أرقامٌ تروي قصة عطاء.
          </h1>
          <p className="mt-5 text-base lg:text-lg text-primary-foreground/85 max-w-2xl leading-relaxed">
            منذ انطلاق برنامج الزواج الجماعي وأبناء العائلة الكرام يتعاضدون لإقامة
            أعراسٍ جامعةٍ تحفظ القيم وتُيسّر الزواج. هذه نظرة شفافة على ما تحقّق.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/register-groom"
              className="inline-flex items-center gap-2 rounded-xl bg-gold text-gold-foreground px-5 py-3 text-sm font-bold shadow-gold hover:opacity-90 transition-opacity"
            >
              تسجيل عريس جديد
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur border border-white/30 px-5 py-3 text-sm font-bold hover:bg-white/20 transition-colors"
            >
              دخول الأعضاء
            </Link>
          </div>
        </div>
      </section>

      {/* Hero KPIs */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 -mt-10 lg:-mt-14 relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
          <HeroKpi
            label="إجمالي العرسان"
            value={fmt(s.grooms)}
            hint="منذ انطلاق البرنامج"
            icon={HeartHandshake}
            tone="gold"
            loading={!loaded}
          />
          <HeroKpi
            label="المساهمون عبر السنوات"
            value={fmt(totalContributors)}
            hint={s.firstYear ? `منذ عام ${s.firstYear}هـ` : "سجلّ تاريخي"}
            icon={Users}
            tone="teal"
            loading={!loaded}
          />
          <HeroKpi
            label="إجمالي المبالغ المجموعة"
            value={`${fmt(totalAmount)} ر.س`}
            hint="مساهمات وأقساط مؤكدة"
            icon={Wallet}
            tone="emerald"
            loading={!loaded}
          />
          <HeroKpi
            label="اللجان العاملة"
            value={fmt(s.committees)}
            hint="فريق يعمل بروح واحدة"
            icon={Building2}
            tone="violet"
            loading={!loaded}
          />
        </div>
      </section>

      {/* Detailed grid */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-14 lg:py-20">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
              لوحة المؤشرات
            </p>
            <h2 className="text-2xl lg:text-3xl font-bold">
              أرقام تفصيلية بشفافية كاملة
            </h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl">
              كل رقم أمامك يعكس جهداً جماعياً ومساهمةً نبيلة من أبناء العائلة، نُحدّثه باستمرار.
            </p>
          </div>
          <TrendingUp className="hidden md:block h-8 w-8 text-gold" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <DetailCard
            icon={Users}
            label="مساهمون تاريخيون"
            value={fmt(s.historicalShareholders)}
            sub={`بإجمالي ${fmt(s.historicalAmount)} ر.س`}
          />
          <DetailCard
            icon={CalendarRange}
            label="سنوات هجرية موثّقة"
            value={fmt(s.historicalYears)}
            sub={s.firstYear ? `منذ ${s.firstYear}هـ` : "سجلّ ينمو"}
          />
          <DetailCard
            icon={Building2}
            label="فروع العائلة المساهمة"
            value={fmt(s.branches)}
            sub="في السجل التاريخي"
          />
          <DetailCard
            icon={HeartHandshake}
            label="عرسان مسجَّلون"
            value={fmt(s.grooms)}
            sub="منذ انطلاق المنصة"
          />
          <DetailCard
            icon={Wallet}
            label="اشتراكات سنوية مؤكدة"
            value={fmt(s.confirmedSubs)}
            sub={`بقيمة ${fmt(s.confirmedAmount)} ر.س`}
          />
          <DetailCard
            icon={ShieldCheck}
            label="لجان منظَّمة"
            value={fmt(s.committees)}
            sub="مالية، إعلام، استقبال، وأكثر"
          />
        </div>
      </section>

      {/* CTA strip */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-16">
        <div className="rounded-3xl border bg-gradient-card p-8 lg:p-10 shadow-soft flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <h3 className="text-xl lg:text-2xl font-bold">
              شارك في صناعة الفرحة
            </h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl">
              يمكنك تسجيل عريس جديد، أو الدخول كعضو في إحدى اللجان لمتابعة المهام والمساهمات.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/register-groom"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-gold text-gold-foreground px-5 py-3 text-sm font-bold shadow-gold hover:opacity-90"
            >
              تسجيل عريس
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-xl border bg-card px-5 py-3 text-sm font-bold hover:bg-accent transition-colors"
            >
              دخول الأعضاء
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} لجنة الزواج الجماعي · جميع الحقوق محفوظة
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
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "gold" | "teal" | "emerald" | "violet";
  loading: boolean;
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
    <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${tones[tone]} backdrop-blur-md bg-card/90 p-4 lg:p-5 shadow-elegant`}>
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
    <div className="rounded-2xl border bg-card p-5 shadow-soft hover:shadow-elegant transition-all hover:-translate-y-0.5">
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
