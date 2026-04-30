import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { COMMITTEES, committeeByType, type CommitteeType } from "@/lib/committees";
import {
  ArrowRight, Compass, Crown, Eye, Flag, HeartHandshake, Lightbulb,
  ListChecks, ShieldCheck, Sparkles, Target, Users,
} from "lucide-react";

export const Route = createFileRoute("/committees")({
  head: () => ({
    meta: [
      { title: "اللجان وأدوارها — لجنة الزواج الجماعي" },
      {
        name: "description",
        content:
          "تعرّف على لجان مبادرة الزواج الجماعي: الرؤية والرسالة والأهداف والمستهدفات والمهام وأعضاء كل لجنة.",
      },
      { property: "og:title", content: "اللجان وأدوارها — لجنة الزواج الجماعي" },
      {
        property: "og:description",
        content:
          "ميثاق كل لجنة وفق منهجية PMP: رؤية، رسالة، أهداف استراتيجية، مستهدفات قابلة للقياس، وقائمة الأعضاء.",
      },
    ],
  }),
  component: PublicCommitteesPage,
});

// ===== Content tables (mirrored from PmpCharter to make this page public-safe) =====
const COMMITTEE_VISION: Record<CommitteeType, string> = {
  supreme: "قيادة مرجعية تُحوّل مبادرة الزواج الجماعي إلى نموذج مؤسسي مستدام ومُلهِم.",
  finance: "إدارة مالية شفافة تضمن استدامة المبادرة وثقة الداعمين والمستفيدين.",
  media: "صورة إعلامية مشرّفة تعكس قيم المبادرة وتُلهم المجتمع للمشاركة والدعم.",
  quality: "جودة تنفيذية متميزة تجعل تجربة كل عريس وضيف لا تُنسى.",
  programs: "برامج وفقرات مُحكمة الإخراج تليق بفرحة العرسان ومكانة الحفل.",
  dinner: "ضيافة كريمة بمعايير صحية عالية تليق بمقام الضيوف والعرسان.",
  procurement: "سلسلة إمداد منضبطة تُسلّم المستلزمات في الوقت والجودة المطلوبة.",
  reception: "استقبال راقٍ ومنظّم يعكس حُسن الضيافة منذ اللحظة الأولى.",
  women: "قسم نسائي متكامل يوفّر بيئة آمنة ومريحة لأمهات وأخوات العرسان.",
};

const COMMITTEE_MISSION: Record<CommitteeType, string> = {
  supreme: "اعتماد الخطط، متابعة الأداء، اتخاذ القرارات الاستراتيجية، وحوكمة عمل اللجان.",
  finance: "إعداد الموازنة، تحصيل الاشتراكات، صرف المستحقات، وإصدار التقارير المالية الدورية.",
  media: "التغطية الإعلامية، إدارة المحتوى الرقمي، أرشفة الحفل، والتواصل مع الجمهور.",
  quality: "وضع المعايير، تدقيق أعمال اللجان، قياس الرضا، وضمان التحسين المستمر.",
  programs: "تصميم الفقرات، إدارة الجدول الزمني، تنسيق البروفات، وإخراج الحفل بسلاسة.",
  dinner: "تخطيط قائمة الطعام، اختيار المورّد، ضمان السلامة الغذائية، وإدارة التقديم.",
  procurement: "تحديد الاحتياجات، التفاوض مع المورّدين، الشراء، والتسليم في الموعد.",
  reception: "تنظيم بروتوكول الاستقبال، إدارة كبار الضيوف، والتنسيق مع الأمن.",
  women: "تجهيز القسم النسائي، التنسيق مع اللجان، وضمان راحة الحاضرات.",
};

