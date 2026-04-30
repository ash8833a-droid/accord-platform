import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Inbox, Plus, Filter, Clock, CheckCircle2, XCircle, AlertTriangle, User2, Users as UsersIcon, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { PageHeroHeader } from "@/components/PageHeroHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/communications")({
  component: RequestsPage,
});

type Category = "financial" | "administrative" | "logistics" | "media" | "consultative" | "urgent";
type Status = "new" | "in_progress" | "pending_confirmation" | "completed" | "rejected" | "cancelled";
type Priority = "low" | "medium" | "high" | "urgent";

interface Req {
  id: string;
  title: string;
  description: string | null;
  category: Category;
  priority: Priority;
  status: Status;
  requester_id: string;
  requester_name: string;
  requester_committee_id: string | null;
  target_committee_id: string | null;
  target_user_id: string | null;
  target_user_name: string | null;
  due_date: string | null;
  completion_note: string | null;
  rejection_reason: string | null;
  created_at: string;
  completed_at: string | null;
  completed_by: string | null;
}

const CATEGORIES: { value: Category; label: string; color: string }[] = [
  { value: "financial",      label: "مالي",     color: "bg-emerald-500/10 text-emerald-700 border-emerald-300" },
  { value: "administrative", label: "إداري",    color: "bg-blue-500/10 text-blue-700 border-blue-300" },
  { value: "logistics",      label: "لوجستي",   color: "bg-amber-500/10 text-amber-700 border-amber-300" },
  { value: "media",          label: "إعلامي",   color: "bg-purple-500/10 text-purple-700 border-purple-300" },
  { value: "consultative",   label: "استشاري",  color: "bg-cyan-500/10 text-cyan-700 border-cyan-300" },
  { value: "urgent",         label: "عاجل",     color: "bg-red-500/10 text-red-700 border-red-300" },
];

const STATUS_META: Record<Status, { label: string; color: string; icon: React.ComponentType<{className?: string}> }> = {
  new:                  { label: "جديد",            color: "bg-slate-500/10 text-slate-700 border-slate-300",   icon: Inbox },
  in_progress:          { label: "قيد التنفيذ",     color: "bg-blue-500/10 text-blue-700 border-blue-300",       icon: Loader2 },
  pending_confirmation: { label: "بانتظار التأكيد", color: "bg-amber-500/10 text-amber-700 border-amber-300",    icon: Clock },
  completed:            { label: "مكتمل",           color: "bg-emerald-500/10 text-emerald-700 border-emerald-300", icon: CheckCircle2 },
  rejected:             { label: "مرفوض",           color: "bg-red-500/10 text-red-700 border-red-300",          icon: XCircle },
  cancelled:            { label: "ملغي",            color: "bg-muted text-muted-foreground border-border",        icon: XCircle },
};

const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  low:    { label: "منخفضة", color: "bg-muted text-muted-foreground" },
  medium: { label: "متوسطة", color: "bg-blue-500/10 text-blue-700" },
  high:   { label: "عالية",  color: "bg-amber-500/10 text-amber-700" },
  urgent: { label: "عاجلة",  color: "bg-red-500/10 text-red-700" },
};

const catLabel = (c: Category) => CATEGORIES.find(x => x.value === c)?.label ?? c;
const catColor = (c: Category) => CATEGORIES.find(x => x.value === c)?.color ?? "";

function RequestsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [committees, setCommittees] = useState<{ id: string; name: string }[]>([]);
  const [tab, setTab] = useState<"all" | "incoming" | "outgoing">("all");
  const [catFilter, setCatFilter] = useState<Category | "all">("all");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [openCreate, setOpenCreate] = useState(false);
  const [detail, setDetail] = useState<Req | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("internal_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data ?? []) as Req[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    supabase.from("committees").select("id,name").order("name").then(({ data }) => {
      setCommittees(data ?? []);
    });
    const ch = supabase
      .channel("internal_requests_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "internal_requests" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    return items.filter(r => {
      if (tab === "incoming" && r.target_user_id !== user?.id && !committees.some(() => false)) {
        // incoming = target user is me OR I am a member of target committee (DB already filters; here just check user direct)
        if (r.target_user_id !== user?.id) return false;
      }
      if (tab === "outgoing" && r.requester_id !== user?.id) return false;
      if (catFilter !== "all" && r.category !== catFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [items, tab, catFilter, statusFilter, user, committees]);

  const stats = useMemo(() => {
    const total = items.length;
    const open = items.filter(r => ["new", "in_progress", "pending_confirmation"].includes(r.status)).length;
    const completed = items.filter(r => r.status === "completed").length;
    const overdue = items.filter(r => r.due_date && new Date(r.due_date) < new Date() && !["completed","rejected","cancelled"].includes(r.status)).length;
    return { total, open, completed, overdue };
  }, [items]);

  return (
    <div className="container mx-auto py-6 px-4 space-y-6" dir="rtl">
      <PageHeroHeader
        icon={Inbox}
        eyebrow="نظام إدارة الطلبات الداخلية"
        title="الطلبات بين اللجان والأعضاء"
        highlight="إدارة"
        subtitle="أنشئ طلبات، وجّهها للجنة أو لشخص، وتابع تنفيذها حتى الإغلاق"
        actions={
          <Button onClick={() => setOpenCreate(true)} className="bg-gold text-primary hover:bg-gold/90">
            <Plus className="h-4 w-4 ml-1" /> طلب جديد
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="إجمالي الطلبات" value={stats.total} icon={FileText} tone="default" />
        <StatCard label="مفتوحة" value={stats.open} icon={Loader2} tone="info" />
        <StatCard label="مكتملة" value={stats.completed} icon={CheckCircle2} tone="success" />
        <StatCard label="متأخرة" value={stats.overdue} icon={AlertTriangle} tone="danger" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="all">الكل</TabsTrigger>
              <TabsTrigger value="incoming">الواردة لي</TabsTrigger>
              <TabsTrigger value="outgoing">الصادرة مني</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap gap-3 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={catFilter} onValueChange={(v) => setCatFilter(v as Category | "all")}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="التصنيف" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل التصنيفات</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as Status | "all")}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                {(Object.keys(STATUS_META) as Status[]).map(s => (
                  <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">جاري التحميل…</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">لا توجد طلبات مطابقة.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(r => <RequestCard key={r.id} req={r} committees={committees} onClick={() => setDetail(r)} />)}
        </div>
      )}

      <CreateDialog open={openCreate} onOpenChange={setOpenCreate} committees={committees} onCreated={load} />
      <DetailDialog req={detail} onOpenChange={(o) => !o && setDetail(null)} committees={committees} onChanged={load} />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: React.ComponentType<{className?: string}>; tone: "default"|"info"|"success"|"danger" }) {
  const toneClass = {
    default: "text-foreground",
    info:    "text-blue-600",
    success: "text-emerald-600",
    danger:  "text-red-600",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
        </div>
        <Icon className={`h-8 w-8 ${toneClass} opacity-60`} />
      </CardContent>
    </Card>
  );
}

