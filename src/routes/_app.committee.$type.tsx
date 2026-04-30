import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, ListTodo, Receipt, Wallet, ArrowLeft, FileText, Upload, Loader2, Pencil, Trash2, GripVertical, User as UserIcon, Users, Target, CheckCircle2, AlertTriangle, MessageSquare, FileSpreadsheet, Printer, MessagesSquare, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { committeeByType, COMMITTEES } from "@/lib/committees";
import * as XLSX from "xlsx";
import { FinanceModule } from "@/components/FinanceModule";
import { PmpCharter } from "@/components/committee/PmpCharter";
import { InvitationCards } from "@/components/media/InvitationCards";
import { MediaInbox } from "@/components/media/MediaInbox";
import { ProcurementRequestsBoard } from "@/components/procurement/ProcurementRequestsBoard";
import { TaskAttachments } from "@/components/TaskAttachments";
import { TaskComments } from "@/components/TaskComments";
import { CommitteeArchive } from "@/components/CommitteeArchive";
import { CommitteeMembersPanel } from "@/components/CommitteeMembersPanel";
import { QuickResponseBar } from "@/components/QuickResponseBar";
import { GroomFollowups } from "@/components/committee/GroomFollowups";
import { QualityAuditPanel } from "@/components/quality/QualityAuditPanel";
import { EvaluationPlanBuilder } from "@/components/quality/EvaluationPlanBuilder";
import { EvaluationCriteria } from "@/components/quality/EvaluationCriteria";
import { EvaluationForm } from "@/components/quality/EvaluationForm";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ClipboardList, ClipboardCheck, CalendarRange, ShieldCheck, UsersRound, HeartHandshake, Wallet as WalletIcon, Megaphone, Inbox, Archive } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { useAppSetting } from "@/hooks/use-app-setting";
import { COMMITTEE_MEMBER_LABEL, committeeMemberLabel } from "@/lib/committee-member-labels";

