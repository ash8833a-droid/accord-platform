import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, BellRing, CheckCircle2, ClipboardCheck, Loader2, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface TaskRow {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
}

interface ActionState {
  overdue: TaskRow[];
  dueSoon: TaskRow[];
  approvals: { payments: number; purchases: number; members: number };
  unread: number;
}

const EMPTY: ActionState = {
  overdue: [],
  dueSoon: [],
  approvals: { payments: 0, purchases: 0, members: 0 },
  unread: 0,
};

/**
 * "المطلوب مني الآن" — a focused, role-aware action center.
 * Replaces vanity metrics with the three things that actually need the user:
 * my late tasks, what awaits my approval, and unread alerts.
 */
export function MyActionCenter() {
  const { user, hasRole } = useAuth();
  const canApprove = hasRole("admin") || hasRole("committee_head");
  const [state, setState] = useState<ActionState>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const in7 = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

    const [mine, unread, payments, purchases, members] = await Promise.all([
      supabase
        .from("committee_tasks")
        .select("id, title, due_date, status")
        .eq("assigned_to", user.id)
        .neq("status", "completed")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(50),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false),
      canApprove
        ? supabase.from("payment_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
        : Promise.resolve({ count: 0 } as { count: number | null }),
      canApprove
        ? supabase.from("purchase_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
        : Promise.resolve({ count: 0 } as { count: number | null }),
      hasRole("admin")
        ? supabase.from("membership_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
        : Promise.resolve({ count: 0 } as { count: number | null }),
    ]);

    const tasks = (mine.data ?? []) as TaskRow[];
    setState({
      overdue: tasks.filter((t) => t.due_date && t.due_date < today),
      dueSoon: tasks.filter((t) => t.due_date && t.due_date >= today && t.due_date <= in7),
      approvals: {
        payments: payments.count ?? 0,
        purchases: purchases.count ?? 0,
        members: members.count ?? 0,
      },
      unread: unread.count ?? 0,
    });
    setLoading(false);
  }, [user, canApprove, hasRole]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 120_000);
    return () => window.clearInterval(id);
  }, [load]);

  if (!user) return null;

  const approvalsTotal =
    state.approvals.payments + state.approvals.purchases + state.approvals.members;
  const allClear =
    !loading && state.overdue.length === 0 && state.dueSoon.length === 0 && approvalsTotal === 0 && state.unread === 0;

  return (
    <section
      dir="rtl"
      aria-labelledby="my-action-center-title"
      className="rounded-3xl border border-slate-100 bg-white p-5 sm:p-6 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="h-9 w-9 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <ClipboardCheck className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <h2 id="my-action-center-title" className="text-base sm:text-lg font-bold text-slate-800 leading-tight">
              المطلوب مني الآن
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">ملخّص شخصي يُحدَّث تلقائيًا</p>
          </div>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-300 shrink-0" />}
      </div>

      {allClear ? (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50/70 px-4 py-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <p className="text-[13px] font-semibold text-emerald-800">
            لا يوجد أي إجراء مطلوب منك حاليًا — كل شيء منضبط.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ActionCard
            to="/admin/tasks"
            tone="rose"
            Icon={AlertTriangle}
            label="مهامي المتأخرة"
            value={state.overdue.length}
            hint={
              state.overdue.length > 0
                ? `أقربها: ${state.overdue[0]?.title ?? ""}`
                : "لا مهام متأخرة عليك"
            }
          />
          <ActionCard
            to="/admin/tasks"
            tone="amber"
            Icon={Timer}
            label="تستحق هذا الأسبوع"
            value={state.dueSoon.length}
            hint={state.dueSoon.length > 0 ? "أنجزها قبل موعدها" : "لا مواعيد قريبة"}
          />
          {canApprove ? (
            <ActionCard
              to="/communications"
              tone="teal"
              Icon={ClipboardCheck}
              label="بانتظار موافقتي"
              value={approvalsTotal}
              hint={
                approvalsTotal > 0
                  ? `صرف ${state.approvals.payments} · شراء ${state.approvals.purchases} · عضوية ${state.approvals.members}`
                  : "لا طلبات معلّقة"
              }
            />
          ) : (
            <ActionCard
              to="/admin/tasks"
              tone="teal"
              Icon={BellRing}
              label="تنبيهات غير مقروءة"
              value={state.unread}
              hint={state.unread > 0 ? "افتح جرس التنبيهات للمراجعة" : "لا جديد"}
            />
          )}
        </div>
      )}
    </section>
  );
}

const TONES: Record<string, { wrap: string; icon: string; value: string }> = {
  rose: { wrap: "bg-rose-50/70 hover:bg-rose-50", icon: "bg-white text-rose-600", value: "text-rose-700" },
  amber: { wrap: "bg-amber-50/70 hover:bg-amber-50", icon: "bg-white text-amber-600", value: "text-amber-700" },
  teal: { wrap: "bg-teal-50/70 hover:bg-teal-50", icon: "bg-white text-teal-700", value: "text-teal-800" },
};

function ActionCard({
  to, tone, Icon, label, value, hint,
}: {
  to: string;
  tone: keyof typeof TONES | string;
  Icon: typeof AlertTriangle;
  label: string;
  value: number;
  hint: string;
}) {
  const t = TONES[tone] ?? TONES.teal!;
  return (
    <Link
      to={to}
      className={`group rounded-2xl px-4 py-4 transition-colors ${t.wrap} ${value === 0 ? "opacity-70" : ""}`}
    >
      <div className="flex items-start gap-3">
        <span className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${t.icon}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-semibold text-slate-500">{label}</p>
          <p className={`text-2xl font-extrabold leading-tight mt-0.5 ${t.value}`}>{value}</p>
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-1" title={hint}>{hint}</p>
        </div>
      </div>
    </Link>
  );
}
