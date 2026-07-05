import { Info } from "lucide-react";

export function BudgetExceptionNotice() {
  return (
    <div className="rounded-2xl border border-amber-300/60 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-4 shadow-sm" dir="rtl">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
          <Info className="h-5 w-5" />
        </div>
        <div>
          <p className="font-bold text-sm text-amber-900">تنبيه مالي — سنة استثنائية</p>
          <p className="text-xs text-amber-800/80 mt-1 leading-relaxed">
            السنة الحالية استثنائية: لا يوجد سقف مخصص مسبق للجان، ويعتمد التسجيل على الصرف الفعلي.
            الالتزام بالمخصصات المحددة سيكون إلزامياً بمشيئة الله من العام القادم.
          </p>
        </div>
      </div>
    </div>
  );
}
