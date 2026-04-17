import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { committeeByType } from "@/lib/committees";
import { Save, AlertTriangle, CheckCircle2, Settings2 } from "lucide-react";
import { toast } from "sonner";

interface Committee {
  id: string;
  name: string;
  type: string;
  budget_allocated: number;
  budget_spent: number;
  min_budget: number;
  max_budget: number;
}

interface Props {
  onTotalChange?: (total: number) => void;
}

const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(n);

export function CommitteeBudgetLimits({ onTotalChange }: Props) {
  const [coms, setComs] = useState<Committee[]>([]);
  const [edits, setEdits] = useState<Record<string, { min: number; max: number; allocated: number }>>({});

  const load = async () => {
    const { data } = await supabase
      .from("committees")
      .select("id, name, type, budget_allocated, budget_spent, min_budget, max_budget")
      .order("name");
    const list = (data ?? []) as Committee[];
    setComs(list);
    const e: Record<string, { min: number; max: number; allocated: number }> = {};
    list.forEach((c) => {
      e[c.id] = { min: Number(c.min_budget), max: Number(c.max_budget), allocated: Number(c.budget_allocated) };
    });
    setEdits(e);
    onTotalChange?.(list.reduce((a, c) => a + Number(c.budget_allocated), 0));
  };

  useEffect(() => { load(); }, []);

  const save = async (id: string) => {
    const e = edits[id];
    if (!e) return;
    if (e.max > 0 && e.min > e.max) return toast.error("الحد الأدنى أكبر من الحد الأعلى");
    if (e.max > 0 && e.allocated > e.max) return toast.error("المخصص يتجاوز الحد الأعلى");
    if (e.min > 0 && e.allocated < e.min) return toast.error("المخصص أقل من الحد الأدنى");
    const { error } = await supabase
      .from("committees")
      .update({ min_budget: e.min, max_budget: e.max, budget_allocated: e.allocated })
      .eq("id", id);
    if (error) return toast.error("تعذر الحفظ", { description: error.message });
    toast.success("تم تحديث المخصصات");
    load();
  };

  const totalAllocated = Object.values(edits).reduce((a, e) => a + e.allocated, 0);
  const totalMax = Object.values(edits).reduce((a, e) => a + e.max, 0);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border-2 border-gold/30 bg-gradient-to-br from-gold/5 to-primary/5 p-5">
        <div className="flex items-start gap-3">
          <Settings2 className="h-6 w-6 text-gold shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="font-bold">سقوف ومخصصات اللجان</h3>
            <p className="text-xs text-muted-foreground mt-1">
              حدد الحد الأدنى والأعلى لكل لجنة. يُمنع اعتماد طلبات صرف تتجاوز السقف الأعلى المعتمد للجنة.
            </p>
          </div>
          <div className="text-left">
            <p className="text-[10px] text-muted-foreground">إجمالي المخصصات</p>
            <p className="font-bold text-lg">{fmt(totalAllocated)} ر.س</p>
            <p className="text-[10px] text-muted-foreground">السقف الأعلى الكلي: {fmt(totalMax)} ر.س</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="text-right">
                <th className="px-4 py-3 font-medium">اللجنة</th>
                <th className="px-4 py-3 font-medium">الحد الأدنى</th>
                <th className="px-4 py-3 font-medium">المخصص</th>
                <th className="px-4 py-3 font-medium">الحد الأعلى</th>
                <th className="px-4 py-3 font-medium">المصروف</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">حفظ</th>
              </tr>
            </thead>
            <tbody>
              {coms.map((c) => {
                const meta = committeeByType(c.type);
                const Icon = meta?.icon;
                const e = edits[c.id] ?? { min: 0, max: 0, allocated: 0 };
                const pct = e.max > 0 ? (Number(c.budget_spent) / e.max) * 100 : 0;
                const overMax = e.max > 0 && e.allocated > e.max;
                const underMin = e.min > 0 && e.allocated < e.min;
                const ok = !overMax && !underMin;
                return (
                  <tr key={c.id} className="border-t hover:bg-muted/20">
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
                      <Input
                        type="number"
                        value={e.min}
                        onChange={(ev) => setEdits({ ...edits, [c.id]: { ...e, min: Number(ev.target.value) } })}
                        className="h-8 w-28"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        value={e.allocated}
                        onChange={(ev) => setEdits({ ...edits, [c.id]: { ...e, allocated: Number(ev.target.value) } })}
                        className={`h-8 w-28 ${overMax || underMin ? "border-rose-500" : ""}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        value={e.max}
                        onChange={(ev) => setEdits({ ...edits, [c.id]: { ...e, max: Number(ev.target.value) } })}
                        className="h-8 w-28"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p className="font-semibold text-xs">{fmt(Number(c.budget_spent))} ر.س</p>
                        {e.max > 0 && (
                          <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${pct > 90 ? "bg-rose-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {ok ? (
                        <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 gap-1">
                          <CheckCircle2 className="h-3 w-3" /> ضمن النطاق
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-rose-500/15 text-rose-700 border-rose-500/30 gap-1">
                          <AlertTriangle className="h-3 w-3" /> {overMax ? "تجاوز السقف" : "أقل من الأدنى"}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button size="sm" onClick={() => save(c.id)} className="gap-1 bg-gradient-hero text-primary-foreground">
                        <Save className="h-3.5 w-3.5" /> حفظ
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {coms.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">لا توجد لجان مسجلة</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
