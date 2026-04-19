import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, ClipboardList, Beef, Users2, CalendarRange, Sparkles, UtensilsCrossed, ShoppingCart, Phone, Calendar } from "lucide-react";
import type { CommitteeType } from "@/lib/committees";

interface GroomRow {
  id: string;
  full_name: string;
  family_branch: string;
  phone: string;
  wedding_date: string | null;
  extra_sheep: number;
  extra_cards_men: number;
  extra_cards_women: number;
  external_participation: boolean;
  external_participation_details: string | null;
  vip_guests: string | null;
  special_requests: string | null;
}

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" }) : "—";

interface FollowupConfig {
  title: string;
  subtitle: string;
  icon: any;
  tone: string;
  emptyText: string;
  filter: (g: GroomRow) => boolean;
  renderItem: (g: GroomRow) => React.ReactNode;
  totalLabel?: (rows: GroomRow[]) => string;
}

const CONFIGS: Partial<Record<CommitteeType, FollowupConfig>> = {
  procurement: {
    title: "الذبائح الإضافية المطلوب توفيرها",
    subtitle: "العرسان المعتمدون الذين طلبوا ذبائح زيادة على المخصص",
    icon: Beef,
    tone: "from-orange-500/10 to-amber-500/5 border-orange-500/30",
    emptyText: "لا توجد طلبات ذبائح إضافية حالياً",
    filter: (g) => (g.extra_sheep ?? 0) > 0,
    renderItem: (g) => (
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Badge className="bg-orange-600 text-white hover:bg-orange-700 shrink-0">
            <Beef className="h-3 w-3 ms-1" /> {g.extra_sheep} ذبيحة
          </Badge>
          <span className="font-bold truncate">{g.full_name}</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">· {g.family_branch}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(g.wedding_date)}</span>
          <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" dir="ltr" />{g.phone}</span>
        </div>
      </div>
    ),
    totalLabel: (rows) => `إجمالي الذبائح المطلوبة: ${rows.reduce((a, g) => a + (g.extra_sheep ?? 0), 0)}`,
  },
  reception: {
    title: "ضيوف الشخصيات الاعتبارية (VIP)",
    subtitle: "الضيوف الذين تحتاج اللجنة حجز مقاعد مخصصة لهم",
    icon: Users2,
    tone: "from-pink-500/10 to-rose-500/5 border-pink-500/30",
    emptyText: "لا يوجد ضيوف VIP مسجلون حالياً",
    filter: (g) => !!g.vip_guests && g.vip_guests.trim() !== "",
    renderItem: (g) => (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Badge className="bg-pink-600 text-white hover:bg-pink-700 shrink-0">
              <Users2 className="h-3 w-3 ms-1" /> ضيف VIP
            </Badge>
            <span className="font-bold truncate">{g.full_name}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">· {g.family_branch}</span>
          </div>
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {fmtDate(g.wedding_date)}
          </span>
        </div>
        <div className="rounded-lg bg-pink-500/5 border border-pink-500/20 p-2.5 text-xs whitespace-pre-line leading-relaxed">
          {g.vip_guests}
        </div>
      </div>
    ),
  },
  programs: {
    title: "المشاركات الخارجية في فقرات الحفل",
    subtitle: "العرسان الذين أبدوا رغبة بمشاركة فقرة خارجية ضمن البرنامج",
    icon: CalendarRange,
    tone: "from-violet-500/10 to-indigo-500/5 border-violet-500/30",
    emptyText: "لا توجد مشاركات خارجية مسجلة",
    filter: (g) => g.external_participation === true,
    renderItem: (g) => (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Badge className="bg-violet-600 text-white hover:bg-violet-700 shrink-0">
              <Sparkles className="h-3 w-3 ms-1" /> مشاركة
            </Badge>
            <span className="font-bold truncate">{g.full_name}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">· {g.family_branch}</span>
          </div>
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {fmtDate(g.wedding_date)}
          </span>
        </div>
        <div className="rounded-lg bg-violet-500/5 border border-violet-500/20 p-2.5 text-xs whitespace-pre-line leading-relaxed">
          {g.external_participation_details || "لم تُذكر التفاصيل"}
        </div>
      </div>
    ),
  },
  dinner: {
    title: "احتياجات العشاء للعرسان المعتمدين",
    subtitle: "الذبائح الإضافية وأي طلبات خاصة بالضيافة",
    icon: UtensilsCrossed,
    tone: "from-amber-500/10 to-yellow-500/5 border-amber-500/30",
    emptyText: "لا توجد متطلبات عشاء إضافية",
    filter: (g) => (g.extra_sheep ?? 0) > 0 || !!g.special_requests,
    renderItem: (g) => (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            {(g.extra_sheep ?? 0) > 0 && (
              <Badge className="bg-amber-600 text-white hover:bg-amber-700 shrink-0">
                <Beef className="h-3 w-3 ms-1" /> +{g.extra_sheep} ذبيحة
              </Badge>
            )}
            <span className="font-bold truncate">{g.full_name}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">· {g.family_branch}</span>
          </div>
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {fmtDate(g.wedding_date)}
          </span>
        </div>
        {g.special_requests && (
          <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-2.5 text-xs whitespace-pre-line leading-relaxed">
            {g.special_requests}
          </div>
        )}
      </div>
    ),
    totalLabel: (rows) => `إجمالي الذبائح الإضافية: ${rows.reduce((a, g) => a + (g.extra_sheep ?? 0), 0)}`,
  },
  women: {
    title: "متطلبات الكروت النسائية الإضافية",
    subtitle: "العرسان الذين طلبوا كروت نسائية زيادة على المخصص",
    icon: ShoppingCart,
    tone: "from-fuchsia-500/10 to-pink-500/5 border-fuchsia-500/30",
    emptyText: "لا توجد طلبات كروت نسائية إضافية",
    filter: (g) => (g.extra_cards_women ?? 0) > 0,
    renderItem: (g) => (
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Badge className="bg-fuchsia-600 text-white hover:bg-fuchsia-700 shrink-0">
            +{g.extra_cards_women} كرت
          </Badge>
          <span className="font-bold truncate">{g.full_name}</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">· {g.family_branch}</span>
        </div>
        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <Calendar className="h-3 w-3" /> {fmtDate(g.wedding_date)}
        </span>
      </div>
    ),
    totalLabel: (rows) => `إجمالي الكروت النسائية الإضافية: ${rows.reduce((a, g) => a + (g.extra_cards_women ?? 0), 0)}`,
  },
};

