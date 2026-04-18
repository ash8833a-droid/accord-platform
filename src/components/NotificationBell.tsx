import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, ListTodo, Receipt, CheckCheck, Inbox } from "lucide-react";
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

  const markAll = async () => {
    if (!user || unread === 0) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    load();
  };

  const markOne = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-lg hover:bg-accent transition-colors"
          aria-label={`الإشعارات${unread > 0 ? ` (${unread} غير مقروء)` : ""}`}
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-background">
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
          {unread > 0 && (
            <button onClick={markAll} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
              <CheckCheck className="h-3 w-3" /> تعليم الكل
            </button>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto divide-y">
          {notifs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">لا توجد إشعارات بعد</p>
            </div>
          ) : (
            notifs.map((n) => {
              const Icon = n.type === "task_assigned" ? ListTodo : Receipt;
              const inner = (
                <div className={`flex items-start gap-3 p-3.5 hover:bg-muted/40 transition-colors ${n.is_read ? "" : "bg-primary/5"}`}>
                  <span className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                    n.type === "task_assigned" ? "bg-primary/10 text-primary" : "bg-gold/15 text-gold-foreground"
                  }`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold leading-snug">{n.title}</p>
                    {n.body && <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
                    <p className="text-[10px] text-muted-foreground/70 mt-1">{new Date(n.created_at).toLocaleString("ar-SA")}</p>
                  </div>
                  {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                </div>
              );
              return (
                <Link
                  key={n.id}
                  to={n.link ?? "/inbox"}
                  onClick={() => { markOne(n.id); setOpen(false); }}
                  className="block"
                >
                  {inner}
                </Link>
              );
            })
          )}
        </div>

        <Link
          to="/inbox"
          onClick={() => setOpen(false)}
          className="block border-t px-4 py-2.5 text-center text-xs font-semibold text-primary hover:bg-primary/5 transition-colors"
        >
          <Inbox className="h-3.5 w-3.5 inline ms-1" /> عرض كل الوارد
        </Link>
      </PopoverContent>
    </Popover>
  );
}
