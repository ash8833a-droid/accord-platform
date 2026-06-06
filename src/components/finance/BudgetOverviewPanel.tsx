import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronLeft, FileSpreadsheet, Printer, Search, Wallet, Loader2, ArrowDownUp, Plus, Lock, Link2, Check } from "lucide-react";
import { exportBudgetXLSX, exportBudgetPDF } from "@/lib/budget-export";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BudgetItem {
  id: string;
  committee_id: string;
  item_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  notes: string | null;
  assigned_by_finance?: boolean | null;
}

interface Committee {
  id: string;
  name: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(Number(n) || 0);

export function BudgetOverviewPanel() {
  const { user } = useAuth();
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortDesc, setSortDesc] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [addCommitteeId, setAddCommitteeId] = useState<string>("");
  const [addItemName, setAddItemName] = useState("");
  const [addQuantity, setAddQuantity] = useState("");
  const [addUnitCost, setAddUnitCost] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyShareLink = async (e: React.MouseEvent, committeeId: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}/budget-entry/${committeeId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(committeeId);
      toast.success("تم نسخ رابط الإدخال", { description: "جاهز للإرسال عبر واتساب" });
      setTimeout(() => setCopiedId((c) => (c === committeeId ? null : c)), 2000);
    } catch {
      toast.error("تعذّر النسخ");
    }
  };

  const load = async () => {
    const [{ data: c }, { data: i, error }] = await Promise.all([
      supabase.from("committees").select("id, name").order("name"),
      supabase
        .from("budget_items" as any)
        .select("id, committee_id, item_name, quantity, unit_cost, total_cost, notes, assigned_by_finance")
        .order("created_at", { ascending: true }),
    ]);
    if (error) toast.error("تعذّر تحميل البيانات", { description: error.message });
    setCommittees((c ?? []) as Committee[]);
    setItems(((i ?? []) as unknown as BudgetItem[]));
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    load();
    const ch = supabase
      .channel("budget_items_overview")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "budget_items" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const cNameById = useMemo(() => new Map(committees.map((c) => [c.id, c.name])), [committees]);

  const filteredItems = useMemo(() => {
    const q = search.trim();
    return items.filter((r) => {
      if (selectedIds.size > 0 && !selectedIds.has(r.committee_id)) return false;
      if (q && !r.item_name.includes(q)) return false;
      return true;
    });
  }, [items, search, selectedIds]);

  const groups = useMemo(() => {
    const map = new Map<string, BudgetItem[]>();
    filteredItems.forEach((r) => {
      const arr = map.get(r.committee_id) ?? [];
      arr.push(r);
      map.set(r.committee_id, arr);
    });
    const list = Array.from(map.entries()).map(([cid, rows]) => ({
      committee_id: cid,
      committee_name: cNameById.get(cid) ?? "—",
      rows,
      total: rows.reduce((s, r) => s + Number(r.total_cost), 0),
    }));
    list.sort((a, b) => (sortDesc ? b.total - a.total : a.total - b.total));
    return list;
  }, [filteredItems, cNameById, sortDesc]);

  const overall = useMemo(
    () => groups.reduce((s, g) => s + g.total, 0),
    [groups],
  );

  const toggleCommittee = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const doExportXlsx = () =>
    exportBudgetXLSX({
      filename: "ميزانية-المشروع-الإجمالية",
      groups: groups.map((g) => ({ committee_name: g.committee_name, rows: g.rows })),
    });

  const doExportPdf = () =>
    exportBudgetPDF({
      title: "الميزانية الإجمالية لجميع اللجان",
      groups: groups.map((g) => ({ committee_name: g.committee_name, rows: g.rows })),
      filenamePrefix: "BUD-ALL",
    });

  const resetAddForm = () => {
    setAddCommitteeId("");
    setAddItemName("");
    setAddQuantity("");
    setAddUnitCost("");
    setAddNotes("");
  };

  const submitAdd = async () => {
    if (!addCommitteeId) return toast.error("اختر اللجنة المستهدفة");
    const name = addItemName.trim();
    const qty = Number(addQuantity);
    const unit = Number(addUnitCost);
    if (!name) return toast.error("اسم البند مطلوب");
    if (!(qty > 0)) return toast.error("الكمية يجب أن تكون أكبر من صفر");
    if (!(unit >= 0)) return toast.error("تكلفة الوحدة غير صحيحة");
    setSubmitting(true);
    const { error } = await supabase.from("budget_items" as any).insert({
      committee_id: addCommitteeId,
      item_name: name,
      quantity: qty,
      unit_cost: unit,
      notes: addNotes.trim() || null,
      assigned_by_finance: true,
      created_by: user?.id ?? null,
    } as any);
    setSubmitting(false);
    if (error) return toast.error("تعذّر إضافة البند", { description: error.message });
    toast.success("تمت إضافة البند للجنة المستهدفة");
    resetAddForm();
    setAddOpen(false);
  };

  const addDraftTotal = (Number(addQuantity) || 0) * (Number(addUnitCost) || 0);

  if (loading) {
    return (
      <div className="flex justify-center py-10 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      {/* Summary widget */}
      <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-l from-gold/10 via-primary/5 to-primary/10 p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="h-12 w-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
              <Wallet className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي ميزانية المشروع المطلوبة</p>
              <p className="text-2xl font-extrabold text-primary">{fmt(overall)} ر.س</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {filteredItems.length} بند · {groups.length} لجنة
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setAddOpen(true)}
              className="gap-1.5 bg-gradient-to-l from-primary to-gold text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> إضافة بند للجان
            </Button>
            <Button size="sm" variant="outline" onClick={doExportXlsx} className="gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>
            <Button size="sm" variant="outline" onClick={doExportPdf} className="gap-1.5">
              <Printer className="h-3.5 w-3.5" /> PDF موحّد
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث في أسماء البنود..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-3 pe-9"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSortDesc(!sortDesc)}
            className="gap-1.5"
          >
            <ArrowDownUp className="h-3.5 w-3.5" />
            {sortDesc ? "الأعلى تكلفة أولاً" : "الأقل تكلفة أولاً"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedIds(new Set())}
            className={`text-[11px] px-3 py-1 rounded-full border transition ${
              selectedIds.size === 0
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted"
            }`}
          >
            كل اللجان
          </button>
          {committees.map((c) => {
            const active = selectedIds.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCommittee(c.id)}
                className={`text-[11px] px-3 py-1 rounded-full border transition ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted"
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Aggregated table */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="text-right">
                <th className="px-3 py-3 font-medium w-8"></th>
                <th className="px-3 py-3 font-medium">اللجنة</th>
                <th className="px-3 py-3 font-medium w-24">عدد البنود</th>
                <th className="px-3 py-3 font-medium w-40">الإجمالي</th>
                <th className="px-3 py-3 font-medium w-32">النسبة من المشروع</th>
                <th className="px-3 py-3 font-medium w-32">مشاركة</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-muted-foreground text-xs">
                    لا توجد بنود ميزانية مطابقة للفلاتر
                  </td>
                </tr>
              )}
              {groups.map((g) => {
                const pct = overall > 0 ? (g.total / overall) * 100 : 0;
                const isOpen = expanded.has(g.committee_id);
                return (
                  <>
                    <tr
                      key={g.committee_id}
                      className="border-t hover:bg-muted/20 cursor-pointer"
                      onClick={() => toggleExpand(g.committee_id)}
                    >
                      <td className="px-3 py-3">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                        )}
                      </td>
                      <td className="px-3 py-3 font-medium">{g.committee_name}</td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className="font-mono">{g.rows.length}</Badge>
                      </td>
                      <td className="px-3 py-3 font-bold text-primary">{fmt(g.total)} ر.س</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-l from-gold to-primary"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <span className="text-[11px] tabular-nums w-10 text-left">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => copyShareLink(e, g.committee_id)}
                          className="h-8 gap-1 text-[11px] w-full"
                          title="نسخ رابط إدخال البنود (للمشاركة عبر واتساب)"
                        >
                          {copiedId === g.committee_id ? (
                            <><Check className="h-3 w-3 text-emerald-600" /> تم النسخ</>
                          ) : (
                            <><Link2 className="h-3 w-3" /> نسخ الرابط</>
                          )}
                        </Button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${g.committee_id}-detail`} className="bg-muted/10">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="rounded-lg border bg-card overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-muted/30 text-muted-foreground">
                                <tr className="text-right">
                                  <th className="px-3 py-2 font-medium w-8">#</th>
                                  <th className="px-3 py-2 font-medium">البند</th>
                                  <th className="px-3 py-2 font-medium w-20">الكمية</th>
                                  <th className="px-3 py-2 font-medium w-28">تكلفة الوحدة</th>
                                  <th className="px-3 py-2 font-medium w-28">الإجمالي</th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.rows.map((r, idx) => (
                                  <tr key={r.id} className="border-t">
                                    <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                                    <td className="px-3 py-2">
                                      <span className="inline-flex items-center gap-1.5">
                                        {r.item_name}
                                        {r.assigned_by_finance && (
                                          <span
                                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold/15 text-gold border border-gold/30 font-semibold inline-flex items-center gap-0.5"
                                            title="بند معتمد من اللجنة المالية"
                                          >
                                            <Lock className="h-2.5 w-2.5" /> مالية
                                          </span>
                                        )}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2">{fmt(Number(r.quantity))}</td>
                                    <td className="px-3 py-2">{fmt(Number(r.unit_cost))} ر.س</td>
                                    <td className="px-3 py-2 font-semibold text-primary">
                                      {fmt(Number(r.total_cost))} ر.س
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-primary/30 bg-gradient-to-l from-gold/10 to-primary/5">
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3 font-bold">الإجمالي العام للمشروع</td>
                <td className="px-3 py-3">
                  <Badge className="bg-primary text-primary-foreground">{filteredItems.length}</Badge>
                </td>
                <td className="px-3 py-3 font-extrabold text-lg text-primary">{fmt(overall)} ر.س</td>
                <td className="px-3 py-3 text-xs text-muted-foreground">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Add Item dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetAddForm(); }}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              إضافة بند ميزانية للجنة
            </DialogTitle>
            <DialogDescription>
              اختر اللجنة وأدخل تفاصيل البند. سيظهر البند فوراً في لوحة اللجنة المستهدفة مع شارة «مالية».
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>اللجنة المستهدفة</Label>
              <Select value={addCommitteeId} onValueChange={setAddCommitteeId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر اللجنة" />
                </SelectTrigger>
                <SelectContent>
                  {committees.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>اسم البند</Label>
              <Input value={addItemName} onChange={(e) => setAddItemName(e.target.value)} placeholder="مثال: طباعة كروت الدعوة" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>الكمية</Label>
                <Input type="number" min={0} step="0.01" value={addQuantity} onChange={(e) => setAddQuantity(e.target.value)} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>تكلفة الوحدة (ر.س)</Label>
                <Input type="number" min={0} step="0.01" value={addUnitCost} onChange={(e) => setAddUnitCost(e.target.value)} dir="ltr" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظات (اختياري)</Label>
              <Input value={addNotes} onChange={(e) => setAddNotes(e.target.value)} />
            </div>
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm flex items-center justify-between">
              <span className="text-muted-foreground">الإجمالي:</span>
              <span className="font-bold text-primary">{fmt(addDraftTotal)} ر.س</span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={submitting}>إلغاء</Button>
            <Button onClick={submitAdd} disabled={submitting} className="gap-1.5">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              حفظ البند
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}