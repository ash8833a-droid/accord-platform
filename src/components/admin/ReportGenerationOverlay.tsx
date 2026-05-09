import { Loader2 } from "lucide-react";

export function ReportGenerationOverlay({
  open,
  message = "جاري تجهيز التقرير...",
  hint = "يتم الآن تجميع البيانات وتنسيق المستند الرسمي",
}: { open: boolean; message?: string; hint?: string }) {
  if (!open) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      dir="rtl"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-[min(92vw,420px)] rounded-2xl bg-white shadow-2xl border border-slate-100 p-7 text-center">
        <div className="absolute -top-px left-6 right-6 h-px bg-gradient-to-r from-transparent via-[#0D7C66] to-transparent" />
        <div className="mx-auto h-14 w-14 rounded-full bg-[#0D7C66]/10 text-[#0D7C66] flex items-center justify-center mb-4">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">{message}</h3>
        <p className="mt-1.5 text-sm text-slate-500">{hint}</p>
        <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-1/3 rounded-full bg-[#0D7C66] animate-[slide_1.6s_ease-in-out_infinite]" />
        </div>
        <style>{`@keyframes slide { 0%{transform:translateX(-100%)} 100%{transform:translateX(300%)} }`}</style>
      </div>
    </div>
  );
}
