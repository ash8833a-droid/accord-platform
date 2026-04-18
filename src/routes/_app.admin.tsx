import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { COMMITTEES, type CommitteeType } from "@/lib/committees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { ShieldCheck, Plus, ListTodo, CalendarRange, Megaphone, Pin, Trash2, Calendar, UserCheck, Users, Crown } from "lucide-react";
import { MembersApproval } from "@/components/admin/MembersApproval";
import { ApprovedMembers } from "@/components/admin/ApprovedMembers";
import { CommitteeHeads } from "@/components/admin/CommitteeHeads";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin")({
  component: AdminCenter,
});

function AdminCenter() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-8 text-primary-foreground shadow-elegant">
        <div className="absolute -top-10 -left-10 w-72 h-72 bg-gold/20 rounded-full blur-3xl" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gold/20 flex items-center justify-center backdrop-blur-sm">
            <ShieldCheck className="h-7 w-7 text-gold" />
          </div>
          <div>
            <p className="text-sm text-primary-foreground/70">مركز الإدارة العليا</p>
            <h1 className="text-2xl lg:text-3xl font-bold">
              <span className="text-shimmer-gold">بوابة القيادة</span> والتمكين المؤسسي
            </h1>
            <p className="text-primary-foreground/80 text-sm mt-1">
              مساحةٌ جامعةٌ لتنظيم المهام، وتنسيق الاجتماعات، وصنع القرار بروح فريقٍ واحدة
            </p>
          </div>
        </div>
      </div>

      {!isAdmin && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">
          ملاحظة: بعض الإجراءات (مثل إنشاء المهام للجان غير عضو فيها أو نشر الأخبار) متاحة فقط لمدير النظام.
        </div>
      )}

      <Tabs defaultValue="members" className="w-full">
        <TabsList className="grid w-full grid-cols-5 max-w-3xl ms-auto">
          <TabsTrigger value="members" className="gap-2">
            <UserCheck className="h-4 w-4" /> طلبات الانضمام
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-2">
            <Users className="h-4 w-4" /> الأعضاء
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <ListTodo className="h-4 w-4" /> المهام
          </TabsTrigger>
          <TabsTrigger value="meetings" className="gap-2">
            <CalendarRange className="h-4 w-4" /> الاجتماعات
          </TabsTrigger>
          <TabsTrigger value="news" className="gap-2">
            <Megaphone className="h-4 w-4" /> الأخبار
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-6">
          <MembersApproval isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="approved" className="mt-6">
          <ApprovedMembers isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="tasks" className="mt-6">
          <TasksManager />
        </TabsContent>
        <TabsContent value="meetings" className="mt-6">
          <MeetingsManager />
        </TabsContent>
        <TabsContent value="news" className="mt-6">
          <NewsManager isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ───────────── Tasks ───────────── */

interface CommitteeRow {
  id: string;
  name: string;
  type: CommitteeType;
}
interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  committee_id: string;
  status: "todo" | "in_progress" | "completed";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  created_at: string;
}

