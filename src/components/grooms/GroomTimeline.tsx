import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  History, UserPlus, CheckCircle2, AlertCircle, XCircle, Award, Loader2, User,
  ShoppingCart, Users2, Sparkles,
} from "lucide-react";

interface AuditRow {
  id: string;
  event_type: string;
  actor_name: string | null;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  created_at: string;
}

const EVENT_META: Record<string, { label: string; icon: any; tone: string }> = {
  created:            { label: "تسجيل العريس",       icon: UserPlus,    tone: "bg-primary/15 text-primary border-primary/30" },
  approved:           { label: "اعتماد الطلب",        icon: CheckCircle2, tone: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  revision_requested: { label: "طلب تعديل",           icon: AlertCircle, tone: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  rejected:           { label: "رفض الطلب",           icon: XCircle,     tone: "bg-rose-500/15 text-rose-700 border-rose-500/30" },
  completed:          { label: "اكتمال",              icon: Award,       tone: "bg-gold/20 text-gold-foreground border-gold/40" },
  status_changed:     { label: "تغيير الحالة",        icon: History,     tone: "bg-muted text-foreground border-border" },
  routed_procurement: { label: "توجيه إلى لجنة المشتريات", icon: ShoppingCart, tone: "bg-orange-500/15 text-orange-700 border-orange-500/30" },
  routed_reception:   { label: "توجيه إلى لجنة الاستقبال",  icon: Users2,       tone: "bg-pink-500/15 text-pink-700 border-pink-500/30" },
  routed_programs:    { label: "توجيه إلى لجنة البرامج",    icon: Sparkles,     tone: "bg-violet-500/15 text-violet-700 border-violet-500/30" },
};

const fmt = (d: string) =>
  new Date(d).toLocaleString("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  });

export function GroomTimeline({ groomId }: { groomId: string }) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("groom_audit_log")
        .select("id,event_type,actor_name,from_status,to_status,note,created_at")
        .eq("groom_id", groomId)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setRows((data ?? []) as AuditRow[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [groomId]);

  return (
    <div className="rounded-xl border bg-gradient-to-br from-muted/30 to-transparent p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-7 w-7 rounded-lg bg-background/70 flex items-center justify-center">
          <History className="h-4 w-4 text-primary" />
        </div>
        <h3 className="text-sm font-bold">السجل الزمني</h3>
        <span className="text-[10px] text-muted-foreground">({rows.length})</span>
      </div>

      {loading ? (
        <div className="py-6 text-center"><Loader2 className="h-4 w-4 animate-spin inline text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">لا توجد أحداث مسجلة</p>
      ) : (
        <ol className="relative space-y-3 ps-5 before:absolute before:top-1 before:bottom-1 before:end-2 before:w-px before:bg-border">
          {rows.map((r) => {
            const meta = EVENT_META[r.event_type] ?? EVENT_META.status_changed;
            const Icon = meta.icon;
            return (
              <li key={r.id} className="relative">
                <span className={`absolute -end-3.5 top-0.5 h-6 w-6 rounded-full border-2 border-background flex items-center justify-center ${meta.tone}`}>
                  <Icon className="h-3 w-3" />
                </span>
                <div className="rounded-lg border bg-card p-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-bold">{meta.label}</span>
                    <span className="text-[10px] text-muted-foreground">{fmt(r.created_at)}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {r.actor_name ?? "النظام"}
                  </p>
                  {r.note && (
                    <p className="text-[11px] mt-1.5 p-2 rounded bg-muted/50 whitespace-pre-line leading-relaxed">{r.note}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
