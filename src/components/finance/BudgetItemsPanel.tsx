import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Save, Pencil, Trash2, X, FileSpreadsheet, Printer, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { exportBudgetXLSX, exportBudgetPDF } from "@/lib/budget-export";

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

interface Props {
  committeeId: string;
  committeeName: string;
  /** When false, hides Add/Edit/Delete controls. */
  canEdit?: boolean;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(Number(n) || 0);

const itemSchema = z.object({
  item_name: z.string().trim().min(1, "اسم البند مطلوب").max(255),
  quantity: z.number().positive("الكمية يجب أن تكون أكبر من صفر"),
  unit_cost: z.number().min(0, "تكلفة الوحدة لا يمكن أن تكون سالبة"),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

type Draft = {
  item_name: string;
  quantity: string;
  unit_cost: string;
  notes: string;
};

const EMPTY: Draft = { item_name: "", quantity: "", unit_cost: "", notes: "" };

export function BudgetItemsPanel({ committeeId, committeeName, canEdit = true }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY);

  const load = async () => {
    const { data, error } = await supabase
      .from("budget_items" as any)
      .select("id, committee_id, item_name, quantity, unit_cost, total_cost, notes, assigned_by_finance")
      .eq("committee_id", committeeId)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("تعذّر تحميل بنود الميزانية", { description: error.message });
      setItems([]);
    } else {
      setItems((data ?? []) as unknown as BudgetItem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    load();
    // realtime updates for this committee
    const ch = supabase
      .channel(`budget_items_${committeeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "budget_items", filter: `committee_id=eq.${committeeId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committeeId]);

  const grandTotal = useMemo(
    () => items.reduce((s, r) => s + Number(r.total_cost), 0),
    [items],
  );

  const parseDraft = (d: Draft) =>
    itemSchema.safeParse({
      item_name: d.item_name,
      quantity: Number(d.quantity),
      unit_cost: Number(d.unit_cost),
      notes: d.notes,
    });

  const handleAdd = async () => {
    const parsed = parseDraft(draft);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "بيانات غير صحيحة");
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("budget_items" as any).insert({
      committee_id: committeeId,
      item_name: parsed.data.item_name,
      quantity: parsed.data.quantity,
      unit_cost: parsed.data.unit_cost,
      notes: parsed.data.notes || null,
      created_by: user?.id ?? null,
    } as any);
    setAdding(false);
    if (error) return toast.error("تعذّر إضافة البند", { description: error.message });
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
    if (!editingId) return;
    const parsed = parseDraft(editDraft);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "بيانات غير صحيحة");
      return;
    }
    const { error } = await supabase
      .from("budget_items" as any)
      .update({
        item_name: parsed.data.item_name,
        quantity: parsed.data.quantity,
        unit_cost: parsed.data.unit_cost,
        notes: parsed.data.notes || null,
      } as any)
      .eq("id", editingId);
    if (error) return toast.error("تعذّر التحديث", { description: error.message });
    toast.success("تم حفظ التعديلات");
    setEditingId(null);
  };

  const remove = async (it: BudgetItem) => {
    if (!confirm(`هل تريد حذف البند "${it.item_name}"؟`)) return;
    const { error } = await supabase.from("budget_items" as any).delete().eq("id", it.id);
    if (error) return toast.error("تعذّر الحذف", { description: error.message });
    toast.success("تم الحذف");
  };

  const doExportXlsx = () =>
    exportBudgetXLSX({
      filename: `ميزانية-${committeeName}`,
      groups: [{ committee_name: committeeName, rows: items }],
    });

  const doExportPdf = () =>
    exportBudgetPDF({
      title: `ميزانية ${committeeName}`,
      groups: [{ committee_name: committeeName, rows: items }],
      filenamePrefix: "BUD",
    });

  const draftTotal = (Number(draft.quantity) || 0) * (Number(draft.unit_cost) || 0);
  const editTotal = (Number(editDraft.quantity) || 0) * (Number(editDraft.unit_cost) || 0);

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-bold text-sm">بنود الميزانية المطلوبة</h3>
            <p className="text-[11px] text-muted-foreground">
              يحسب النظام إجمالي كل بند تلقائياً (الكمية × تكلفة الوحدة)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={doExportXlsx} className="gap-1.5">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </Button>
          <Button size="sm" variant="outline" onClick={doExportPdf} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="text-right">
                <th className="px-3 py-2 font-medium w-10">#</th>
                <th className="px-3 py-2 font-medium">البند</th>
                <th className="px-3 py-2 font-medium w-24">الكمية</th>
                <th className="px-3 py-2 font-medium w-32">تكلفة الوحدة</th>
                <th className="px-3 py-2 font-medium w-32">الإجمالي</th>
                <th className="px-3 py-2 font-medium">ملاحظات</th>
                {canEdit && <th className="px-3 py-2 font-medium w-24">إجراءات</th>}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="text-center py-10 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline-block" />
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && !canEdit && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                    لا توجد بنود ميزانية مسجّلة لهذه اللجنة
                  </td>
                </tr>
              )}
              {items.map((it, idx) => {
                const isEditing = editingId === it.id;
                return (
                  <tr key={it.id} className="border-t hover:bg-muted/20">
                    <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <Input
                          value={editDraft.item_name}
                          onChange={(e) => setEditDraft({ ...editDraft, item_name: e.target.value })}
                          className="h-8"
                        />
                      ) : (
                        <span className="font-medium inline-flex items-center gap-1.5">
                          {it.item_name}
                          {it.assigned_by_finance && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold/15 text-gold border border-gold/30 font-semibold"
                              title="بند معتمد من اللجنة المالية"
                            >
                              مالية
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={editDraft.quantity}
                          onChange={(e) => setEditDraft({ ...editDraft, quantity: e.target.value })}
                          className="h-8 w-24"
                          dir="ltr"
                        />
                      ) : (
                        fmt(Number(it.quantity))
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={editDraft.unit_cost}
                          onChange={(e) => setEditDraft({ ...editDraft, unit_cost: e.target.value })}
                          className="h-8 w-28"
                          dir="ltr"
                        />
                      ) : (
                        `${fmt(Number(it.unit_cost))} ر.س`
                      )}
                    </td>
                    <td className="px-3 py-2 font-bold text-primary">
                      {isEditing ? `${fmt(editTotal)} ر.س` : `${fmt(Number(it.total_cost))} ر.س`}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {isEditing ? (
                        <Input
                          value={editDraft.notes}
                          onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })}
                          className="h-8"
                        />
                      ) : (
                        it.notes ?? "—"
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {isEditing ? (
                            <>
                              <button
                                onClick={saveEdit}
                                className="h-7 w-7 rounded-md flex items-center justify-center bg-primary/10 text-primary hover:bg-primary/20"
                                title="حفظ"
                              >
                                <Save className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted"
                                title="إلغاء"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(it)}
                                className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-primary/10 hover:text-primary"
                                title="تعديل"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => remove(it)}
                                className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-destructive/10 hover:text-destructive"
                                title="حذف"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}

              {canEdit && (
                <tr className="border-t bg-muted/10">
                  <td className="px-3 py-2 text-muted-foreground">+</td>
                  <td className="px-3 py-2">
                    <Input
                      placeholder="اسم البند"
                      value={draft.item_name}
                      onChange={(e) => setDraft({ ...draft, item_name: e.target.value })}
                      className="h-8"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0"
                      value={draft.quantity}
                      onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                      className="h-8 w-24"
                      dir="ltr"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0"
                      value={draft.unit_cost}
                      onChange={(e) => setDraft({ ...draft, unit_cost: e.target.value })}
                      className="h-8 w-28"
                      dir="ltr"
                    />
                  </td>
                  <td className="px-3 py-2 font-bold text-primary">{fmt(draftTotal)} ر.س</td>
                  <td className="px-3 py-2">
                    <Input
                      placeholder="ملاحظات (اختياري)"
                      value={draft.notes}
                      onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                      className="h-8"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      size="sm"
                      onClick={handleAdd}
                      disabled={adding}
                      className="gap-1 bg-gradient-hero text-primary-foreground h-8"
                    >
                      {adding ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      إضافة
                    </Button>
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-primary/30 bg-gradient-to-l from-gold/10 to-primary/5">
                <td colSpan={4} className="px-3 py-3 text-right font-bold">
                  الإجمالي الكلي
                </td>
                <td className="px-3 py-3 font-bold text-lg text-primary">
                  {fmt(grandTotal)} ر.س
                </td>
                <td colSpan={canEdit ? 2 : 1} className="px-3 py-3 text-xs text-muted-foreground">
                  {items.length} بند
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}