function TasksManager() {
  const [committees, setCommittees] = useState<CommitteeRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    committee_id: "",
    priority: "medium" as TaskRow["priority"],
    due_date: "",
  });

  const load = async () => {
    const [cm, tk] = await Promise.all([
      supabase.from("committees").select("id, name, type").order("name"),
      supabase
        .from("committee_tasks")
        .select("id, title, description, committee_id, status, priority, due_date, created_at")
        .order("created_at", { ascending: false }),
    ]);
    setCommittees((cm.data as CommitteeRow[]) ?? []);
    setTasks((tk.data as TaskRow[]) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!form.title || !form.committee_id) {
      toast.error("العنوان واللجنة مطلوبان");
      return;
    }
    const { error } = await supabase.from("committee_tasks").insert({
      title: form.title,
      description: form.description || null,
      committee_id: form.committee_id,
      priority: form.priority,
      due_date: form.due_date || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم إنشاء المهمة وتوجيهها للجنة");
    setOpen(false);
    setForm({ title: "", description: "", committee_id: "", priority: "medium", due_date: "" });
    load();
  };

  const updateStatus = async (id: string, status: TaskRow["status"]) => {
    const { error } = await supabase.from("committee_tasks").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("committee_tasks").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("تم الحذف");
      load();
    }
  };

  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.committee_id === filter);

  const priorityTone: Record<TaskRow["priority"], string> = {
    low: "bg-muted text-muted-foreground",
    medium: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    high: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    urgent: "bg-destructive/15 text-destructive",
  };
  const priorityLabel: Record<TaskRow["priority"], string> = {
    low: "منخفضة",
    medium: "متوسطة",
    high: "عالية",
    urgent: "عاجلة",
  };
  const statusLabel: Record<TaskRow["status"], string> = {
    todo: "قيد الانتظار",
    in_progress: "جارية",
    completed: "مكتملة",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-xs">فلترة بحسب اللجنة:</Label>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع اللجان</SelectItem>
              {committees.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-gold text-gold-foreground hover:opacity-90">
              <Plus className="h-4 w-4" /> مهمة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader>
              <DialogTitle>توجيه مهمة جديدة للجنة</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>عنوان المهمة *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثال: إعداد جدول العشاء" />
              </div>
              <div>
                <Label>الوصف</Label>
                <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>اللجنة *</Label>
                  <Select value={form.committee_id} onValueChange={(v) => setForm({ ...form, committee_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر اللجنة" /></SelectTrigger>
                    <SelectContent>
                      {committees.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>الأولوية</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as TaskRow["priority"] })}>
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
              <div>
                <Label>تاريخ الاستحقاق</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={create}>إنشاء وتوجيه</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((t) => {
          const com = committees.find((c) => c.id === t.committee_id);
          const meta = com ? COMMITTEES.find((m) => m.type === com.type) : null;
          return (
            <div key={t.id} className="rounded-xl border bg-card p-4 shadow-soft hover:shadow-elegant transition-all">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {meta && <span className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${meta.tone}`}><meta.icon className="h-3.5 w-3.5" /></span>}
                  <p className="text-xs text-muted-foreground truncate">{com?.name ?? "—"}</p>
                </div>
                <Badge className={priorityTone[t.priority]} variant="secondary">{priorityLabel[t.priority]}</Badge>
              </div>
              <h3 className="font-bold text-sm mb-1">{t.title}</h3>
              {t.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{t.description}</p>}
              {t.due_date && (
                <p className="text-[11px] text-muted-foreground mb-3 flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {new Date(t.due_date).toLocaleDateString("ar-SA")}
                </p>
              )}
              <div className="flex items-center gap-2">
                <Select value={t.status} onValueChange={(v) => updateStatus(t.id, v as TaskRow["status"])}>
                  <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">{statusLabel.todo}</SelectItem>
                    <SelectItem value="in_progress">{statusLabel.in_progress}</SelectItem>
                    <SelectItem value="completed">{statusLabel.completed}</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(t.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-full text-center text-sm text-muted-foreground py-10">لا توجد مهام بعد</p>
        )}
      </div>
    </div>
  );
}

/* ───────────── Meetings ───────────── */

interface MeetingRow {
  id: string;
  title: string;
  body: string;
  created_at: string;
  is_pinned: boolean;
}

/**
 * Meetings & news both use the announcements table.
 * Meetings are stored with a "[MEETING]" prefix in title and ISO date+location in body.
 */
function MeetingsManager() {
  const [list, setList] = useState<MeetingRow[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    date: "",
    time: "",
    location: "",
    agenda: "",
  });

  const load = async () => {
    const { data } = await supabase
      .from("announcements")
      .select("id, title, body, created_at, is_pinned")
      .like("title", "[MEETING]%")
      .order("created_at", { ascending: false });
    setList((data as MeetingRow[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title || !form.date) {
      toast.error("العنوان وتاريخ الاجتماع مطلوبان");
      return;
    }
    const body = JSON.stringify({
      date: form.date,
      time: form.time,
      location: form.location,
      agenda: form.agenda,
    });
    const { error } = await supabase.from("announcements").insert({
      title: `[MEETING] ${form.title}`,
      body,
      is_pinned: false,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("تمت جدولة الاجتماع");
    setOpen(false);
    setForm({ title: "", date: "", time: "", location: "", agenda: "" });
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("تم الحذف"); load(); }
  };

  const parseBody = (b: string) => {
    try { return JSON.parse(b) as { date: string; time: string; location: string; agenda: string }; }
    catch { return { date: "", time: "", location: "", agenda: b }; }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-gold text-gold-foreground hover:opacity-90">
              <Plus className="h-4 w-4" /> جدولة اجتماع
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader>
              <DialogTitle>اجتماع جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>عنوان الاجتماع *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثال: اجتماع رؤساء اللجان" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>التاريخ *</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <Label>الوقت</Label>
                  <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>المكان / الرابط</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="مثال: مقر العائلة - أو رابط Zoom" />
              </div>
              <div>
                <Label>جدول الأعمال</Label>
                <Textarea rows={3} value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} />
              </div>
            </div>
            <DialogFooter><Button onClick={create}>جدولة</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {list.map((m) => {
          const info = parseBody(m.body);
          const title = m.title.replace(/^\[MEETING\]\s*/, "");
          const dateObj = info.date ? new Date(info.date) : null;
          const upcoming = dateObj ? dateObj.getTime() >= Date.now() - 86400000 : false;
          return (
            <div key={m.id} className="rounded-xl border bg-card p-5 shadow-soft hover:shadow-elegant transition-all">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${upcoming ? "bg-gradient-hero text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <CalendarRange className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold">{title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {dateObj?.toLocaleDateString("ar-SA")} {info.time && `— ${info.time}`}
                    </p>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(m.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {info.location && <p className="text-xs mb-1.5"><span className="text-muted-foreground">المكان:</span> {info.location}</p>}
              {info.agenda && <p className="text-xs text-muted-foreground line-clamp-3"><span className="font-medium text-foreground">الأعمال:</span> {info.agenda}</p>}
              {upcoming && <Badge className="mt-3 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" variant="secondary">قادم</Badge>}
            </div>
          );
        })}
        {list.length === 0 && <p className="col-span-full text-center text-sm text-muted-foreground py-10">لا توجد اجتماعات مجدولة</p>}
      </div>
    </div>
  );
}

/* ───────────── News ───────────── */

interface NewsRow { id: string; title: string; body: string; created_at: string; is_pinned: boolean; }

function NewsManager({ isAdmin }: { isAdmin: boolean }) {
  const [list, setList] = useState<NewsRow[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", is_pinned: false });

  const load = async () => {
    const { data } = await supabase
      .from("announcements")
      .select("id, title, body, created_at, is_pinned")
      .not("title", "like", "[MEETING]%")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });
    setList((data as NewsRow[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title || !form.body) { toast.error("العنوان والمحتوى مطلوبان"); return; }
    const { error } = await supabase.from("announcements").insert({
      title: form.title, body: form.body, is_pinned: form.is_pinned,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("تم نشر الخبر");
    setOpen(false);
    setForm({ title: "", body: "", is_pinned: false });
    load();
  };

  const togglePin = async (id: string, current: boolean) => {
    const { error } = await supabase.from("announcements").update({ is_pinned: !current }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("تم الحذف"); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!isAdmin} className="gap-2 bg-gradient-gold text-gold-foreground hover:opacity-90">
              <Plus className="h-4 w-4" /> خبر جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader><DialogTitle>نشر خبر لفريق العمل</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>العنوان *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>المحتوى *</Label><Textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.is_pinned} onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })} />
                تثبيت في الأعلى
              </label>
            </div>
            <DialogFooter><Button onClick={create}>نشر</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {list.map((n) => (
          <div key={n.id} className={`rounded-xl border p-5 shadow-soft hover:shadow-elegant transition-all ${n.is_pinned ? "bg-gradient-to-br from-gold/10 to-transparent border-gold/30" : "bg-card"}`}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <Megaphone className={`h-5 w-5 ${n.is_pinned ? "text-gold" : "text-primary"}`} />
                <h3 className="font-bold">{n.title}</h3>
                {n.is_pinned && <Badge className="bg-gold/20 text-gold-foreground" variant="secondary">مثبّت</Badge>}
              </div>
              <div className="flex items-center gap-1">
                {isAdmin && (
                  <>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => togglePin(n.id, n.is_pinned)}>
                      <Pin className={`h-3.5 w-3.5 ${n.is_pinned ? "text-gold" : ""}`} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(n.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{n.body}</p>
            <p className="text-[11px] text-muted-foreground mt-3">{new Date(n.created_at).toLocaleString("ar-SA")}</p>
          </div>
        ))}
        {list.length === 0 && <p className="text-center text-sm text-muted-foreground py-10">لا توجد أخبار حالياً</p>}
      </div>
    </div>
  );
}
