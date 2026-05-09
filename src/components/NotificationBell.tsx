import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell, BellOff, Plus, Pencil, CheckCircle2, AlarmClock,
  Receipt, ListTodo, MessageSquare, Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

/** Arabic relative time, e.g. "منذ 10 دقائق". */
function relativeAr(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "الآن";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return m === 1 ? "منذ دقيقة" : m === 2 ? "منذ دقيقتين" : `منذ ${m} دقائق`;
  const h = Math.floor(m / 60);
  if (h < 24) return h === 1 ? "منذ ساعة" : h === 2 ? "منذ ساعتين" : `منذ ${h} ساعات`;
  const d = Math.floor(h / 24);
  if (d < 30) return d === 1 ? "منذ يوم" : d === 2 ? "منذ يومين" : `منذ ${d} أيام`;
  const mo = Math.floor(d / 30);
  return mo === 1 ? "منذ شهر" : mo === 2 ? "منذ شهرين" : `منذ ${mo} أشهر`;
}

/** Map notification.type → contextual icon + soft tone. */
function iconForType(type: string): { Icon: typeof Bell; tone: string } {
  if (type === "task_completed" || /completed|complete|done/i.test(type))
    return { Icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600" };
  if (type === "task_created" || type === "task_assigned" || /add|create|new/i.test(type))
    return { Icon: Plus, tone: "bg-sky-50 text-sky-600" };
  if (type === "task_updated" || /edit|update/i.test(type))
    return { Icon: Pencil, tone: "bg-amber-50 text-amber-600" };
  if (type === "task_deadline" || type === "task_reminder")
    return { Icon: AlarmClock, tone: "bg-rose-50 text-rose-600" };
  if (/payment|expense|invoice|receipt/i.test(type))
    return { Icon: Receipt, tone: "bg-violet-50 text-violet-600" };
  if (/comment|message|reply/i.test(type))
    return { Icon: MessageSquare, tone: "bg-teal-50 text-teal-700" };
  return { Icon: ListTodo, tone: "bg-slate-100 text-slate-600" };
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(15);
    setNotifs((data ?? []) as Notif[]);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel("bell_notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const unread = notifs.filter((n) => !n.is_read).length;
  const hasUrgent = notifs.some(
    (n) => !n.is_read && (n.type === "task_deadline" || n.type === "task_reminder" || /عاجل|urgent/i.test(n.title)),
  );

  const markAll = async () => {
    if (!user || unread === 0) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    load();
  };

  const markOne = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const clearAll = async () => {
    if (!user || notifs.length === 0) return;
    await supabase.from("notifications").delete().eq("user_id", user.id);
    setNotifs([]);
  };

  const deleteOne = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifs((prev) => prev.filter((n) => n.id !== id));
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-xl hover:bg-slate-100/80 transition-colors"
          aria-label={`الإشعارات${unread > 0 ? ` (${unread} غير مقروء)` : ""}`}
        >
          <Bell className={`h-5 w-5 ${hasUrgent ? "text-rose-500" : "text-slate-600"}`} />
          {unread > 0 && (
            <>
              <span
                aria-hidden
                className={`absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white ${hasUrgent ? "animate-pulse" : ""}`}
              />
              {unread > 1 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        dir="rtl"
        className="w-[350px] p-0 rounded-2xl shadow-xl border border-slate-100 bg-white overflow-hidden animate-fade-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100">
          <h3 className="text-[15px] font-bold text-slate-800">التنبيهات</h3>
          <div className="flex items-center gap-3">
            {unread > 0 && (
              <button
                onClick={markAll}
                className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 transition-colors"
              >
                تحديد الكل كمقروء
              </button>
            )}
            {notifs.length > 0 && (
              <button
                onClick={clearAll}
                className="text-[11px] text-slate-400 hover:text-rose-600 transition-colors"
                title="مسح الكل"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="max-h-[420px] overflow-y-auto scrollbar-hide">
          {notifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 px-5">
              <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                <BellOff className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-[13px] font-semibold text-slate-700">لا توجد تنبيهات</p>
              <p className="text-[11px] text-slate-400 mt-1">سنعلمك فور وصول أي تحديث جديد</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {notifs.map((n) => {
                const { Icon, tone } = iconForType(n.type);
                const target = n.link && n.link.startsWith("/") ? n.link : null;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => {
                        if (!n.is_read) markOne(n.id);
                        setOpen(false);
                        if (target) navigate({ to: target });
                      }}
                      className={`group w-full text-start flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50/80 ${
                        n.is_read ? "bg-white" : "bg-slate-50/70"
                      }`}
                    >
                      <span className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${tone}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <p className="flex-1 text-[12.5px] font-bold leading-snug text-slate-800 line-clamp-1">
                            {n.title}
                          </p>
                          {!n.is_read && (
                            <span aria-hidden className="mt-1.5 h-2 w-2 rounded-full bg-teal-600 shrink-0" />
                          )}
                        </div>
                        {n.body && (
                          <p className="text-[11.5px] text-slate-500 leading-relaxed line-clamp-2 mt-0.5">
                            {n.body}
                          </p>
                        )}
                        <p className="text-[10.5px] text-slate-400 mt-1.5">{relativeAr(n.created_at)}</p>
                      </div>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); deleteOne(n.id); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); deleteOne(n.id); } }}
                        title="حذف"
                        aria-label="حذف الإشعار"
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 shrink-0 self-start cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