function RequestCard({ req, committees, onClick }: { req: Req; committees: {id:string;name:string}[]; onClick: () => void }) {
  const StatusIcon = STATUS_META[req.status].icon;
  const tCommittee = committees.find(c => c.id === req.target_committee_id)?.name;
  const overdue = req.due_date && new Date(req.due_date) < new Date() && !["completed","rejected","cancelled"].includes(req.status);
  return (
    <Card className="cursor-pointer hover:border-primary/40 transition" onClick={onClick}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className={catColor(req.category)}>{catLabel(req.category)}</Badge>
              <Badge variant="outline" className={STATUS_META[req.status].color}>
                <StatusIcon className="h-3 w-3 ml-1" /> {STATUS_META[req.status].label}
              </Badge>
              <Badge variant="outline" className={PRIORITY_META[req.priority].color}>{PRIORITY_META[req.priority].label}</Badge>
              {overdue && <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-300"><AlertTriangle className="h-3 w-3 ml-1"/>متأخر</Badge>}
            </div>
            <h3 className="font-semibold text-base truncate">{req.title}</h3>
            {req.description && <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{req.description}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><User2 className="h-3 w-3"/> من: {req.requester_name}</span>
          {tCommittee && <span className="flex items-center gap-1"><UsersIcon className="h-3 w-3"/> إلى لجنة: {tCommittee}</span>}
          {req.target_user_name && <span className="flex items-center gap-1"><User2 className="h-3 w-3"/> إلى: {req.target_user_name}</span>}
          {req.due_date && <span className="flex items-center gap-1"><Clock className="h-3 w-3"/> الاستحقاق: {req.due_date}</span>}
          <span>أنشئ: {new Date(req.created_at).toLocaleDateString("ar-SA")}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateDialog({ open, onOpenChange, committees, onCreated }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  committees: {id:string;name:string}[]; onCreated: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("administrative");
  const [priority, setPriority] = useState<Priority>("medium");
  const [targetCommittee, setTargetCommittee] = useState<string>("");
  const [targetUserName, setTargetUserName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setTitle(""); setDescription(""); setCategory("administrative");
    setPriority("medium"); setTargetCommittee(""); setTargetUserName(""); setDueDate("");
  };

  const submit = async () => {
    if (!user) { toast.error("يلزم تسجيل الدخول"); return; }
    if (!title.trim()) { toast.error("العنوان مطلوب"); return; }
    if (!targetCommittee && !targetUserName.trim()) { toast.error("حدّد لجنة مستهدفة أو اسم شخص"); return; }
    setBusy(true);

    let target_user_id: string | null = null;
    if (targetUserName.trim()) {
      const { data } = await supabase.from("profiles").select("user_id").eq("full_name", targetUserName.trim()).maybeSingle();
      target_user_id = data?.user_id ?? null;
    }

    const { data: prof } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();

    const { error } = await supabase.from("internal_requests").insert({
      title: title.trim(),
      description: description.trim() || null,
      category, priority,
      requester_id: user.id,
      requester_name: prof?.full_name ?? "عضو",
      target_committee_id: targetCommittee || null,
      target_user_id,
      target_user_name: targetUserName.trim() || null,
      due_date: dueDate || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم إنشاء الطلب");
    reset(); onOpenChange(false); onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader><DialogTitle>طلب جديد</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>العنوان *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="مثال: طلب اعتماد مبلغ لتجهيزات…" />
          </div>
          <div>
            <Label>التفاصيل</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>التصنيف</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>الأولوية</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_META) as Priority[]).map(p => (
                    <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>اللجنة المستهدفة</Label>
            <Select value={targetCommittee || "_none"} onValueChange={(v) => setTargetCommittee(v === "_none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="اختر لجنة (اختياري)"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— بدون —</SelectItem>
                {committees.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>اسم الشخص المستهدف (اختياري)</Label>
            <Input value={targetUserName} onChange={e => setTargetUserName(e.target.value)} placeholder="اسم العضو كما هو مسجل" />
          </div>
          <div>
            <Label>تاريخ الاستحقاق</Label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "جاري الحفظ…" : "إنشاء الطلب"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailDialog({ req, onOpenChange, committees, onChanged }: {
  req: Req | null; onOpenChange: (o: boolean) => void;
  committees: {id:string;name:string}[]; onChanged: () => void;
}) {
  const { user } = useAuth();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (!req) return null;
  const tCommittee = committees.find(c => c.id === req.target_committee_id)?.name;
  const StatusIcon = STATUS_META[req.status].icon;

  const update = async (patch: Partial<Req>) => {
    setBusy(true);
    const { error } = await supabase.from("internal_requests").update(patch).eq("id", req.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم التحديث");
    onChanged();
    onOpenChange(false);
  };

  const start    = () => update({ status: "in_progress" });
  const askConf  = () => update({ status: "pending_confirmation", completion_note: note || null, completed_by: user?.id ?? null });
  const complete = () => update({ status: "completed", completed_at: new Date().toISOString(), completion_note: note || req.completion_note, completed_by: user?.id ?? null });
  const reject   = () => update({ status: "rejected", rejection_reason: note || "بدون سبب" });
  const cancel   = () => update({ status: "cancelled" });

  return (
    <Dialog open={!!req} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={catColor(req.category)}>{catLabel(req.category)}</Badge>
            <Badge variant="outline" className={STATUS_META[req.status].color}>
              <StatusIcon className="h-3 w-3 ml-1"/> {STATUS_META[req.status].label}
            </Badge>
            <span>{req.title}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {req.description && <div className="p-3 rounded-md bg-muted/50 whitespace-pre-wrap">{req.description}</div>}
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>الطالب: <span className="text-foreground">{req.requester_name}</span></div>
            <div>الأولوية: <span className="text-foreground">{PRIORITY_META[req.priority].label}</span></div>
            {tCommittee && <div>اللجنة المستهدفة: <span className="text-foreground">{tCommittee}</span></div>}
            {req.target_user_name && <div>الشخص المستهدف: <span className="text-foreground">{req.target_user_name}</span></div>}
            {req.due_date && <div>الاستحقاق: <span className="text-foreground">{req.due_date}</span></div>}
            <div>أنشئ: <span className="text-foreground">{new Date(req.created_at).toLocaleString("ar-SA")}</span></div>
          </div>
          {req.completion_note && (
            <div className="p-3 rounded-md bg-emerald-500/5 border border-emerald-200">
              <div className="text-xs text-emerald-700 mb-1">ملاحظات التنفيذ</div>
              <div>{req.completion_note}</div>
            </div>
          )}
          {req.rejection_reason && (
            <div className="p-3 rounded-md bg-red-500/5 border border-red-200">
              <div className="text-xs text-red-700 mb-1">سبب الرفض</div>
              <div>{req.rejection_reason}</div>
            </div>
          )}
          {!["completed","rejected","cancelled"].includes(req.status) && (
            <div>
              <Label>ملاحظة (للإكمال أو الرفض)</Label>
              <Textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="اكتب ما تم تنفيذه أو سبب الرفض…" />
            </div>
          )}
        </div>
        <DialogFooter className="flex-wrap gap-2">
          {req.status === "new" && <Button variant="outline" onClick={start} disabled={busy}>بدء التنفيذ</Button>}
          {(req.status === "new" || req.status === "in_progress") && (
            <>
              <Button variant="outline" onClick={askConf} disabled={busy}>تم — بانتظار تأكيد الطالب</Button>
              <Button onClick={complete} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">إكمال مباشر</Button>
              <Button variant="destructive" onClick={reject} disabled={busy}>رفض</Button>
            </>
          )}
          {req.status === "pending_confirmation" && (
            <>
              <Button onClick={complete} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">تأكيد الإكمال</Button>
              <Button variant="outline" onClick={start} disabled={busy}>إعادة فتح</Button>
            </>
          )}
          {req.requester_id === user?.id && req.status === "new" && (
            <Button variant="ghost" onClick={cancel} disabled={busy}>إلغاء الطلب</Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
