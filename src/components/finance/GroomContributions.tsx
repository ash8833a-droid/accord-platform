import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { HeartHandshake, Calculator, AlertTriangle, CheckCircle2, Coins, TrendingDown } from "lucide-react";
import { toast } from "sonner";

const BASE_CONTRIBUTION = 10000;
const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(Math.round(n));

interface Groom {
  id: string;
  full_name: string;
  family_branch: string;
  status: string;
  groom_contribution: number;
  deficit_share: number;
  contribution_paid: boolean;
}

interface Props {
  totalCollected: number; // total subscriptions
  totalBudgetNeeded: number; // sum of committee budgets
}

export function GroomContributions({ totalCollected, totalBudgetNeeded }: Props) {
  const [grooms, setGrooms] = useState<Groom[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("grooms")
      .select("id, full_name, family_branch, status, groom_contribution, deficit_share, contribution_paid")
      .in("status", ["approved", "completed"])
      .order("full_name");
    setGrooms((data ?? []) as Groom[]);
  };

  useEffect(() => { load(); }, []);

  // Eligible grooms = approved or completed
  const eligible = grooms;
  const baseTotal = eligible.length * BASE_CONTRIBUTION;
  const totalAvailable = totalCollected + baseTotal;
  const deficit = Math.max(0, totalBudgetNeeded - totalAvailable);
  const perGroomExtra = eligible.length > 0 ? deficit / eligible.length : 0;
  const totalCollectedFromGrooms = grooms.reduce(
    (a, g) => a + (g.contribution_paid ? Number(g.groom_contribution) + Number(g.deficit_share) : 0),
    0,
  );

  const applyDistribution = async () => {
    if (eligible.length === 0) return toast.error("لا يوجد عرسان معتمدون لتوزيع العجز عليهم");
    const updates = eligible.map((g) =>
      supabase
        .from("grooms")
        .update({ groom_contribution: BASE_CONTRIBUTION, deficit_share: Math.round(perGroomExtra) })
        .eq("id", g.id),
    );
    const results = await Promise.all(updates);
    const fail = results.find((r) => r.error);
    if (fail?.error) return toast.error("تعذر التوزيع", { description: fail.error.message });
    toast.success(`تم توزيع ${fmt(deficit)} ر.س على ${eligible.length} عريس بالتساوي`);
    load();
  };

  const togglePaid = async (id: string, paid: boolean) => {
    await supabase.from("grooms").update({ contribution_paid: paid }).eq("id", id);
    load();
  };

  const updateGroomShare = async (id: string, field: "groom_contribution" | "deficit_share", v: number) => {
    await supabase.from("grooms").update({ [field]: v }).eq("id", id);
  };

  return (
    <div className="space-y-5">
      {/* Equation explanation */}
      <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-gold/5 p-5">
        <div className="flex items-start gap-3">
          <Calculator className="h-6 w-6 text-primary shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="font-bold">معادلة توزيع العجز</h3>
            <p className="text-xs text-muted-foreground mt-1">
              كل عريس يدفع <span className="font-bold text-primary">{fmt(BASE_CONTRIBUTION)} ر.س</span> كمقدم ثابت. عند وجود عجز،
              يُوزَّع المبلغ <span className="font-bold">بالتساوي</span> على جميع العرسان المعتمدين.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <KPI label="الميزانية المطلوبة" value={`${fmt(totalBudgetNeeded)} ر.س`} tone="amber" />
          <KPI label="المتوفر (اشتراكات + مقدم)" value={`${fmt(totalAvailable)} ر.س`} tone="emerald" />
          <KPI
            label="العجز"
            value={`${fmt(deficit)} ر.س`}
            tone={deficit > 0 ? "rose" : "emerald"}
            icon={deficit > 0 ? TrendingDown : CheckCircle2}
          />
          <KPI label="حصة كل عريس من العجز" value={`${fmt(perGroomExtra)} ر.س`} tone="primary" />
        </div>

        <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-muted-foreground">
            عدد العرسان المعتمدين: <span className="font-bold text-foreground">{eligible.length}</span>
            {" • "}
            إجمالي المحصّل من العرسان: <span className="font-bold text-foreground">{fmt(totalCollectedFromGrooms)} ر.س</span>
          </p>
          <Button onClick={applyDistribution} disabled={eligible.length === 0} className="bg-gradient-hero text-primary-foreground gap-2">
            <Calculator className="h-4 w-4" /> توزيع العجز بالتساوي
          </Button>
        </div>
      </div>

      {/* Grooms table */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-soft">
        <div className="px-5 py-4 border-b bg-gradient-to-l from-rose-500/5 to-transparent">
          <h3 className="font-bold flex items-center gap-2">
            <HeartHandshake className="h-4 w-4 text-rose-600" /> سجل مساهمات العرسان
          </h3>
          <p className="text-xs text-muted-foreground mt-1">يظهر هنا العرسان المعتمدون فقط</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="text-right">
                <th className="px-4 py-3 font-medium">العريس</th>
                <th className="px-4 py-3 font-medium">الفرع</th>
                <th className="px-4 py-3 font-medium">المقدم</th>
                <th className="px-4 py-3 font-medium">حصة العجز</th>
                <th className="px-4 py-3 font-medium">الإجمالي</th>
                <th className="px-4 py-3 font-medium">الدفع</th>
              </tr>
            </thead>
            <tbody>
              {grooms.map((g) => {
                const total = Number(g.groom_contribution) + Number(g.deficit_share);
                return (
                  <tr key={g.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{g.full_name}</td>
                    <td className="px-4 py-3"><Badge variant="outline" className="bg-primary/5">{g.family_branch}</Badge></td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        defaultValue={g.groom_contribution}
                        onBlur={(e) => updateGroomShare(g.id, "groom_contribution", Number(e.target.value))}
                        className="h-8 w-28"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        defaultValue={g.deficit_share}
                        onBlur={(e) => updateGroomShare(g.id, "deficit_share", Number(e.target.value))}
                        className="h-8 w-28"
                      />
                    </td>
                    <td className="px-4 py-3 font-bold">
                      <span className="inline-flex items-center gap-1">
                        <Coins className="h-3.5 w-3.5 text-gold" /> {fmt(total)} ر.س
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant={g.contribution_paid ? "default" : "outline"}
                        className={g.contribution_paid ? "bg-emerald-600 hover:bg-emerald-700 text-white gap-1" : "gap-1"}
                        onClick={() => togglePaid(g.id, !g.contribution_paid)}
                      >
                        {g.contribution_paid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                        {g.contribution_paid ? "مدفوع" : "غير مدفوع"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {grooms.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">
                  لا يوجد عرسان معتمدون بعد. اعتمد العرسان من سجل العرسان أولاً.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, tone, icon: Icon }: { label: string; value: string; tone: string; icon?: any }) {
  const map: Record<string, string> = {
    amber: "from-amber-500/15 to-amber-500/5 border-amber-500/30 text-amber-700",
    emerald: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/30 text-emerald-700",
    rose: "from-rose-500/15 to-rose-500/5 border-rose-500/30 text-rose-700",
    primary: "from-primary/15 to-primary/5 border-primary/30 text-primary",
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-3 ${map[tone]}`}>
      <p className="text-[10px] font-medium opacity-80">{label}</p>
      <p className="font-bold text-lg leading-tight mt-1 inline-flex items-center gap-1">
        {Icon && <Icon className="h-4 w-4" />} {value}
      </p>
    </div>
  );
}