const COMMITTEE_TARGETS: Record<CommitteeType, string[]> = {
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

interface PublicMember {
  id: string;
  full_name: string;
  role_title: string | null;
  specialty: string | null;
  is_head: boolean;
}

interface PublicCommittee {
  id: string;
  type: CommitteeType;
  name: string;
  description: string | null;
  members: PublicMember[];
}

function PublicCommitteesPage() {
  const [data, setData] = useState<PublicCommittee[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data: rows } = await supabase.rpc("get_public_committees");
      setData((rows as unknown as PublicCommittee[]) ?? []);
    })();
  }, []);

  // Order committees according to the canonical order in COMMITTEES (supreme first, etc.)
  const ordered = COMMITTEES.map((meta) => {
    const dbRow = data?.find((c) => c.type === meta.type);
    return { meta, members: dbRow?.members ?? [] };
  });

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur bg-background/85 border-b">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 lg:px-8 h-16">
          <Logo size={36} />
          <nav className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold border hover:bg-accent transition-colors"
            >
              <ArrowRight className="h-4 w-4" />
              العودة للرئيسية
            </Link>
            <Link
              to="/auth"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold bg-gradient-hero text-primary-foreground shadow-elegant hover:opacity-90 transition-opacity"
            >
              <ShieldCheck className="h-4 w-4" />
              دخول الأعضاء
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full bg-gold/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-24 w-[460px] h-[460px] rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 lg:px-8 py-14 lg:py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 mb-5 text-[11px] sm:text-xs font-semibold text-gold tracking-wider">
            <Sparkles className="h-3 w-3" />
            ميثاق اللجان وفق منهجية PMP
          </div>
          <h1 className="font-extrabold leading-[1.2] tracking-tight text-3xl sm:text-4xl md:text-5xl text-foreground mb-5">
            اللجان <span className="text-primary">وأدوارها</span>
            <br className="hidden sm:block" />
            في صناعة <span className="text-gold">الفَرَح</span>
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-loose max-w-2xl mx-auto">
            تعرّف على لجاننا التسع: رؤيتها ورسالتها وأهدافها الاستراتيجية ومستهدفاتها القابلة للقياس،
            مع قائمة أعضاء كل لجنة الذين يعملون بروح الفريق لإنجاح المبادرة.
          </p>
        </div>
      </section>

      {/* Committee anchors / table of contents */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {COMMITTEES.map((c) => {
            const Icon = c.icon;
            return (
              <a
                key={c.type}
                href={`#committee-${c.type}`}
                className="group flex items-center gap-2 rounded-xl border bg-card p-3 hover:border-primary/40 hover:shadow-soft transition-all"
              >
                <span className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${c.tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-xs font-bold leading-tight">{c.label}</span>
              </a>
            );
          })}
        </div>
      </section>

      {/* Committees list */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-10 space-y-8">
        {ordered.map(({ meta, members }) => (
          <CommitteeCard key={meta.type} meta={meta} members={members} />
        ))}
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-16">
        <div className="relative overflow-hidden rounded-3xl border bg-gradient-card p-8 lg:p-10 shadow-soft text-center">
          <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gold/15 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative max-w-2xl mx-auto">
            <h3 className="text-xl lg:text-2xl font-bold leading-tight">
              هل ترغب في الانضمام لإحدى اللجان؟
            </h3>
            <p className="text-sm text-muted-foreground mt-3 leading-loose">
              سجّل دخولك إلى المنصة وقدّم طلب انضمام، وسيتم التواصل معك من قِبَل اللجنة العليا.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold bg-gradient-hero text-primary-foreground shadow-elegant hover:opacity-90 transition-opacity"
              >
                <ShieldCheck className="h-4 w-4" />
                دخول الأعضاء
              </Link>
              <Link
                to="/register-groom"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold border border-gold/40 bg-gold/10 text-foreground hover:bg-gold/20 transition-colors"
              >
                <HeartHandshake className="h-4 w-4" />
                تسجيل عريس
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t bg-card/50">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} لجنة الزواج الجماعي · جميع الحقوق محفوظة
        </div>
      </footer>
    </div>
  );
}

function CommitteeCard({
  meta,
  members,
}: {
  meta: ReturnType<typeof committeeByType> & {};
  members: PublicMember[];
}) {
  const Icon = meta!.icon;
  const type = meta!.type;
  const vision = COMMITTEE_VISION[type] ?? meta!.description;
  const mission = COMMITTEE_MISSION[type] ?? meta!.description;
  const goals = meta!.goals ?? [];
  const targets = COMMITTEE_TARGETS[type] ?? [];
  const head = members.find((m) => m.is_head);
  const others = members.filter((m) => !m.is_head);

  return (
    <article
      id={`committee-${type}`}
      className="relative overflow-hidden rounded-3xl border bg-gradient-to-bl from-primary/5 via-card to-card shadow-soft scroll-mt-20"
    >
      <div className="pointer-events-none absolute -top-16 -start-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative p-5 md:p-7 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4 flex-wrap">
          <span className={`h-14 w-14 md:h-16 md:w-16 rounded-2xl flex items-center justify-center shrink-0 ${meta!.tone}`}>
            <Icon className="h-7 w-7 md:h-8 md:w-8" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] font-bold mb-2">
              <Compass className="h-3.5 w-3.5" />
              ميثاق اللجنة
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold leading-tight">{meta!.label}</h2>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{meta!.description}</p>
          </div>
        </div>

        {/* Vision · Mission · Goals */}
        <div className="grid gap-3 md:grid-cols-3">
          <InfoCard icon={Eye} title="الرؤية" tone="violet">
            <p className="text-sm leading-relaxed">{vision}</p>
          </InfoCard>
          <InfoCard icon={Lightbulb} title="الرسالة" tone="primary">
            <p className="text-sm leading-relaxed">{mission}</p>
          </InfoCard>
          <InfoCard icon={Flag} title="الأهداف الاستراتيجية" tone="emerald">
            {goals.length === 0 ? (
              <p className="text-xs text-muted-foreground">لم تُحدَّد أهداف بعد.</p>
            ) : (
              <ul className="space-y-1.5">
                {goals.map((g, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            )}
          </InfoCard>
        </div>

        {/* Targets */}
        <div className="rounded-2xl border bg-background/70 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-8 w-8 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center">
              <Target className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-bold">المستهدفات ومؤشرات النجاح</h3>
          </div>
          {targets.length === 0 ? (
            <p className="text-xs text-muted-foreground">لم تُحدَّد مستهدفات بعد.</p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {targets.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Members */}
        <div className="rounded-2xl border bg-background/70 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Users className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-bold">أعضاء اللجنة</h3>
            {members.length > 0 && (
              <span className="text-[11px] text-muted-foreground mr-auto">
                {members.length} {members.length === 1 ? "عضو" : "أعضاء"}
              </span>
            )}
          </div>

          {members.length === 0 ? (
            <p className="text-xs text-muted-foreground">لم يُسجَّل أعضاء بعد.</p>
          ) : (
            <div className="space-y-3">
              {head && (
                <div className="rounded-xl border border-gold/30 bg-gold/5 p-3 flex items-center gap-3">
                  <span className="h-10 w-10 rounded-full bg-gradient-gold text-gold-foreground flex items-center justify-center shrink-0">
                    <Crown className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold truncate">{head.full_name}</p>
                      <span className="text-[10px] font-bold bg-gold/20 text-gold-foreground rounded-full px-2 py-0.5">
                        رئيس اللجنة
                      </span>
                    </div>
                    {(head.role_title || head.specialty) && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {[head.role_title, head.specialty].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {others.length > 0 && (
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {others.map((m) => (
                    <li key={m.id} className="rounded-lg border bg-card p-2.5 flex items-center gap-2.5">
                      <span className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                        {initials(m.full_name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{m.full_name}</p>
                        {(m.role_title || m.specialty) && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            {[m.role_title, m.specialty].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Tasks placeholder note */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <ListChecks className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            تعمل اللجنة وفق منهجية PMP بمراحلها الخمس: التهيئة، التخطيط، التنفيذ، المتابعة، والإغلاق —
            ضماناً للحوكمة وجودة المخرجات.
          </p>
        </div>
      </div>
    </article>
  );
}

function InfoCard({
  icon: Icon,
  title,
  tone,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tone: "violet" | "primary" | "emerald";
  children: React.ReactNode;
}) {
  const styles: Record<string, { wrap: string; iconWrap: string }> = {
    violet: {
      wrap: "from-violet-500/10",
      iconWrap: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
    },
    primary: {
      wrap: "from-primary/10",
      iconWrap: "bg-primary/15 text-primary",
    },
    emerald: {
      wrap: "from-emerald-500/10",
      iconWrap: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
    },
  };
  const s = styles[tone];
  return (
    <div className={`rounded-2xl border bg-gradient-to-bl ${s.wrap} via-card to-card p-4 shadow-sm`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`h-9 w-9 rounded-xl flex items-center justify-center ${s.iconWrap}`}>
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-extrabold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "؟";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] ?? "") + (parts[1][0] ?? "");
}