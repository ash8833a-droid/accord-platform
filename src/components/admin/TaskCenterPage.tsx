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
  ArrowUp, ArrowDown,
  RefreshCw,
} from "lucide-react";
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
    <div className="p-4 lg:p-8 space-y-6" dir="rtl">
      <PageHeroHeader
        eyebrow="مركز عمليات اللجان"
        title="ومتابعة المهام"
        highlight="إدارة"
        subtitle="إنشاء ومتابعة مهام جميع اللجان من مكان واحد"
        icon={Target}
        actions={canEdit ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={async () => { await load(); toast.success("تم تحديث الترتيب"); }}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" /> تحديث
            </Button>
            <Button
              onClick={() => setCreateOpen(true)}
              className="gap-2 bg-gold text-gold-foreground hover:bg-gold/90"
            >
              <Plus className="h-4 w-4" /> مهمة جديدة
            </Button>
          </div>
        ) : null}
      />

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
          <Select value={committeeFilter} onValueChange={setCommitteeFilter}>
            <SelectTrigger className="w-[180px] order-3"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل اللجان</SelectItem>
              {committees.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[200px] order-4">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث في المهام..." className="pr-9" />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="board" dir="rtl" className="w-full">
        <TabsList>
          <TabsTrigger value="board">المهام</TabsTrigger>
          <TabsTrigger value="performance">أداء اللجان</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4">
          {view === "kanban"
            ? <KanbanBoard tasks={filtered} cmMap={cmMap} canEdit={canEdit} onMove={moveTask} onReorder={reorderTask} onStep={stepTask} onOpen={setDetails} onDelete={deleteTask} />
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {cols.map((status) => {
        const meta = STATUS_META[status];
        const items = tasks
          .filter((t) => t.status === status)
          .sort(comparePmp);
        return (
          <div
            key={status}
            onDragOver={(e) => { if (canEdit) e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              if (!canEdit || !dragId) return;
              // Drop on empty column area → move to end
              const dragged = tasks.find((t) => t.id === dragId);
              if (dragged && dragged.status === status && items.length > 0) {
                // if dropped on column (not on a card), append to end of this committee group
                onReorder(dragId, status, dragged.committee_id, null, false);
              } else if (dragged) {
                onMove(dragId, status);
              }
              setDragId(null); setDragOverId(null); setDragOverPos(null);
            }}
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
              {items.map((t, idx) => {
                const cm = cmMap.get(t.committee_id);
                const cmeta = cm ? committeeByType(cm.type) : null;
                const overdue = isOverdue(t);
                const isDragging = dragId === t.id;
                const showBefore = dragOverId === t.id && dragOverPos === "before";
                const showAfter = dragOverId === t.id && dragOverPos === "after";
                // Position within the same committee+status group (for step buttons)
                const sameGroup = items.filter((x) => x.committee_id === t.committee_id);
                const groupIdx = sameGroup.findIndex((x) => x.id === t.id);
                const isFirstInGroup = groupIdx === 0;
                const isLastInGroup = groupIdx === sameGroup.length - 1;
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
                    className={`group rounded-lg border bg-card p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${isDragging ? "opacity-40" : ""}`}
                  >
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
                    {showAfter && <div className="h-1 bg-primary rounded mt-1" />}
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
