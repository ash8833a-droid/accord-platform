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
import { Plus, ListTodo, Receipt, Wallet, ArrowLeft, FileText, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { committeeByType, COMMITTEES } from "@/lib/committees";

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
  status: "todo" | "in_progress" | "completed";
  priority: string;
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

function CommitteePage() {
  const { type } = Route.useParams();
  const meta = committeeByType(type);

  const [committee, setCommittee] = useState<{ id: string; name: string; description: string | null; budget_allocated: number; budget_spent: number } | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);

  const [taskOpen, setTaskOpen] = useState(false);
  const [tTitle, setTTitle] = useState("");
  const [tDesc, setTDesc] = useState("");
  const [tStatus, setTStatus] = useState<Task["status"]>("todo");

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
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase.from("committee_tasks").select("id, title, status, priority").eq("committee_id", c.id),
      supabase.from("payment_requests").select("id, title, amount, status, created_at, invoice_url").eq("committee_id", c.id).order("created_at", { ascending: false }),
    ]);
    setTasks((t ?? []) as Task[]);
    setRequests((p ?? []) as PaymentRequest[]);
  };

  useEffect(() => {
    if (meta) load();
  }, [type]);

  if (!meta) {
    throw notFound();
  }

  const Icon = meta.icon;
  const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(n);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!committee) return;
    const { error } = await supabase.from("committee_tasks").insert({
      committee_id: committee.id, title: tTitle, description: tDesc, status: tStatus,
    });
    if (error) return toast.error("تعذرت الإضافة", { description: error.message });
    toast.success("تمت إضافة المهمة");
    setTTitle(""); setTDesc(""); setTaskOpen(false); load();
  };

  const moveTask = async (id: string, to: Task["status"]) => {
    await supabase.from("committee_tasks").update({ status: to }).eq("id", id);
    load();
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

      {/* Payment requests */}
      <section className="rounded-2xl border bg-card shadow-soft overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gradient-to-l from-gold/5 to-transparent">
          <h3 className="font-bold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-gold" />
            طلبات الصرف والعهد المالية
          </h3>
          <Dialog open={prOpen} onOpenChange={setPrOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-hero text-primary-foreground">
                <Plus className="h-4 w-4 ms-1" /> طلب صرف جديد
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>رفع طلب صرف للجنة المالية</DialogTitle>
              </DialogHeader>
              <form onSubmit={submitRequest} className="space-y-3 pt-2">
                <div className="space-y-2"><Label>عنوان الطلب</Label><Input value={prTitle} onChange={(e) => setPrTitle(e.target.value)} required placeholder="مثال: عهدة لشراء مستلزمات الحفل" /></div>
                <div className="space-y-2"><Label>المبلغ المطلوب (ر.س)</Label><Input type="number" min="1" value={prAmount} onChange={(e) => setPrAmount(e.target.value)} required dir="ltr" /></div>
                <div className="space-y-2"><Label>تفاصيل الطلب</Label><Textarea value={prDesc} onChange={(e) => setPrDesc(e.target.value)} rows={4} placeholder="اشرح سبب الطلب وبنود الصرف" /></div>
                <Button type="submit" className="w-full bg-gradient-hero text-primary-foreground">
                  <Wallet className="h-4 w-4 ms-1" /> رفع الطلب
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="divide-y">
          {requests.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">لا توجد طلبات صرف بعد</p>
          )}
          {requests.map((r) => {
            const s = PR_STATUS[r.status] ?? PR_STATUS.pending;
            return (
              <div key={r.id} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(r.created_at).toLocaleDateString("ar-SA")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm">{fmt(Number(r.amount))} ر.س</span>
                  <Badge variant="outline" className={s.cls}>{s.label}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Tasks Kanban */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" /> لوحة المهام
          </h3>
          <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-gold text-gold-foreground shadow-gold">
                <Plus className="h-4 w-4 ms-1" /> مهمة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader><DialogTitle>إضافة مهمة</DialogTitle></DialogHeader>
              <form onSubmit={addTask} className="space-y-3 pt-2">
                <div className="space-y-2"><Label>العنوان</Label><Input value={tTitle} onChange={(e) => setTTitle(e.target.value)} required /></div>
                <div className="space-y-2"><Label>الوصف</Label><Textarea value={tDesc} onChange={(e) => setTDesc(e.target.value)} /></div>
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
                <Button type="submit" className="w-full bg-gradient-hero text-primary-foreground">حفظ</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["todo", "in_progress", "completed"] as const).map((col) => (
            <div key={col} className="rounded-2xl border bg-muted/30 p-4 min-h-[260px]">
              <h4 className="text-sm font-bold mb-3 flex items-center justify-between">
                <span>{STATUS_LABELS[col]}</span>
                <span className="text-xs text-muted-foreground">
                  {tasks.filter((t) => t.status === col).length}
                </span>
              </h4>
              <div className="space-y-2">
                {tasks.filter((t) => t.status === col).map((t) => (
                  <div key={t.id} className="rounded-lg bg-card p-3 shadow-soft border hover:border-primary/40 transition">
                    <p className="font-medium text-sm mb-2">{t.title}</p>
                    <div className="flex gap-1">
                      {(["todo", "in_progress", "completed"] as const).filter((s) => s !== t.status).map((s) => (
                        <button key={s} onClick={() => moveTask(t.id, s)} className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-primary hover:text-primary-foreground transition">
                          {STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {tasks.filter((t) => t.status === col).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">لا توجد مهام</p>
                )}
              </div>
            </div>
          ))}
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
