import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(Math.round(n * 100) / 100);

interface Row {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  itemsSum: number;
  paidSum: number;
  allocDiff: number;
  spentDiff: number;
}

interface Props {
  canFix?: boolean;
  onFixed?: () => void;
}

export function FinanceReconciliationAlerts({ canFix = false, onFixed }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: coms }, { data: items }, { data: prs }] = await Promise.all([
      supabase.from("committees").select("id, name, budget_allocated, budget_spent"),
      supabase.from("budget_items").select("committee_id, total_cost"),
      supabase.from("payment_requests").select("committee_id, amount, status").eq("status", "paid"),
    ]);
    const itemsBy = new Map<string, number>();
    (items ?? []).forEach((r: any) =>
      itemsBy.set(r.committee_id, (itemsBy.get(r.committee_id) ?? 0) + Number(r.total_cost || 0)),
    );
    const paidBy = new Map<string, number>();
    (prs ?? []).forEach((r: any) =>
      paidBy.set(r.committee_id, (paidBy.get(r.committee_id) ?? 0) + Number(r.amount || 0)),
    );
    const list: Row[] = (coms ?? []).map((c: any) => {
      const allocated = Number(c.budget_allocated || 0);
      const spent = Number(c.budget_spent || 0);
      const itemsSum = itemsBy.get(c.id) ?? 0;
      const paidSum = paidBy.get(c.id) ?? 0;
      return {
        id: c.id,
        name: c.name,
        allocated,
        spent,
        itemsSum,
        paidSum,
        allocDiff: Math.round((allocated - itemsSum) * 100) / 100,
        spentDiff: Math.round((spent - paidSum) * 100) / 100,
      };
    });
    setRows(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const mismatches = rows.filter((r) => Math.abs(r.allocDiff) > 0.01 || Math.abs(r.spentDiff) > 0.01);

  const handleFix = async () => {
    setFixing(true);
    try {
      for (const r of mismatches) {
        const { error } = await supabase
          .from("committees")
          .update({ budget_allocated: r.itemsSum, budget_spent: r.paidSum })
          .eq("id", r.id);
        if (error) throw error;
      }
      toast.success("تمت مطابقة أرصدة اللجان مع البيانات الفعلية");
      await load();
      onFixed?.();
    } catch (e: any) {
      toast.error(e.message || "تعذّر الإصلاح");
    } finally {
      setFixing(false);
    }
  };

  if (loading) return null;

  if (mismatches.length === 0) {
    return (
      <div dir="rtl" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
            الربط المالي متطابق
          </p>
          <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
            لا يوجد فرق بين بنود الميزانية والمخصصات، ولا بين طلبات الصرف المدفوعة والمصروفات المسجلة.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-bl from-amber-500/10 to-rose-500/5 p-4 shadow-soft">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
          <AlertTriangle className="h-5 w-5 text-amber-700" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-amber-900 dark:text-amber-200">
            تنبيه: اختلاف في الربط المالي ({mismatches.length} لجنة)
          </h3>
          <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
            المخصص المخزّن لا يطابق مجموع بنود الميزانية، أو المصروف المخزّن لا يطابق طلبات الصرف المدفوعة فعلياً.
          </p>
        </div>
        {canFix && (
          <Button size="sm" onClick={handleFix} disabled={fixing} className="gap-2 shrink-0">
            <RefreshCw className={`h-3.5 w-3.5 ${fixing ? "animate-spin" : ""}`} />
            {fixing ? "جارٍ المطابقة..." : "مطابقة تلقائية"}
          </Button>
        )}
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="text-right">
                <th className="px-3 py-2 font-medium">اللجنة</th>
                <th className="px-3 py-2 font-medium">المخصّص</th>
                <th className="px-3 py-2 font-medium">مجموع البنود</th>
                <th className="px-3 py-2 font-medium">فرق التخصيص</th>
                <th className="px-3 py-2 font-medium">المصروف</th>
                <th className="px-3 py-2 font-medium">مدفوع فعلياً</th>
                <th className="px-3 py-2 font-medium">فرق الصرف</th>
              </tr>
            </thead>
            <tbody>
              {mismatches.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 font-semibold">{r.name}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(r.allocated)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(r.itemsSum)}</td>
                  <td className={`px-3 py-2 tabular-nums font-bold ${Math.abs(r.allocDiff) > 0.01 ? "text-rose-600" : "text-muted-foreground"}`}>
                    {r.allocDiff === 0 ? "—" : (r.allocDiff > 0 ? "+" : "") + fmt(r.allocDiff)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{fmt(r.spent)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(r.paidSum)}</td>
                  <td className={`px-3 py-2 tabular-nums font-bold ${Math.abs(r.spentDiff) > 0.01 ? "text-rose-600" : "text-muted-foreground"}`}>
                    {r.spentDiff === 0 ? "—" : (r.spentDiff > 0 ? "+" : "") + fmt(r.spentDiff)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}