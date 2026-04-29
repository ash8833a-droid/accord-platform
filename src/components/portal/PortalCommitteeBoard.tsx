import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { committeeByType } from "@/lib/committees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Loader2,
  ListTodo,
  PlayCircle,
  CheckCircle2,
  MessageSquare,
  Paperclip,
  Sparkles,
  ArrowLeft,
  Target,
  Lightbulb,
  Flag,
  ExternalLink,
  Search,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { TaskComments } from "@/components/TaskComments";
import { TaskAttachments } from "@/components/TaskAttachments";
import { TaskResponseForm } from "@/components/TaskResponseForm";

interface Member {
  id: string;
  full_name: string;
  is_head: boolean;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "completed";
  priority: "low" | "medium" | "high" | "urgent";
  assigned_to: string | null;
  due_date: string | null;
  created_at: string;
}

interface Props {
  committeeId: string;
  committeeName: string;
  committeeType: string;
}

const PRIORITY_LABEL: Record<Task["priority"], string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  urgent: "عاجلة",
};
const PRIORITY_TONE: Record<Task["priority"], string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  urgent: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};
const STATUS_META: Record<
  Task["status"],
  { label: string; icon: any; tone: string; ring: string }
> = {
  todo: {
    label: "قائمة الانتظار",
    icon: ListTodo,
    tone: "bg-muted/40",
    ring: "ring-muted-foreground/20",
  },
  in_progress: {
    label: "قيد التنفيذ",
    icon: PlayCircle,
    tone: "bg-sky-500/10",
    ring: "ring-sky-500/40",
  },
  completed: {
    label: "مكتملة",
    icon: CheckCircle2,
    tone: "bg-emerald-500/10",
    ring: "ring-emerald-500/40",
  },
};

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0] ?? "")
    .join("") || "؟";

