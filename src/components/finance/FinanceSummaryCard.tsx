import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(Math.round(n));

interface Props {
  groomSubsTotal: number;
  familyContribTotal: number;
  expensesTotal: number;
  committeeBreakdown: Array<{ name: string; spent: number }>;
}

export function FinanceSummaryCard({
  groomSubsTotal, familyContribTotal, expensesTotal, committeeBreakdown,
}: Props) {
  const revenues = groomSubsTotal + familyContribTotal;
  const balance = revenues - expensesTotal;
  const burn = revenues > 0 ? Math.min(100, (expensesTotal / revenues) * 100) : 0;

  const revenueData = [
    { name: "اشتراكات العرسان", value: groomSubsTotal, color: "hsl(190 80% 40%)" },
    { name: "مساهمات أفراد القبيلة", value: familyContribTotal, color: "hsl(142 70% 40%)" },
  ].filter((d) => d.value > 0);

  const expensesData = committeeBreakdown
    .filter((c) => c.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 8);

  return (
    <div dir="rtl" className="rounded-3xl border bg-gradient-to-bl from-card via-card to-primary/5 shadow-elegant overflow-hidden">
      {/* Top: 3 KPI tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-border/60">
        <KpiTile
          label="إجمالي الإيرادات"
          value={revenues}
          icon={TrendingUp}
          tone="emerald"
          arrow={ArrowUpRight}
          sublines={[
            { k: "اشتراكات العرسان", v: groomSubsTotal },
            { k: "مساهمات أفراد القبيلة", v: familyContribTotal },
          ]}
        />
        <KpiTile
          label="إجمالي المصروفات"
          value={expensesTotal}
          icon={TrendingDown}
          tone="rose"
          arrow={ArrowDownRight}
          sublines={[
            { k: "مصاريف اللجان والحفل", v: expensesTotal },
          ]}
        />
        <KpiTile
          label="الرصيد الحالي"
          value={balance}
          icon={Wallet}
          tone={balance >= 0 ? "primary" : "rose"}
          big
        />
      </div>

      {/* Burn rate bar */}
      <div className="px-6 pb-5">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-muted-foreground">نسبة الإنفاق من الإيرادات</span>
          <span className="font-semibold tabular-nums">{burn.toFixed(1)}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full transition-all ${burn <= 70 ? "bg-emerald-500" : burn <= 90 ? "bg-amber-500" : "bg-rose-500"}`}
            style={{ width: `${burn}%` }}
          />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-border/60 border-t">
        <div className="bg-card p-5">
          <h4 className="text-sm font-bold mb-3 text-muted-foreground">توزيع الإيرادات</h4>
          <div className="h-56">
            {revenueData.length === 0 ? (
              <EmptyChart text="لا توجد إيرادات بعد" />
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={revenueData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {revenueData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${fmt(v)} ر.س`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="space-y-1.5 mt-2">
            {revenueData.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
                  {d.name}
                </span>
                <span className="font-bold tabular-nums">{fmt(d.value)} ر.س</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card p-5">
          <h4 className="text-sm font-bold mb-3 text-muted-foreground">مصاريف اللجان</h4>
          <div className="h-56">
            {expensesData.length === 0 ? (
              <EmptyChart text="لا توجد مصاريف بعد" />
            ) : (
              <ResponsiveContainer>
                <BarChart data={expensesData} margin={{ top: 5, right: 5, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => `${fmt(v)} ر.س`} />
                  <Bar dataKey="spent" fill="hsl(190 80% 40%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiTile({
  label, value, icon: Icon, tone, arrow: Arrow, sublines, big,
}: {
  label: string; value: number; icon: any; tone: "emerald" | "rose" | "primary";
  arrow?: any; sublines?: Array<{ k: string; v: number }>; big?: boolean;
}) {
  const tones = {
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", ring: "ring-emerald-500/20" },
    rose: { bg: "bg-rose-500/10", text: "text-rose-700 dark:text-rose-400", ring: "ring-rose-500/20" },
    primary: { bg: "bg-primary/10", text: "text-primary", ring: "ring-primary/20" },
  } as const;
  const t = tones[tone];
  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={`tabular-nums font-black ${big ? "text-4xl" : "text-3xl"} ${t.text}`}>
            {fmt(value)} <span className="text-base font-bold">ر.س</span>
          </p>
        </div>
        <div className={`h-12 w-12 rounded-2xl ${t.bg} ring-1 ${t.ring} flex items-center justify-center ${t.text} shrink-0`}>
          <Icon className="h-6 w-6" />
          {Arrow && <Arrow className="h-3 w-3 absolute" style={{ marginRight: -8, marginTop: 16 }} />}
        </div>
      </div>
      {sublines && (
        <div className="mt-4 space-y-1.5">
          {sublines.map((s) => (
            <div key={s.k} className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">{s.k}</span>
              <span className="font-semibold tabular-nums">{fmt(s.v)} ر.س</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}