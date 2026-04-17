import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, ListTodo, Receipt, Wallet, ArrowLeft, FileText, Upload, Loader2, Pencil, Trash2, GripVertical, User as UserIcon, Users } from "lucide-react";
import { toast } from "sonner";
import { committeeByType, COMMITTEES } from "@/lib/committees";
import { FinanceModule } from "@/components/FinanceModule";
import { InvitationCards } from "@/components/media/InvitationCards";
import { TaskAttachments } from "@/components/TaskAttachments";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/committee/$type")({
  component: CommitteePage,
  notFoundComponent: () => (
    <div className="text-center py-20">
      <p className="text-muted-foreground">اللجنة غير موجودة</p>
      <Link to="/dashboard" className="text-primary underline mt-4 inline-block">العودة</Link>
    </div>
  ),
});

interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: "todo" | "in_progress" | "completed";
  priority: "low" | "medium" | "high" | "urgent";
  assigned_to?: string | null;
}

interface TeamMember {
  id: string;
  full_name: string;
  role_title: string | null;
  is_head: boolean;
}

const PRIORITY_LABELS: Record<Task["priority"], string> = {
  low: "منخفضة", medium: "متوسطة", high: "عالية", urgent: "عاجلة",
};
const PRIORITY_TONE: Record<Task["priority"], string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  urgent: "bg-destructive/15 text-destructive",
};

interface PaymentRequest {
  id: string;
  title: string;
  amount: number;
  status: "pending" | "approved" | "rejected" | "paid";
  created_at: string;
  invoice_url: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  todo: "قائمة الانتظار",
  in_progress: "قيد التنفيذ",
  completed: "مكتملة",
};

const PR_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "قيد المراجعة", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  approved: { label: "معتمد", cls: "bg-sky-500/15 text-sky-700 border-sky-500/30" },
  paid: { label: "مصروف", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  rejected: { label: "مرفوض", cls: "bg-rose-500/15 text-rose-700 border-rose-500/30" },
};

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((s) => s[0] ?? "").join("").toUpperCase() || "؟";