export function PortalCommitteeBoard({
  committeeId,
  committeeName,
  committeeType,
}: Props) {
  const meta = committeeByType(committeeType);
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [headUserId, setHeadUserId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  // Form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [tTitle, setTTitle] = useState("");
  const [tDesc, setTDesc] = useState("");
  const [tStatus, setTStatus] = useState<Task["status"]>("todo");
  const [tPriority, setTPriority] = useState<Task["priority"]>("medium");
  const [tAssignee, setTAssignee] = useState<string>("none");
  const [tDue, setTDue] = useState<string>("");

  // Detail dialog
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  const isHead = !!(user && headUserId && headUserId === user.id);
  const canManage = isAdmin || isHead;

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: t }, { data: m }] = await Promise.all([
      supabase.from("committees").select("head_user_id").eq("id", committeeId).maybeSingle(),
      supabase
        .from("committee_tasks")
        .select("id, title, description, status, priority, assigned_to, due_date, created_at")
        .eq("committee_id", committeeId)
        .order("created_at", { ascending: false }),
      supabase
        .from("team_members")
        .select("id, full_name, is_head")
        .eq("committee_id", committeeId)
        .order("display_order"),
    ]);
    setHeadUserId((c as any)?.head_user_id ?? null);
    setTasks((t ?? []) as Task[]);
    setMembers((m ?? []) as Member[]);

    // Comment counts
    const ids = (t ?? []).map((x) => x.id);
    if (ids.length) {
      const { data: cm } = await supabase
        .from("task_comments" as any)
        .select("task_id")
        .in("task_id", ids);
      const map: Record<string, number> = {};
      ((cm ?? []) as any[]).forEach((x) => {
        map[x.task_id] = (map[x.task_id] ?? 0) + 1;
      });
      setCounts(map);
    } else {
      setCounts({});
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // realtime
    const ch = supabase
      .channel(`portal_committee_${committeeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "committee_tasks", filter: `committee_id=eq.${committeeId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committeeId]);

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const filtered = useMemo(() => {
    let list = tasks;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q),
      );
    }
    if (priorityFilter !== "all") list = list.filter((t) => t.priority === priorityFilter);
    if (assigneeFilter !== "all") {
      if (assigneeFilter === "unassigned") list = list.filter((t) => !t.assigned_to);
      else list = list.filter((t) => t.assigned_to === assigneeFilter);
    }
    return list;
  }, [tasks, search, priorityFilter, assigneeFilter]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "completed").length;
    const inProg = tasks.filter((t) => t.status === "in_progress").length;
    const todo = tasks.filter((t) => t.status === "todo").length;
    const overdue = tasks.filter(
      (t) => t.status !== "completed" && t.due_date && new Date(t.due_date) < new Date(),
    ).length;
    const rate = total ? Math.round((done / total) * 100) : 0;
    return { total, done, inProg, todo, overdue, rate };
  }, [tasks]);

  const resetForm = () => {
    setEditingId(null);
    setTTitle("");
    setTDesc("");
    setTStatus("todo");
    setTPriority("medium");
    setTAssignee("none");
    setTDue("");
  };

  const openNew = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (t: Task) => {
    setEditingId(t.id);
    setTTitle(t.title);
    setTDesc(t.description ?? "");
    setTStatus(t.status);
    setTPriority(t.priority);
    setTAssignee(t.assigned_to ?? "none");
    setTDue(t.due_date ?? "");
    setOpen(true);
  };

  const saveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      toast.error("لا تملك صلاحية إدارة المهام في هذه اللجنة");
      return;
    }
    if (!tTitle.trim()) {
      toast.error("العنوان مطلوب");
      return;
    }
    const payload: any = {
      title: tTitle.trim(),
      description: tDesc.trim() || null,
      status: tStatus,
      priority: tPriority,
      assigned_to: tAssignee === "none" ? null : tAssignee,
      due_date: tDue || null,
    };
    if (editingId) {
      const { error } = await supabase
        .from("committee_tasks")
        .update(payload)
        .eq("id", editingId);
      if (error) return toast.error("تعذّر التحديث", { description: error.message });
      toast.success("تم تحديث المهمة");
    } else {
      const { error } = await supabase
        .from("committee_tasks")
        .insert({ ...payload, committee_id: committeeId });
      if (error) return toast.error("تعذّرت الإضافة", { description: error.message });
      toast.success("تمت إضافة المهمة");
    }
    setOpen(false);
    resetForm();
    load();
  };

  const deleteTask = async (id: string) => {
    if (!canManage) return toast.error("لا تملك صلاحية الحذف");
    if (!confirm("هل أنت متأكد من حذف هذه المهمة؟")) return;
    const { error } = await supabase.from("committee_tasks").delete().eq("id", id);
    if (error) return toast.error("تعذّر الحذف", { description: error.message });
    toast.success("تم الحذف");
    load();
  };

  const moveTask = async (id: string, to: Task["status"]) => {
    const cur = tasks.find((t) => t.id === id);
    if (!cur || cur.status === to) return;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: to } : t)));
    const { error } = await supabase
      .from("committee_tasks")
      .update({ status: to })
      .eq("id", id);
    if (error) {
      toast.error("تعذّر النقل", { description: error.message });
      load();
    }
  };

  // Drag & drop
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<Task["status"] | null>(null);

  const onDragStart = (e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };
  const onDragOver = (e: React.DragEvent, col: Task["status"]) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(col);
  };
  const onDrop = (e: React.DragEvent, col: Task["status"]) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDragId(null);
    setDragOverCol(null);
    if (id) moveTask(id, col);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  const Icon = meta?.icon ?? ListTodo;

  return (
    <div className="space-y-5" dir="rtl">
      {/* Hero / identity */}
      <Card className="overflow-hidden border-0 shadow-sm">
        <div
          className={`p-5 md:p-6 ${meta?.tone ?? "bg-primary/10 text-primary"}`}
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, currentColor 12%, transparent), color-mix(in oklab, currentColor 4%, transparent))",
          }}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-card/80 backdrop-blur flex items-center justify-center shrink-0 shadow-sm">
                <Icon className="h-6 w-6 md:h-7 md:w-7" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-foreground">
                  {committeeName}
                </h2>
                {meta?.description && (
                  <p className="text-xs md:text-sm text-muted-foreground mt-1 max-w-2xl">
                    {meta.description}
                  </p>
                )}
              </div>
            </div>
            <Link
              to="/committee/$type"
              params={{ type: committeeType }}
              className="text-xs inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-card hover:bg-accent border transition"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              فتح بوابة اللجنة الكاملة
            </Link>
          </div>

          {meta?.goals && meta.goals.length > 0 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {meta.goals.slice(0, 4).map((g, i) => (
                <div
                  key={i}
                  className="rounded-xl bg-card/70 backdrop-blur border p-2.5 text-[12px] leading-relaxed flex items-start gap-2"
                >
                  <Target className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-70" />
                  <span>{g}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border">
          <KpiCell label="إجمالي" value={stats.total} />
          <KpiCell label="قيد التنفيذ" value={stats.inProg} accent="text-sky-600" />
          <KpiCell label="مكتملة" value={stats.done} accent="text-emerald-600" />
          <KpiCell label="متأخرة" value={stats.overdue} accent={stats.overdue ? "text-rose-600" : ""} />
          <KpiCell label="نسبة الإنجاز" value={`${stats.rate}%`} accent="text-primary" />
        </div>
      </Card>

      {/* Toolbar */}
      <Card className="p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في المهام..."
              className="pr-8 h-9"
            />
          </div>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-36 h-9">
              <Filter className="h-3.5 w-3.5 ml-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأولويات</SelectItem>
              <SelectItem value="urgent">عاجلة</SelectItem>
              <SelectItem value="high">عالية</SelectItem>
              <SelectItem value="medium">متوسطة</SelectItem>
              <SelectItem value="low">منخفضة</SelectItem>
            </SelectContent>
          </Select>
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأعضاء</SelectItem>
              <SelectItem value="unassigned">غير مُسندة</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canManage && (
            <Button onClick={openNew} size="sm" className="h-9 gap-1">
              <Plus className="h-4 w-4" />
              مهمة جديدة
            </Button>
          )}
          {!canManage && (
            <Badge variant="outline" className="text-[11px]">
              عرض فقط — التحرير لرئيس اللجنة والإدارة
            </Badge>
          )}
        </div>
      </Card>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Object.keys(STATUS_META) as Task["status"][]).map((col) => {
          const sm = STATUS_META[col];
          const colTasks = filtered.filter((t) => t.status === col);
          const ColIcon = sm.icon;
          const isHover = dragOverCol === col;
          return (
            <div
              key={col}
              onDragOver={(e) => onDragOver(e, col)}
              onDrop={(e) => onDrop(e, col)}
              onDragLeave={() => setDragOverCol(null)}
              className={`rounded-2xl border ${sm.tone} p-3 min-h-[280px] transition ${
                isHover ? `ring-2 ${sm.ring}` : ""
              }`}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="font-bold text-sm flex items-center gap-2">
                  <ColIcon className="h-4 w-4" />
                  {sm.label}
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {colTasks.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {colTasks.map((t) => {
                  const member = t.assigned_to ? memberById.get(t.assigned_to) : null;
                  const overdue =
                    t.due_date && t.status !== "completed" && new Date(t.due_date) < new Date();
                  const cmCount = counts[t.id] ?? 0;
                  return (
                    <div
                      key={t.id}
                      draggable={canManage}
                      onDragStart={(e) => canManage && onDragStart(e, t.id)}
                      onClick={() => setDetailTask(t)}
                      className={`group rounded-xl bg-card border border-border/60 hover:border-primary/40 hover:shadow-md transition p-3 cursor-pointer ${
                        dragId === t.id ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {canManage && (
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60 mt-1 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <Badge
                              variant="secondary"
                              className={`${PRIORITY_TONE[t.priority]} text-[10px] px-1.5 py-0 h-5 border-0`}
                            >
                              {PRIORITY_LABEL[t.priority]}
                            </Badge>
                            {overdue && (
                              <Badge className="bg-rose-500/15 text-rose-700 text-[10px] px-1.5 py-0 h-5 border-0">
                                متأخرة
                              </Badge>
                            )}
                          </div>
                          <h4 className="font-bold text-[13px] leading-snug">{t.title}</h4>
                          {t.description && (
                            <p className="text-[11.5px] text-muted-foreground mt-1 line-clamp-2">
                              {t.description}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                              {member ? (
                                <span className="inline-flex items-center gap-1 bg-muted/50 px-1.5 py-0.5 rounded-full">
                                  <span className="h-4 w-4 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[9px] font-bold">
                                    {initials(member.full_name)}
                                  </span>
                                  {member.full_name.split(" ")[0]}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/70">غير مُسندة</span>
                              )}
                              {t.due_date && (
                                <span className={overdue ? "text-rose-600 font-bold" : ""}>
                                  · {new Date(t.due_date).toLocaleDateString("ar-SA")}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground">
                              {cmCount > 0 && (
                                <span className="inline-flex items-center gap-0.5">
                                  <MessageSquare className="h-3 w-3" />
                                  {cmCount}
                                </span>
                              )}
                              {canManage && (
                                <div
                                  className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => openEdit(t)}
                                    className="p-1 rounded hover:bg-muted"
                                    title="تعديل"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => deleteTask(t.id)}
                                    className="p-1 rounded hover:bg-destructive/10 text-destructive"
                                    title="حذف"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {colTasks.length === 0 && (
                  <div className="text-center py-8 text-[11.5px] text-muted-foreground border-2 border-dashed border-muted/60 rounded-lg">
                    لا توجد مهام
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingId ? "تعديل المهمة" : "إضافة مهمة جديدة"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveTask} className="space-y-3">
            <div className="space-y-1.5">
              <Label>العنوان *</Label>
              <Input value={tTitle} onChange={(e) => setTTitle(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>الوصف</Label>
              <Textarea
                value={tDesc}
                onChange={(e) => setTDesc(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>المسؤول</Label>
                <Select value={tAssignee} onValueChange={setTAssignee}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>تاريخ الاستحقاق</Label>
                <Input type="date" value={tDue} onChange={(e) => setTDue(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit">{editingId ? "حفظ" : "إضافة"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail dialog: comments + attachments + response */}
      <Dialog open={!!detailTask} onOpenChange={(o) => !o && setDetailTask(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          {detailTask && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <DialogTitle className="text-lg">{detailTask.title}</DialogTitle>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <Badge className={`${PRIORITY_TONE[detailTask.priority]} border-0 text-[10px]`}>
                        {PRIORITY_LABEL[detailTask.priority]}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {STATUS_META[detailTask.status].label}
                      </Badge>
                      {detailTask.assigned_to && memberById.get(detailTask.assigned_to) && (
                        <Badge variant="secondary" className="text-[10px]">
                          {memberById.get(detailTask.assigned_to)!.full_name}
                        </Badge>
                      )}
                      {detailTask.due_date && (
                        <Badge variant="outline" className="text-[10px]">
                          استحقاق: {new Date(detailTask.due_date).toLocaleDateString("ar-SA")}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        openEdit(detailTask);
                        setDetailTask(null);
                      }}
                      className="gap-1"
                    >
                      <Pencil className="h-3.5 w-3.5" /> تعديل
                    </Button>
                  )}
                </div>
                {detailTask.description && (
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    {detailTask.description}
                  </p>
                )}
              </DialogHeader>

              <Tabs defaultValue="comments" className="mt-2">
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="comments" className="gap-1 text-xs">
                    <MessageSquare className="h-3.5 w-3.5" /> التعليقات
                  </TabsTrigger>
                  <TabsTrigger value="attachments" className="gap-1 text-xs">
                    <Paperclip className="h-3.5 w-3.5" /> المرفقات
                  </TabsTrigger>
                  <TabsTrigger value="response" className="gap-1 text-xs">
                    <Sparkles className="h-3.5 w-3.5" /> استجابة التنفيذ
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="comments" className="mt-3">
                  <TaskComments taskId={detailTask.id} />
                </TabsContent>
                <TabsContent value="attachments" className="mt-3">
                  <TaskAttachments taskId={detailTask.id} committeeId={committeeId} />
                </TabsContent>
                <TabsContent value="response" className="mt-3">
                  <TaskResponseForm taskId={detailTask.id} committeeId={committeeId} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <div className="bg-card p-3 text-center">
      <div className={`text-lg md:text-xl font-bold tabular-nums ${accent ?? ""}`}>{value}</div>
      <div className="text-[10.5px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
