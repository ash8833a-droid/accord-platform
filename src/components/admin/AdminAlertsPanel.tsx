import { Link } from "@tanstack/react-router";
import { AlertTriangle, BellRing, Check, X, ExternalLink, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAdminAlerts } from "@/hooks/use-admin-alerts";

interface Props {
  enabled: boolean;
}

/**
 * Top-of-page panel that mirrors the red badge on the "الأداء العام" sidebar link.
 * Currently surfaces pending membership requests; dismissing an alert decreases
 * the sidebar badge instantly via a shared hook.
 */
export function AdminAlertsPanel({ enabled }: Props) {
  const { alerts, count, dismiss, dismissAll } = useAdminAlerts(enabled);

  if (!enabled) return null;
  if (count === 0) {
    return (
      <div className="rounded-2xl border-2 border-emerald-300/60 dark:border-emerald-700/60 bg-emerald-50/80 dark:bg-emerald-950/30 px-4 py-3 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
          <Check className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-bold text-emerald-800 dark:text-emerald-200">لا توجد تنبيهات هامة</h3>
          <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">جميع طلبات الانضمام تمت مراجعتها.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-rose-300/70 dark:border-rose-800/60 bg-rose-50/70 dark:bg-rose-950/30 shadow-sm overflow-hidden" dir="rtl">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-rose-200/70 dark:border-rose-800/60 bg-rose-100/50 dark:bg-rose-950/40">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-rose-500/15 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-rose-800 dark:text-rose-200">تنبيهات هامة — تتطلب إجراءً</h3>
              <Badge className="bg-rose-600 text-white hover:bg-rose-600 tabular-nums">{count}</Badge>
            </div>
            <p className="text-[11px] sm:text-xs text-rose-700/80 dark:text-rose-300/80">
              المصدر: طلبات انضمام بانتظار المراجعة من إدارة المستخدمين.
            </p>
          </div>
        </div>
        {count > 1 && (
          <Button variant="ghost" size="sm" onClick={dismissAll} className="text-rose-700 hover:bg-rose-100 dark:text-rose-200 shrink-0">
            تجاهل الكل
          </Button>
        )}
      </div>
      <ul className="divide-y divide-rose-200/60 dark:divide-rose-800/50">
        {alerts.map((a) => (
          <li key={a.id} className="px-4 py-3 flex items-center gap-3 bg-white/70 dark:bg-card/40">
            <div className="h-9 w-9 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0">
              <BellRing className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{a.title}</p>
              <p className="text-xs text-muted-foreground truncate">{a.body}</p>
            </div>
            <Link to={a.link} className="shrink-0">
              <Button size="sm" variant="outline" className="gap-1 h-8">
                <ExternalLink className="h-3.5 w-3.5" /> مراجعة
              </Button>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => dismiss(a.id)}
              aria-label="تحديد كمقروء"
              title="تحديد كمقروء"
              className="shrink-0 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="px-4 py-2 text-[11px] text-rose-700/70 dark:text-rose-300/70 bg-rose-100/30 dark:bg-rose-950/30 flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5" />
        التجاهل يخفي التنبيه من الشريط الجانبي فوراً، ولا يلغي الطلب.
      </div>
    </div>
  );
}