export const Route = createFileRoute("/_app/committee/$type")({
  component: CommitteePage,
  notFoundComponent: () => (
    <div className="text-center py-20">
      <p className="text-muted-foreground">اللجنة غير موجودة</p>
      <Link to="/admin" className="text-primary underline mt-4 inline-block">العودة</Link>
    </div>
  ),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    const isChunkError = /Failed to fetch dynamically imported module|Loading chunk|ChunkLoadError/i.test(
      error?.message ?? "",
    );
    // Auto-retry stale chunk errors once (occurs after a deploy/HMR refresh)
    if (isChunkError && typeof window !== "undefined") {
      const flag = "__committee_chunk_retry__";
      if (!sessionStorage.getItem(flag)) {
        sessionStorage.setItem(flag, "1");
        window.location.reload();
        return null;
      }
    }
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <p className="text-lg font-bold">تعذّر تحميل صفحة اللجنة</p>
        <p className="text-sm text-muted-foreground">{error?.message ?? "خطأ غير متوقع"}</p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={() => { sessionStorage.removeItem("__committee_chunk_retry__"); router.invalidate(); reset(); }}>
            إعادة المحاولة
          </Button>
          <Link to="/admin"><Button>العودة للرئيسية</Button></Link>
        </div>
      </div>
    );
  },
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

  const [committee, setCommittee] = useState<{ id: string; name: string; description: string | null; budget_allocated: number; budget_spent: number; head_user_id: string | null } | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  // per-task response KPIs: count + average completion %
  const [taskKpis, setTaskKpis] = useState<Record<string, { count: number; avg: number }>>({});
  const [committeeResponses, setCommitteeResponses] = useState<any[]>([]);

  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const { value: urgentAlert } = useAppSetting<{ enabled: boolean; label: string }>(
    "urgent_alert",
    { enabled: true, label: "عاجل" },
  );
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

  // Edit/Delete payment request state
  const [editPrOpen, setEditPrOpen] = useState(false);
  const [editingPr, setEditingPr] = useState<PaymentRequest | null>(null);
  const [editPrTitle, setEditPrTitle] = useState("");
  const [editPrAmount, setEditPrAmount] = useState("");

  const isHead = !!(user && committee && committee.head_user_id === user.id);
  const canManageTasks = isAdmin || isHead;

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

    const [{ data: t }, { data: p }, { data: m }, { data: am }, { data: rolesInCommittee }, { data: allRoles }, { data: rsp }] = await Promise.all([
      supabase.from("committee_tasks")
        .select("id, title, description, status, priority, assigned_to, created_at")
        .eq("committee_id", c.id)
        .order("created_at", { ascending: false }),
      supabase.from("payment_requests").select("id, title, amount, status, created_at, invoice_url").eq("committee_id", c.id).order("created_at", { ascending: false }),
      supabase.from("team_members").select("id, full_name, role_title, is_head").eq("committee_id", c.id).order("display_order"),
      supabase.from("team_members").select("id, full_name, role_title, is_head, committee_id, committees(name)").order("display_order"),
      supabase.from("user_roles").select("user_id, role").eq("committee_id", c.id),
      supabase.from("user_roles").select("user_id, role, committee_id").not("committee_id", "is", null),
      supabase
        .from("task_responses" as any)
        .select("id, task_id, author_name, action_taken, outcomes, completion_percent, challenges, recommendations, execution_date, attachments_note, created_at")
        .eq("committee_id", c.id)
        .order("created_at", { ascending: false }),
    ]);

    // Build per-task KPIs from response rows
    const responsesData = (rsp ?? []) as any[];
    const kpiMap: Record<string, { count: number; sum: number }> = {};
    responsesData.forEach((r) => {
      const k = kpiMap[r.task_id] ?? { count: 0, sum: 0 };
      k.count += 1;
      k.sum += Number(r.completion_percent) || 0;
      kpiMap[r.task_id] = k;
    });
    const kpis: Record<string, { count: number; avg: number }> = {};
    Object.entries(kpiMap).forEach(([id, v]) => {
      kpis[id] = { count: v.count, avg: Math.round(v.sum / v.count) };
    });
    setTaskKpis(kpis);
    // Stash raw response rows for export (attached to closure via state below)
    setCommitteeResponses(responsesData);

    const teamForCommittee = (m ?? []) as TeamMember[];
    const allTeam = ((am ?? []) as any[]).map((x) => ({
      id: x.id, full_name: x.full_name, role_title: x.role_title, is_head: x.is_head,
      committee_id: x.committee_id as string, committee_name: x.committees?.name ?? "",
    })) as TeamMember[];

    // Fetch profiles for users in user_roles to merge into the members lists
    const allRoleRows = (allRoles ?? []) as { user_id: string; role: string; committee_id: string }[];
    const roleUserIds = Array.from(new Set(allRoleRows.map((r) => r.user_id)));
    let profiles: { user_id: string; full_name: string }[] = [];
    if (roleUserIds.length) {
      const { data: pr } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", roleUserIds);
      profiles = pr ?? [];
    }
    const profMap = new Map(profiles.map((p) => [p.user_id, p.full_name]));
    const committeeNameById = new Map(allTeam.map((tm) => [tm.committee_id, tm.committee_name] as const));
    // Also include current committee in the map (in case it has no team_members yet)
    committeeNameById.set(c.id, c.name);

    // Build virtual TeamMember entries from user_roles, deduped against existing team_members by name+committee
    const existingKeys = new Set(allTeam.map((tm) => `${tm.committee_id}::${tm.full_name.trim()}`));
    const virtualFromRoles: TeamMember[] = [];
    allRoleRows.forEach((r) => {
      const name = profMap.get(r.user_id);
      if (!name) return;
      const key = `${r.committee_id}::${name.trim()}`;
      if (existingKeys.has(key)) return;
      existingKeys.add(key);
      virtualFromRoles.push({
        id: `role::${r.user_id}::${r.committee_id}`,
        full_name: name,
        role_title: COMMITTEE_MEMBER_LABEL,
        is_head: false,
        committee_id: r.committee_id,
        committee_name: committeeNameById.get(r.committee_id) ?? "",
      });
    });

    // Merge into members of the current committee and global list
    const mergedForCommittee = [
      ...teamForCommittee,
      ...virtualFromRoles.filter((v) => v.committee_id === c.id),
    ];
    const mergedAll = [...allTeam, ...virtualFromRoles];

    setTasks((t ?? []) as Task[]);
    setRequests((p ?? []) as PaymentRequest[]);
    setMembers(mergedForCommittee);
    setAllMembers(mergedAll);

    // Suppress unused warning for rolesInCommittee (kept for future use)
    void rolesInCommittee;
  };

  useEffect(() => {
    if (meta) load();
  }, [type]);

  // Refresh KPIs when responses change in realtime
  useEffect(() => {
    if (!committee) return;
    const ch = supabase
      .channel(`committee_responses_${committee.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_responses",
          filter: `committee_id=eq.${committee.id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.id]);

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
    if (!canManageTasks) {
      toast.error("لا تملك صلاحية إنشاء/تعديل المهام في هذه اللجنة");
      return;
    }

    // Resolve assignee: virtual role-based ids (role::userId::committeeId) need to map to a real team_members row
    let assigned_to: string | null = tAssignee === "none" ? null : tAssignee;
    if (assigned_to && assigned_to.startsWith("role::")) {
      const [, userId, committeeId] = assigned_to.split("::");
      const target = allMembers.find((m) => m.id === assigned_to);
      const fullName = target?.full_name ?? "";
      // Check if a team_members row already exists for that name+committee
      const { data: existing } = await supabase
        .from("team_members")
        .select("id")
        .eq("committee_id", committeeId)
        .eq("full_name", fullName)
        .maybeSingle();
      if (existing?.id) {
        assigned_to = existing.id;
      } else {
        // Create a minimal team_members row so notifications & assignment chain work
        const { data: created, error: createErr } = await supabase
          .from("team_members")
          .insert({
            committee_id: committeeId,
            full_name: fullName,
            role_title: COMMITTEE_MEMBER_LABEL,
            is_head: false,
          })
          .select("id")
          .single();
        if (createErr || !created) {
          toast.error("تعذّر تجهيز بيانات العضو", { description: createErr?.message });
          return;
        }
        assigned_to = created.id;
        void userId;
      }
    }

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

  /** Quick reassign a task to a member (or null) directly from the card.
   *  Resolves virtual role-based ids to real team_members rows just like saveTask. */
  const quickAssign = async (taskId: string, newAssigneeId: string | null) => {
    if (!canManageTasks) {
      toast.error("لا تملك صلاحية إسناد المهام في هذه اللجنة");
      return;
    }
    let assigned_to: string | null = newAssigneeId;
    if (assigned_to && assigned_to.startsWith("role::")) {
      const [, , committeeId] = assigned_to.split("::");
      const target = allMembers.find((m) => m.id === assigned_to);
      const fullName = target?.full_name ?? "";
      const { data: existing } = await supabase
        .from("team_members")
        .select("id")
        .eq("committee_id", committeeId)
        .eq("full_name", fullName)
        .maybeSingle();
      if (existing?.id) {
        assigned_to = existing.id;
      } else {
        const { data: created, error: createErr } = await supabase
          .from("team_members")
          .insert({
            committee_id: committeeId,
            full_name: fullName,
            role_title: COMMITTEE_MEMBER_LABEL,
            is_head: false,
          })
          .select("id")
          .single();
        if (createErr || !created) {
          toast.error("تعذّر تجهيز بيانات العضو", { description: createErr?.message });
          return;
        }
        assigned_to = created.id;
      }
    }
    // optimistic update
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, assigned_to } : t)));
    const { error } = await supabase
      .from("committee_tasks")
      .update({ assigned_to })
      .eq("id", taskId);
    if (error) {
      toast.error("تعذّر الإسناد", { description: error.message });
      load();
      return;
    }
    if (assigned_to) {
      const m = (allMembers.length ? allMembers : members).find((x) => x.id === assigned_to);
      toast.success(`تم إسناد المهمة إلى ${m?.full_name ?? "العضو"}`);
    } else {
      toast.success("تم إلغاء الإسناد");
    }
  };

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<Task["status"] | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  // ----- Manual task ordering (per-committee, persisted in localStorage) -----
  const ORDER_STORAGE_KEY = committee ? `committee:taskOrder:${committee.id}` : "";
  const [taskOrder, setTaskOrder] = useState<Record<Task["status"], string[]>>({
    todo: [], in_progress: [], completed: [],
  });
  useEffect(() => {
    if (!ORDER_STORAGE_KEY || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(ORDER_STORAGE_KEY);
      if (raw) setTaskOrder(JSON.parse(raw));
      else setTaskOrder({ todo: [], in_progress: [], completed: [] });
    } catch { /* ignore */ }
  }, [ORDER_STORAGE_KEY]);
  const persistOrder = (next: Record<Task["status"], string[]>) => {
    setTaskOrder(next);
    if (!ORDER_STORAGE_KEY || typeof window === "undefined") return;
    try { window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  /** Reorder a task within its column, inserting BEFORE targetId (or to the end if null). */
  const reorderWithinColumn = (
    sourceId: string,
    targetId: string | null,
    col: Task["status"],
    colTaskIds: string[],
  ) => {
    // Build the current effective order of the column (manual first, then the rest)
    const manual = (taskOrder[col] ?? []).filter((id) => colTaskIds.includes(id));
    const rest = colTaskIds.filter((id) => !manual.includes(id));
    const current = [...manual, ...rest];
    const without = current.filter((id) => id !== sourceId);
    let insertAt = targetId ? without.indexOf(targetId) : without.length;
    if (insertAt < 0) insertAt = without.length;
    without.splice(insertAt, 0, sourceId);
    persistOrder({ ...taskOrder, [col]: without });
  };

  const COMMENTS_STORAGE_KEY = "committee:expandedComments";
  const [expandedComments, setExpandedComments] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.localStorage.getItem(COMMENTS_STORAGE_KEY);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });
  const toggleComments = (id: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore quota / private mode */
      }
      return next;
    });
  };
  const onDragStart = (e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };
  const onDragEnd = () => { setDragId(null); setDragOverCol(null); setDragOverTaskId(null); };
  const onDragOverCol = (e: React.DragEvent, col: Task["status"]) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(col);
  };
  const onDropCol = (e: React.DragEvent, col: Task["status"], colTaskIds: string[]) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDragId(null); setDragOverCol(null); setDragOverTaskId(null);
    if (!id) return;
    const src = tasks.find((t) => t.id === id);
    if (!src) return;
    // Cross-column move: update status (will be appended to end of new column)
    if (src.status !== col) {
      moveTask(id, col);
      // Place it at the end of manual order for the new column
      const next = { ...taskOrder, [col]: [...(taskOrder[col] ?? []).filter((x) => x !== id), id] };
      persistOrder(next);
      return;
    }
    // Same column: drop on empty area → move to end
    reorderWithinColumn(id, null, col, colTaskIds);
  };
  const onDropOnCard = (e: React.DragEvent, targetId: string, col: Task["status"], colTaskIds: string[]) => {
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDragId(null); setDragOverCol(null); setDragOverTaskId(null);
    if (!id || id === targetId) return;
    const src = tasks.find((t) => t.id === id);
    if (!src) return;
    if (src.status !== col) {
      // Move across columns AND position before the target
      moveTask(id, col);
    }
    reorderWithinColumn(id, targetId, col, colTaskIds);
  };

  // ---------- Per-committee responses export ----------
  const buildExportRows = () => {
    const taskById = new Map(tasks.map((t) => [t.id, t.title]));
    return committeeResponses.map((r) => ({
      "اللجنة": committee?.name ?? "",
      "المهمة": taskById.get(r.task_id) ?? "—",
      "العضو": r.author_name,
      "الإجراء": r.action_taken,
      "المخرجات": r.outcomes ?? "",
      "الإنجاز %": r.completion_percent,
      "التحديات": r.challenges ?? "",
      "التوصيات": r.recommendations ?? "",
      "تاريخ التنفيذ": r.execution_date ?? "",
      "تاريخ الرد": new Intl.DateTimeFormat("ar-SA", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(r.created_at)),
    }));
  };

  const exportResponsesXLSX = () => {
    if (committeeResponses.length === 0) {
      toast.info("لا توجد ردود لتصديرها بعد");
      return;
    }
    const rows = buildExportRows();
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ردود اللجنة");
    XLSX.writeFile(
      wb,
      `responses-${meta?.label ?? type}-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const escapeHtml = (s: string) =>
    String(s ?? "").replace(/[&<>"']/g, (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m] as string),
    );

  const printResponsesPDF = () => {
    if (committeeResponses.length === 0) {
      toast.info("لا توجد ردود للطباعة بعد");
      return;
    }
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("الرجاء السماح بفتح النوافذ المنبثقة");
      return;
    }
    const rows = buildExportRows();
    const total = rows.length;
    const avg = Math.round(
      rows.reduce((s, r) => s + (Number(r["الإنجاز %"]) || 0), 0) / Math.max(1, total),
    );
    const completed = rows.filter((r) => Number(r["الإنجاز %"]) === 100).length;

    const rowsHtml = rows
      .map(
        (r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(r["المهمة"])}</td>
        <td>${escapeHtml(r["العضو"])}</td>
        <td style="max-width:280px">${escapeHtml(r["الإجراء"])}</td>
        <td style="max-width:200px">${escapeHtml(r["المخرجات"])}</td>
        <td style="text-align:center"><span class="pct ${
          Number(r["الإنجاز %"]) === 100 ? "ok" : Number(r["الإنجاز %"]) >= 50 ? "mid" : "low"
        }">${r["الإنجاز %"]}%</span></td>
        <td>${escapeHtml(r["التحديات"])}</td>
        <td>${escapeHtml(r["التوصيات"])}</td>
        <td>${escapeHtml(r["تاريخ التنفيذ"])}</td>
        <td>${escapeHtml(r["تاريخ الرد"])}</td>
      </tr>`,
      )
      .join("");
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
<title>تقرير ردود ${meta?.label ?? ""}</title>
<style>
  body{font-family:'Tajawal','Segoe UI',sans-serif;padding:24px;color:#1a1a1a}
  h1{margin:0 0 4px;font-size:22px;color:#7a5a17}
  .sub{color:#666;font-size:12px;margin-bottom:16px}
  .meta{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px}
  .kpi{border:1px solid #e6d9b8;background:#fbf7ec;border-radius:10px;padding:8px 14px;font-size:12px}
  .kpi b{display:block;font-size:18px;color:#7a5a17}
  table{width:100%;border-collapse:collapse;font-size:11.5px}
  th{background:linear-gradient(135deg,#c9a45e,#a8842f);color:#fff;padding:8px;text-align:right;font-weight:700}
  td{border:1px solid #e5e5e5;padding:6px;vertical-align:top;text-align:right}
  tr:nth-child(even) td{background:#fafafa}
  .pct{display:inline-block;padding:2px 8px;border-radius:999px;font-weight:bold;font-size:11px}
  .pct.ok{background:#d1fae5;color:#065f46}
  .pct.mid{background:#dbeafe;color:#1e3a8a}
  .pct.low{background:#fef3c7;color:#854d0e}
  .footer{margin-top:18px;padding-top:10px;border-top:1px solid #e5e5e5;font-size:11px;color:#777;text-align:center}
</style></head><body>
<h1>تقرير ردود اللجان — ${escapeHtml(meta?.label ?? "")}</h1>
<p class="sub">${escapeHtml(committee?.name ?? "")} · ${new Date().toLocaleString("ar-SA")}</p>
<div class="meta">
  <div class="kpi"><b>${total}</b>إجمالي الردود</div>
  <div class="kpi"><b>${avg}%</b>متوسط الإنجاز</div>
  <div class="kpi"><b>${completed}</b>مكتملة 100%</div>
</div>
<table>
  <thead><tr>
    <th>#</th><th>المهمة</th><th>العضو</th><th>الإجراء المتخذ</th><th>المخرجات</th>
    <th>الإنجاز</th><th>التحديات</th><th>التوصيات</th><th>تاريخ التنفيذ</th><th>تاريخ الرد</th>
  </tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>
      <div class="footer">منصة القبيلة — تقرير رسمي</div>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body></html>`);
    w.document.close();
  };

  const openEditRequest = (r: PaymentRequest) => {
    setEditingPr(r);
    setEditPrTitle(r.title);
    setEditPrAmount(String(r.amount));
    setEditPrOpen(true);
  };

  const saveEditRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPr) return;
    const amt = Number(editPrAmount);
    if (!amt || amt <= 0) return toast.error("المبلغ غير صحيح");
    const { error } = await supabase
      .from("payment_requests")
      .update({ title: editPrTitle, amount: amt })
      .eq("id", editingPr.id);
    if (error) return toast.error("تعذر التحديث", { description: error.message });
    toast.success("تم تحديث الطلب");
    setEditPrOpen(false);
    setEditingPr(null);
    load();
  };

  const deleteRequest = async (r: PaymentRequest) => {
    if (!confirm(`حذف طلب الصرف "${r.title}" نهائياً؟`)) return;
    const { error } = await supabase.from("payment_requests").delete().eq("id", r.id);
    if (error) return toast.error("تعذر الحذف", { description: error.message });
    toast.success("تم حذف الطلب");
    load();
  };

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!committee) return;
    const amount = Number(prAmount);
    if (!amount || amount <= 0) return toast.error("المبلغ غير صحيح");
    const { MAX_UPLOAD_SIZE, MAX_UPLOAD_SIZE_LABEL, safeStorageKey } = await import("@/lib/uploads");
    if (prFile && prFile.size > MAX_UPLOAD_SIZE) return toast.error(`حجم الملف أكبر من ${MAX_UPLOAD_SIZE_LABEL}`);

    setPrSubmitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();

      let invoice_url: string | null = null;
      if (prFile) {
        const path = safeStorageKey(prFile.name, committee.id);
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
        <PmpCharter meta={meta} />
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
      <PmpCharter meta={meta} />

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

      <QualitySection storageKey={`committee:${type}:members`} title="أعضاء اللجنة" icon={UsersRound} defaultOpen>
        <CommitteeMembersPanel committeeId={committee.id} />
      </QualitySection>

      <QualitySection storageKey={`committee:${type}:grooms`} title="متابعة العرسان" icon={HeartHandshake}>
        <GroomFollowups committeeType={type as any} />
      </QualitySection>

      {type === "finance" && (
        <QualitySection storageKey={`committee:${type}:finance`} title="الوحدة المالية" icon={WalletIcon} defaultOpen>
          <div className="rounded-2xl border bg-card p-5 shadow-soft">
            <FinanceModule />
          </div>
        </QualitySection>
      )}

      {/* Quality committee: audit panel for monitoring all committees' tasks + per-committee PDF reports */}
      {type === "quality" && (
        <>
          <QualitySection storageKey={`committee:${type}:criteria`} title="معايير وبنود التقييم" icon={ClipboardList} defaultOpen>
            <EvaluationCriteria />
          </QualitySection>
          <QualitySection storageKey={`committee:${type}:form`} title="نموذج تقييم اللجان" icon={ClipboardCheck}>
            <EvaluationForm />
          </QualitySection>
          <QualitySection storageKey={`committee:${type}:plan`} title="خطة التقييم الأسبوعية" icon={CalendarRange}>
            <EvaluationPlanBuilder />
          </QualitySection>
          <QualitySection storageKey={`committee:${type}:audit`} title="لوحة تدقيق الجودة" icon={ShieldCheck}>
            <QualityAuditPanel />
          </QualitySection>
        </>
      )}

      {/* Media committee gets inbox + invitation cards distribution */}
      {type === "media" && (
        <>
          <QualitySection storageKey={`committee:${type}:inbox`} title="صندوق الوارد الإعلامي" icon={Inbox} defaultOpen>
            <MediaInbox />
          </QualitySection>
          <QualitySection storageKey={`committee:${type}:invitations`} title="بطاقات الدعوة" icon={Megaphone}>
            <div className="rounded-2xl border bg-card p-5 shadow-soft">
              <InvitationCards />
            </div>
          </QualitySection>
        </>
      )}

      {/* Purchase requests — embedded in every committee page as a professional dropdown.
          Procurement committee sees the inbox (review/approve/reject); other committees
          see the create + my-requests view (edit / cancel / track status). */}
      <QualitySection
        storageKey={`committee:${type}:requests`}
        title={type === "procurement" ? "طلبات الشراء الواردة من اللجان" : "طلبات الشراء الخاصة بلجنتنا"}
        icon={Inbox}
        defaultOpen={type === "procurement"}
      >
        <ProcurementRequestsBoard procurementOnly={type === "procurement"} />
      </QualitySection>

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
                            {m.full_name} · {committeeMemberLabel(m)}
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
                const canEditThis = (isAdmin || isHead) && r.status === "pending";
                const canDeleteThis = isAdmin || isHead;
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
                      {canEditThis && (
                        <button
                          type="button"
                          onClick={() => openEditRequest(r)}
                          className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-primary/10 hover:text-primary transition"
                          aria-label="تعديل الطلب"
                          title="تعديل (متاح قبل الاعتماد)"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                      {canDeleteThis && (
                        <button
                          type="button"
                          onClick={() => deleteRequest(r)}
                          className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition"
                          aria-label="حذف الطلب"
                          title="حذف"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tasks Kanban */}
      <QualitySection
        storageKey={`committee:${type}:tasks`}
        title={`لوحة المهام${isHead ? " — رئيس اللجنة" : ""}`}
        icon={ListTodo}
        defaultOpen
      >
        <section>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-primary" /> لوحة المهام
            </h3>
            {isHead && (
              <Badge className="bg-gold/15 text-gold-foreground border border-gold/40 text-[10px] gap-1">
                👑 أنت رئيس هذه اللجنة
              </Badge>
            )}
            {!canManageTasks && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                للعرض والتنفيذ فقط — الإسناد من رئيس اللجنة
              </Badge>
            )}
          </div>
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
            <Button
              size="sm"
              variant="outline"
              onClick={exportResponsesXLSX}
              title="تصدير ردود اللجنة إلى Excel"
              className="gap-1"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={printResponsesPDF}
              title="طباعة/تصدير PDF لردود اللجنة"
              className="gap-1"
            >
              <Printer className="h-3.5 w-3.5" /> PDF
            </Button>
            <Dialog open={taskOpen} onOpenChange={(o) => { setTaskOpen(o); if (!o) resetTaskForm(); }}>
              {canManageTasks && (
                <Button size="sm" onClick={openNewTask} className="bg-gradient-gold text-gold-foreground shadow-gold">
                  <Plus className="h-4 w-4 ms-1" /> مهمة جديدة
                </Button>
              )}
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
                            <div className="px-2 py-1.5 text-[11px] font-bold text-primary bg-primary/10 mt-1 flex items-center gap-1.5 border-y border-primary/20">
                              <Users className="h-3 w-3" />
                              أعضاء {meta.label} (إسناد داخلي)
                            </div>
                            {members.map((m) => (
                              <SelectItem key={`own-${m.id}`} value={m.id}>
                                {m.full_name} · {committeeMemberLabel(m)}
                              </SelectItem>
                            ))}
                          </div>
                        )}
                        {(isAdmin ? COMMITTEES.filter((cm) => cm.label !== meta.label) : []).map((cm) => {
                          const list = allMembers.filter((m) => m.committee_name === cm.label);
                          if (list.length === 0) return null;
                          return (
                            <div key={cm.type}>
                              <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground bg-muted/40 mt-1">{cm.label} (لجنة أخرى)</div>
                              {list.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.full_name} · {committeeMemberLabel(m)}
                                </SelectItem>
                              ))}
                            </div>
                          );
                        })}
                        {members.length === 0 && (
                          <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">
                            لا يوجد أعضاء معتمدون في هذه اللجنة بعد. أضف أعضاء من إدارة اللجنة أولاً.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      {isAdmin
                        ? "بصفتك مديراً، يمكنك الإسناد لأي عضو في أي لجنة."
                        : "بصفتك رئيس اللجنة، يمكنك إسناد المهام لأعضاء لجنتك فقط."}
                    </p>
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
          💡 اسحب البطاقة بين الأعمدة لتغيير حالتها، أو فوق بطاقة أخرى لإعادة الترتيب يدوياً{showMine ? " · يتم عرض مهامك فقط" : ""}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["todo", "in_progress", "completed"] as const).map((col) => {
            const priorityRank: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
            const inCol = visibleTasks.filter((t) => t.status === col);
            const manualIds = (taskOrder[col] ?? []).filter((id) => inCol.some((t) => t.id === id));
            const ordered: Task[] = manualIds
              .map((id) => inCol.find((t) => t.id === id)!)
              .filter(Boolean);
            const remainder = inCol
              .filter((t) => !manualIds.includes(t.id))
              .sort((a, b) => {
                const pr = (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
                if (pr !== 0) return pr;
                const ad = (a as any).created_at ? new Date((a as any).created_at).getTime() : 0;
                const bd = (b as any).created_at ? new Date((b as any).created_at).getTime() : 0;
                return bd - ad;
              });
            const colTasks: Task[] = [...ordered, ...remainder];
            const colTaskIds = colTasks.map((t) => t.id);
            const isOver = dragOverCol === col;
            return (
              <div
                key={col}
                onDragOver={(e) => onDragOverCol(e, col)}
                onDragLeave={() => setDragOverCol((c) => (c === col ? null : c))}
                onDrop={(e) => onDropCol(e, col, colTaskIds)}
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
                    const isFirstUrgent = urgentAlert.enabled && tasks.length > 0 && tasks[0].id === t.id;
                    return (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, t.id)}
                        onDragEnd={onDragEnd}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (dragId && dragId !== t.id) setDragOverTaskId(t.id);
                        }}
                        onDragLeave={() => setDragOverTaskId((c) => (c === t.id ? null : c))}
                        onDrop={(e) => onDropOnCard(e, t.id, col, colTaskIds)}
                        className={`group relative rounded-2xl bg-card shadow-sm border border-border/60 hover:border-primary/40 hover:shadow-lg transition-all overflow-hidden ${
                          dragId === t.id ? "opacity-40 scale-95" : ""
                        } ${isMine ? "ring-1 ring-primary/40" : ""} ${isFirstUrgent ? "ring-2 ring-destructive/60 border-destructive/50" : ""} ${
                          dragOverTaskId === t.id && dragId !== t.id ? "before:absolute before:inset-x-0 before:-top-1 before:h-1 before:bg-primary before:rounded-full" : ""
                        }`}
                      >
                        {/* Priority accent bar */}
                        <span
                          className={`absolute top-0 bottom-0 start-0 w-1.5 ${
                            t.priority === "urgent" ? "bg-rose-500" :
                            t.priority === "high" ? "bg-amber-500" :
                            t.priority === "medium" ? "bg-sky-500" : "bg-muted-foreground/30"
                          }`}
                          aria-hidden
                        />

                        {/* === SECTION 1: Header (title + meta) === */}
                        <div className="ps-4 pe-3.5 pt-3.5 pb-2.5 cursor-grab active:cursor-grabbing">
                          {isFirstUrgent && (
                            <div className="mb-2 flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-2.5 py-1">
                              <span className="relative flex h-2 w-2 shrink-0">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                              </span>
                              <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                              <span className="text-[10.5px] font-bold text-destructive">{urgentAlert.label || "عاجل"}</span>
                            </div>
                          )}
                          {(() => {
                            const { phase, clean } = splitPhase(t.title);
                            return (
                              <>
                                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                                  {phase && (
                                    <Badge variant="outline" className={`${PHASE_TONE[phase] ?? "bg-muted text-muted-foreground"} text-[10px] font-semibold px-1.5 py-0 h-5 rounded-md border`}>
                                      {phase}
                                    </Badge>
                                  )}
                                  <Badge variant="secondary" className={`${PRIORITY_TONE[t.priority]} text-[10px] font-medium px-1.5 py-0 h-5 rounded-md`}>
                                    {PRIORITY_LABELS[t.priority]}
                                  </Badge>
                                </div>
                                <div className="flex items-start gap-1.5">
                                  <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0 group-hover:text-muted-foreground transition" />
                                  <h5 className="font-bold text-[14px] leading-snug flex-1 text-foreground">{clean}</h5>
                                </div>
                                {t.description && (
                                  <p className="text-[12px] leading-relaxed text-muted-foreground mt-1.5 ps-5.5 whitespace-pre-wrap">
                                    {t.description}
                                  </p>
                                )}
                              </>
                            );
                          })()}
                        </div>

                        {/* === SECTION 2: Attachments + collapsible discussion === */}
                        <div className="px-3.5 ps-4 pb-2 pt-1 space-y-2 border-t border-border/40">
                          <TaskAttachments taskId={t.id} committeeId={committee.id} compact />
                          {(() => {
                            const isOpen = expandedComments.has(t.id);
                            return (
                              <>
                                <button
                                  type="button"
                                  onClick={() => toggleComments(t.id)}
                                  aria-expanded={isOpen}
                                  aria-controls={`comments-${t.id}`}
                                  className={`inline-flex items-center gap-1.5 text-[11.5px] font-bold transition w-full justify-between rounded-lg px-2.5 py-1.5 border ${
                                    isOpen
                                      ? "bg-primary/10 text-primary border-primary/30"
                                      : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground border-transparent"
                                  }`}
                                >
                                  <span className="inline-flex items-center gap-1.5">
                                    <MessagesSquare className="h-3.5 w-3.5" />
                                    {isOpen ? "إخفاء نقاش الأعضاء" : "عرض نقاش الأعضاء"}
                                  </span>
                                  <ChevronDown
                                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                                      isOpen ? "rotate-180" : ""
                                    }`}
                                  />
                                </button>
                                {isOpen && (
                                  <div
                                    id={`comments-${t.id}`}
                                    className="rounded-lg border border-border/60 bg-background/70 p-2.5 animate-in fade-in slide-in-from-top-1 duration-200"
                                  >
                                    <TaskComments taskId={t.id} />
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>

                        {/* === SECTION 4: Footer (assignee + actions) === */}
                        <div className="flex items-center justify-between gap-2 px-3.5 ps-4 py-2 border-t border-border/40 bg-card">
                          {canManageTasks ? (
                            <QuickAssignPopover
                              task={t}
                              assignee={assignee}
                              isMine={isMine}
                              members={members}
                              allMembers={allMembers}
                              isAdmin={isAdmin}
                              currentCommitteeLabel={meta.label}
                              onAssign={(id) => quickAssign(t.id, id)}
                            />
                          ) : assignee ? (
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
                          {canManageTasks && (
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
                          )}
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
      </QualitySection>

      {/* Archive of past reports / files / images for this committee */}
      <QualitySection storageKey={`committee:${type}:archive`} title="الأرشيف والتقارير" icon={Archive}>
        <CommitteeArchive committeeId={committee.id} committeeName={committee.name} />
      </QualitySection>

      {/* Edit payment request dialog */}
      <Dialog open={editPrOpen} onOpenChange={(o) => { setEditPrOpen(o); if (!o) setEditingPr(null); }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" /> تعديل طلب الصرف
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEditRequest} className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label>عنوان الطلب</Label>
              <Input value={editPrTitle} onChange={(e) => setEditPrTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>المبلغ (ر.س)</Label>
              <Input type="number" min="1" value={editPrAmount} onChange={(e) => setEditPrAmount(e.target.value)} required dir="ltr" />
            </div>
            <Button type="submit" className="w-full bg-gradient-hero text-primary-foreground">حفظ التعديلات</Button>
          </form>
        </DialogContent>
      </Dialog>
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
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-0 text-[10px] px-2">
              ورشة العمل التنفيذية
            </Badge>
            <p className="text-xs text-muted-foreground">{meta.description}</p>
          </div>
        </div>
      </div>
      <Link to="/" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> العودة للرئيسية
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

/**
 * Inline quick-assign popover for task cards.
 * Heads see only their committee members; admins see all committees grouped.
 */
function QuickAssignPopover({
  task,
  assignee,
  isMine,
  members,
  allMembers,
  isAdmin,
  currentCommitteeLabel,
  onAssign,
}: {
  task: Task;
  assignee: TeamMember | undefined;
  isMine: boolean;
  members: TeamMember[];
  allMembers: TeamMember[];
  isAdmin: boolean;
  currentCommitteeLabel: string;
  onAssign: (id: string | null) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const otherCommittees = isAdmin
    ? COMMITTEES.filter((cm) => cm.label !== currentCommitteeLabel)
    : [];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 min-w-0 rounded-lg px-1.5 py-1 hover:bg-primary/10 hover:ring-1 hover:ring-primary/30 transition group/assign"
          title="انقر لإسناد المهمة"
        >
          {assignee ? (
            <>
              <Avatar className="h-6 w-6 border border-primary/20">
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                  {initials(assignee.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-[11px] text-muted-foreground truncate font-medium">
                {assignee.full_name.split(" ").slice(0, 2).join(" ")}
              </span>
              {isMine && (
                <Badge variant="secondary" className="bg-primary/10 text-primary text-[9px] px-1.5 h-4 rounded-md">
                  أنت
                </Badge>
              )}
            </>
          ) : (
            <span className="text-[10.5px] text-primary inline-flex items-center gap-1 font-medium">
              <UserIcon className="h-3 w-3" /> إسناد لعضو
            </span>
          )}
          <ChevronDown className="h-3 w-3 text-muted-foreground/60 opacity-0 group-hover/assign:opacity-100 transition" />
        </button>
      </PopoverTrigger>
      <PopoverContent dir="rtl" align="start" className="p-0 w-72">
        <Command>
          <CommandInput placeholder="ابحث عن عضو..." className="text-xs" />
          <CommandList className="max-h-72">
            <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
              لا يوجد أعضاء مطابقون
            </CommandEmpty>
            <CommandGroup heading="إجراء">
              <CommandItem
                value="__unassign__"
                onSelect={() => {
                  setOpen(false);
                  void onAssign(null);
                }}
                className="text-xs gap-2"
              >
                <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                إلغاء الإسناد
                {!task.assigned_to && (
                  <Badge variant="outline" className="text-[9px] h-4 ms-auto">الحالة الحالية</Badge>
                )}
              </CommandItem>
            </CommandGroup>
            {members.length > 0 && (
              <CommandGroup heading={`أعضاء ${currentCommitteeLabel}`}>
                {members.map((m) => (
                  <CommandItem
                    key={`own-${m.id}`}
                    value={`${m.full_name} ${m.role_title ?? ""}`}
                    onSelect={() => {
                      setOpen(false);
                      void onAssign(m.id);
                    }}
                    className="text-xs gap-2"
                  >
                    <Avatar className="h-5 w-5 border">
                      <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-bold">
                        {initials(m.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{m.full_name}</span>
                    <Badge className="bg-gold/15 text-gold-foreground border border-gold/40 text-[9px] h-4 px-1">
                      {committeeMemberLabel(m)}
                    </Badge>
                    {task.assigned_to === m.id && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary ms-auto shrink-0" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {otherCommittees.map((cm) => {
              const list = allMembers.filter((m) => m.committee_name === cm.label);
              if (list.length === 0) return null;
              return (
                <CommandGroup key={cm.type} heading={`${cm.label} (لجنة أخرى)`}>
                  {list.map((m) => (
                    <CommandItem
                      key={m.id}
                      value={`${m.full_name} ${cm.label}`}
                      onSelect={() => {
                        setOpen(false);
                        void onAssign(m.id);
                      }}
                      className="text-xs gap-2"
                    >
                      <Avatar className="h-5 w-5 border">
                        <AvatarFallback className="text-[9px] bg-muted text-muted-foreground font-bold">
                          {initials(m.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{m.full_name}</span>
                      {task.assigned_to === m.id && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary ms-auto shrink-0" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
            {members.length === 0 && otherCommittees.length === 0 && (
              <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">
                لا يوجد أعضاء معتمدون. أضف أعضاء من إدارة اللجنة أولاً.
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function QualitySection({
  title,
  icon: Icon,
  defaultOpen = false,
  storageKey,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  storageKey: string;
  children: React.ReactNode;
}) {
  // storageKey is provided fully-qualified by the caller (e.g. "committee:quality:criteria")
  const fullKey = storageKey;
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return defaultOpen;
    const saved = window.localStorage.getItem(fullKey);
    return saved === null ? defaultOpen : saved === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(fullKey, open ? "1" : "0");
  }, [fullKey, open]);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <CollapsibleTrigger className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-right">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="font-semibold text-sm md:text-base">{title}</div>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t bg-background/40 p-3 md:p-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