export function GroomFollowups({ committeeType }: { committeeType: CommitteeType }) {
  const config = CONFIGS[committeeType];
  const [rows, setRows] = useState<GroomRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("grooms")
        .select("id,full_name,family_branch,phone,wedding_date,extra_sheep,extra_cards_men,extra_cards_women,external_participation,external_participation_details,vip_guests,special_requests")
        .in("status", ["approved", "completed"])
        .order("wedding_date", { ascending: true, nullsFirst: false });
      if (!cancelled) {
        setRows((data ?? []) as GroomRow[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [committeeType, config]);

  if (!config) return null;

  const filtered = rows.filter(config.filter);
  const Icon = config.icon;

  return (
    <div className={`rounded-2xl border-2 bg-gradient-to-br ${config.tone} p-5 shadow-soft`}>
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-11 w-11 rounded-xl bg-background/80 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-base flex items-center gap-2 flex-wrap">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              {config.title}
              <Badge variant="outline" className="bg-background/60">{filtered.length}</Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">{config.subtitle}</p>
          </div>
        </div>
        {config.totalLabel && filtered.length > 0 && (
          <div className="text-xs font-bold bg-background/70 border rounded-lg px-3 py-1.5">
            {config.totalLabel(filtered)}
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground bg-background/40 rounded-xl border border-dashed">
          {config.emptyText}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((g) => (
            <div key={g.id} className="rounded-xl border bg-background/70 backdrop-blur p-3 hover:bg-background transition-colors">
              {config.renderItem(g)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
