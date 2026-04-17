import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mail, Users, User, Printer, CheckCircle2, Clock, Calculator } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_MEN = 50;
const DEFAULT_WOMEN = 30;
const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(n);

interface Groom {
  id: string;
  full_name: string;
  family_branch: string;
  status: string;
  cards_men: number;
  cards_women: number;
  cards_printed: boolean;
}

export function InvitationCards() {
  const [grooms, setGrooms] = useState<Groom[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("grooms")
      .select("id, full_name, family_branch, status, cards_men, cards_women, cards_printed")
      .order("created_at", { ascending: false });
    setGrooms((data ?? []) as Groom[]);
  };

  useEffect(() => { load(); }, []);

  const updateCards = async (id: string, field: "cards_men" | "cards_women", v: number) => {
    const payload = field === "cards_men" ? { cards_men: v } : { cards_women: v };
    await supabase.from("grooms").update(payload).eq("id", id);
  };

  const togglePrinted = async (id: string, printed: boolean) => {
    await supabase.from("grooms").update({ cards_printed: printed }).eq("id", id);
    load();
  };

  const totalMen = grooms.reduce((a, g) => a + Number(g.cards_men), 0);
  const totalWomen = grooms.reduce((a, g) => a + Number(g.cards_women), 0);
  const totalCards = totalMen + totalWomen;
  const printedCount = grooms.filter((g) => g.cards_printed).length;

  return (
    <div className="space-y-5">
      {/* Equation card */}
      <div className="rounded-2xl border-2 border-rose-500/30 bg-gradient-to-br from-rose-500/5 to-pink-500/5 p-5">
        <div className="flex items-start gap-3">
          <Calculator className="h-6 w-6 text-rose-600 shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="font-bold">معادلة كروت الدعوة</h3>
            <p className="text-xs text-muted-foreground mt-1">
              لكل عريس <span className="font-bold text-rose-700">{DEFAULT_MEN} كرت رجال</span> + <span className="font-bold text-pink-700">{DEFAULT_WOMEN} كرت نساء</span> كافتراضي.
              يمكن تعديل العدد لكل عريس حسب الحاجة.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <KPI label="إجمالي العرسان" value={String(grooms.length)} icon={Users} tone="primary" />
          <KPI label="كروت الرجال" value={fmt(totalMen)} icon={User} tone="rose" />
          <KPI label="كروت النساء" value={fmt(totalWomen)} icon={User} tone="pink" />
          <KPI label="إجمالي الكروت" value={fmt(totalCards)} icon={Mail} tone="gold" />
        </div>

        <div className="mt-4 flex items-center justify-between flex-wrap gap-2 text-xs text-muted-foreground">
          <p>تمت الطباعة لـ <span className="font-bold text-foreground">{printedCount}</span> من <span className="font-bold text-foreground">{grooms.length}</span> عريس</p>
          <p>المعادلة: <span className="font-mono">عدد العرسان × ({DEFAULT_MEN} + {DEFAULT_WOMEN}) = {fmt(grooms.length * (DEFAULT_MEN + DEFAULT_WOMEN))} كرت</span></p>
        </div>
      </div>

      {/* Grooms table */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-soft">
        <div className="px-5 py-4 border-b bg-gradient-to-l from-rose-500/5 to-transparent">
          <h3 className="font-bold flex items-center gap-2">
            <Mail className="h-4 w-4 text-rose-600" /> توزيع كروت الدعوة على العرسان
          </h3>
          <p className="text-xs text-muted-foreground mt-1">عدّل العدد لكل عريس عند الحاجة وحدّد حالة الطباعة</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="text-right">
                <th className="px-4 py-3 font-medium">العريس</th>
                <th className="px-4 py-3 font-medium">الفرع</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">كروت رجال</th>
                <th className="px-4 py-3 font-medium">كروت نساء</th>
                <th className="px-4 py-3 font-medium">الإجمالي</th>
                <th className="px-4 py-3 font-medium">الطباعة</th>
              </tr>
            </thead>
            <tbody>
              {grooms.map((g) => {
                const total = Number(g.cards_men) + Number(g.cards_women);
                const statusMap: Record<string, { label: string; cls: string }> = {
                  new: { label: "جديد", cls: "bg-muted text-foreground" },
                  under_review: { label: "قيد المراجعة", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
                  approved: { label: "معتمد", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
                  rejected: { label: "مرفوض", cls: "bg-rose-500/15 text-rose-700 border-rose-500/30" },
                  completed: { label: "مكتمل", cls: "bg-gold/15 text-gold-foreground border-gold/30" },
                };
                const s = statusMap[g.status] ?? statusMap.new;
                return (
                  <tr key={g.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{g.full_name}</td>
                    <td className="px-4 py-3"><Badge variant="outline" className="bg-primary/5">{g.family_branch}</Badge></td>
                    <td className="px-4 py-3"><Badge variant="outline" className={s.cls}>{s.label}</Badge></td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        min={0}
                        defaultValue={g.cards_men}
                        onBlur={(e) => updateCards(g.id, "cards_men", Number(e.target.value))}
                        className="h-8 w-24"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        min={0}
                        defaultValue={g.cards_women}
                        onBlur={(e) => updateCards(g.id, "cards_women", Number(e.target.value))}
                        className="h-8 w-24"
                      />
                    </td>
                    <td className="px-4 py-3 font-bold">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5 text-gold" /> {fmt(total)} كرت
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant={g.cards_printed ? "default" : "outline"}
                        className={g.cards_printed ? "bg-emerald-600 hover:bg-emerald-700 text-white gap-1" : "gap-1"}
                        onClick={() => togglePrinted(g.id, !g.cards_printed)}
                      >
                        {g.cards_printed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                        {g.cards_printed ? "مطبوعة" : "بانتظار الطباعة"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {grooms.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">
                  <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  لا يوجد عرسان مسجلون بعد. ستظهر الكروت تلقائياً عند تسجيل أي عريس.
                </td></tr>
              )}
            </tbody>
            {grooms.length > 0 && (
              <tfoot className="bg-gradient-to-l from-rose-500/10 to-pink-500/10 font-bold">
                <tr>
                  <td className="px-4 py-3" colSpan={3}>الإجمالي</td>
                  <td className="px-4 py-3">{fmt(totalMen)}</td>
                  <td className="px-4 py-3">{fmt(totalWomen)}</td>
                  <td className="px-4 py-3 inline-flex items-center gap-1"><Printer className="h-3.5 w-3.5" /> {fmt(totalCards)} كرت</td>
                  <td className="px-4 py-3">{printedCount}/{grooms.length}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: string }) {
  const map: Record<string, string> = {
    primary: "from-primary/15 to-primary/5 border-primary/30 text-primary",
    rose: "from-rose-500/15 to-rose-500/5 border-rose-500/30 text-rose-700",
    pink: "from-pink-500/15 to-pink-500/5 border-pink-500/30 text-pink-700",
    gold: "from-gold/15 to-gold/5 border-gold/30 text-gold-foreground",
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-3 ${map[tone]}`}>
      <p className="text-[10px] font-medium opacity-80">{label}</p>
      <p className="font-bold text-lg leading-tight mt-1 inline-flex items-center gap-1">
        <Icon className="h-4 w-4" /> {value}
      </p>
    </div>
  );
}
