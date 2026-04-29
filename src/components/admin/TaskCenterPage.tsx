import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { committeeByType } from "@/lib/committees";
import { PageGate } from "@/components/PageGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Plus, Target, Search, Loader2, ListTodo, PlayCircle, CheckCircle2,
  AlertTriangle, Trash2, ExternalLink, LayoutGrid, Rows3, CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { CreateTaskDialog } from "@/components/admin/CreateTaskDialog";
import { TaskDetailsDialog } from "@/components/admin/TaskDetailsDialog";

interface CommitteeRow { id: string; name: string; type: string }
interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  committee_id: string;
  status: "todo" | "in_progress" | "completed";
  priority: "low" | "medium" | "high" | "urgent";
  assigned_to: string | null;
  due_date: string | null;
  created_at: string;
}

const STATUS_META = {
  todo:        { label: "قائمة الانتظار", icon: ListTodo,     color: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30" },
  in_progress: { label: "قيد التنفيذ",   icon: PlayCircle,   color: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  completed:   { label: "مكتملة",        icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
} as const;

const PRIORITY_META: Record<TaskRow["priority"], { label: string; cls: string }> = {
  low:    { label: "منخفضة", cls: "bg-slate-500/10 text-slate-600 border-slate-500/30" },
  medium: { label: "متوسطة", cls: "bg-sky-500/10 text-sky-600 border-sky-500/30" },
  high:   { label: "عالية",  cls: "bg-orange-500/10 text-orange-600 border-orange-500/30" },
  urgent: { label: "عاجلة",  cls: "bg-rose-500/10 text-rose-600 border-rose-500/30" },
};

function isOverdue(t: TaskRow): boolean {
  if (!t.due_date || t.status === "completed") return false;
  return new Date(t.due_date).getTime() < Date.now() - 86400000;
}

export function TaskCenterPage() {
  return (
    <PageGate pageKey="admin-tasks">
      {({ canEdit }) => <TaskCenterInner canEdit={canEdit} />}
    </PageGate>
  );
}

function TaskCenterInner({ canEdit }: { canEdit: boolean }) {
  const { user } = useAuth();
  const [committees, setCommittees] = useState<CommitteeRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [committeeFilter, setCommitteeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [createOpen, setCreateOpen] = useState(false);
  const [details, setDetails] = useState<TaskRow | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: cm }, { data: tk }] = await Promise.all([
      supabase.from("committees").select("id, name, type").order("name"),
      supabase.from("committee_tasks")
        .select("id, title, description, committee_id, status, priority, assigned_to, due_date, created_at")
        .order("created_at", { ascending: false }),
    ]);
    setCommittees((cm ?? []) as CommitteeRow[]);
    setTasks((tk ?? []) as TaskRow[]);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("admin_tasks_center")
      .on("postgres_changes", { event: "*", schema: "public", table: "committee_tasks" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const cmMap = useMemo(() => new Map(committees.map((c) => [c.id, c])), [committees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (committeeFilter !== "all" && t.committee_id !== committeeFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (!q) return true;
      const cn = cmMap.get(t.committee_id)?.name ?? "";
      return t.title.toLowerCase().includes(q)
        || (t.description ?? "").toLowerCase().includes(q)
        || cn.toLowerCase().includes(q);
    });
  }, [tasks, committeeFilter, priorityFilter, search, cmMap]);

  const stats = useMemo(() => {
    const active = tasks.filter((t) => t.status !== "completed");
    const completed = tasks.filter((t) => t.status === "completed").length;
    const overdue = tasks.filter(isOverdue).length;
    const total = tasks.length;
    const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);
    const committeesWithTasks = new Set(tasks.map((t) => t.committee_id));
    const empty = committees.filter((c) => !committeesWithTasks.has(c.id)).length;
    return { activeCount: active.length, completionRate, overdue, empty };
  }, [tasks, committees]);

  const moveTask = async (id: string, to: TaskRow["status"]) => {
    const prev = tasks;
    setTasks((s) => s.map((t) => (t.id === id ? { ...t, status: to } : t)));
    const { error } = await supabase.from("committee_tasks").update({ status: to }).eq("id", id);
    if (error) { setTasks(prev); toast.error("تعذّر نقل المهمة: " + error.message); }
  };

  const deleteTask = async (id: string) => {
    if (!confirm("حذف المهمة نهائياً؟")) return;
    const { error } = await supabase.from("committee_tasks").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("تم الحذف");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-gold flex items-center justify-center text-gold-foreground">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold">مركز المهام</h1>
              <p className="text-xs text-muted-foreground">إنشاء ومتابعة مهام جميع اللجان من مكان واحد</p>
            </div>
          </div>
        </div>
        {canEdit && (
          <Button onClick={() => setCreateOpen(true)} className="gap-2 bg-gradient-gold text-gold-foreground hover:opacity-90">
            <Plus className="h-4 w-4" /> مهمة جديدة
          </Button>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="مهام نشطة" value={String(stats.activeCount)} icon={ListTodo} tone="text-sky-600 bg-sky-500/10" />
        <KpiCard label="نسبة الإنجاز" value={`${stats.completionRate}%`} icon={CheckCircle2} tone="text-emerald-600 bg-emerald-500/10" />
        <KpiCard label="مهام متأخرة" value={String(stats.overdue)} icon={AlertTriangle} tone="text-rose-600 bg-rose-500/10" />
        <KpiCard label="لجان دون مهام" value={String(stats.empty)} icon={Target} tone="text-amber-600 bg-amber-500/10" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث في المهام..." className="pr-9" />
          </div>
          <Select value={committeeFilter} onValueChange={setCommitteeFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل اللجان</SelectItem>
              {committees.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأولويات</SelectItem>
              {Object.entries(PRIORITY_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="inline-flex rounded-lg border bg-background p-0.5">
            <button onClick={() => setView("kanban")} className={`px-3 py-1.5 text-xs rounded-md inline-flex items-center gap-1.5 ${view === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><LayoutGrid className="h-3.5 w-3.5" />كانبان</button>
            <button onClick={() => setView("list")} className={`px-3 py-1.5 text-xs rounded-md inline-flex items-center gap-1.5 ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><Rows3 className="h-3.5 w-3.5" />قائمة</button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="board" className="w-full">
        <TabsList>
          <TabsTrigger value="board">المهام</TabsTrigger>
          <TabsTrigger value="performance">أداء اللجان</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4">
          {view === "kanban"
            ? <KanbanBoard tasks={filtered} cmMap={cmMap} canEdit={canEdit} onMove={moveTask} onOpen={setDetails} onDelete={deleteTask} />
            : <ListView tasks={filtered} cmMap={cmMap} canEdit={canEdit} onMove={moveTask} onOpen={setDetails} onDelete={deleteTask} />
          }
        </TabsContent>

        <TabsContent value="performance" className="mt-4">
          <PerformanceGrid committees={committees} tasks={tasks} />
        </TabsContent>
      </Tabs>

      {createOpen && (
        <CreateTaskDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          committees={committees}
          onCreated={() => { setCreateOpen(false); load(); }}
        />
      )}

      {details && (
        <TaskDetailsDialog
          task={details}
          committee={cmMap.get(details.committee_id) ?? null}
          canEdit={canEdit}
          onClose={() => setDetails(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${tone}`}><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-extrabold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function KanbanBoard({
  tasks, cmMap, canEdit, onMove, onOpen, onDelete,
}: {
  tasks: TaskRow[];
  cmMap: Map<string, CommitteeRow>;
  canEdit: boolean;
  onMove: (id: string, to: TaskRow["status"]) => void;
  onOpen: (t: TaskRow) => void;
  onDelete: (id: string) => void;
}) {
  const cols: TaskRow["status"][] = ["todo", "in_progress", "completed"];
  const [dragId, setDragId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {cols.map((status) => {
        const meta = STATUS_META[status];
        const items = tasks.filter((t) => t.status === status);
        return (
          <div
            key={status}
            onDragOver={(e) => { if (canEdit) e.preventDefault(); }}
            onDrop={() => { if (canEdit && dragId) { onMove(dragId, status); setDragId(null); } }}
            className="rounded-xl border bg-muted/20 p-3 min-h-[300px]"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <meta.icon className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-bold text-sm">{meta.label}</h3>
              </div>
              <Badge variant="outline">{items.length}</Badge>
            </div>
            <div className="space-y-2">
              {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">لا توجد مهام</p>}
              {items.map((t) => {
                const cm = cmMap.get(t.committee_id);
                const cmeta = cm ? committeeByType(cm.type) : null;
                const overdue = isOverdue(t);
                return (
                  <div
                    key={t.id}
                    draggable={canEdit}
                    onDragStart={() => setDragId(t.id)}
                    onClick={() => onOpen(t)}
                    className="group rounded-lg border bg-card p-3 cursor-pointer hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold flex-1 line-clamp-2">{t.title}</p>
                      {canEdit && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
                          className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-600 transition-opacity"
                          aria-label="حذف"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center flex-wrap gap-1 mt-2">
                      {cmeta && (
                        <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${cmeta.tone}`}>
                          <cmeta.icon className="h-3 w-3" />{cm?.name}
                        </span>
                      )}
                      <Badge variant="outline" className={`text-[10px] ${PRIORITY_META[t.priority].cls}`}>{PRIORITY_META[t.priority].label}</Badge>
                      {overdue && (
                        <Badge className="text-[10px] bg-rose-500/15 text-rose-600 border-rose-500/30">
                          <AlertTriangle className="h-2.5 w-2.5 ms-0.5" />متأخرة
                        </Badge>
                      )}
                    </div>
                    {t.due_date && (
                      <p className="text-[11px] text-muted-foreground mt-1.5 inline-flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" />
                        {new Date(t.due_date).toLocaleDateString("ar-SA")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView({
  tasks, cmMap, canEdit, onMove, onOpen, onDelete,
}: {
  tasks: TaskRow[];
  cmMap: Map<string, CommitteeRow>;
  canEdit: boolean;
  onMove: (id: string, to: TaskRow["status"]) => void;
  onOpen: (t: TaskRow) => void;
  onDelete: (id: string) => void;
}) {
  if (tasks.length === 0) {
    return <Card><CardContent className="p-12 text-center text-sm text-muted-foreground">لا توجد مهام مطابقة</CardContent></Card>;
  }
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">المهمة</TableHead>
            <TableHead className="text-right">اللجنة</TableHead>
            <TableHead className="text-right">الحالة</TableHead>
            <TableHead className="text-right">الأولوية</TableHead>
            <TableHead className="text-right">تاريخ الاستحقاق</TableHead>
            <TableHead className="text-right">إجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((t) => {
            const cm = cmMap.get(t.committee_id);
            const overdue = isOverdue(t);
            return (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => onOpen(t)}>
                <TableCell className="font-bold">
                  {t.title}
                  {overdue && <Badge className="ms-2 text-[10px] bg-rose-500/15 text-rose-600 border-rose-500/30">متأخرة</Badge>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{cm?.name ?? "—"}</TableCell>
                <TableCell>
                  {canEdit ? (
                    <Select value={t.status} onValueChange={(v) => onMove(t.id, v as TaskRow["status"])}>
                      <SelectTrigger className="w-[140px] h-8" onClick={(e) => e.stopPropagation()}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_META) as TaskRow["status"][]).map((s) => (
                          <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className={STATUS_META[t.status].color}>{STATUS_META[t.status].label}</Badge>
                  )}
                </TableCell>
                <TableCell><Badge variant="outline" className={PRIORITY_META[t.priority].cls}>{PRIORITY_META[t.priority].label}</Badge></TableCell>
                <TableCell className="text-xs">{t.due_date ? new Date(t.due_date).toLocaleDateString("ar-SA") : "—"}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {canEdit && (
                    <Button size="sm" variant="ghost" onClick={() => onDelete(t.id)} className="text-rose-500 hover:text-rose-600">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function PerformanceGrid({ committees, tasks }: { committees: CommitteeRow[]; tasks: TaskRow[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {committees.map((c) => {
        const ct = tasks.filter((t) => t.committee_id === c.id);
        const completed = ct.filter((t) => t.status === "completed").length;
        const total = ct.length;
        const rate = total === 0 ? 0 : Math.round((completed / total) * 100);
        const overdue = ct.filter(isOverdue).length;
        const meta = committeeByType(c.type);
        return (
          <Card key={c.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {meta && (
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${meta.tone}`}>
                      <meta.icon className="h-4 w-4" />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-sm">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground">{total} مهمة · {completed} مكتملة</p>
                  </div>
                </div>
                <Link to="/committee/$type" params={{ type: c.type }} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                  فتح <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">نسبة الإنجاز</span>
                  <span className="font-bold">{rate}%</span>
                </div>
                <Progress value={rate} className="h-2" />
              </div>
              {overdue > 0 && (
                <div className="text-xs text-rose-600 inline-flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> {overdue} مهمة متأخرة
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
