import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { COMMITTEES, committeeByType } from "@/lib/committees";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PortalReportDialog } from "@/components/portal/PortalReportDialog";
import { QuickCreateTask } from "@/components/portal/QuickCreateTask";
import { QuickCreatePayment } from "@/components/portal/QuickCreatePayment";
import { QuickPurchaseRequestDialog } from "@/components/QuickPurchaseRequestDialog";
import {
  LayoutGrid,
  ListTodo,
  Receipt,
  FileText,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Search,
  CheckCircle2,
  Clock3,
  PlayCircle,
  Wallet,
  TrendingUp,
  ShoppingCart,
} from "lucide-react";

export const Route = createFileRoute("/_app/portal")({
  component: PortalPage,
  head: () => ({
    meta: [
      { title: "بوابتي — منصة لجنة الزواج الجماعي" },
      { name: "description", content: "بوابة موحّدة لجميع لجانك: مهامك، طلبات الصرف، والتقارير في مكان واحد." },
    ],
  }),
});

interface MyTask {
  id: string;
  title: string;
  description?: string | null;
  status: "todo" | "in_progress" | "completed";
  priority: "low" | "medium" | "high" | "urgent";
  due_date?: string | null;
  committee_id: string;
  committee_name: string;
  committee_type: string;
}

interface MyPaymentRequest {
  id: string;
  title: string;
  amount: number;
  status: string;
  created_at: string;
  committee_id: string;
  committee_name: string;
  committee_type: string;
}

interface MyCommittee {
  id: string;
  name: string;
  type: string;
}

const PRIORITY_TONE: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  urgent: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};
const PRIORITY_LABELS: Record<string, string> = {
  low: "منخفضة", medium: "متوسطة", high: "عالية", urgent: "عاجلة",
};
const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

const STATUS_META: Record<string, { label: string; icon: any; tone: string }> = {
  todo: { label: "قائمة الانتظار", icon: Clock3, tone: "bg-muted/50" },
  in_progress: { label: "قيد التنفيذ", icon: PlayCircle, tone: "bg-sky-500/10" },
  completed: { label: "مكتملة", icon: CheckCircle2, tone: "bg-emerald-500/10" },
};

const PR_STATUS_META: Record<string, { label: string; tone: string }> = {
  pending: { label: "قيد الانتظار", tone: "bg-amber-500/15 text-amber-700" },
  approved: { label: "معتمد", tone: "bg-emerald-500/15 text-emerald-700" },
  rejected: { label: "مرفوض", tone: "bg-rose-500/15 text-rose-700" },
  paid: { label: "مدفوع", tone: "bg-primary/15 text-primary" },
};

