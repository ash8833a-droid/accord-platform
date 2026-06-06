import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ChevronDown, Loader2, Lock, Pencil, Plus, Save, ShieldCheck, Trash2, Wallet, X } from "lucide-react";
import { toast, Toaster } from "sonner";

interface Committee {
  id: string;
  name: string;
  type?: string;
}

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

type Draft = { item_name: string; quantity: string; unit_cost: string; notes: string };
type BudgetEntrySearch = { committee?: string };

const EMPTY: Draft = { item_name: "", quantity: "", unit_cost: "", notes: "" };

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(Number(n) || 0);

function UnifiedBudgetEntryPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { committee: committeeFromUrl } = Route.useSearch();
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY);

  const selectedCommittee = useMemo(
    () => committees.find((c) => c.id === committeeFromUrl),
    [committees, committeeFromUrl],
  );

  const loadCommittees = async () => {
    const { data, error } = await supabase.rpc("get_public_committees" as any);
    if (error) {
      toast.error("تعذّر تحميل اللجان", { description: error.message });
      setLoading(false);
      return;
    }
    const rows = Array.isArray(data) ? data : [];
    const list = rows
      .map((row: any) => ({ id: row.id, name: row.name, type: row.type }))
      .filter((row: Committee) => row.id && row.name);
    setCommittees(list);
    setLoading(false);
  };

  const loadItems = async (committeeId: string) => {
    setItemsLoading(true);
    const { data, error } = await supabase.rpc("public_get_budget_for_committee" as any, {
      _committee_id: committeeId,
    });
    setItemsLoading(false);
    if (error) {
      toast.error("تعذّر تحميل البنود", { description: error.message });
      return;
    }
    const payload = data as any;
    setItems((payload?.items ?? []) as BudgetItem[]);
  };

  useEffect(() => {
    loadCommittees();
  }, []);

  useEffect(() => {
    if (!committeeFromUrl) {
      setItems([]);
      return;
    }
    loadItems(committeeFromUrl);
    const channel = supabase
      .channel(`unified_budget_${committeeFromUrl}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "budget_items", filter: `committee_id=eq.${committeeFromUrl}` },
        () => loadItems(committeeFromUrl),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [committeeFromUrl]);

  const selectCommittee = (committeeId: string) => {
    setDraft(EMPTY);
    setEditingId(null);
    navigate({ to: ".", search: { committee: committeeId }, replace: true });
  };

  const grandTotal = useMemo(
    () => items.reduce((s, r) => s + Number(r.total_cost), 0),
    [items],
  );

  const validateDraft = (d: Draft) => {
    const name = d.item_name.trim();
    const qty = Number(d.quantity);
    const unit = Number(d.unit_cost);
    if (!name) return "اسم البند مطلوب";
    if (!(qty > 0)) return "الكمية يجب أن تكون أكبر من صفر";
    if (!(unit >= 0)) return "تكلفة الوحدة غير صحيحة";
    return null;
  };

  const handleAdd = async () => {
    if (!committeeFromUrl) return toast.error("اختر اللجنة أولاً");
    const err = validateDraft(draft);
    if (err) return toast.error(err);
    setAdding(true);
    const { error } = await supabase.rpc("public_add_budget_item" as any, {
      _committee_id: committeeFromUrl,
      _item_name: draft.item_name.trim(),
      _quantity: Number(draft.quantity),
      _unit_cost: Number(draft.unit_cost),
      _notes: draft.notes.trim() || null,
    });
    setAdding(false);
    if (error) return toast.error("تعذّر الإضافة", { description: error.message });
    toast.success("تمت إضافة البند");
    setDraft(EMPTY);
  };

  const startEdit = (it: BudgetItem) => {
    setEditingId(it.id);
    setEditDraft({
      item_name: it.item_name,
      quantity: String(it.quantity),
      unit_cost: String(it.unit_cost),
      notes: it.notes ?? "",
    });
  };

  const saveEdit = async () => {
    if (!editingId || !committeeFromUrl) return;
    const err = validateDraft(editDraft);
    if (err) return toast.error(err);
    const { error } = await supabase.rpc("public_update_budget_item" as any, {
      _item_id: editingId,
      _committee_id: committeeFromUrl,
      _item_name: editDraft.item_name.trim(),
      _quantity: Number(editDraft.quantity),
      _unit_cost: Number(editDraft.unit_cost),
      _notes: editDraft.notes.trim() || null,
    });
    if (error) return toast.error("تعذّر التحديث", { description: error.message });
    toast.success("تم الحفظ");
    setEditingId(null);
  };

  const remove = async (it: BudgetItem) => {
    if (!committeeFromUrl) return;
    if (it.assigned_by_finance) return toast.error("لا يمكن حذف بند معتمد من اللجنة المالية");
    if (!confirm(`حذف البند "${it.item_name}"؟`)) return;
    const { error } = await supabase.rpc("public_delete_budget_item" as any, {
      _item_id: it.id,
      _committee_id: committeeFromUrl,
    });
    if (error) return toast.error("تعذّر الحذف", { description: error.message });
    toast.success("تم الحذف");
  };

  const draftTotal = (Number(draft.quantity) || 0) * (Number(draft.unit_cost) || 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background pb-32" dir="rtl">
      <Toaster richColors position="top-center" dir="rtl" />

      <header className="bg-gradient-to-l from-primary to-gold text-primary-foreground px-4 py-5 shadow-md">
        <div className="max-w-xl mx-auto space-y-3">
          <div className="flex items-center gap-3">
            <span className="h-11 w-11 rounded-2xl bg-primary-foreground/15 flex items-center justify-center">
              <Wallet className="h-5 w-5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] opacity-80">رابط موحّد لإدخال ميزانيات اللجان</p>
              <h1 className="text-base font-extrabold truncate">
                {selectedCommittee ? selectedCommittee.name : "اختر لجنتك"}
              </h1>
            </div>
          </div>
          <div className="flex items-start gap-1.5 text-[11px] opacity-90">
            <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>بعد اختيار اللجنة، القراءة والتعديل تكون على بنود هذه اللجنة فقط وتظهر فوراً لدى المالية.</span>
          </div>
        </div>
      </header>

      <main className="px-3 pt-4 space-y-4 max-w-xl mx-auto">
        <Card className="border-primary/20">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold text-sm">اختيار اللجنة</h2>
              {selectedCommittee && <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> محددة</Badge>}
            </div>
            <div className="relative">
              <select
                value={committeeFromUrl ?? ""}
                onChange={(event) => selectCommittee(event.target.value)}
                className="h-12 w-full appearance-none rounded-lg border border-input bg-background px-3 py-2 pe-9 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="" disabled>اختر اسم لجنتك</option>
                {committees.map((committee) => (
                  <option key={committee.id} value={committee.id}>{committee.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {selectedCommittee && (
          <>
            <Card className="border-primary/20">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" />
                  <h2 className="font-bold text-sm">إضافة بند جديد</h2>
                </div>
                <Input placeholder="اسم البند" value={draft.item_name} onChange={(e) => setDraft({ ...draft, item_name: e.target.value })} className="h-11" />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" inputMode="decimal" placeholder="الكمية" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} className="h-11" dir="ltr" />
                  <Input type="number" inputMode="decimal" placeholder="تكلفة الوحدة" value={draft.unit_cost} onChange={(e) => setDraft({ ...draft, unit_cost: e.target.value })} className="h-11" dir="ltr" />
                </div>
                <Input placeholder="ملاحظات (اختياري)" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="h-11" />
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">الإجمالي: <span className="font-bold text-primary">{fmt(draftTotal)} ر.س</span></span>
                  <Button onClick={handleAdd} disabled={adding} className="gap-1.5 bg-gradient-to-l from-primary to-gold text-primary-foreground">
                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    إضافة البند
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold">البنود المضافة ({items.length})</h3>
                {itemsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              {items.length === 0 && !itemsLoading && (
                <Card>
                  <CardContent className="p-6 text-center text-xs text-muted-foreground">لا توجد بنود مضافة بعد.</CardContent>
                </Card>
              )}
              {items.map((it, idx) => {
                const isEditing = editingId === it.id;
                const locked = !!it.assigned_by_finance;
                return (
                  <Card key={it.id} className={locked ? "border-gold/40 bg-gold/5" : ""}>
                    <CardContent className="p-3 space-y-2">
                      {isEditing ? (
                        <>
                          <Input value={editDraft.item_name} onChange={(e) => setEditDraft({ ...editDraft, item_name: e.target.value })} className="h-10" />
                          <div className="grid grid-cols-2 gap-2">
                            <Input type="number" inputMode="decimal" value={editDraft.quantity} onChange={(e) => setEditDraft({ ...editDraft, quantity: e.target.value })} className="h-10" dir="ltr" />
                            <Input type="number" inputMode="decimal" value={editDraft.unit_cost} onChange={(e) => setEditDraft({ ...editDraft, unit_cost: e.target.value })} className="h-10" dir="ltr" />
                          </div>
                          <Input placeholder="ملاحظات" value={editDraft.notes} onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })} className="h-10" />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={saveEdit} className="flex-1 gap-1"><Save className="h-3.5 w-3.5" /> حفظ</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="gap-1"><X className="h-3.5 w-3.5" /> إلغاء</Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] text-muted-foreground">#{idx + 1}</span>
                                <h4 className="font-bold text-sm">{it.item_name}</h4>
                                {locked && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold/15 text-gold border border-gold/30 font-semibold inline-flex items-center gap-0.5">
                                    <Lock className="h-2.5 w-2.5" /> مالية
                                  </span>
                                )}
                              </div>
                              {it.notes && <p className="text-[11px] text-muted-foreground mt-1">{it.notes}</p>}
                            </div>
                            {!locked && (
                              <div className="flex items-center gap-1">
                                <button onClick={() => startEdit(it)} className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-primary/10 text-primary" aria-label="تعديل">
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button onClick={() => remove(it)} className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-destructive/10 text-destructive" aria-label="حذف">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center text-[11px] bg-muted/30 rounded-lg p-2">
                            <div><div className="text-muted-foreground">الكمية</div><div className="font-semibold">{fmt(it.quantity)}</div></div>
                            <div><div className="text-muted-foreground">سعر الوحدة</div><div className="font-semibold">{fmt(it.unit_cost)} ر.س</div></div>
                            <div><div className="text-muted-foreground">الإجمالي</div><div className="font-bold text-primary">{fmt(it.total_cost)} ر.س</div></div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </main>

      {selectedCommittee && (
        <div className="fixed bottom-0 inset-x-0 bg-card border-t-2 border-primary/30 shadow-2xl px-4 py-3 z-50">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground">الإجمالي الكلي</p>
              <p className="text-xl font-extrabold text-primary">{fmt(grandTotal)} ر.س</p>
            </div>
            <div className="text-[10px] text-muted-foreground text-left">
              {items.length} بند<br />
              <span className="text-primary">مزامنة مباشرة ✓</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/budget-entry")({
  validateSearch: (search: Record<string, unknown>): BudgetEntrySearch => ({
    committee: typeof search.committee === "string" ? search.committee : undefined,
  }),
  component: UnifiedBudgetEntryPage,
});