import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { History, TrendingUp, Users2, Calendar, Award } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from "recharts";

const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(Math.round(n));

interface Row { hijri_year: number; amount: number; }
interface YearAgg { year: number; total: number; count: number; cumulative: number; }

export function HistoricalContributionsDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("historical_shareholders")
      .select("hijri_year, amount")
      .gte("hijri_year", 1436)
      .order("hijri_year", { ascending: true })
      .then(({ data }) => {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }, []);

  const aggregated: YearAgg[] = useMemo(() => {
    const startYear = 1436;
    const currentHijri = new Date().getFullYear() - 622 + 1; // approximation
    const endYear = Math.max(currentHijri, ...rows.map((r) => r.hijri_year), startYear);
    const map = new Map<number, { total: number; count: number }>();
    for (let y = startYear; y <= endYear; y++) map.set(y, { total: 0, count: 0 });
    rows.forEach((r) => {
      const a = map.get(r.hijri_year) ?? { total: 0, count: 0 };
      a.total += Number(r.amount); a.count += 1;
      map.set(r.hijri_year, a);
    });
    let cum = 0;
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, v]) => {
        cum += v.total;
        return { year, total: v.total, count: v.count, cumulative: cum };
      });
  }, [rows]);

  const totalAmount = aggregated.reduce((s, a) => s + a.total, 0);
  const totalCount = aggregated.reduce((s, a) => s + a.count, 0);
  const yearsCovered = aggregated.filter((a) => a.total > 0).length;
  const peakYear = aggregated.reduce<YearAgg | null>((best, a) => (!best || a.total > best.total) ? a : best, null);

  return (
    <div dir="rtl" className="space-y-5">
      <div className="rounded-3xl border bg-gradient-to-bl from-amber-500/10 via-card to-card shadow-soft overflow-hidden">
        <div className="px-6 py-5 border-b border-amber-500/10">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/15 ring-1 ring-amber-500/30 flex items-center justify-center text-amber-700">
              <History className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">السجل التاريخي للمساهمات</h3>
              <p className="text-xs text-muted-foreground mt-0.5">تراكم دعم القبيلة منذ عام 1436هـ حتى اليوم</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-border/60">
          <BigCounter label="الإجمالي التاريخي" value={`${fmt(totalAmount)} ر.س`} icon={TrendingUp} tone="amber" />
          <BigCounter label="عدد المساهمين" value={fmt(totalCount)} icon={Users2} tone="emerald" />
          <BigCounter label="السنوات المُغطّاة" value={`${yearsCovered} سنة`} icon={Calendar} tone="sky" />
          <BigCounter
            label="السنة الأعلى دعماً"
            value={peakYear && peakYear.total > 0 ? `${peakYear.year}هـ` : "—"}
            sub={peakYear && peakYear.total > 0 ? `${fmt(peakYear.total)} ر.س` : ""}
            icon={Award}
            tone="rose"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardContent className="p-5">
            <h4 className="font-bold text-sm mb-3 text-muted-foreground">الإيرادات السنوية (ر.س)</h4>
            <div className="h-72">
              {loading ? <Skeleton /> : (
                <ResponsiveContainer>
                  <BarChart data={aggregated} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="year" tick={{ fontSize: 10 }} tickFormatter={(y) => `${y}هـ`} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(v: number) => `${fmt(v)} ر.س`}
                      labelFormatter={(y) => `${y}هـ`}
                    />
                    <Bar dataKey="total" fill="hsl(38 90% 50%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h4 className="font-bold text-sm mb-3 text-muted-foreground">التراكم منذ 1436هـ</h4>
            <div className="h-72">
              {loading ? <Skeleton /> : (
                <ResponsiveContainer>
                  <LineChart data={aggregated} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="year" tick={{ fontSize: 10 }} tickFormatter={(y) => `${y}هـ`} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(v: number) => `${fmt(v)} ر.س`}
                      labelFormatter={(y) => `${y}هـ`}
                    />
                    <Line type="monotone" dataKey="cumulative" stroke="hsl(190 80% 40%)" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="px-5 py-3 border-b font-bold text-sm">تفاصيل سنوية</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr className="text-right">
                  <th className="px-4 py-2.5 font-medium">السنة</th>
                  <th className="px-4 py-2.5 font-medium">عدد المساهمين</th>
                  <th className="px-4 py-2.5 font-medium">الإجمالي السنوي</th>
                  <th className="px-4 py-2.5 font-medium">التراكمي</th>
                </tr>
              </thead>
              <tbody>
                {aggregated.map((a) => (
                  <tr key={a.year} className="border-t hover:bg-muted/10">
                    <td className="px-4 py-2 font-semibold">{a.year}هـ</td>
                    <td className="px-4 py-2 tabular-nums">{a.count > 0 ? fmt(a.count) : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-2 tabular-nums font-bold text-amber-700 dark:text-amber-400">
                      {a.total > 0 ? `${fmt(a.total)} ر.س` : <span className="text-muted-foreground font-normal">—</span>}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">{fmt(a.cumulative)} ر.س</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BigCounter({
  label, value, sub, icon: Icon, tone,
}: { label: string; value: string; sub?: string; icon: any; tone: "amber" | "emerald" | "sky" | "rose" }) {
  const tones = {
    amber: "text-amber-700 bg-amber-500/15 ring-amber-500/20",
    emerald: "text-emerald-700 bg-emerald-500/15 ring-emerald-500/20",
    sky: "text-sky-700 bg-sky-500/15 ring-sky-500/20",
    rose: "text-rose-700 bg-rose-500/15 ring-rose-500/20",
  } as const;
  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p className="text-2xl font-black tabular-nums mt-1 truncate">{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">{sub}</p>}
        </div>
        <div className={`h-10 w-10 rounded-xl ring-1 flex items-center justify-center shrink-0 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return <div className="h-full w-full animate-pulse rounded-lg bg-muted/40" />;
}