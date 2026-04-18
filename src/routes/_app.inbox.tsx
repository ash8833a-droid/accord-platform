import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Inbox, ListTodo, Receipt, Bell, CheckCircle2, FileText, Building2 } from "lucide-react";
import { COMMITTEES } from "@/lib/committees";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/inbox")({
  component: InboxPage,
});

interface InboxTask {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "completed";
  priority: "low" | "medium" | "high" | "urgent";
  committee_id: string;
  committee_name: string;
  committee_type: string;
}

interface InboxRequest {
  id: string;
  title: string;
  amount: number;
  status: "pending" | "approved" | "rejected" | "paid";
  description: string | null;
  created_at: string;
  committee_id: string;
  committee_name: string;
  committee_type: string;
}

interface NotifRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
}

const STATUS_TONE: Record<string, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};
const STATUS_LABEL: Record<string, string> = {
  todo: "قائمة الانتظار", in_progress: "قيد التنفيذ", completed: "مكتملة",
  pending: "قيد المراجعة", approved: "معتمد", paid: "مصروف", rejected: "مرفوض",
};
const PR_TONE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  approved: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  paid: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  rejected: "bg-rose-500/15 text-rose-700 border-rose-500/30",
};
const PRIO_TONE: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-sky-500/15 text-sky-700",
  high: "bg-amber-500/15 text-amber-700",
  urgent: "bg-destructive/15 text-destructive",
};
const PRIO_LABEL: Record<string, string> = { low: "منخفضة", medium: "متوسطة", high: "عالية", urgent: "عاجلة" };

function committeeTypeFor(name: string): string {
  return COMMITTEES.find((c) => c.label === name)?.type ?? "finance";
}