function PortalPage() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const isQuality = hasRole("quality");

  const [loading, setLoading] = useState(true);
  const [myCommittees, setMyCommittees] = useState<MyCommittee[]>([]);
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [payments, setPayments] = useState<MyPaymentRequest[]>([]);
  const [reportsCount, setReportsCount] = useState(0);
  const [committeeFilter, setCommitteeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // 1) Find committees the user belongs to (or all if admin/quality)
      let committeeIds: string[] = [];
      let committeeRows: MyCommittee[] = [];
      if (isAdmin || isQuality) {
        const { data } = await supabase.from("committees").select("id, name, type").order("name");
        committeeRows = (data ?? []) as MyCommittee[];
        committeeIds = committeeRows.map((c) => c.id);
      } else {
        const { data: ur } = await supabase
          .from("user_roles")
          .select("committee_id")
          .eq("user_id", user.id);
        committeeIds = Array.from(new Set((ur ?? []).map((r) => r.committee_id).filter(Boolean) as string[]));
        if (committeeIds.length > 0) {
          const { data } = await supabase
            .from("committees")
            .select("id, name, type")
            .in("id", committeeIds);
          committeeRows = (data ?? []) as MyCommittee[];
        }
      }

      // 2) Find my team_member id (to filter assigned tasks)
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      let memberIds: string[] = [];
      if (profile?.full_name && committeeIds.length) {
        const { data: tm } = await supabase
          .from("team_members")
          .select("id")
          .eq("full_name", profile.full_name)
          .in("committee_id", committeeIds);
        memberIds = (tm ?? []).map((t) => t.id);
      }

      // 3) Tasks across user's committees (or assigned to user)
      let taskRows: any[] = [];
      if (committeeIds.length) {
        const { data } = await supabase
          .from("committee_tasks")
          .select("id, title, description, status, priority, due_date, committee_id")
          .in("committee_id", committeeIds)
          .order("created_at", { ascending: false })
          .limit(500);
        taskRows = data ?? [];
      }

      // 4) Payment requests
      let prRows: any[] = [];
      if (committeeIds.length) {
        const { data } = await supabase
          .from("payment_requests")
          .select("id, title, amount, status, created_at, committee_id")
          .in("committee_id", committeeIds)
          .order("created_at", { ascending: false })
          .limit(200);
        prRows = data ?? [];
      }

      // 5) Reports count
      let rCount = 0;
      if (committeeIds.length) {
        const { count } = await supabase
          .from("reports")
          .select("id", { count: "exact", head: true })
          .in("committee_id", committeeIds);
        rCount = count ?? 0;
      }

      if (cancelled) return;
      const cMap = new Map(committeeRows.map((c) => [c.id, c]));
      setMyCommittees(committeeRows);
      setTasks(
        taskRows.map((t) => ({
          ...t,
          committee_name: cMap.get(t.committee_id)?.name ?? "—",
          committee_type: cMap.get(t.committee_id)?.type ?? "",
        }))
      );
      setPayments(
        prRows.map((p) => ({
          ...p,
          committee_name: cMap.get(p.committee_id)?.name ?? "—",
          committee_type: cMap.get(p.committee_id)?.type ?? "",
        }))
      );
      setReportsCount(rCount);
      setLoading(false);
      // Stash member ids for "my tasks" filter
      (window as any).__portal_member_ids__ = memberIds;
    })();
    return () => { cancelled = true; };
  }, [user, isAdmin, isQuality, reloadKey]);

  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (committeeFilter !== "all") list = list.filter((t) => t.committee_id === committeeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [tasks, committeeFilter, search]);

  const filteredPayments = useMemo(() => {
    if (committeeFilter === "all") return payments;
    return payments.filter((p) => p.committee_id === committeeFilter);
  }, [payments, committeeFilter]);

  const stats = useMemo(() => {
    const todo = filteredTasks.filter((t) => t.status === "todo").length;
    const inProg = filteredTasks.filter((t) => t.status === "in_progress").length;
    const done = filteredTasks.filter((t) => t.status === "completed").length;
    const total = filteredTasks.length;
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
    const overdue = filteredTasks.filter(
      (t) => t.status !== "completed" && t.due_date && new Date(t.due_date) < new Date()
    ).length;
    const pendingPayments = filteredPayments.filter((p) => p.status === "pending").length;
    const totalAmount = filteredPayments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount || 0), 0);
    return { todo, inProg, done, total, completionRate, overdue, pendingPayments, totalAmount };
  }, [filteredTasks, filteredPayments]);

  const sortedByPriority = (list: MyTask[]) =>
    [...list].sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9));

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (myCommittees.length === 0) {
    return (
      <Card className="p-10 text-center max-w-xl mx-auto">
        <LayoutGrid className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-lg font-bold mb-2">هذه شاشتك الشخصية</h2>
        <p className="text-sm text-muted-foreground mb-4">
          ستظهر هنا مهامك ومؤشرات إنجازك وطلبات صرفك حال اعتماد عضويتك في لجنة.
        </p>
        <p className="text-xs text-muted-foreground">
          بوابتي = شاشة العرض الشخصية · اللجنة = ورشة العمل التنفيذية
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <LayoutGrid className="h-7 w-7 text-primary" /> بوابتي
          </h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-[10px] px-2">
              شاشتي الشخصية · عرض موحّد
            </Badge>
            <p className="text-xs text-muted-foreground">
              اضغط أي مهمة للانتقال إلى لجنتها وتنفيذ الإجراء
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <QuickCreateTask committees={myCommittees} onCreated={() => setReloadKey((k) => k + 1)} />
          <QuickCreatePayment committees={myCommittees} onCreated={() => setReloadKey((k) => k + 1)} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPurchaseOpen(true)}
            className="gap-1.5 border-orange-500/40 text-orange-700 hover:bg-orange-500/10"
          >
            <ShoppingCart className="h-4 w-4" />
            طلب شراء
          </Button>
          <PortalReportDialog
            userName={user?.email ?? "عضو"}
            committeesCount={myCommittees.length}
            tasks={tasks}
            payments={payments}
          />
          <div className="relative">
            <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث في المهام..."
              className="pr-8 w-48"
            />
          </div>
          <Select value={committeeFilter} onValueChange={setCommitteeFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع لجاني</SelectItem>
              {myCommittees.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={ListTodo}
          label="إجمالي المهام"
          value={stats.total}
          subtitle={`${stats.completionRate}% مكتمل`}
          tone="from-primary/10 to-primary/5 text-primary"
        />
        <StatCard
          icon={PlayCircle}
          label="قيد التنفيذ"
          value={stats.inProg}
          subtitle={`${stats.todo} في الانتظار`}
          tone="from-sky-500/10 to-sky-500/5 text-sky-600"
        />
        <StatCard
          icon={AlertTriangle}
          label="مهام متأخرة"
          value={stats.overdue}
          subtitle={stats.overdue > 0 ? "تحتاج إجراء" : "لا توجد"}
          tone={stats.overdue > 0 ? "from-rose-500/15 to-rose-500/5 text-rose-600" : "from-emerald-500/10 to-emerald-500/5 text-emerald-600"}
        />
        <StatCard
          icon={Receipt}
          label="طلبات صرف معلّقة"
          value={stats.pendingPayments}
          subtitle={`${stats.totalAmount.toLocaleString()} ر.س مصروف`}
          tone="from-amber-500/10 to-amber-500/5 text-amber-600"
        />
      </div>

      {/* My committees quick links */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> لجاني
          </h2>
          <span className="text-xs text-muted-foreground">انتقل إلى البوابة الكاملة لكل لجنة</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {myCommittees.map((c) => {
            const meta = committeeByType(c.type as any);
            const Icon = meta?.icon ?? LayoutGrid;
            const myTasks = tasks.filter((t) => t.committee_id === c.id && t.status !== "completed").length;
            return (
              <Link
                key={c.id}
                to="/committee/$type"
                params={{ type: c.type }}
                className="group rounded-xl border bg-card hover:border-primary/50 hover:shadow-md transition p-3 flex items-center gap-3"
              >
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${meta?.tone ?? "bg-primary/10 text-primary"}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{c.name}</div>
                  <div className="text-[11px] text-muted-foreground">{myTasks} مهمة نشطة</div>
                </div>
                <ArrowLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:-translate-x-1 transition" />
              </Link>
            );
          })}
        </div>
      </Card>

      {/* Unified Kanban */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-bold flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" /> لوحة المهام الموحّدة
          </h2>
          <p className="text-[11px] text-muted-foreground">
            عرض للقراءة فقط — للتعديل والسحب، ادخل بوابة اللجنة
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["todo", "in_progress", "completed"] as const).map((col) => {
            const meta = STATUS_META[col];
            const Icon = meta.icon;
            const colTasks = sortedByPriority(filteredTasks.filter((t) => t.status === col)).slice(0, 50);
            return (
              <div key={col} className={`rounded-2xl border p-4 min-h-[280px] ${meta.tone}`}>
                <h4 className="text-sm font-bold mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4" /> {meta.label}
                  </span>
                  <span className="text-xs bg-card rounded-full px-2 py-0.5 border">{colTasks.length}</span>
                </h4>
                <div className="space-y-2">
                  {colTasks.map((t) => {
                    const cmeta = committeeByType(t.committee_type as any);
                    const overdue = t.due_date && t.status !== "completed" && new Date(t.due_date) < new Date();
                    return (
                      <Link
                        key={t.id}
                        to="/committee/$type"
                        params={{ type: t.committee_type }}
                        className="block rounded-xl bg-card border border-border/60 hover:border-primary/40 hover:shadow-md transition p-3 group"
                      >
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          <Badge variant="outline" className={`${cmeta?.tone ?? "bg-muted"} text-[10px] px-1.5 py-0 h-5 border-0`}>
                            {t.committee_name}
                          </Badge>
                          <Badge variant="secondary" className={`${PRIORITY_TONE[t.priority]} text-[10px] px-1.5 py-0 h-5`}>
                            {PRIORITY_LABELS[t.priority]}
                          </Badge>
                          {overdue && (
                            <Badge className="bg-rose-500/15 text-rose-700 text-[10px] px-1.5 py-0 h-5 border-0">
                              متأخر
                            </Badge>
                          )}
                        </div>
                        <h5 className="font-bold text-[13px] leading-snug group-hover:text-primary transition">{t.title}</h5>
                        {t.description && (
                          <p className="text-[11.5px] text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                        )}
                        {t.due_date && (
                          <p className={`text-[10.5px] mt-1.5 inline-flex items-center gap-1 ${overdue ? "text-rose-600 font-bold" : "text-muted-foreground"}`}>
                            <Clock3 className="h-3 w-3" /> {new Date(t.due_date).toLocaleDateString("ar-SA")}
                          </p>
                        )}
                      </Link>
                    );
                  })}
                  {colTasks.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8 border-2 border-dashed border-muted/60 rounded-lg">
                      لا توجد مهام
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Recent payment requests */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" /> طلبات الصرف الأخيرة
          </h2>
          <span className="text-xs text-muted-foreground">
            {filteredPayments.length} طلب{reportsCount > 0 ? ` · ${reportsCount} تقرير` : ""}
          </span>
        </div>
        {filteredPayments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8 border-2 border-dashed border-muted/60 rounded-lg">
            لا توجد طلبات صرف
          </p>
        ) : (
          <div className="space-y-2">
            {filteredPayments.slice(0, 8).map((p) => {
              const meta = PR_STATUS_META[p.status] ?? { label: p.status, tone: "bg-muted" };
              return (
                <Link
                  key={p.id}
                  to="/committee/$type"
                  params={{ type: p.committee_type }}
                  className="flex items-center gap-3 rounded-lg border bg-card hover:border-primary/40 hover:shadow-sm transition p-3"
                >
                  <Receipt className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{p.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {p.committee_name} · {new Date(p.created_at).toLocaleDateString("ar-SA")}
                    </div>
                  </div>
                  <Badge className={`${meta.tone} border-0 text-[10px]`}>{meta.label}</Badge>
                  <span className="font-bold text-sm tabular-nums shrink-0">
                    {Number(p.amount).toLocaleString()} ر.س
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  tone,
}: {
  icon: any;
  label: string;
  value: number | string;
  subtitle?: string;
  tone: string;
}) {
  return (
    <Card className={`p-4 bg-gradient-to-br ${tone} border-0`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium opacity-80">{label}</span>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      {subtitle && <div className="text-[11px] opacity-70 mt-0.5">{subtitle}</div>}
    </Card>
  );
}
