import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { committeeByType } from "@/lib/committees";
import { Settings2 } from "lucide-react";

interface Committee {
  id: string;
  name: string;
  type: string;
  budget_allocated: number;
  budget_spent: number;
}

interface Props {
  onTotalChange?: (total: number) => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(n);
const pctFmt = (n: number) =>
  new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 1 }).format(n);

export function CommitteeBudgetLimits({ onTotalChange }: Props) {
  const [coms, setComs] = useState<Committee[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("committees")
      .select("id, name, type, budget_allocated, budget_spent")
      .order("name");
    const list = (data ?? []) as Committee[];
    setComs(list);
    onTotalChange?.(list.reduce((a, c) => a + Number(c.budget_allocated), 0));
  };

  useEffect(() => { load(); }, []);

  const totalAllocated = coms.reduce((a, c) => a + Number(c.budget_allocated), 0);
  const totalSpent = coms.reduce((a, c) => a + Number(c.budget_spent), 0);
  const totalRemaining = totalAllocated - totalSpent;
  const totalPct = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border-2 border-gold/30 bg-gradient-to-br from-gold/5 to-primary/5 p-5">
        <div className="flex items-start gap-3">
          <Settings2 className="h-6 w-6 text-gold shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="font-bold">ميزانيات اللجان</h3>
            <p className="text-xs text-muted-foreground mt-1">
              يتم احتساب الرصيد المتبقي ونسبة الصرف تلقائيًا من الميزانية المعتمدة والمصروف الفعلي.
            </p>
          </div>
          <div className="text-left">
            <p className="text-[10px] text-muted-foreground">إجمالي الميزانية المعتمدة</p>
            <p className="font-bold text-lg">{fmt(totalAllocated)} ر.س</p>
            <p className="text-[10px] text-muted-foreground">
              إجمالي المصروف الفعلي: {fmt(totalSpent)} ر.س
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="text-right">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">اللجنة</th>
                <th className="px-4 py-3 font-medium">الميزانية المعتمدة (ر.س)</th>
                <th className="px-4 py-3 font-medium">المصروف الفعلي (ر.س)</th>
                <th className="px-4 py-3 font-medium">الرصيد المتبقي (ر.س)</th>
                <th className="px-4 py-3 font-medium">نسبة الصرف</th>
              </tr>
            </thead>
            <tbody>
              {coms.map((c, idx) => {
                const meta = committeeByType(c.type);
                const Icon = meta?.icon;
                const allocated = Number(c.budget_allocated);
                const spent = Number(c.budget_spent);
                const remaining = allocated - spent;
                const pct = allocated > 0 ? (spent / allocated) * 100 : 0;
                return (
                  <tr key={c.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {Icon && (
                          <span className={`h-8 w-8 rounded-lg flex items-center justify-center ${meta!.tone}`}>
                            <Icon className="h-4 w-4" />
                          </span>
                        )}
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-md bg-muted px-3 py-1.5 text-sm font-medium">
                        {fmt(allocated)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-md bg-muted px-3 py-1.5 text-sm font-medium">
                        {fmt(spent)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-md px-3 py-1.5 text-sm font-medium ${remaining === 0 ? "bg-muted" : remaining < 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {fmt(remaining)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1 min-w-[110px]">
                        <p className="font-semibold text-xs">{pctFmt(pct)}%</p>
                        <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {coms.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">لا توجد لجان مسجلة</td></tr>
              )}
              {coms.length > 0 && (
                <tr className="border-t-2 bg-gold/5 font-bold">
                  <td className="px-4 py-3" colSpan={2}>الإجمالي</td>
                  <td className="px-4 py-3">{fmt(totalAllocated)} ر.س</td>
                  <td className="px-4 py-3">{fmt(totalSpent)} ر.س</td>
                  <td className="px-4 py-3">{fmt(totalRemaining)} ر.س</td>
                  <td className="px-4 py-3">{pctFmt(totalPct)}%</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