function CommitteePage() {
  const { type } = Route.useParams();
  const meta = committeeByType(type);

  const [committee, setCommittee] = useState<{ id: string; name: string; description: string | null; budget_allocated: number; budget_spent: number } | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);

  const { user } = useAuth();
  const [profileName, setProfileName] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [showMine, setShowMine] = useState(false);

  const [taskOpen, setTaskOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tTitle, setTTitle] = useState("");
  const [tDesc, setTDesc] = useState("");
  const [tStatus, setTStatus] = useState<Task["status"]>("todo");
  const [tPriority, setTPriority] = useState<Task["priority"]>("medium");
  const [tAssignee, setTAssignee] = useState<string>("none");

  const [prOpen, setPrOpen] = useState(false);
  const [prTitle, setPrTitle] = useState("");
  const [prAmount, setPrAmount] = useState("");
  const [prDesc, setPrDesc] = useState("");
  const [prFile, setPrFile] = useState<File | null>(null);
  const [prSubmitting, setPrSubmitting] = useState(false);

  const load = async () => {
    const { data: c } = await supabase
      .from("committees")
      .select("*")
      .eq("type", type as never)
      .maybeSingle();
    if (!c) {
      setCommittee(null);
      return;
    }
    setCommittee(c);
    const [{ data: t }, { data: p }, { data: m }] = await Promise.all([
      supabase.from("committee_tasks").select("id, title, description, status, priority, assigned_to").eq("committee_id", c.id),
      supabase.from("payment_requests").select("id, title, amount, status, created_at, invoice_url").eq("committee_id", c.id).order("created_at", { ascending: false }),
      supabase.from("team_members").select("id, full_name, role_title, is_head").eq("committee_id", c.id).order("display_order"),
    ]);
    setTasks((t ?? []) as Task[]);
    setRequests((p ?? []) as PaymentRequest[]);
    setMembers((m ?? []) as TeamMember[]);
  };

  useEffect(() => {
    if (meta) load();
  }, [type]);

  useEffect(() => {
    if (!user) { setProfileName(null); return; }
    supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setProfileName(data?.full_name ?? null));
  }, [user]);

  if (!meta) {
    throw notFound();
  }

  const Icon = meta.icon;
  const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(n);

  const memberById = new Map(members.map((m) => [m.id, m]));
  const myMemberId = profileName
    ? members.find((m) => m.full_name.trim() === profileName.trim())?.id ?? null
    : null;
  const visibleTasks = showMine && myMemberId ? tasks.filter((t) => t.assigned_to === myMemberId) : tasks;
  const mineCount = myMemberId ? tasks.filter((t) => t.assigned_to === myMemberId).length : 0;
  const resetTaskForm = () => {
    setEditingId(null);
    setTTitle(""); setTDesc(""); setTStatus("todo"); setTPriority("medium"); setTAssignee("none");
  };

  const openNewTask = () => {
    resetTaskForm();
    setTaskOpen(true);
  };

  const openEditTask = (t: Task) => {
    setEditingId(t.id);
    setTTitle(t.title);
    setTDesc(t.description ?? "");
    setTStatus(t.status);
    setTPriority(t.priority);
    setTAssignee(t.assigned_to ?? "none");
    setTaskOpen(true);
  };

  const saveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!committee) return;
    const assigned_to = tAssignee === "none" ? null : tAssignee;
    if (editingId) {
      const { error } = await supabase.from("committee_tasks")
        .update({ title: tTitle, description: tDesc, status: tStatus, priority: tPriority, assigned_to })
        .eq("id", editingId);
      if (error) return toast.error("تعذر التحديث", { description: error.message });
      toast.success("تم تحديث المهمة");
    } else {
      const { error } = await supabase.from("committee_tasks").insert({
        committee_id: committee.id, title: tTitle, description: tDesc, status: tStatus, priority: tPriority, assigned_to,
      });
      if (error) return toast.error("تعذرت الإضافة", { description: error.message });
      toast.success("تمت إضافة المهمة");
    }
    resetTaskForm();
    setTaskOpen(false);
    load();
  };

  const deleteTask = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه المهمة؟")) return;
    const { error } = await supabase.from("committee_tasks").delete().eq("id", id);
    if (error) return toast.error("تعذر الحذف", { description: error.message });
    toast.success("تم حذف المهمة");
    load();
  };

  const moveTask = async (id: string, to: Task["status"]) => {
    const current = tasks.find((t) => t.id === id);
    if (!current || current.status === to) return;
    // optimistic update
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: to } : t)));
    const { error } = await supabase.from("committee_tasks").update({ status: to }).eq("id", id);
    if (error) {
      toast.error("تعذر النقل", { description: error.message });
      load();
    }
  };

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<Task["status"] | null>(null);
  const onDragStart = (e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };
  const onDragEnd = () => { setDragId(null); setDragOverCol(null); };
  const onDragOverCol = (e: React.DragEvent, col: Task["status"]) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(col);
  };
  const onDropCol = (e: React.DragEvent, col: Task["status"]) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDragId(null); setDragOverCol(null);
    if (id) moveTask(id, col);
  };

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!committee) return;
    const amount = Number(prAmount);
    if (!amount || amount <= 0) return toast.error("المبلغ غير صحيح");
    if (prFile && prFile.size > 10 * 1024 * 1024) return toast.error("حجم الملف أكبر من 10 ميجابايت");

    setPrSubmitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();

      let invoice_url: string | null = null;
      if (prFile) {
        const ext = prFile.name.split(".").pop() || "pdf";
        const path = `${committee.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("invoices").upload(path, prFile, {
          contentType: prFile.type || "application/pdf",
          upsert: false,
        });
        if (upErr) {
          toast.error("تعذر رفع الفاتورة", { description: upErr.message });
          setPrSubmitting(false);
          return;
        }
        invoice_url = path;
      }

      const { error } = await supabase.from("payment_requests").insert({
        committee_id: committee.id,
        title: prTitle,
        amount,
        description: prDesc,
        requested_by: u.user?.id,
        invoice_url,
      });
      if (error) {
        toast.error("تعذر الإرسال", { description: error.message });
        setPrSubmitting(false);
        return;
      }
      toast.success("تم رفع الطلب للجنة المالية");
      setPrTitle(""); setPrAmount(""); setPrDesc(""); setPrFile(null); setPrOpen(false);
      load();
    } finally {
      setPrSubmitting(false);
    }
  };

  if (!committee) {
    return (
      <div className="space-y-6">
        <Header meta={meta} />
        <div className="rounded-2xl border bg-card p-10 text-center">
          <p className="text-muted-foreground">
            لم يتم تهيئة بيانات هذه اللجنة بعد. يحتاج المدير لإنشائها من قاعدة البيانات.
          </p>
        </div>
      </div>
    );
  }

  const remaining = Number(committee.budget_allocated) - Number(committee.budget_spent);
  const pct = committee.budget_allocated > 0 ? Math.min(100, (Number(committee.budget_spent) / Number(committee.budget_allocated)) * 100) : 0;

  return (
    <div className="space-y-6">
      <Header meta={meta} />

      {/* Committee header */}
      <div className="rounded-2xl border bg-gradient-card p-6 shadow-soft">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${meta.tone}`}>
              <Icon className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{committee.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">{committee.description ?? meta.description}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 lg:min-w-[420px]">
            <Stat label="مخصص" value={`${fmt(Number(committee.budget_allocated))} ر.س`} tone="bg-primary/10 text-primary" />
            <Stat label="منصرف" value={`${fmt(Number(committee.budget_spent))} ر.س`} tone="bg-gold/15 text-gold-foreground" />
            <Stat label="المتبقي" value={`${fmt(remaining)} ر.س`} tone="bg-emerald-500/10 text-emerald-700" />
          </div>
        </div>
        <div className="mt-5">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-gradient-gold transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">نسبة الصرف من الميزانية: {pct.toFixed(0)}%</p>
        </div>
      </div>

      {/* Finance committee gets the full finance module embedded here */}
      {type === "finance" && (
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <FinanceModule />
        </div>
      )}

      {/* Media committee gets invitation cards distribution */}
      {type === "media" && (
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <InvitationCards />
        </div>
      )}


      <Dialog open={prOpen} onOpenChange={setPrOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label="رفع طلب صرف أو عهدة مالية"
            className="fixed bottom-6 left-6 z-50 group flex items-center gap-3 ps-2 pe-5 py-2 rounded-full bg-gradient-hero text-primary-foreground shadow-elegant hover:shadow-gold transition-all hover:scale-105 active:scale-95 animate-fade-up"
          >
            <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping opacity-40 group-hover:opacity-0" aria-hidden="true" />
            <span className="relative h-11 w-11 rounded-full bg-gold text-gold-foreground flex items-center justify-center shadow-gold shrink-0">
              <Receipt className="h-5 w-5" />
              {requests.length > 0 && (
                <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-background">
                  {requests.length}
                </span>
              )}
            </span>
            <span className="relative flex flex-col items-start leading-tight">
              <span className="text-sm font-bold">طلب صرف / عهدة</span>
              <span className="text-[10px] opacity-85">إرسال للجنة المالية</span>
            </span>
          </button>
        </DialogTrigger>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-gold" />
              طلبات الصرف والعهد المالية
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={submitRequest} className="space-y-3 pt-2 border-b pb-5">
            <div className="space-y-2"><Label>عنوان الطلب</Label><Input value={prTitle} onChange={(e) => setPrTitle(e.target.value)} required placeholder="مثال: عهدة لشراء مستلزمات الحفل" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>المبلغ (ر.س)</Label><Input type="number" min="1" value={prAmount} onChange={(e) => setPrAmount(e.target.value)} required dir="ltr" /></div>
              <div className="space-y-2">
                <Label>الفاتورة (اختياري)</Label>
                <label className="flex items-center justify-center gap-2 px-3 h-9 rounded-md border border-dashed border-input cursor-pointer hover:border-primary/60 hover:bg-muted/40 transition text-xs">
                  <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground truncate max-w-[140px]">
                    {prFile ? prFile.name : "اختر ملف"}
                  </span>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => setPrFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>
            <div className="space-y-2"><Label>تفاصيل الطلب</Label><Textarea value={prDesc} onChange={(e) => setPrDesc(e.target.value)} rows={3} placeholder="اشرح سبب الطلب وبنود الصرف" /></div>
            <Button type="submit" disabled={prSubmitting} className="w-full bg-gradient-hero text-primary-foreground">
              {prSubmitting ? <Loader2 className="h-4 w-4 ms-1 animate-spin" /> : <Wallet className="h-4 w-4 ms-1" />}
              {prSubmitting ? "جاري الرفع..." : "رفع الطلب للجنة المالية"}
            </Button>
          </form>

          <div>
            <h4 className="text-sm font-bold mb-3 mt-2">الطلبات السابقة ({requests.length})</h4>
            <div className="divide-y rounded-lg border">
              {requests.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">لا توجد طلبات صرف بعد</p>
              )}
              {requests.map((r) => {
                const s = PR_STATUS[r.status] ?? PR_STATUS.pending;
                return (
                  <div key={r.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                    <div className="min-w-0 flex items-center gap-2">
                      {r.invoice_url && (
                        <span className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <FileText className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate text-sm">{r.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(r.created_at).toLocaleDateString("ar-SA")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-xs">{fmt(Number(r.amount))} ر.س</span>
                      <Badge variant="outline" className={`${s.cls} text-[10px]`}>{s.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tasks Kanban */}
      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="font-bold flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" /> لوحة المهام
          </h3>
          <div className="flex items-center gap-2">
            {myMemberId && (
              <Button
                size="sm"
                variant={showMine ? "default" : "outline"}
                onClick={() => setShowMine((v) => !v)}
                className={showMine ? "bg-primary text-primary-foreground" : ""}
              >
                <UserIcon className="h-3.5 w-3.5 ms-1" />
                {showMine ? `مهامي (${mineCount})` : "مهامي"}
              </Button>
            )}
            <Dialog open={taskOpen} onOpenChange={(o) => { setTaskOpen(o); if (!o) resetTaskForm(); }}>
              <Button size="sm" onClick={openNewTask} className="bg-gradient-gold text-gold-foreground shadow-gold">
                <Plus className="h-4 w-4 ms-1" /> مهمة جديدة
              </Button>
              <DialogContent dir="rtl">
                <DialogHeader><DialogTitle>{editingId ? "تعديل المهمة" : "إضافة مهمة"}</DialogTitle></DialogHeader>
                <form onSubmit={saveTask} className="space-y-3 pt-2">
                  <div className="space-y-2"><Label>العنوان</Label><Input value={tTitle} onChange={(e) => setTTitle(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>الوصف</Label><Textarea value={tDesc} onChange={(e) => setTDesc(e.target.value)} rows={3} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>الحالة</Label>
                      <Select value={tStatus} onValueChange={(v) => setTStatus(v as Task["status"])}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">قائمة الانتظار</SelectItem>
                          <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                          <SelectItem value="completed">مكتملة</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>الأولوية</Label>
                      <Select value={tPriority} onValueChange={(v) => setTPriority(v as Task["priority"])}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">منخفضة</SelectItem>
                          <SelectItem value="medium">متوسطة</SelectItem>
                          <SelectItem value="high">عالية</SelectItem>
                          <SelectItem value="urgent">عاجلة</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> المسؤول عن المهمة</Label>
                    <Select value={tAssignee} onValueChange={setTAssignee}>
                      <SelectTrigger><SelectValue placeholder="اختر عضواً" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— بدون تعيين —</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.full_name}{m.role_title ? ` · ${m.role_title}` : ""}{m.is_head ? " (رئيس)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {members.length === 0 && (
                      <p className="text-[11px] text-muted-foreground">لا يوجد أعضاء لهذه اللجنة. أضف أعضاء من صفحة فريق العمل.</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full bg-gradient-hero text-primary-foreground">
                    {editingId ? "حفظ التعديلات" : "إضافة"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground mb-3">
          💡 اسحب البطاقة وأفلتها بين الأعمدة لتغيير حالتها{showMine ? " · يتم عرض مهامك فقط" : ""}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["todo", "in_progress", "completed"] as const).map((col) => {
            const colTasks = visibleTasks.filter((t) => t.status === col);
            const isOver = dragOverCol === col;
            return (
              <div
                key={col}
                onDragOver={(e) => onDragOverCol(e, col)}
                onDragLeave={() => setDragOverCol((c) => (c === col ? null : c))}
                onDrop={(e) => onDropCol(e, col)}
                className={`rounded-2xl border bg-muted/30 p-4 min-h-[280px] transition-all ${
                  isOver ? "border-primary border-2 bg-primary/5 ring-2 ring-primary/20" : ""
                }`}
              >
                <h4 className="text-sm font-bold mb-3 flex items-center justify-between">
                  <span>{STATUS_LABELS[col]}</span>
                  <span className="text-xs text-muted-foreground bg-card rounded-full px-2 py-0.5 border">
                    {colTasks.length}
                  </span>
                </h4>
                <div className="space-y-2">
                  {colTasks.map((t) => {
                    const assignee = t.assigned_to ? memberById.get(t.assigned_to) : undefined;
                    const isMine = !!myMemberId && t.assigned_to === myMemberId;
                    return (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, t.id)}
                        onDragEnd={onDragEnd}
                        className={`group rounded-lg bg-card p-3 shadow-soft border hover:border-primary/40 transition cursor-grab active:cursor-grabbing ${
                          dragId === t.id ? "opacity-40 scale-95" : ""
                        } ${isMine ? "ring-1 ring-primary/40" : ""}`}
                      >
                        <div className="flex items-start gap-2 mb-1.5">
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60 mt-0.5 shrink-0" />
                          <p className="font-medium text-sm flex-1">{t.title}</p>
                          <Badge variant="secondary" className={`${PRIORITY_TONE[t.priority]} text-[10px] shrink-0`}>
                            {PRIORITY_LABELS[t.priority]}
                          </Badge>
                        </div>
                        {t.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2 ps-5">{t.description}</p>
                        )}

                        <div className="ps-5 mb-2">
                          <TaskAttachments taskId={t.id} committeeId={committee.id} compact />
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                          {assignee ? (
                            <div className="flex items-center gap-1.5 min-w-0" title={assignee.full_name}>
                              <Avatar className="h-6 w-6 border border-primary/20">
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                                  {initials(assignee.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-[11px] text-muted-foreground truncate">
                                {assignee.full_name.split(" ").slice(0, 2).join(" ")}
                              </span>
                              {isMine && <Badge variant="secondary" className="bg-primary/10 text-primary text-[9px] px-1.5 h-4">أنت</Badge>}
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/70 inline-flex items-center gap-1">
                              <UserIcon className="h-3 w-3" /> غير معيّن
                            </span>
                          )}
                          <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition">
                            <button
                              onClick={() => openEditTask(t)}
                              className="h-6 w-6 rounded flex items-center justify-center hover:bg-primary/10 hover:text-primary transition"
                              aria-label="تعديل"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => deleteTask(t.id)}
                              className="h-6 w-6 rounded flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition"
                              aria-label="حذف"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {colTasks.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8 border-2 border-dashed border-muted rounded-lg">
                      {isOver ? "أفلت هنا" : showMine ? "لا توجد مهام معيّنة لك" : "لا توجد مهام"}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Header({ meta }: { meta: typeof COMMITTEES[number] }) {
  const Icon = meta.icon;
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        <span className={`h-10 w-10 rounded-xl flex items-center justify-center ${meta.tone}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">{meta.label}</h1>
          <p className="text-xs text-muted-foreground">{meta.description}</p>
        </div>
      </div>
      <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> العودة للوحة التحكم
      </Link>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-xl px-3 py-2 ${tone}`}>
      <p className="text-[10px] opacity-80">{label}</p>
      <p className="font-bold text-sm mt-0.5">{value}</p>
    </div>
  );
}
