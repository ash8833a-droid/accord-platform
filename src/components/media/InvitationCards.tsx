import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, Users, User, Printer, CheckCircle2, Clock, Calculator, Receipt, Loader2, Download, Sparkles } from "lucide-react";
import { toast } from "sonner";
import invitationMen from "@/assets/invitation-men.jpg";
import invitationWomen from "@/assets/invitation-women.jpg";

const DEFAULT_MEN = 50;
const DEFAULT_WOMEN = 30;
const DEFAULT_PRICE = 5;
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
  const [mediaCommitteeId, setMediaCommitteeId] = useState<string | null>(null);
  const [prOpen, setPrOpen] = useState(false);
  const [price, setPrice] = useState<number>(DEFAULT_PRICE);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const [{ data }, { data: c }] = await Promise.all([
      supabase
        .from("grooms")
        .select("id, full_name, family_branch, status, cards_men, cards_women, cards_printed")
        .order("created_at", { ascending: false }),
      supabase.from("committees").select("id").eq("type", "media").maybeSingle(),
    ]);
    setGrooms((data ?? []) as Groom[]);
    setMediaCommitteeId(c?.id ?? null);
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
  const totalAmount = totalCards * price;

  const submitPaymentRequest = async () => {
    if (!mediaCommitteeId) return toast.error("لم يتم العثور على اللجنة الإعلامية");
    if (totalCards === 0) return toast.error("لا توجد كروت لإصدار طلب صرف");
    if (price <= 0) return toast.error("سعر الكرت غير صحيح");
    setSubmitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("payment_requests").insert({
        committee_id: mediaCommitteeId,
        title: `طباعة كروت الدعوة (${fmt(totalCards)} كرت)`,
        amount: totalAmount,
        description: `طلب صرف تلقائي لطباعة كروت دعوة الزواج الجماعي.\n• عدد العرسان: ${grooms.length}\n• كروت رجال: ${fmt(totalMen)}\n• كروت نساء: ${fmt(totalWomen)}\n• إجمالي الكروت: ${fmt(totalCards)}\n• سعر الكرت: ${fmt(price)} ر.س\n• المعادلة: ${fmt(totalCards)} × ${fmt(price)} = ${fmt(totalAmount)} ر.س`,
        requested_by: u.user?.id,
      });
      if (error) {
        toast.error("تعذر إنشاء الطلب", { description: error.message });
        return;
      }
      toast.success("تم إنشاء طلب الصرف وإرساله للجنة المالية");
      setPrOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Official invitation designs */}
      <div className="rounded-2xl border-2 border-gold/30 bg-gradient-to-br from-gold/5 via-background to-primary/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-gold" />
          <h3 className="font-bold">التصميم الرسمي لكروت الدعوة</h3>
          <span className="text-xs text-muted-foreground">— يُعتمد كنموذج للطباعة</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            { src: invitationMen, label: "كرت دعوة الرجال", sub: "تصميم كلاسيكي فاخر بلون الزمرّد والذهب", file: "invitation-men.jpg", tone: "from-emerald-900/10 to-gold/10 border-emerald-700/30" },
            { src: invitationWomen, label: "كرت دعوة النساء", sub: "تصميم راقٍ بلون العاج والذهب الوردي", file: "invitation-women.jpg", tone: "from-rose-200/20 to-amber-100/20 border-rose-300/40" },
          ].map((c) => (
            <div key={c.file} className={`group relative rounded-xl border-2 bg-gradient-to-br ${c.tone} overflow-hidden transition-all hover:shadow-elegant`}>
              <div className="aspect-[2/3] overflow-hidden bg-muted/20">
                <img src={c.src} alt={c.label} loading="lazy" width={848} height={1264} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </div>
              <div className="p-4 bg-card/95 backdrop-blur border-t">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-sm">{c.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{c.sub}</p>
                  </div>
                  <a href={c.src} download={c.file} className="shrink-0">
                    <Button size="sm" variant="outline" className="gap-1 h-8">
                      <Download className="h-3.5 w-3.5" /> تحميل
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Equation card */}
      <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary-glow/5 p-5">
        <div className="flex items-start gap-3">
          <Calculator className="h-6 w-6 text-primary shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="font-bold">معادلة كروت الدعوة</h3>
            <p className="text-xs text-muted-foreground mt-1">
              لكل عريس <span className="font-bold text-primary">{DEFAULT_MEN} كرت رجال</span> + <span className="font-bold text-primary-glow">{DEFAULT_WOMEN} كرت نساء</span> كافتراضي.
              يمكن تعديل العدد لكل عريس حسب الحاجة.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <KPI label="إجمالي العرسان" value={String(grooms.length)} icon={Users} tone="primary" />
          <KPI label="كروت الرجال" value={fmt(totalMen)} icon={User} tone="teal" />
          <KPI label="كروت النساء" value={fmt(totalWomen)} icon={User} tone="tealLight" />
          <KPI label="إجمالي الكروت" value={fmt(totalCards)} icon={Mail} tone="gold" />
        </div>

        <div className="mt-4 flex items-center justify-between flex-wrap gap-2 text-xs text-muted-foreground">
          <p>تمت الطباعة لـ <span className="font-bold text-foreground">{printedCount}</span> من <span className="font-bold text-foreground">{grooms.length}</span> عريس</p>
          <p>المعادلة: <span className="font-mono">عدد العرسان × ({DEFAULT_MEN} + {DEFAULT_WOMEN}) = {fmt(grooms.length * (DEFAULT_MEN + DEFAULT_WOMEN))} كرت</span></p>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            onClick={() => setPrOpen(true)}
            disabled={totalCards === 0}
            className="gap-2 bg-gradient-to-r from-primary to-primary-glow text-primary-foreground hover:opacity-90"
          >
            <Receipt className="h-4 w-4" />
            إصدار طلب صرف لطباعة الكروت
          </Button>
        </div>
      </div>

      {/* Payment request dialog */}
      <Dialog open={prOpen} onOpenChange={setPrOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              إصدار طلب صرف لطباعة كروت الدعوة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>سعر الكرت الواحد (ر.س)</Label>
              <Input
                type="number"
                min={0.1}
                step="0.1"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                dir="ltr"
              />
            </div>
            <div className="rounded-xl border bg-muted/30 p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">عدد العرسان</span><span className="font-bold">{fmt(grooms.length)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">إجمالي كروت الرجال</span><span className="font-bold">{fmt(totalMen)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">إجمالي كروت النساء</span><span className="font-bold">{fmt(totalWomen)}</span></div>
              <div className="flex justify-between border-t pt-2"><span className="text-muted-foreground">إجمالي الكروت</span><span className="font-bold">{fmt(totalCards)} كرت</span></div>
              <div className="flex justify-between text-base"><span className="font-semibold">المبلغ الإجمالي</span><span className="font-bold text-primary">{fmt(totalAmount)} ر.س</span></div>
              <p className="text-xs text-muted-foreground pt-2 font-mono">{fmt(totalCards)} × {fmt(price)} = {fmt(totalAmount)} ر.س</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPrOpen(false)} disabled={submitting}>إلغاء</Button>
            <Button onClick={submitPaymentRequest} disabled={submitting} className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground">
              {submitting ? <Loader2 className="h-4 w-4 ms-1 animate-spin" /> : <Receipt className="h-4 w-4 ms-1" />}
              {submitting ? "جاري الإرسال..." : "إرسال للجنة المالية"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grooms table */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-soft">
        <div className="px-5 py-4 border-b bg-gradient-to-l from-primary/5 to-transparent">
          <h3 className="font-bold flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" /> توزيع كروت الدعوة على العرسان
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
              <tfoot className="bg-gradient-to-l from-primary/10 to-primary-glow/10 font-bold">
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
    teal: "from-primary/15 to-primary/5 border-primary/30 text-primary",
    tealLight: "from-primary-glow/15 to-primary-glow/5 border-primary-glow/30 text-primary",
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
