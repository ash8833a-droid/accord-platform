import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  Plus,
  Pencil,
  ArrowRightLeft,
  MessageSquare,
  Paperclip,
  Sparkles,
  Trash2,
  UserPlus,
  Flag,
  CalendarClock,
  FileText,
  History,
} from "lucide-react";

interface Entry {
  id: string;
  event_type: string;
  actor_name: string | null;
  from_value: string | null;
  to_value: string | null;
  note: string | null;
  meta: any;
  created_at: string;
}

const STATUS_AR: Record<string, string> = {
  todo: "قائمة الانتظار",
  in_progress: "قيد التنفيذ",
  completed: "مكتملة",
};
const PRIORITY_AR: Record<string, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  urgent: "عاجلة",
};

const META: Record<string, { icon: any; tone: string; label: (e: Entry) => string }> = {
  created: {
    icon: Plus,
    tone: "text-emerald-600 bg-emerald-500/10",
    label: () => "أنشأ المهمة",
  },
  status_changed: {
    icon: ArrowRightLeft,
    tone: "text-sky-600 bg-sky-500/10",
    label: (e) =>
      `نقل الحالة من «${STATUS_AR[e.from_value ?? ""] ?? e.from_value ?? "—"}» إلى «${STATUS_AR[e.to_value ?? ""] ?? e.to_value ?? "—"}»`,
  },
  priority_changed: {
    icon: Flag,
    tone: "text-amber-600 bg-amber-500/10",
    label: (e) =>
      `غيّر الأولوية من «${PRIORITY_AR[e.from_value ?? ""] ?? e.from_value ?? "—"}» إلى «${PRIORITY_AR[e.to_value ?? ""] ?? e.to_value ?? "—"}»`,
  },
  assignee_changed: {
    icon: UserPlus,
    tone: "text-indigo-600 bg-indigo-500/10",
    label: () => "غيّر المسؤول عن المهمة",
  },
  title_changed: {
    icon: Pencil,
    tone: "text-muted-foreground bg-muted",
    label: (e) => `عدّل العنوان: «${e.from_value ?? ""}» → «${e.to_value ?? ""}»`,
  },
  description_changed: {
    icon: FileText,
    tone: "text-muted-foreground bg-muted",
    label: () => "حدّث وصف المهمة",
  },
  due_date_changed: {
    icon: CalendarClock,
    tone: "text-amber-600 bg-amber-500/10",
    label: (e) => `حدّث تاريخ الاستحقاق إلى ${e.to_value ?? "—"}`,
  },
  comment_added: {
    icon: MessageSquare,
    tone: "text-primary bg-primary/10",
    label: () => "أضاف تعليقاً",
  },
  attachment_added: {
    icon: Paperclip,
    tone: "text-violet-600 bg-violet-500/10",
    label: (e) => `أرفق ملفاً: ${e.note ?? ""}`,
  },
  response_added: {
    icon: Sparkles,
    tone: "text-emerald-600 bg-emerald-500/10",
    label: (e) => `سجّل استجابة تنفيذ (${e.to_value ?? "0"}%)`,
  },
  response_updated: {
    icon: Sparkles,
    tone: "text-emerald-600 bg-emerald-500/10",
    label: (e) => `حدّث الاستجابة (${e.from_value ?? "0"}% → ${e.to_value ?? "0"}%)`,
  },
  deleted: {
    icon: Trash2,
    tone: "text-rose-600 bg-rose-500/10",
    label: () => "حذف المهمة",
  },
};

const fmt = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function TaskActivityLog({ taskId }: { taskId: string }) {
  const [items, setItems] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("task_activity_log" as any)
      .select("id, event_type, actor_name, from_value, to_value, note, meta, created_at")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });
    setItems(((data ?? []) as unknown) as Entry[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`task_activity_${taskId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "task_activity_log", filter: `task_id=eq.${taskId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="text-center py-10 text-xs text-muted-foreground border-2 border-dashed border-muted/60 rounded-lg">
        <History className="h-5 w-5 mx-auto mb-2 opacity-60" />
        لا يوجد نشاط مسجّل لهذه المهمة بعد
      </div>
    );
  }

  return (
    <ol className="relative space-y-3 pr-4 border-r border-border/60" dir="rtl">
      {items.map((e) => {
        const m = META[e.event_type] ?? {
          icon: History,
          tone: "text-muted-foreground bg-muted",
          label: () => e.event_type,
        };
        const Icon = m.icon;
        return (
          <li key={e.id} className="relative pr-4">
            <span
              className={`absolute -right-[14px] top-1 h-7 w-7 rounded-full ${m.tone} flex items-center justify-center ring-4 ring-background`}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="bg-card border rounded-lg p-2.5">
              <div className="text-[12.5px] leading-relaxed">
                <span className="font-bold">{e.actor_name ?? "النظام"}</span>{" "}
                <span className="text-muted-foreground">— {m.label(e)}</span>
              </div>
              {e.note && e.event_type === "comment_added" && (
                <div className="text-[11.5px] text-muted-foreground bg-muted/40 rounded px-2 py-1 mt-1.5 line-clamp-3">
                  «{e.note}»
                </div>
              )}
              <div className="text-[10.5px] text-muted-foreground/70 mt-1">{fmt(e.created_at)}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
