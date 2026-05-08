import { useEffect, useMemo, useState } from "react";
import "drag-drop-touch";
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
  ArrowUp, ArrowDown,
  RefreshCw,
} from "lucide-react";
import { Bell, PartyPopper, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { CreateTaskDialog } from "@/components/admin/CreateTaskDialog";
import { TaskDetailsDialog } from "@/components/admin/TaskDetailsDialog";
import { PageHeroHeader } from "@/components/PageHeroHeader";

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
  sort_order: number;
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

// Thick colored left-border per priority (renders on the right in RTL via border-r)
const PRIORITY_BORDER: Record<TaskRow["priority"], string> = {
  urgent: "border-r-4 border-r-rose-500",
  high:   "border-r-4 border-r-orange-500",
  medium: "border-r-4 border-r-amber-400",
  low:    "border-r-4 border-r-slate-300",
};

function isOverdue(t: TaskRow): boolean {
  if (!t.due_date || t.status === "completed") return false;
  return new Date(t.due_date).getTime() < Date.now() - 86400000;
}

// PMP-style priority ranking (Urgent → High → Medium → Low)
const PRIORITY_RANK: Record<TaskRow["priority"], number> = {
  urgent: 1, high: 2, medium: 3, low: 4,
};

/**
 * Comparator following project-management best practice:
 * 1) Overdue items first (most days late on top)
 * 2) Higher priority first (Urgent > High > Medium > Low)
 * 3) Earlier due date first (nulls last)
 * 4) Manual sort_order (drag-and-drop) as a fine-grained tiebreaker
 * 5) Older created_at as a final stable tiebreaker
 */
function comparePmp(a: TaskRow, b: TaskRow): number {
  const ao = isOverdue(a) ? 0 : 1;
  const bo = isOverdue(b) ? 0 : 1;
  if (ao !== bo) return ao - bo;
  const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (pr !== 0) return pr;
  const ad = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
  const bd = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
  if (ad !== bd) return ad - bd;
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

export function TaskCenterPage() {
  return (
    <PageGate pageKey="admin-tasks">
      {({ canEdit }) => <TaskCenterInner canEdit={canEdit} />}
    </PageGate>
  );
}

function TaskCenterInner({ canEdit }: { canEdit: boolean }) {
  const { user, hasRole, committeeId } = useAuth();
  const isPrivileged = hasRole("admin") || hasRole("quality");
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
        .select("id, title, description, committee_id, status, priority, assigned_to, due_date, created_at, sort_order")
        .order("sort_order", { ascending: true })
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

  // Regular committee members: lock view to their own committee only.
  const scopedTasks = useMemo(() => {
    if (isPrivileged || !committeeId) return tasks;
    return tasks.filter((t) => t.committee_id === committeeId);
  }, [tasks, isPrivileged, committeeId]);
  const scopedCommittees = useMemo(() => {
    if (isPrivileged || !committeeId) return committees;
    return committees.filter((c) => c.id === committeeId);
  }, [committees, isPrivileged, committeeId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedTasks.filter((t) => {
      if (isPrivileged && committeeFilter !== "all" && t.committee_id !== committeeFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (!q) return true;
      const cn = cmMap.get(t.committee_id)?.name ?? "";
      return t.title.toLowerCase().includes(q)
        || (t.description ?? "").toLowerCase().includes(q)
        || cn.toLowerCase().includes(q);
    });
  }, [scopedTasks, isPrivileged, committeeFilter, priorityFilter, search, cmMap]);

  const stats = useMemo(() => {
    const active = scopedTasks.filter((t) => t.status !== "completed");
    const completed = scopedTasks.filter((t) => t.status === "completed").length;
    const overdue = scopedTasks.filter(isOverdue).length;
    const total = scopedTasks.length;
    const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);
    const committeesWithTasks = new Set(scopedTasks.map((t) => t.committee_id));
    const empty = scopedCommittees.filter((c) => !committeesWithTasks.has(c.id)).length;
    return { activeCount: active.length, completionRate, overdue, empty };
  }, [scopedTasks, scopedCommittees]);

  // Most urgent active task for the current scope (committee member sees their committee).
  const urgentTask = useMemo(() => {
    const order: Record<TaskRow["priority"], number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    const active = scopedTasks.filter((t) => t.status === "todo" || t.status === "in_progress");
    if (active.length === 0) return null;
    return [...active].sort((a, b) => {
      const pa = order[a.priority] ?? 9;
      const pb = order[b.priority] ?? 9;
      if (pa !== pb) return pa - pb;
      const da = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
      const db = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
      return da - db;
    })[0];
  }, [scopedTasks]);

  const moveTask = async (id: string, to: TaskRow["status"]) => {
    const prev = tasks;
    setTasks((s) => s.map((t) => (t.id === id ? { ...t, status: to } : t)));
    const { error } = await supabase.from("committee_tasks").update({ status: to }).eq("id", id);
    if (error) { setTasks(prev); toast.error("تعذّر نقل المهمة: " + error.message); }
  };

  // Reorder a task within the same column (committee + status). targetId is the task we drop ON; if null → drop at end.
  const reorderTask = async (
    draggedId: string,
    targetStatus: TaskRow["status"],
    targetCommitteeId: string,
    targetId: string | null,
    placeBefore: boolean,
  ) => {
    const dragged = tasks.find((t) => t.id === draggedId);
    if (!dragged) return;
    // Only reorder when staying in same committee AND same status
    if (dragged.committee_id !== targetCommitteeId || dragged.status !== targetStatus) {
      // fall back to status move only (cross-column)
      if (dragged.status !== targetStatus) await moveTask(draggedId, targetStatus);
      return;
    }
    const column = tasks
      .filter((t) => t.committee_id === targetCommitteeId && t.status === targetStatus && t.id !== draggedId)
      .sort(comparePmp);
    let newOrder: number;
    if (!targetId || column.length === 0) {
      const last = column[column.length - 1];
      newOrder = (last?.sort_order ?? 0) + 1000;
    } else {
      const idx = column.findIndex((t) => t.id === targetId);
      if (idx === -1) {
        newOrder = (column[column.length - 1]?.sort_order ?? 0) + 1000;
      } else if (placeBefore) {
        const prevOrder = idx === 0 ? (column[0].sort_order - 1000) : column[idx - 1].sort_order;
        newOrder = (prevOrder + column[idx].sort_order) / 2;
      } else {
        const nextOrder = idx === column.length - 1 ? (column[idx].sort_order + 1000) : column[idx + 1].sort_order;
        newOrder = (column[idx].sort_order + nextOrder) / 2;
      }
    }
    const prev = tasks;
    setTasks((s) => s.map((t) => (t.id === draggedId ? { ...t, sort_order: newOrder } : t)));
    const { error } = await supabase.from("committee_tasks").update({ sort_order: newOrder }).eq("id", draggedId);
    if (error) { setTasks(prev); toast.error("تعذّر إعادة الترتيب: " + error.message); }
  };

  const deleteTask = async (id: string) => {
    if (!confirm("حذف المهمة نهائياً؟")) return;
    const { error } = await supabase.from("committee_tasks").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("تم الحذف");
  };

  // Manual move within the same column (committee + status) by N steps.
  // steps: 1 = خطوة واحدة. 0 / Infinity → نقل لأقصى الطرف.
  const stepTask = async (taskId: string, direction: "up" | "down", steps = 1) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    const column = tasks
      .filter((x) => x.committee_id === t.committee_id && x.status === t.status)
      .sort(comparePmp);
    const idx = column.findIndex((x) => x.id === taskId);
    if (idx === -1) return;

    const maxUp = idx;
    const maxDown = column.length - 1 - idx;
    const want = !Number.isFinite(steps) || steps <= 0 ? Infinity : Math.floor(steps);
    const move = direction === "up" ? Math.min(want, maxUp) : Math.min(want, maxDown);
    if (move <= 0) { toast.info("لا يمكن النقل أكثر في هذا الاتجاه"); return; }

    const targetIdx = direction === "up" ? idx - move : idx + move;
    // Build the new column order by inserting the dragged item at targetIdx
    const without = column.filter((x) => x.id !== taskId);
    const reordered = [...without.slice(0, targetIdx), t, ...without.slice(targetIdx)];
    // Reassign sort_order using existing values from the column (preserves spacing)
    const orderValues = column.map((x) => x.sort_order).sort((a, b) => a - b);
    const updates = reordered.map((task, i) => ({ id: task.id, sort_order: orderValues[i] }));
    // Only persist rows whose sort_order actually changed
    const changed = updates.filter((u) => {
      const orig = column.find((x) => x.id === u.id);
      return orig && orig.sort_order !== u.sort_order;
    });
    if (changed.length === 0) return;

    const prev = tasks;
    const newOrderMap = new Map(updates.map((u) => [u.id, u.sort_order]));
    setTasks((s) => s.map((x) => newOrderMap.has(x.id) ? { ...x, sort_order: newOrderMap.get(x.id)! } : x));

    const results = await Promise.all(
      changed.map((u) => supabase.from("committee_tasks").update({ sort_order: u.sort_order }).eq("id", u.id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      setTasks(prev);
      toast.error("تعذّر النقل: " + failed.error.message);
    } else if (move > 1) {
      toast.success(`تم النقل ${move} خطوات`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-10 space-y-8 bg-[#f8fafc] dark:bg-background min-h-screen" dir="rtl">
      {/* Active task alert banner */}
      {urgentTask ? (
        <div className="rounded-xl border-2 border-sky-300/60 dark:border-sky-700/60 bg-sky-50/80 dark:bg-sky-950/30 px-4 py-3 shadow-sm">
          <div className="flex items-start sm:items-center gap-3 flex-col sm:flex-row">
            <div className="h-10 w-10 rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0">
              <Bell className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">المهمة النشطة الحالية</span>
                <Badge variant="outline" className={PRIORITY_META[urgentTask.priority].cls}>
                  {PRIORITY_META[urgentTask.priority].label}
                </Badge>
                <Badge variant="outline" className={STATUS_META[urgentTask.status].color}>
                  {STATUS_META[urgentTask.status].label}
                </Badge>
              </div>
              <h2 className="text-base sm:text-lg font-bold mt-1 truncate">{urgentTask.title}</h2>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                {urgentTask.due_date && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5" />
                    تاريخ الاستحقاق: {new Date(urgentTask.due_date).toLocaleDateString("ar-SA")}
                  </span>
                )}
                {cmMap.get(urgentTask.committee_id) && (
                  <span className="truncate">{cmMap.get(urgentTask.committee_id)!.name}</span>
                )}
              </div>
            </div>
            <Button size="sm" onClick={() => setDetails(urgentTask)} className="gap-2 shrink-0">
              <ExternalLink className="h-3.5 w-3.5" /> عرض التفاصيل
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-emerald-300/60 dark:border-emerald-700/60 bg-emerald-50/80 dark:bg-emerald-950/30 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <PartyPopper className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-emerald-800 dark:text-emerald-200">تم إنجاز جميع المهام</h2>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">لا توجد مهام معلقة حالياً. عمل رائع!</p>
            </div>
          </div>
        </div>
      )}

      {/* Compact header — slim banner to keep board near the top */}
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-gradient-to-l from-primary/10 to-transparent px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Target className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold leading-tight truncate">
              {isPrivileged ? "إدارة ومتابعة المهام" : `مهام لجنتك${committeeId && cmMap.get(committeeId) ? ` — ${cmMap.get(committeeId)!.name}` : ""}`}
            </h1>
            <p className="text-[11px] text-muted-foreground truncate">
              {isPrivileged ? "كل اللجان في مكان واحد" : "المهام المعنية بلجنتك فقط"}
            </p>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => { await load(); toast.success("تم التحديث"); }}
              className="gap-2 h-8"
            >
              <RefreshCw className="h-3.5 w-3.5" /> تحديث
            </Button>
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="gap-2 h-8 bg-gold text-gold-foreground hover:bg-gold/90"
            >
              <Plus className="h-3.5 w-3.5" /> مهمة جديدة
            </Button>
          </div>
        )}
      </div>

      {/* Global KPI cards — only for admins/quality. Members see their own scoped quick stats. */}
      {isPrivileged ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-7">
          <KpiCard label="إجمالي المهام النشطة" value={String(stats.activeCount)} icon={ListTodo} tone="text-sky-600 bg-sky-500/10" />
          <KpiCard label="نسبة الإنجاز الكلية" value={`${stats.completionRate}%`} icon={CheckCircle2} tone="text-emerald-600 bg-emerald-500/10" />
          <KpiCard label="المهام المتأخرة" value={String(stats.overdue)} icon={AlertTriangle} tone="text-rose-600 bg-rose-500/10" />
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border bg-sky-500/10 text-sky-700 px-3 py-1">نشطة: <b>{stats.activeCount}</b></span>
          <span className="rounded-full border bg-emerald-500/10 text-emerald-700 px-3 py-1">إنجاز: <b>{stats.completionRate}%</b></span>
          <span className="rounded-full border bg-rose-500/10 text-rose-700 px-3 py-1">متأخرة: <b>{stats.overdue}</b></span>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border bg-background p-0.5 order-1">
            <button onClick={() => setView("kanban")} className={`px-3 py-1.5 text-xs rounded-md inline-flex items-center gap-1.5 ${view === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><LayoutGrid className="h-3.5 w-3.5" />كانبان</button>
            <button onClick={() => setView("list")} className={`px-3 py-1.5 text-xs rounded-md inline-flex items-center gap-1.5 ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><Rows3 className="h-3.5 w-3.5" />قائمة</button>
          </div>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[140px] order-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأولويات</SelectItem>
              {Object.entries(PRIORITY_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {isPrivileged && (
            <Select value={committeeFilter} onValueChange={setCommitteeFilter}>
              <SelectTrigger className="w-[180px] order-3"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل اللجان</SelectItem>
                {committees.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="relative flex-1 min-w-[200px] order-4">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث في المهام..." className="pr-9" />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="board" dir="rtl" className="w-full">
        <TabsList>
          <TabsTrigger value="board">المهام</TabsTrigger>
          {isPrivileged && <TabsTrigger value="performance">أداء اللجان</TabsTrigger>}
        </TabsList>

        <TabsContent value="board" className="mt-4">
          {view === "kanban"
            ? <KanbanBoard tasks={filtered} cmMap={cmMap} canEdit={canEdit} onMove={moveTask} onReorder={reorderTask} onStep={stepTask} onOpen={setDetails} onDelete={deleteTask} />
            : <ListView tasks={filtered} cmMap={cmMap} canEdit={canEdit} onMove={moveTask} onOpen={setDetails} onDelete={deleteTask} />
          }
        </TabsContent>

        {isPrivileged && (
          <TabsContent value="performance" className="mt-4">
            <PerformanceGrid committees={committees} tasks={tasks} />
          </TabsContent>
        )}
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
    <Card className="bg-white dark:bg-card border-slate-200/70 dark:border-border shadow-sm hover:shadow-md transition-shadow rounded-2xl">
      <CardContent className="p-6 flex items-center gap-5">
        <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${tone}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground tracking-wide">{label}</p>
          <p className="text-3xl font-extrabold tabular-nums mt-1 leading-none">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function KanbanBoard({
  tasks, cmMap, canEdit, onMove, onReorder, onStep, onOpen, onDelete,
}: {
  tasks: TaskRow[];
  cmMap: Map<string, CommitteeRow>;
  canEdit: boolean;
  onMove: (id: string, to: TaskRow["status"]) => void;
  onReorder: (draggedId: string, targetStatus: TaskRow["status"], targetCommitteeId: string, targetId: string | null, placeBefore: boolean) => void;
  onStep: (id: string, direction: "up" | "down", steps?: number) => void;
  onOpen: (t: TaskRow) => void;
  onDelete: (id: string) => void;
}) {
  const cols: TaskRow["status"][] = ["todo", "in_progress", "completed"];
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPos, setDragOverPos] = useState<"before" | "after" | null>(null);
  const [dragOverColKey, setDragOverColKey] = useState<string | null>(null);

  const committeeGroups = useMemo(() => {
    const grouped = new Map<string, TaskRow[]>();
    for (const task of tasks) {
      if (!grouped.has(task.committee_id)) grouped.set(task.committee_id, []);
      grouped.get(task.committee_id)!.push(task);
    }
    return Array.from(grouped.entries()).map(([cid, list]) => ({
      cid,
      name: cmMap.get(cid)?.name ?? "—",
      type: cmMap.get(cid)?.type ?? "",
      list,
    })).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [tasks, cmMap]);

  return (
    <div className="space-y-4">
      {committeeGroups.length === 0 && <Card><CardContent className="p-12 text-center text-sm text-muted-foreground">لا توجد مهام</CardContent></Card>}
      {committeeGroups.map((group) => {
        const gmeta = group.type ? committeeByType(group.type) : null;
        const total = group.list.length;
        const completed = group.list.filter((t) => t.status === "completed").length;
        const todoCount = group.list.filter((t) => t.status === "todo").length;
        const inProgressCount = group.list.filter((t) => t.status === "in_progress").length;
        const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
        const rate = pct(completed);
        const todoPct = pct(todoCount);
        const inProgressPct = pct(inProgressCount);
        return (
          <section key={group.cid} className="rounded-xl border bg-card overflow-hidden">
            <div className="border-b bg-muted/20 px-4 py-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {gmeta && (
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${gmeta.tone}`}>
                      <gmeta.icon className="h-4 w-4" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-sm">{group.name}</h3>
                    <p className="text-[11px] text-muted-foreground">منهجية PMP: انتظار ← تنفيذ ← إغلاق</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{total} مهمة</Badge>
                  <Badge variant="outline" className="bg-slate-500/10 text-slate-700 border-slate-500/30">
                    انتظار {todoCount} ({todoPct}%)
                  </Badge>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">
                    تنفيذ {inProgressCount} ({inProgressPct}%)
                  </Badge>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                    إغلاق {completed} ({rate}%)
                  </Badge>
                </div>
              </div>
              {total > 0 && (
                <div className="space-y-1.5">
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="bg-slate-400 h-full transition-all" style={{ width: `${todoPct}%` }} title={`انتظار ${todoPct}%`} />
                    <div className="bg-amber-500 h-full transition-all" style={{ width: `${inProgressPct}%` }} title={`تنفيذ ${inProgressPct}%`} />
                    <div className="bg-emerald-500 h-full transition-all" style={{ width: `${rate}%` }} title={`إغلاق ${rate}%`} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>التقدم الكلي</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">إنجاز {rate}%</span>
                  </div>
                </div>
              )}
            </div>
            {/* Kanban — single layout for desktop & mobile (touch DnD enabled via polyfill) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 p-3">
              <div className="lg:hidden -mb-1 flex items-center gap-2 text-[11px] text-muted-foreground bg-sky-50 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-800/60 rounded-md px-2.5 py-1.5">
                <GripVertical className="h-3.5 w-3.5" />
                <span>اضغط مطوّلاً على المقبض لسحب البطاقة. التمرير العادي يعمل بشكل طبيعي.</span>
              </div>
              {cols.map((status) => {
                const meta = STATUS_META[status];
                const statusItems = group.list.filter((t) => t.status === status).sort(comparePmp);
                return (
                  <div
                    key={`${group.cid}-${status}`}
                    onDragOver={(e) => {
                      if (!canEdit || !dragId) return;
                      e.preventDefault();
                      setDragOverColKey(`${group.cid}-${status}`);
                    }}
                    onDragLeave={(e) => {
                      // Only clear when leaving the column itself, not its children
                      if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
                        setDragOverColKey((k) => (k === `${group.cid}-${status}` ? null : k));
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (!canEdit || !dragId) { setDragOverColKey(null); return; }
                      const dragged = tasks.find((t) => t.id === dragId);
                      if (!dragged || dragged.committee_id !== group.cid) {
                        setDragId(null); setDragOverId(null); setDragOverPos(null); setDragOverColKey(null);
                        return;
                      }
                      if (dragged.status === status && statusItems.length > 0) {
                        onReorder(dragId, status, group.cid, null, false);
                      } else if (dragged.status !== status) {
                        onMove(dragId, status);
                      }
                      setDragId(null); setDragOverId(null); setDragOverPos(null); setDragOverColKey(null);
                    }}
                    className={`rounded-lg border bg-muted/20 p-3 min-h-[220px] transition-all ${
                      dragOverColKey === `${group.cid}-${status}` && dragId
                        ? "border-primary border-2 bg-primary/5 shadow-lg shadow-primary/20 ring-2 ring-primary/30"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <meta.icon className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-bold text-xs">{meta.label}</h4>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{statusItems.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {statusItems.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">لا توجد مهام</p>}
                      {statusItems.map((t, idx) => {
                const cm = cmMap.get(t.committee_id);
                const cmeta = cm ? committeeByType(cm.type) : null;
                const overdue = isOverdue(t);
                const isDragging = dragId === t.id;
                const showBefore = dragOverId === t.id && dragOverPos === "before";
                const showAfter = dragOverId === t.id && dragOverPos === "after";
                const isFirstInGroup = idx === 0;
                const isLastInGroup = idx === statusItems.length - 1;
                return (
                  <div key={t.id}>
                    {showBefore && <div className="h-1 bg-primary rounded mb-1" />}
                  <div
                    draggable={canEdit}
                    onDragStart={(e) => { setDragId(t.id); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => { setDragId(null); setDragOverId(null); setDragOverPos(null); }}
                    onDragOver={(e) => {
                      if (!canEdit || !dragId || dragId === t.id) return;
                      e.preventDefault();
                      e.stopPropagation();
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const before = (e.clientY - rect.top) < rect.height / 2;
                      setDragOverId(t.id);
                      setDragOverPos(before ? "before" : "after");
                    }}
                    onDragLeave={() => {
                      if (dragOverId === t.id) { setDragOverId(null); setDragOverPos(null); }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!canEdit || !dragId || dragId === t.id) return;
                      const placeBefore = dragOverPos === "before";
                      onReorder(dragId, status, t.committee_id, t.id, placeBefore);
                      setDragId(null); setDragOverId(null); setDragOverPos(null);
                    }}
                    onClick={() => onOpen(t)}
                    style={{ touchAction: "pan-y" }}
                    className={`group relative rounded-lg border bg-card p-3 ps-9 pr-3.5 cursor-grab active:cursor-grabbing hover:shadow-md hover:-translate-y-0.5 transition-all select-none ${PRIORITY_BORDER[t.priority]} ${isDragging ? "opacity-40 rotate-1 shadow-xl ring-2 ring-primary/40" : ""}`}
                  >
                    {/* Visible drag handle (also acts as a touch-friendly affordance) */}
                    <div
                      aria-hidden
                      className="absolute inset-y-0 start-0 w-7 flex items-center justify-center text-muted-foreground/60 group-hover:text-primary border-e border-dashed border-border/60 bg-muted/30 rounded-s-lg"
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold flex-1 line-clamp-2">
                        <span className="text-[10px] text-muted-foreground me-1">#{idx + 1}</span>
                        {t.title}
                      </p>
                      {canEdit && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); onStep(t.id, "up", 1); }}
                            disabled={isFirstInGroup}
                            className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground hover:text-primary"
                            aria-label="نقل لأعلى"
                            title="نقل خطوة لأعلى"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onStep(t.id, "down", 1); }}
                            disabled={isLastInGroup}
                            className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground hover:text-primary"
                            aria-label="نقل لأسفل"
                            title="نقل خطوة لأسفل"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
                            className="p-1 rounded hover:bg-muted text-rose-500 hover:text-rose-600"
                            aria-label="حذف"
                            title="حذف"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center flex-wrap gap-1 mt-2">
                      {cmeta && (
                        <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${cmeta.tone}`}>
                          <cmeta.icon className="h-3 w-3" />{cm?.name}
                        </span>
                      )}
                      <Badge variant="outline" className={`text-[10px] ${PRIORITY_META[t.priority].cls}`}>{PRIORITY_META[t.priority].label}</Badge>
                    </div>
                    {t.due_date && (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md border ${
                            overdue
                              ? "bg-rose-500/10 text-rose-600 border-rose-500/40"
                              : "bg-muted text-foreground/80 border-border"
                          }`}
                          title={overdue ? "تاريخ متأخر" : "تاريخ الاستحقاق"}
                        >
                          <CalendarClock className="h-3 w-3" />
                          {new Date(t.due_date).toLocaleDateString("ar-SA")}
                        </span>
                        {overdue && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600">
                            <AlertTriangle className="h-3 w-3" />متأخرة
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                    {showAfter && <div className="h-1 bg-primary rounded mt-1" />}
                  </div>
                );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
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

function MobileColumns({
  group, cmMap, canEdit, onMove, onOpen, onDelete,
}: {
  group: { cid: string; name: string; type: string; list: TaskRow[] };
  cmMap: Map<string, CommitteeRow>;
  canEdit: boolean;
  onMove: (id: string, to: TaskRow["status"]) => void;
  onOpen: (t: TaskRow) => void;
  onDelete: (id: string) => void;
}) {
  const cols: TaskRow["status"][] = ["todo", "in_progress", "completed"];
  const counts = {
    todo: group.list.filter((t) => t.status === "todo").length,
    in_progress: group.list.filter((t) => t.status === "in_progress").length,
    completed: group.list.filter((t) => t.status === "completed").length,
  };
  const initial: TaskRow["status"] = counts.in_progress > 0 ? "in_progress" : counts.todo > 0 ? "todo" : "completed";
  const [tab, setTab] = useState<TaskRow["status"]>(initial);
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as TaskRow["status"])} dir="rtl" className="w-full">
      <TabsList className="w-full grid grid-cols-3 h-auto">
        {cols.map((s) => {
          const meta = STATUS_META[s];
          return (
            <TabsTrigger key={s} value={s} className="flex flex-col gap-0.5 py-2 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <span className="inline-flex items-center gap-1"><meta.icon className="h-3.5 w-3.5" />{meta.label}</span>
              <span className="text-[10px] opacity-80">{counts[s]}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
      {cols.map((status) => {
        const items = group.list.filter((t) => t.status === status).sort(comparePmp);
        return (
          <TabsContent key={status} value={status} className="mt-3 space-y-2">
            {items.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">لا توجد مهام في هذا العمود</p>
            )}
            {items.map((t, idx) => {
              const cm = cmMap.get(t.committee_id);
              const cmeta = cm ? committeeByType(cm.type) : null;
              const overdue = isOverdue(t);
              return (
                <div
                  key={t.id}
                  onClick={() => onOpen(t)}
                  className={`rounded-lg border bg-card p-3 active:bg-muted/40 transition-colors ${PRIORITY_BORDER[t.priority]}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold flex-1 line-clamp-2">
                      <span className="text-[10px] text-muted-foreground me-1">#{idx + 1}</span>
                      {t.title}
                    </p>
                    {canEdit && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
                        className="p-1.5 rounded text-rose-500 hover:bg-rose-500/10 shrink-0"
                        aria-label="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
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
                  </div>
                  {t.due_date && (
                    <div className="mt-2">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md border ${
                          overdue
                            ? "bg-rose-500/10 text-rose-600 border-rose-500/40"
                            : "bg-muted text-foreground/80 border-border"
                        }`}
                      >
                        <CalendarClock className="h-3 w-3" />
                        {new Date(t.due_date).toLocaleDateString("ar-SA")}
                        {overdue && <span className="ms-1 font-bold">· متأخرة</span>}
                      </span>
                    </div>
                  )}
                  {canEdit && (
                    <div
                      className="mt-3 pt-3 border-t flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-[11px] text-muted-foreground shrink-0">تغيير الحالة:</span>
                      <Select value={t.status} onValueChange={(v) => onMove(t.id, v as TaskRow["status"])}>
                        <SelectTrigger className="h-9 flex-1 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {cols.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">{STATUS_META[s].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

function PerformanceGrid({ committees, tasks }: { committees: CommitteeRow[]; tasks: TaskRow[] }) {
  return (
    <div className="space-y-4">
      {committees.map((c) => {
        const ct = tasks.filter((t) => t.committee_id === c.id);
        const completed = ct.filter((t) => t.status === "completed").length;
        const total = ct.length;
        const rate = total === 0 ? 0 : Math.round((completed / total) * 100);
        const overdue = ct.filter(isOverdue).length;
        const meta = committeeByType(c.type);
        return (
          <Card key={c.id} className="bg-white dark:bg-card border-slate-200/70 dark:border-border shadow-sm hover:shadow-md transition-shadow rounded-2xl">
            <CardContent className="p-5 lg:p-6">
              <div className="flex items-center gap-4 lg:gap-6">
                {meta && (
                  <div className={`h-14 w-14 lg:h-16 lg:w-16 rounded-2xl flex items-center justify-center shrink-0 ${meta.tone}`}>
                    <meta.icon className="h-6 w-6 lg:h-7 lg:w-7" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                    <div className="min-w-0">
                      <h3 className="font-bold text-base lg:text-lg leading-tight truncate">{c.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">مسار اللجنة</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-2xl lg:text-3xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400 leading-none">{rate}%</span>
                      <Link to="/committee/$type" params={{ type: c.type }} className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-semibold">
                        فتح <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                  <Progress value={rate} className="h-3 rounded-full" />
                  <div className="flex items-center justify-between gap-3 mt-2 text-xs flex-wrap">
                    <div className="text-muted-foreground tabular-nums">
                      <span className="font-semibold text-foreground">{total}</span> مهمة
                      <span className="mx-1.5">•</span>
                      <span className="font-semibold text-foreground">{completed}</span> مكتملة
                      {total - completed > 0 && (
                        <>
                          <span className="mx-1.5">•</span>
                          <span className="font-semibold text-foreground">{total - completed}</span> قيد العمل
                        </>
                      )}
                    </div>
                    {overdue > 0 && (
                      <div className="text-rose-600 inline-flex items-center gap-1 font-semibold">
                        <AlertTriangle className="h-3.5 w-3.5" /> {overdue} متأخرة
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