export function InboxPage() {
  const { user } = useAuth();
  const [profileName, setProfileName] = useState<string | null>(null);
  const [tasks, setTasks] = useState<InboxTask[]>([]);
  const [requests, setRequests] = useState<InboxRequest[]>([]);
  const [notifs, setNotifs] = useState<NotifRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setProfileName(data?.full_name ?? null));
  }, [user]);

  const load = async () => {
    if (!user || !profileName) return;
    setLoading(true);

    // Find all team_member ids whose name matches my profile (across all committees)
    const { data: memberRows } = await supabase
      .from("team_members")
      .select("id")
      .eq("full_name", profileName);
    const memberIds = (memberRows ?? []).map((m: any) => m.id);

    // Fetch tasks assigned to me
    let taskRows: any[] = [];
    if (memberIds.length > 0) {
      const { data } = await supabase
        .from("committee_tasks")
        .select("id, title, description, status, priority, committee_id, committees(name, type)")
        .in("assigned_to", memberIds);
      taskRows = data ?? [];
    }

    // Fetch payment requests addressed to me (description contains [إلى: <name>...])
    const needle = `[إلى: ${profileName}`;
    const { data: prRows } = await supabase
      .from("payment_requests")
      .select("id, title, amount, status, description, created_at, committee_id, committees(name, type)")
      .ilike("description", `%${needle}%`)
      .order("created_at", { ascending: false });

    // Fetch my notifications
    const { data: nRows } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    setTasks(taskRows.map((t: any) => ({
      id: t.id, title: t.title, description: t.description, status: t.status, priority: t.priority,
      committee_id: t.committee_id, committee_name: t.committees?.name ?? "", committee_type: t.committees?.type ?? "finance",
    })));
    setRequests((prRows ?? []).map((r: any) => ({
      id: r.id, title: r.title, amount: r.amount, status: r.status, description: r.description,
      created_at: r.created_at, committee_id: r.committee_id, committee_name: r.committees?.name ?? "",
      committee_type: r.committees?.type ?? "finance",
    })));
    setNotifs((nRows ?? []) as NotifRow[]);
    setLoading(false);
  };

  useEffect(() => { if (profileName) load(); }, [profileName]);

  // Realtime: refresh when notifications change
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("inbox_notifications")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, profileName]);

  const unreadCount = useMemo(() => notifs.filter((n) => !n.is_read).length, [notifs]);
  const openTasks = useMemo(() => tasks.filter((t) => t.status !== "completed"), [tasks]);
  const pendingReqs = useMemo(() => requests.filter((r) => r.status === "pending" || r.status === "approved"), [requests]);

  const markAllRead = async () => {
    if (!user || unreadCount === 0) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    toast.success("تم تعليم كل الإشعارات كمقروءة");
    load();
  };

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <Inbox className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">صندوق الوارد</h1>
            <p className="text-xs text-muted-foreground">المهام والطلبات والإشعارات الموجّهة إليك من جميع اللجان</p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={markAllRead}>
            <CheckCircle2 className="h-4 w-4 ms-1" /> تعليم الكل كمقروء ({unreadCount})
          </Button>
        )}
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Kpi icon={<ListTodo className="h-4 w-4" />} label="مهام مفتوحة" value={openTasks.length} tone="bg-primary/10 text-primary" />
        <Kpi icon={<Receipt className="h-4 w-4" />} label="طلبات قيد المراجعة" value={pendingReqs.length} tone="bg-gold/15 text-gold-foreground" />
        <Kpi icon={<Bell className="h-4 w-4" />} label="إشعارات غير مقروءة" value={unreadCount} tone="bg-rose-500/10 text-rose-700" />
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="w-full grid grid-cols-3 h-auto">
          <TabsTrigger value="tasks" className="text-xs sm:text-sm py-2.5">
            <ListTodo className="h-4 w-4 ms-1" /> مهامي ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="requests" className="text-xs sm:text-sm py-2.5">
            <Receipt className="h-4 w-4 ms-1" /> طلباتي ({requests.length})
          </TabsTrigger>
          <TabsTrigger value="notifs" className="text-xs sm:text-sm py-2.5 relative">
            <Bell className="h-4 w-4 ms-1" /> الإشعارات
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          {loading ? <Skeleton /> : tasks.length === 0 ? (
            <Empty icon={<ListTodo className="h-6 w-6" />} text="لا توجد مهام موجّهة إليك حالياً" />
          ) : (
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li key={t.id}>
                  <Link
                    to="/committee/$type"
                    params={{ type: t.committee_type }}
                    className="flex items-start gap-3 rounded-xl border bg-card p-3.5 hover:border-primary/40 hover:shadow-md transition-all"
                  >
                    <span className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <ListTodo className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className="text-[10px] gap-1"><Building2 className="h-3 w-3" />{t.committee_name}</Badge>
                        <Badge variant="secondary" className={`${PRIO_TONE[t.priority]} text-[10px]`}>{PRIO_LABEL[t.priority]}</Badge>
                        <Badge variant="secondary" className={`${STATUS_TONE[t.status]} text-[10px] ms-auto`}>{STATUS_LABEL[t.status]}</Badge>
                      </div>
                      <p className="font-semibold text-sm leading-snug">{t.title}</p>
                      {t.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{t.description}</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
          {loading ? <Skeleton /> : requests.length === 0 ? (
            <Empty icon={<Receipt className="h-6 w-6" />} text="لا توجد طلبات صرف موجّهة إليك" />
          ) : (
            <ul className="space-y-2">
              {requests.map((r) => (
                <li key={r.id}>
                  <Link
                    to="/committee/$type"
                    params={{ type: r.committee_type }}
                    className="flex items-start gap-3 rounded-xl border bg-card p-3.5 hover:border-primary/40 hover:shadow-md transition-all"
                  >
                    <span className="h-9 w-9 rounded-lg bg-gold/15 text-gold-foreground flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className="text-[10px] gap-1"><Building2 className="h-3 w-3" />{r.committee_name}</Badge>
                        <Badge variant="outline" className={`${PR_TONE[r.status]} text-[10px] ms-auto`}>{STATUS_LABEL[r.status]}</Badge>
                      </div>
                      <p className="font-semibold text-sm leading-snug">{r.title}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ar-SA")}</p>
                        <p className="text-sm font-bold">{Number(r.amount).toLocaleString("ar-SA")} ر.س</p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="notifs" className="mt-4">
          {loading ? <Skeleton /> : notifs.length === 0 ? (
            <Empty icon={<Bell className="h-6 w-6" />} text="لا توجد إشعارات" />
          ) : (
            <ul className="space-y-2">
              {notifs.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => markRead(n.id)}
                    className={`w-full text-start flex items-start gap-3 rounded-xl border p-3.5 transition-all hover:border-primary/40 ${
                      n.is_read ? "bg-card" : "bg-primary/5 border-primary/30"
                    }`}
                  >
                    <span className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                      n.type === "task_assigned" ? "bg-primary/10 text-primary" : "bg-gold/15 text-gold-foreground"
                    }`}>
                      {n.type === "task_assigned" ? <ListTodo className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                      <p className="text-[10px] text-muted-foreground/70 mt-1">{new Date(n.created_at).toLocaleString("ar-SA")}</p>
                    </div>
                    {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border bg-card p-3 sm:p-4">
      <div className={`inline-flex h-8 w-8 rounded-lg items-center justify-center ${tone}`}>{icon}</div>
      <p className="text-xl sm:text-2xl font-bold mt-2">{value}</p>
      <p className="text-[10px] sm:text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed bg-muted/20 p-10 text-center text-muted-foreground">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-3">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />
      ))}
    </div>
  );
}
