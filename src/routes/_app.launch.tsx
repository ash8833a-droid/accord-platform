import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLaunchStatus } from "@/components/LaunchBanner";
import { Loader2, Rocket, ShieldCheck, Sparkles, PartyPopper, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/launch")({
  component: LaunchPage,
});

function LaunchPage() {
  const { user, hasRole, loading } = useAuth();
  const status = useLaunchStatus();
  const nav = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [justLaunched, setJustLaunched] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const isAdmin = hasRole("admin");
  const alreadyLaunched = !!status?.is_launched;

  // Auto-redirect to home after launch
  useEffect(() => {
    if (!justLaunched) return;
    const t = setTimeout(() => nav({ to: "/" }), 12000);
    return () => clearTimeout(t);
  }, [justLaunched, nav]);

  const handleLaunch = async () => {
    if (submitting) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("launch_platform");
    setSubmitting(false);
    if (error) {
      toast.error("تعذّر تنفيذ التدشين", { description: error.message });
      return;
    }
    setJustLaunched(true);
    toast.success("🎉 تم تدشين المنصة بنجاح");
    // Try to autoplay the video
    setTimeout(() => {
      videoRef.current?.play().catch(() => {});
    }, 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-gradient-to-b from-background via-primary/[0.04] to-background">
      {/* Ambient glow */}
      <div className="absolute -top-32 right-1/4 h-[480px] w-[480px] rounded-full bg-gold/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-1/4 h-[480px] w-[480px] rounded-full bg-primary/15 blur-3xl pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-8 py-12 lg:py-20">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-xs font-bold text-gold tracking-wider mb-5">
            <Sparkles className="h-3.5 w-3.5" />
            بوابة التدشين الرسمي
          </div>
          <h1 className="font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-tight text-foreground mb-4">
            التدشين الرسمي للمنصة
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-loose">
            خطوةٌ توثّق انطلاقَ المنصة الرسمية للجنة الزواج الجماعي،
            تُسجَّل بهويّة المُدشِّن وتاريخ التدشين، وتُبثّ مباشرةً لجميع الأعضاء.
          </p>
        </div>

        {/* Status card / Action card / Success state */}
        {!user ? (
          <GateMessage
            icon={<ShieldCheck className="h-10 w-10 text-primary" />}
            title="يلزم تسجيل الدخول"
            desc="هذه الصفحة مخصّصة لمسؤولي المنصة فقط."
          />
        ) : !isAdmin && !alreadyLaunched ? (
          <GateMessage
            icon={<ShieldCheck className="h-10 w-10 text-primary" />}
            title="صلاحية التدشين محصورة بالمشرف العام"
            desc="بإمكانك مشاهدة لحظة التدشين فور تنفيذها من قِبل المشرف."
          />
        ) : justLaunched || alreadyLaunched ? (
          <SuccessState
            status={status}
            videoRef={videoRef}
            showRedirectHint={justLaunched}
            onGoHome={() => nav({ to: "/" })}
          />
        ) : (
          <div className="relative rounded-3xl border border-border/60 bg-card/80 backdrop-blur p-8 sm:p-12 shadow-elegant text-center">
            <div className="mx-auto mb-6 grid place-items-center w-20 h-20 rounded-full bg-gradient-hero text-primary-foreground shadow-elegant">
              <Rocket className="h-10 w-10" />
            </div>
            <h2 className="font-extrabold text-2xl sm:text-3xl mb-3">جاهزون للانطلاق</h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto leading-loose">
              عند الضغط على الزر سيتم تسجيل التدشين الرسمي في قاعدة البيانات،
              وستُعرض كلمة التدشين عبر الفيديو الرسمي مباشرةً.
            </p>
            <button
              onClick={handleLaunch}
              disabled={submitting}
              className="group relative inline-flex items-center gap-3 rounded-2xl bg-gradient-hero text-primary-foreground px-10 py-5 text-lg font-extrabold shadow-elegant hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Rocket className="h-6 w-6 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              )}
              {submitting ? "جارٍ التدشين..." : "تدشين المنصة الآن"}
            </button>
            <p className="mt-6 text-xs text-muted-foreground">
              لا يمكن التراجع عن هذا الإجراء؛ سيُسجَّل باسم: {user.email}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function GateMessage({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur p-10 text-center shadow-soft">
      <div className="mx-auto mb-4 grid place-items-center w-16 h-16 rounded-full bg-primary/10">{icon}</div>
      <h2 className="font-bold text-xl mb-2">{title}</h2>
      <p className="text-muted-foreground">{desc}</p>
    </div>
  );
}

function SuccessState({
  status,
  videoRef,
  showRedirectHint,
  onGoHome,
}: {
  status: { launched_at: string | null; launched_by_name: string | null } | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  showRedirectHint: boolean;
  onGoHome: () => void;
}) {
  const date = status?.launched_at
    ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "long", timeStyle: "short" }).format(new Date(status.launched_at))
    : "";
  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-700">
      <div className="relative rounded-3xl border border-gold/40 bg-gradient-to-br from-primary/10 via-gold/10 to-primary/5 p-8 text-center shadow-elegant overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <span
              key={i}
              className="absolute block w-1.5 h-1.5 rounded-full bg-gold animate-ping"
              style={{
                top: `${(i * 53) % 100}%`,
                left: `${(i * 37) % 100}%`,
                animationDelay: `${(i % 5) * 0.3}s`,
                animationDuration: `${1.5 + (i % 3) * 0.5}s`,
                opacity: 0.6,
              }}
            />
          ))}
        </div>
        <div className="relative">
          <div className="mx-auto mb-4 grid place-items-center w-20 h-20 rounded-full bg-gradient-hero text-primary-foreground shadow-elegant">
            <PartyPopper className="h-10 w-10" />
          </div>
          <h2 className="font-extrabold text-3xl sm:text-4xl mb-2">تم التدشين بنجاح</h2>
          <p className="text-muted-foreground">
            {status?.launched_by_name ? `بواسطة ${status.launched_by_name}` : ""}
            {date ? ` — ${date}` : ""}
          </p>
        </div>
      </div>

      <div className="relative rounded-3xl overflow-hidden border border-border/60 bg-black shadow-elegant">
        <video
          ref={videoRef}
          src="/launch-video.mp4"
          controls
          autoPlay
          playsInline
          className="w-full aspect-video bg-black"
        />
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/80 backdrop-blur px-5 py-4">
        <p className="text-sm text-muted-foreground">
          {showRedirectHint
            ? "سيتم تحويلك إلى الصفحة الرئيسية تلقائيًا خلال لحظات…"
            : "يمكنك الآن العودة إلى الصفحة الرئيسية لمتابعة المنصة."}
        </p>
        <button
          onClick={onGoHome}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-hero text-primary-foreground px-5 py-2.5 text-sm font-bold shadow-soft hover:opacity-90"
        >
          الانتقال للرئيسية
          <ArrowRight className="h-4 w-4 rotate-180" />
        </button>
      </div>
    </div>
  );
}