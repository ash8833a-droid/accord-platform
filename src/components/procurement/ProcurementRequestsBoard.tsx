import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { COMMITTEES, committeeByType } from "@/lib/committees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ShoppingCart,
  Plus,
  Loader2,
  PackageCheck,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Filter,
  Pencil,
  Trash2,
} from "lucide-react";

type ReqStatus =
  | "new"
  | "under_review"
  | "approved"
  | "rejected"
  | "purchasing"
  | "delivered";
type Priority = "low" | "medium" | "high" | "urgent";

interface ProcRequest {
  id: string;
  requesting_committee_id: string;
  requested_by: string | null;
  requester_name: string;
  item_name: string;
  description: string | null;
  quantity: number;
  unit: string;
  needed_by: string | null;
  priority: Priority;
  notes: string | null;
  status: ReqStatus;
  decision_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface CommitteeLite {
  id: string;
  name: string;
  type: string;
}

const STATUS_META: Record<ReqStatus, { label: string; tone: string; icon: any }> = {
  new: { label: "جديد", tone: "bg-sky-500/15 text-sky-700 border-sky-500/30", icon: Clock },
  under_review: {
    label: "قيد المراجعة",
    tone: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    icon: AlertTriangle,
  },
  approved: {
    label: "معتمد",
    tone: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    icon: CheckCircle2,
  },
  rejected: {
    label: "مرفوض",
    tone: "bg-rose-500/15 text-rose-700 border-rose-500/30",
    icon: XCircle,
  },
  purchasing: {
    label: "قيد الشراء",
    tone: "bg-violet-500/15 text-violet-700 border-violet-500/30",
    icon: ShoppingCart,
  },
  delivered: {
    label: "مُسلَّم",
    tone: "bg-teal-500/15 text-teal-700 border-teal-500/30",
    icon: PackageCheck,
  },
};

const PRIORITY_META: Record<Priority, { label: string; tone: string }> = {
  low: { label: "منخفضة", tone: "bg-muted text-muted-foreground" },
  medium: { label: "متوسطة", tone: "bg-sky-500/15 text-sky-700" },
  high: { label: "عالية", tone: "bg-amber-500/15 text-amber-700" },
  urgent: { label: "عاجلة", tone: "bg-rose-500/15 text-rose-700" },
};

const UNITS = ["قطعة", "كرتون", "علبة", "كيلو", "لتر", "متر", "حزمة", "أخرى"];

export function ProcurementRequestsBoard({
  procurementOnly = false,
}: {
  procurementOnly?: boolean;
}) {
  const { user, hasRole, committeeId } = useAuth();
  const [committees, setCommittees] = useState<CommitteeLite[]>([]);
  const [myCommitteeType, setMyCommitteeType] = useState<string | null>(null);
  const [requests, setRequests] = useState<ProcRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [filter, setFilter] = useState<ReqStatus | "all">("all");
  const [decisionFor, setDecisionFor] = useState<ProcRequest | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [decisionTarget, setDecisionTarget] = useState<ReqStatus>("approved");
  const [editFor, setEditFor] = useState<ProcRequest | null>(null);
  const [editForm, setEditForm] = useState({
    item_name: "",
    description: "",
    quantity: "1",
    unit: "قطعة",
    needed_by: "",
    priority: "medium" as Priority,
    notes: "",
  });

  const isAdmin = hasRole("admin");
  const isProcurementMember = myCommitteeType === "procurement";
  const canDecide = isAdmin || isProcurementMember;

  // form
  const [form, setForm] = useState({
    item_name: "",
    description: "",
    quantity: "1",
    unit: "قطعة",
    needed_by: "",
    priority: "medium" as Priority,
    notes: "",
  });

  const refresh = async () => {
    setLoading(true);
    const { data: cs } = await supabase
      .from("committees")
      .select("id, name, type")
      .order("name");
    setCommittees((cs ?? []) as CommitteeLite[]);

    if (committeeId) {
      const found = (cs ?? []).find((c) => c.id === committeeId);
      setMyCommitteeType(found?.type ?? null);
    }

    const { data, error } = await supabase
      .from("procurement_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("تعذّر تحميل الطلبات");
    setRequests((data ?? []) as ProcRequest[]);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("procurement_requests_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "procurement_requests" },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committeeId]);

  const myCommittee = useMemo(
    () => committees.find((c) => c.id === committeeId) ?? null,
    [committees, committeeId],
  );

  const filtered = useMemo(() => {
    let rows = requests;
    if (filter !== "all") rows = rows.filter((r) => r.status === filter);
    return rows;
  }, [requests, filter]);

  const submitNew = async () => {
    if (!user) return toast.error("يجب تسجيل الدخول");
    if (!committeeId || !myCommittee)
      return toast.error("يجب أن تكون عضواً في لجنة لتقديم الطلب");
    if (!form.item_name.trim()) return toast.error("اكتب اسم الصنف");
    const qty = Number(form.quantity);
    if (!qty || qty <= 0) return toast.error("الكمية غير صحيحة");

    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const { error } = await supabase.from("procurement_requests").insert({
      requesting_committee_id: committeeId,
      requested_by: user.id,
      requester_name: prof?.full_name ?? user.email ?? "عضو",
      item_name: form.item_name.trim(),
      description: form.description.trim() || null,
      quantity: qty,
      unit: form.unit,
      needed_by: form.needed_by || null,
      priority: form.priority,
      notes: form.notes.trim() || null,
      status: "new" as ReqStatus,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم إرسال الطلب إلى لجنة المشتريات");
    setOpenNew(false);
    setForm({
      item_name: "",
      description: "",
      quantity: "1",
      unit: "قطعة",
      needed_by: "",
      priority: "medium",
      notes: "",
    });
    refresh();
  };

  const updateStatus = async (
    req: ProcRequest,
    next: ReqStatus,
    notes?: string,
  ) => {
    const { error } = await supabase
      .from("procurement_requests")
      .update({
        status: next,
        decision_notes: notes ?? req.decision_notes,
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", req.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم تحديث حالة الطلب");
    setDecisionFor(null);
    setDecisionNotes("");
    refresh();
  };

  const openDecision = (req: ProcRequest, target: ReqStatus) => {
    setDecisionFor(req);
    setDecisionTarget(target);
    setDecisionNotes(req.decision_notes ?? "");
  };

  const openEdit = (req: ProcRequest) => {
    setEditFor(req);
    setEditForm({
      item_name: req.item_name,
      description: req.description ?? "",
      quantity: String(req.quantity),
      unit: req.unit,
      needed_by: req.needed_by ?? "",
      priority: req.priority,
      notes: req.notes ?? "",
    });
  };

  const saveEdit = async () => {
    if (!editFor) return;
    if (!editForm.item_name.trim()) return toast.error("اكتب اسم الصنف");
    const qty = Number(editForm.quantity);
    if (!qty || qty <= 0) return toast.error("الكمية غير صحيحة");
    const { error } = await supabase
      .from("procurement_requests")
      .update({
        item_name: editForm.item_name.trim(),
        description: editForm.description.trim() || null,
        quantity: qty,
        unit: editForm.unit,
        needed_by: editForm.needed_by || null,
        priority: editForm.priority,
        notes: editForm.notes.trim() || null,
      })
      .eq("id", editFor.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم تحديث الطلب");
    setEditFor(null);
    refresh();
  };

  const deleteRequest = async (req: ProcRequest) => {
    if (!confirm(`حذف طلب «${req.item_name}» نهائياً؟`)) return;
    const { error } = await supabase
      .from("procurement_requests")
      .delete()
      .eq("id", req.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم حذف الطلب");
    refresh();
  };

  const canEditRequest = (r: ProcRequest) =>
    isAdmin ||
    isProcurementMember ||
    (user?.id === r.requested_by && r.status === "new");

  const canDeleteRequest = (r: ProcRequest) =>
    isAdmin || (user?.id === r.requested_by && r.status === "new");

  const counts = useMemo(() => {
    const c: Record<ReqStatus | "all", number> = {
      all: requests.length,
      new: 0,
      under_review: 0,
      approved: 0,
      rejected: 0,
      purchasing: 0,
      delivered: 0,
    };
    requests.forEach((r) => {
      c[r.status] += 1;
    });
    return c;
  }, [requests]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="border-orange-500/20 shadow-elegant">
        <CardHeader className="border-b bg-gradient-to-l from-orange-500/5 to-transparent">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-orange-500/10 p-2.5 text-orange-600">
                <ShoppingCart className="size-6" />
              </div>
              <div>
                <CardTitle className="text-lg">طلبات الشراء بين اللجان</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  نموذج موحّد لتقديم احتياجات اللجان إلى لجنة المشتريات ومتابعة سير
                  الاعتماد والتسليم.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {committeeId && (
                <Dialog open={openNew} onOpenChange={setOpenNew}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-hero text-primary-foreground">
                      <Plus className="ml-1 size-4" /> طلب شراء جديد
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg" dir="rtl">
                    <DialogHeader>
                      <DialogTitle>نموذج طلب شراء موحّد</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="rounded-lg border bg-muted/30 p-2.5 text-xs">
                        <span className="text-muted-foreground">اللجنة الطالبة:</span>{" "}
                        <b>{myCommittee?.name ?? "—"}</b>
                      </div>
                      <div>
                        <Label>الصنف / الوصف المختصر *</Label>
                        <Input
                          value={form.item_name}
                          onChange={(e) => setForm({ ...form, item_name: e.target.value })}
                          placeholder="مثال: كراسي بلاستيكية بيضاء"
                          maxLength={150}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>الكمية *</Label>
                          <Input
                            type="number"
                            min="1"
                            value={form.quantity}
                            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>الوحدة</Label>
                          <Select
                            value={form.unit}
                            onValueChange={(v) => setForm({ ...form, unit: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {UNITS.map((u) => (
                                <SelectItem key={u} value={u}>
                                  {u}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>تاريخ الحاجة</Label>
                          <Input
                            type="date"
                            value={form.needed_by}
                            onChange={(e) => setForm({ ...form, needed_by: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>الأولوية</Label>
                          <Select
                            value={form.priority}
                            onValueChange={(v) => setForm({ ...form, priority: v as Priority })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
                                <SelectItem key={p} value={p}>
                                  {PRIORITY_META[p].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label>وصف تفصيلي / مواصفات</Label>
                        <Textarea
                          rows={3}
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          placeholder="النوع، اللون، المقاس، أي مواصفات تساعد المشتريات"
                          maxLength={1000}
                        />
                      </div>
                      <div>
                        <Label>ملاحظات إضافية</Label>
                        <Textarea
                          rows={2}
                          value={form.notes}
                          onChange={(e) => setForm({ ...form, notes: e.target.value })}
                          maxLength={500}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setOpenNew(false)}>
                        إلغاء
                      </Button>
                      <Button onClick={submitNew} className="bg-gradient-hero text-primary-foreground">
                        إرسال الطلب
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 text-xs">
            <KPI label="الكل" value={counts.all} active={filter === "all"} onClick={() => setFilter("all")} />
            {(Object.keys(STATUS_META) as ReqStatus[]).map((s) => (
              <KPI
                key={s}
                label={STATUS_META[s].label}
                value={counts[s]}
                tone={STATUS_META[s].tone}
                active={filter === s}
                onClick={() => setFilter(s)}
              />
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-3 md:p-5">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <Filter className="size-8 mx-auto mb-2 opacity-50" />
              لا توجد طلبات بهذا الفلتر
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => {
                const cmt = committees.find((c) => c.id === r.requesting_committee_id);
                const meta = STATUS_META[r.status];
                const SIcon = meta.icon;
                return (
                  <div
                    key={r.id}
                    className="rounded-xl border bg-card p-3 md:p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm">{r.item_name}</h4>
                          <Badge variant="outline" className={`text-[10px] gap-1 ${meta.tone}`}>
                            <SIcon className="size-3" />
                            {meta.label}
                          </Badge>
                          <Badge variant="secondary" className={`text-[10px] ${PRIORITY_META[r.priority].tone}`}>
                            {PRIORITY_META[r.priority].label}
                          </Badge>
                        </div>
                        <div className="mt-1.5 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                          <span>
                            <b className="text-foreground">{cmt?.name ?? "—"}</b> · {r.requester_name}
                          </span>
                          <span>
                            الكمية: <b className="text-foreground">{r.quantity} {r.unit}</b>
                          </span>
                          {r.needed_by && (
                            <span>
                              مطلوب قبل: <b className="text-foreground">{r.needed_by}</b>
                            </span>
                          )}
                        </div>
                        {r.description && (
                          <p className="mt-2 text-xs text-muted-foreground leading-relaxed bg-muted/30 rounded p-2">
                            {r.description}
                          </p>
                        )}
                        {r.decision_notes && (
                          <p className="mt-2 text-xs leading-relaxed bg-amber-500/10 text-amber-900 rounded p-2 border border-amber-500/20">
                            <b>قرار المشتريات:</b> {r.decision_notes}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {canEditRequest(r) && (
                          <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                            <Pencil className="ml-1 size-3.5" /> تعديل
                          </Button>
                        )}
                        {canDeleteRequest(r) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => deleteRequest(r)}
                          >
                            <Trash2 className="ml-1 size-3.5" /> حذف
                          </Button>
                        )}
                        {canDecide && (
                          <>
                          {r.status === "new" && (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(r, "under_review")}>
                              <AlertTriangle className="ml-1 size-3.5" /> مراجعة
                            </Button>
                          )}
                          {(r.status === "new" || r.status === "under_review") && (
                            <>
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => openDecision(r, "approved")}
                              >
                                <CheckCircle2 className="ml-1 size-3.5" /> اعتماد
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => openDecision(r, "rejected")}
                              >
                                <XCircle className="ml-1 size-3.5" /> رفض
                              </Button>
                            </>
                          )}
                          {r.status === "approved" && (
                            <Button
                              size="sm"
                              className="bg-violet-600 hover:bg-violet-700 text-white"
                              onClick={() => updateStatus(r, "purchasing")}
                            >
                              <ShoppingCart className="ml-1 size-3.5" /> بدء الشراء
                            </Button>
                          )}
                          {r.status === "purchasing" && (
                            <Button
                              size="sm"
                              className="bg-teal-600 hover:bg-teal-700 text-white"
                              onClick={() => updateStatus(r, "delivered")}
                            >
                              <Truck className="ml-1 size-3.5" /> تأكيد التسليم
                            </Button>
                          )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decision dialog */}
      <Dialog open={!!decisionFor} onOpenChange={(o) => !o && setDecisionFor(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {decisionTarget === "approved" ? "اعتماد الطلب" : "رفض الطلب"}
            </DialogTitle>
          </DialogHeader>
          {decisionFor && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/30 p-2.5 text-xs">
                <b>{decisionFor.item_name}</b> — {decisionFor.quantity} {decisionFor.unit}
              </div>
              <div>
                <Label>ملاحظات القرار {decisionTarget === "rejected" && "*"}</Label>
                <Textarea
                  rows={3}
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  placeholder={
                    decisionTarget === "approved"
                      ? "ملاحظات اختيارية للّجنة الطالبة"
                      : "اذكر سبب الرفض"
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionFor(null)}>
              إلغاء
            </Button>
            <Button
              onClick={() => {
                if (!decisionFor) return;
                if (decisionTarget === "rejected" && !decisionNotes.trim()) {
                  toast.error("يرجى ذكر سبب الرفض");
                  return;
                }
                updateStatus(decisionFor, decisionTarget, decisionNotes.trim() || undefined);
              }}
              className={
                decisionTarget === "approved"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-rose-600 hover:bg-rose-700 text-white"
              }
            >
              تأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editFor} onOpenChange={(o) => !o && setEditFor(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل طلب الشراء</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الصنف *</Label>
              <Input
                value={editForm.item_name}
                onChange={(e) => setEditForm({ ...editForm, item_name: e.target.value })}
                maxLength={150}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>الكمية *</Label>
                <Input
                  type="number"
                  min="1"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                />
              </div>
              <div>
                <Label>الوحدة</Label>
                <Select value={editForm.unit} onValueChange={(v) => setEditForm({ ...editForm, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>تاريخ الحاجة</Label>
                <Input
                  type="date"
                  value={editForm.needed_by}
                  onChange={(e) => setEditForm({ ...editForm, needed_by: e.target.value })}
                />
              </div>
              <div>
                <Label>الأولوية</Label>
                <Select
                  value={editForm.priority}
                  onValueChange={(v) => setEditForm({ ...editForm, priority: v as Priority })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
                      <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>وصف تفصيلي</Label>
              <Textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                maxLength={1000}
              />
            </div>
            <div>
              <Label>ملاحظات</Label>
              <Textarea
                rows={2}
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFor(null)}>إلغاء</Button>
            <Button onClick={saveEdit} className="bg-gradient-hero text-primary-foreground">
              حفظ التعديلات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KPI({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border p-2 text-right transition-all ${
        active
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card hover:border-primary/40"
      }`}
    >
      <div className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] mb-1 ${tone ?? "bg-muted text-muted-foreground"}`}>
        {label}
      </div>
      <div className="text-base font-bold">{value}</div>
    </button>
  );
}