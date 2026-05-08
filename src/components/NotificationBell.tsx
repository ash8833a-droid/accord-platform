import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, ListTodo, Receipt, CheckCheck, Trash2, AlarmClock, Check } from "lucide-react";
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
          className="relative p-2 rounded-lg hover:bg-accent transition-colors"
          aria-label={`الإشعارات${unread > 0 ? ` (${unread} غير مقروء)` : ""}`}
        >
          <Bell className={`h-5 w-5 ${hasUrgent ? "text-rose-500" : "text-muted-foreground"}`} />
          {hasUrgent && (
            <span className="absolute inset-0 rounded-lg ring-2 ring-rose-500/60 animate-ping pointer-events-none" />
          )}
          {unread > 0 && (
            <span className={`absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-background ${hasUrgent ? "animate-pulse" : ""}`}>
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[340px] sm:w-[380px] p-0 overflow-hidden" dir="rtl">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-l from-primary/5 to-transparent">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-sm">الإشعارات</h3>
            {unread > 0 && <span className="text-[10px] bg-primary/15 text-primary rounded-full px-2 py-0.5 font-bold">{unread}</span>}
          </div>
          <div className="flex items-center gap-3">
            {unread > 0 && (
              <button onClick={markAll} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
                <CheckCheck className="h-3 w-3" /> تعليم الكل
              </button>
            )}
            {notifs.length > 0 && (
              <button onClick={clearAll} className="text-[11px] text-rose-600 hover:underline inline-flex items-center gap-1">
                <Trash2 className="h-3 w-3" /> مسح الكل
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto divide-y">
          {notifs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">لا توجد إشعارات بعد</p>
            </div>
          ) : (
            notifs.map((n) => {
              const isDeadline = n.type === "task_deadline" || n.type === "task_reminder";
              const Icon = isDeadline ? AlarmClock : n.type === "task_assigned" ? ListTodo : Receipt;
              const target = n.link && n.link.startsWith("/committee/") ? n.link : null;
              return (
                <div
                  key={n.id}
                  className={`group relative flex items-start gap-3 p-3.5 hover:bg-muted/40 transition-colors ${n.is_read ? "" : "bg-primary/5"}`}
                >
                  <button
                    onClick={() => {
                      markOne(n.id);
                      setOpen(false);
                      if (target) navigate({ to: target });
                    }}
                    className="flex-1 text-start flex items-start gap-3 min-w-0"
                  >
                    <span className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isDeadline ? "bg-rose-500/10 text-rose-600"
                        : n.type === "task_assigned" ? "bg-primary/10 text-primary"
                        : "bg-gold/15 text-gold-foreground"
                    }`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold leading-snug">{n.title}</p>
                      {n.body && <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
                      <p className="text-[10px] text-muted-foreground/70 mt-1">{new Date(n.created_at).toLocaleString("ar-SA")}</p>
                    </div>
                    {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                  </button>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!n.is_read && (
                      <button
                        onClick={(e) => { e.stopPropagation(); markOne(n.id); }}
                        title="تعليم كمقروء"
                        className="p-1 rounded hover:bg-primary/15 text-primary"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteOne(n.id); }}
                      title="حذف"
                      className="p-1 rounded hover:bg-rose-500/15 text-rose-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
