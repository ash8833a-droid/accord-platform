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
import { Plus, ListTodo, Receipt, Wallet, ArrowLeft, FileText, Upload, Loader2, Pencil, Trash2, GripVertical, User as UserIcon, Users, Target, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { committeeByType, COMMITTEES } from "@/lib/committees";
import { FinanceModule } from "@/components/FinanceModule";
import { InvitationCards } from "@/components/media/InvitationCards";
import { TaskAttachments } from "@/components/TaskAttachments";
import { CommitteeArchive } from "@/components/CommitteeArchive";
import { CommitteeMembersPanel } from "@/components/CommitteeMembersPanel";
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
  committee_id?: string;
  committee_name?: string;
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

const PHASE_TONE: Record<string, string> = {
  "البدء": "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  "التخطيط": "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  "التنفيذ": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  "المراقبة والضبط": "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  "الإغلاق": "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
};

/** Extract phase prefix like "[التخطيط]" from task title */
function splitPhase(title: string): { phase: string | null; clean: string } {
  const m = title.match(/^\s*\[([^\]]+)\]\s*(.*)$/);
  if (m) return { phase: m[1].trim(), clean: m[2].trim() };
  return { phase: null, clean: title };
}

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
  const [allMembers, setAllMembers] = useState<TeamMember[]>([]);
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
  const [prRecipient, setPrRecipient] = useState<string>("finance");
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
    const [{ data: t }, { data: p }, { data: m }, { data: am }] = await Promise.all([
      supabase.from("committee_tasks").select("id, title, description, status, priority, assigned_to").eq("committee_id", c.id),
      supabase.from("payment_requests").select("id, title, amount, status, created_at, invoice_url").eq("committee_id", c.id).order("created_at", { ascending: false }),
      supabase.from("team_members").select("id, full_name, role_title, is_head").eq("committee_id", c.id).order("display_order"),
      supabase.from("team_members").select("id, full_name, role_title, is_head, committee_id, committees(name)").order("display_order"),
    ]);
    setTasks((t ?? []) as Task[]);
    setRequests((p ?? []) as PaymentRequest[]);
    setMembers((m ?? []) as TeamMember[]);
    setAllMembers(((am ?? []) as any[]).map((x) => ({
      id: x.id, full_name: x.full_name, role_title: x.role_title, is_head: x.is_head,
      committee_id: x.committee_id, committee_name: x.committees?.name ?? "",
    })));
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

  const memberById = new Map((allMembers.length ? allMembers : members).map((m) => [m.id, m]));
  const myMemberId = profileName
    ? (allMembers.find((m) => m.full_name.trim() === profileName.trim())?.id
        ?? members.find((m) => m.full_name.trim() === profileName.trim())?.id
        ?? null)
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

      const recipientLabel = (() => {
        if (prRecipient === "finance") return "اللجنة المالية";
        const m = allMembers.find((x) => x.id === prRecipient);
        return m ? `${m.full_name}${m.committee_name ? ` (${m.committee_name})` : ""}` : "اللجنة المالية";
      })();
      const finalDesc = `[إلى: ${recipientLabel}]\n${prDesc}`.trim();

      const { error } = await supabase.from("payment_requests").insert({
        committee_id: committee.id,
        title: prTitle,
        amount,
        description: finalDesc,
        requested_by: u.user?.id,
        invoice_url,
      });
      if (error) {
        toast.error("تعذر الإرسال", { description: error.message });
        setPrSubmitting(false);
        return;
      }
      toast.success(`تم إرسال الطلب إلى ${recipientLabel}`);
      setPrTitle(""); setPrAmount(""); setPrDesc(""); setPrFile(null); setPrRecipient("finance"); setPrOpen(false);
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

      {/* Budget icon button → opens dialog */}
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            className="group inline-flex items-center gap-2.5 rounded-2xl border bg-card hover:bg-primary/5 hover:border-primary/40 px-4 py-3 shadow-sm hover:shadow-md transition-all"
            aria-label="ميزانية اللجنة"
          >
            <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition">
              <Wallet className="h-5 w-5" />
            </span>
            <span className="text-start">
              <span className="block text-sm font-bold leading-tight">ميزانية اللجنة</span>
              <span className="block text-[11px] text-muted-foreground mt-0.5">
                {fmt(Number(committee.budget_spent))} / {fmt(Number(committee.budget_allocated))} ر.س · {pct.toFixed(0)}%
              </span>
            </span>
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-gradient-to-l from-primary/5 to-transparent">
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className={`h-9 w-9 rounded-xl flex items-center justify-center ${meta.tone}`}>
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-bold">{committee.name}</p>
                <p className="text-[11px] text-muted-foreground font-normal">{committee.description ?? meta.description}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="مخصص" value={`${fmt(Number(committee.budget_allocated))} ر.س`} tone="bg-primary/10 text-primary" />
              <Stat label="منصرف" value={`${fmt(Number(committee.budget_spent))} ر.س`} tone="bg-gold/15 text-gold-foreground" />
              <Stat label="المتبقي" value={`${fmt(remaining)} ر.س`} tone="bg-emerald-500/10 text-emerald-700" />
            </div>
            <div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-gradient-gold transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">نسبة الصرف من الميزانية: {pct.toFixed(0)}%</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Strategic goals card */}
      {meta.goals && meta.goals.length > 0 && (
        <div className="rounded-2xl border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-2 mb-4">
            <span className={`h-9 w-9 rounded-lg flex items-center justify-center ${meta.tone}`}>
              <Target className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-bold text-base">أهداف اللجنة الاستراتيجية</h3>
              <p className="text-xs text-muted-foreground">المخرجات الرئيسية المتوقعة من اللجنة</p>
            </div>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {meta.goals.map((g, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 rounded-xl border bg-gradient-to-br from-card to-muted/30 px-4 py-3"
              >
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
                <span className="text-sm leading-relaxed">{g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <CommitteeMembersPanel committeeId={committee.id} />

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
            className="fixed bottom-20 lg:bottom-6 left-4 lg:left-6 z-40 group flex items-center gap-3 ps-2 pe-5 py-2 rounded-full bg-gradient-hero text-primary-foreground shadow-elegant hover:shadow-gold transition-all hover:scale-105 active:scale-95 animate-fade-up"
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
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> إرسال الطلب إلى</Label>
              <Select value={prRecipient} onValueChange={setPrRecipient}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="finance">اللجنة المالية (افتراضي)</SelectItem>
                  {COMMITTEES.map((cm) => {
                    const list = allMembers.filter((m) => m.committee_name === cm.label);
                    if (list.length === 0) return null;
                    return (
                      <div key={cm.type}>
                        <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground bg-muted/40 mt-1">{cm.label}</div>
                        {list.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.full_name}{m.role_title ? ` · ${m.role_title}` : ""}{m.is_head ? " (رئيس)" : ""}
                          </SelectItem>
                        ))}
                      </div>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
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
                    <Label className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> تعيين المهمة إلى</Label>
                    <Select value={tAssignee} onValueChange={setTAssignee}>
                      <SelectTrigger><SelectValue placeholder="اختر عضواً من المنصة" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="none">— بدون تعيين —</SelectItem>
                        {members.length > 0 && (
                          <div>
                            <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground bg-primary/5 mt-1">
                              {meta.label} (لجنتك)
                            </div>
                            {members.map((m) => (
                              <SelectItem key={`own-${m.id}`} value={m.id}>
                                {m.full_name}{m.role_title ? ` · ${m.role_title}` : ""}{m.is_head ? " (رئيس)" : ""}
                              </SelectItem>
                            ))}
                          </div>
                        )}
                        {COMMITTEES.filter((cm) => cm.label !== meta.label).map((cm) => {
                          const list = allMembers.filter((m) => m.committee_name === cm.label);
                          if (list.length === 0) return null;
                          return (
                            <div key={cm.type}>
                              <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground bg-muted/40 mt-1">{cm.label}</div>
                              {list.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.full_name}{m.role_title ? ` · ${m.role_title}` : ""}{m.is_head ? " (رئيس)" : ""}
                                </SelectItem>
                              ))}
                            </div>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">يمكنك تعيين المهمة لأي عضو في أي لجنة بالمنصة.</p>
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
                        className={`group relative rounded-xl bg-card p-3.5 shadow-sm border border-border/60 hover:border-primary/40 hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${
                          dragId === t.id ? "opacity-40 scale-95" : ""
                        } ${isMine ? "ring-1 ring-primary/40" : ""}`}
                      >
                        {/* Priority accent bar */}
                        <span
                          className={`absolute top-0 bottom-0 start-0 w-1 rounded-s-xl ${
                            t.priority === "urgent" ? "bg-rose-500" :
                            t.priority === "high" ? "bg-amber-500" :
                            t.priority === "medium" ? "bg-sky-500" : "bg-muted-foreground/30"
                          }`}
                          aria-hidden
                        />

                        {/* Header: phase + priority on top, title below */}
                        {(() => {
                          const { phase, clean } = splitPhase(t.title);
                          return (
                            <div className="ps-2 mb-2">
                              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                                {phase && (
                                  <Badge variant="outline" className={`${PHASE_TONE[phase] ?? "bg-muted text-muted-foreground"} text-[10px] font-semibold px-1.5 py-0 h-5 rounded-md border`}>
                                    {phase}
                                  </Badge>
                                )}
                                <Badge variant="secondary" className={`${PRIORITY_TONE[t.priority]} text-[10px] font-medium px-1.5 py-0 h-5 rounded-md ms-auto`}>
                                  {PRIORITY_LABELS[t.priority]}
                                </Badge>
                              </div>
                              <div className="flex items-start gap-2">
                                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 mt-0.5 shrink-0 group-hover:text-muted-foreground transition" />
                                <h5 className="font-semibold text-sm leading-snug flex-1 line-clamp-2">{clean}</h5>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Description */}
                        {t.description && (
                          <p className="text-[11.5px] leading-relaxed text-muted-foreground line-clamp-2 mb-2.5 ps-7">
                            {t.description}
                          </p>
                        )}

                        {/* Attachments */}
                        <div className="ps-7 mb-2.5">
                          <TaskAttachments taskId={t.id} committeeId={committee.id} compact />
                        </div>

                        {/* Footer: assignee + actions */}
                        <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-dashed border-border/60 ps-2">
                          {assignee ? (
                            <div className="flex items-center gap-1.5 min-w-0" title={assignee.full_name}>
                              <Avatar className="h-6 w-6 border border-primary/20">
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                                  {initials(assignee.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-[11px] text-muted-foreground truncate font-medium">
                                {assignee.full_name.split(" ").slice(0, 2).join(" ")}
                              </span>
                              {isMine && <Badge variant="secondary" className="bg-primary/10 text-primary text-[9px] px-1.5 h-4 rounded-md">أنت</Badge>}
                            </div>
                          ) : (
                            <span className="text-[10.5px] text-muted-foreground/60 inline-flex items-center gap-1">
                              <UserIcon className="h-3 w-3" /> غير معيّن
                            </span>
                          )}
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                            <button
                              onClick={() => openEditTask(t)}
                              className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-primary/10 hover:text-primary transition"
                              aria-label="تعديل"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => deleteTask(t.id)}
                              className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition"
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

      {/* Archive of past reports / files / images for this committee */}
      <CommitteeArchive committeeId={committee.id} committeeName={committee.name} />
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
