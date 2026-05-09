import { Link } from "@tanstack/react-router";
import { BellRing, Check, X, ExternalLink, ShieldAlert, ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAdminAlerts } from "@/hooks/use-admin-alerts";

interface Props {
  enabled: boolean;
}

/**
 * Compact alert bell for the admin dashboard. Renders a small icon button;
 * clicking it opens a popover with the pending membership-request alerts.
 * Mirrors the red badge on the "الأداء العام" sidebar link.
 */
export function AdminAlertsPanel({ enabled }: Props) {
  const { alerts, count, dismiss, dismissAll } = useAdminAlerts(enabled);

  if (!enabled) return null;

  const hasAlerts = count > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={hasAlerts ? `تنبيهات هامة (${count})` : "لا توجد تنبيهات"}
          title={hasAlerts ? `تنبيهات هامة (${count})` : "لا توجد تنبيهات"}
          className={`relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm border transition-colors ${
            hasAlerts
              ? "border-rose-200 hover:bg-rose-50"
              : "border-slate-100 hover:bg-slate-50"
          }`}
        >
          {hasAlerts ? (
            <ShieldAlert className="h-5 w-5 text-rose-600" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          )}
          {hasAlerts && (
            <>
              <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white tabular-nums">
                {count > 9 ? "9+" : count}
              </span>
              <span className="absolute inset-0 rounded-xl ring-2 ring-rose-400/40 animate-ping pointer-events-none" />
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={10}
        className="w-[360px] sm:w-[400px] p-0 overflow-hidden rounded-2xl border-slate-100 shadow-xl"
        dir="rtl"
      >
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/60">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
              hasAlerts ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
            }`}>
              {hasAlerts ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate">
                {hasAlerts ? "تنبيهات هامة — تتطلب إجراءً" : "لا توجد تنبيهات"}
              </h3>
              <p className="text-[11px] text-slate-500 truncate">
                {hasAlerts ? "طلبات انضمام بانتظار المراجعة" : "تمت مراجعة جميع الطلبات"}
              </p>
            </div>
          </div>
          {hasAlerts && count > 1 && (
            <Button variant="ghost" size="sm" onClick={dismissAll} className="text-rose-700 hover:bg-rose-50 h-8 text-xs">
              تجاهل الكل
            </Button>
          )}
        </div>

        {hasAlerts ? (
          <ul className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
            {alerts.map((a) => (
              <li key={a.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50/60 transition-colors">
                <div className="h-9 w-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <BellRing className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{a.title}</p>
                  <p className="text-xs text-slate-500 truncate">{a.body}</p>
                </div>
                <Link to={a.link} className="shrink-0">
                  <Button size="sm" variant="outline" className="gap-1 h-8 border-slate-200">
                    <ExternalLink className="h-3.5 w-3.5" /> مراجعة
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => dismiss(a.id)}
                  aria-label="تجاهل"
                  title="تجاهل"
                  className="shrink-0 h-8 w-8 p-0 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-6 py-10 text-center text-slate-500">
            <div className="h-12 w-12 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <Check className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">كل شيء على ما يرام</p>
            <p className="text-xs mt-1">لا توجد طلبات بانتظار المراجعة حالياً.</p>
          </div>
        )}

        {hasAlerts && (
          <div className="px-4 py-2 text-[11px] text-slate-500 bg-slate-50/60 border-t border-slate-100 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            التجاهل يخفي التنبيه من الشريط الجانبي فوراً، ولا يلغي الطلب.
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
