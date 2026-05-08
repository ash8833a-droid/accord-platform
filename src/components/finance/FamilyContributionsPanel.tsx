import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  HandCoins, Plus, Trash2, Loader2, Calendar, User, TrendingUp,
} from "lucide-react";

const schema = z.object({
  donor_name: z.string().trim().min(2, "اسم المتبرع قصير جداً").max(120, "الاسم طويل جداً"),
  amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر").max(100000000, "مبلغ غير منطقي"),
  contribution_date: z.string().min(8, "أدخل تاريخاً صحيحاً"),
  notes: z.string().trim().max(500, "الملاحظات طويلة").optional().or(z.literal("")),
});

interface Row {
  id: string;
  donor_name: string;
  amount: number;
  contribution_date: string;
  notes: string | null;
  created_at: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat("ar-SA").format(n);
}

export function FamilyContributionsPanel() {
  const { user, hasRole } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [donor, setDonor] = useState("");
  const [amount, setAmount] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");

  const canDelete = hasRole("admin");

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    const ch = supabase
      .channel("family-contrib-rt")
      .on("postgres_changes",
          { event: "*", schema: "public", table: "family_contributions" },
          () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("family_contributions")
      .select("id, donor_name, amount, contribution_date, notes, created_at")
      .order("contribution_date", { ascending: false })
      .limit(500);
    if (error) toast.error("تعذّر تحميل المساهمات");
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }

  const total = useMemo(() => rows.reduce((s, r) => s + Number(r.amount || 0), 0), [rows]);
  const monthTotal = useMemo(() => {
    const m = new Date().toISOString().slice(0, 7);
    return rows
      .filter((r) => r.contribution_date.startsWith(m))
      .reduce((s, r) => s + Number(r.amount || 0), 0);
  }, [rows]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({
      donor_name: donor, amount, contribution_date: date, notes,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("family_contributions").insert({
      donor_name: parsed.data.donor_name,
      amount: parsed.data.amount,
      contribution_date: parsed.data.contribution_date,
      notes: parsed.data.notes || null,
      recorded_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast.error("تعذّر حفظ المساهمة");
      return;
    }
    toast.success("تم تسجيل المساهمة");
    setDonor(""); setAmount(""); setNotes(""); setDate(today);
  }

  async function remove(id: string) {
    if (!confirm("حذف هذه المساهمة؟")) return;
    const { error } = await supabase.from("family_contributions").delete().eq("id", id);
    if (error) toast.error("تعذّر الحذف");
    else toast.success("تم الحذف");
  }

  return (
    <div className="space-y-5" dir="rtl">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiTile label="إجمالي مساهمات أفراد العائلة" value={`${fmt(total)} ر.س`} icon={HandCoins} accent="emerald" />
        <KpiTile label="مساهمات هذا الشهر" value={`${fmt(monthTotal)} ر.س`} icon={TrendingUp} accent="teal" />
        <KpiTile label="عدد المساهمات" value={String(rows.length)} icon={User} accent="sky" />
      </div>

      <Card className="border-emerald-500/20">
        <CardContent className="p-5">
          <h3 className="font-bold flex items-center gap-2 mb-4 text-emerald-700 dark:text-emerald-400">
            <Plus className="h-4 w-4" /> تسجيل مساهمة جديدة
          </h3>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-1">
              <Label htmlFor="donor">اسم المتبرع</Label>
              <Input id="donor" value={donor} onChange={(e) => setDonor(e.target.value)}
                maxLength={120} required placeholder="الاسم الكامل" />
            </div>
            <div>
              <Label htmlFor="amount">المبلغ (ر.س)</Label>
              <Input id="amount" type="number" min={1} step="1" value={amount}
                onChange={(e) => setAmount(e.target.value)} required placeholder="0" />
            </div>
            <div>
              <Label htmlFor="date">التاريخ</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="md:col-span-1 flex items-end">
              <Button type="submit" disabled={saving}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                حفظ
              </Button>
            </div>
            <div className="md:col-span-4">
              <Label htmlFor="notes">ملاحظات (اختياري)</Label>
              <Textarea id="notes" value={notes} maxLength={500}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات حول المساهمة" rows={2} />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="px-5 py-3 border-b font-bold flex items-center gap-2">
            <HandCoins className="h-4 w-4 text-emerald-600" /> سجل المساهمات
          </div>
          {loading ? (
            <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : rows.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">لا توجد مساهمات مسجّلة بعد</p>
          ) : (
            <div className="divide-y">
              {rows.map((r) => (
                <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-muted/30">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{r.donor_name}</span>
                      <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(r.contribution_date).toLocaleDateString("ar-SA-u-ca-gregory")}
                      </span>
                    </div>
                    {r.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{r.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {fmt(Number(r.amount))} ر.س
                    </span>
                    {canDelete && (
                      <Button variant="ghost" size="icon" onClick={() => void remove(r.id)}
                        className="text-rose-600 hover:text-rose-700 h-8 w-8">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiTile({ label, value, icon: Icon, accent }: { label: string; value: string; icon: any; accent: "emerald" | "teal" | "sky" }) {
  const tones: Record<string, string> = {
    emerald: "from-emerald-500/15 to-emerald-500/0 text-emerald-600 ring-emerald-500/20",
    teal: "from-teal-500/15 to-teal-500/0 text-teal-600 ring-teal-500/20",
    sky: "from-sky-500/15 to-sky-500/0 text-sky-600 ring-sky-500/20",
  };
  const ring = tones[accent].split(" ").find((c) => c.startsWith("ring-"));
  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${tones[accent]} bg-card p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-2xl font-extrabold tabular-nums">{value}</p>
        </div>
        <div className={`h-10 w-10 rounded-xl bg-background/70 ring-1 ${ring} flex items-center justify-center`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}