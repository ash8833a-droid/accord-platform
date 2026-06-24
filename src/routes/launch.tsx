import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLaunchStatus } from "@/components/LaunchBanner";
import { Logo } from "@/components/Logo";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/launch")({
  component: LaunchPage,
  head: () => ({
    meta: [
      { title: "تدشين منصة الزواج الجماعي — لجنة الزواج الجماعي" },
      { name: "description", content: "الصفحة الرسمية لتدشين منصة الزواج الجماعي لعائلة الهملة من قريش." },
    ],
  }),
});

function LaunchPage() {
  const { user, hasRole, loading } = useAuth();
  const status = useLaunchStatus();
  const nav = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<"ready" | "launching" | "launched">("ready");

  const isAdmin = hasRole("admin");
  const alreadyLaunched = !!status?.is_launched;

  // After the admin clicks the launch button and the success message appears,
  // redirect automatically to the official platform domain after 3 seconds.
  useEffect(() => {
    if (phase !== "launched") return;
    const t = setTimeout(() => {
      window.location.href = "https://www.lajnat-zawaj.org";
    }, 3000);
    return () => clearTimeout(t);
  }, [phase]);

  const handleLaunch = async () => {
    if (submitting || phase !== "ready") return;
    setPhase("launching");
    setSubmitting(true);
    const { error } = await supabase.rpc("launch_platform");
    setSubmitting(false);
    if (error) {
      setPhase("ready");
      toast.error("تعذّر تنفيذ التدشين", { description: error.message });
      return;
    }
    setPhase("launched");
    toast.success("تم تدشين المنصة بنجاح");
  };

  if (loading || status === null) {
    return (
      <CeremonialContainer>
        <Loader2 className="h-10 w-10 animate-spin text-gold" />
      </CeremonialContainer>
    );
  }

  // If the platform has already been launched, show the celebratory success state immediately.
  if (alreadyLaunched || phase === "launched") {
    return <LaunchedSuccess />;
  }

  return (
    <CeremonialContainer>
      <div className="mb-10 flex justify-center">
        <div className="rounded-full bg-primary-foreground/10 p-5 ring-1 ring-gold/30 shadow-elegant">
          <Logo size={80} withText={false} />
        </div>
      </div>

      <div className="animate-fade-in space-y-10">
        <div className="space-y-5">
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-tight">
            تدشين منصة الزواج الجماعي
          </h1>
          <p className="text-xl sm:text-2xl lg:text-4xl text-gold font-semibold">
            لعائلة الهِملة من قريش
          </p>
        </div>

        <p className="mx-auto max-w-2xl text-lg sm:text-xl text-primary-foreground/80 leading-relaxed">
          خطوة رسمية توثّق انطلاق المنصة الرقمية، وترفع الستار عن مرحلة جديدة
          من العطاء والإنجاز.
        </p>

        {isAdmin ? (
          <button
            onClick={handleLaunch}
            disabled={submitting}
            className="group relative inline-flex items-center justify-center gap-3 rounded-full bg-gold text-primary px-14 py-6 text-2xl sm:text-3xl font-bold shadow-elegant ring-4 ring-gold/30 hover:ring-gold/60 hover:scale-105 active:scale-95 transition-all duration-300 disabled:opacity-60 disabled:scale-100"
          >
            {submitting ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <Sparkles className="h-8 w-8 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            )}
            دشّن المنصة
          </button>
        ) : user ? (
          <div className="space-y-3">
            <p className="text-primary-foreground/70">
              بانتظار قيام المشرف العام بتدشين المنصة...
            </p>
            <p className="text-sm text-primary-foreground/50">
              صلاحية التدشين محصورة بالمشرف العام
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-primary-foreground/70">
              بانتظار قيام المشرف العام بتدشين المنصة...
            </p>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-full bg-primary-foreground/10 text-primary-foreground px-8 py-3 text-lg font-semibold ring-1 ring-gold/30 hover:bg-primary-foreground/20 transition"
            >
              تسجيل الدخول
            </Link>
          </div>
        )}
      </div>
    </CeremonialContainer>
  );
}

function LaunchedSuccess() {
  return (
    <CeremonialContainer>
      <div className="mb-10 flex justify-center">
        <div className="rounded-full bg-primary-foreground/10 p-5 ring-1 ring-gold/30 shadow-elegant">
          <Logo size={80} withText={false} />
        </div>
      </div>
      <LaunchedContent />
    </CeremonialContainer>
  );
}

function LaunchedContent() {
  return (
    <div className="animate-enter space-y-8">
      <div className="mx-auto w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-gold/20 flex items-center justify-center ring-4 ring-gold/40 shadow-elegant">
        <Sparkles className="h-14 w-14 sm:h-18 sm:w-18 text-gold" />
      </div>
      <h2 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-primary-foreground tracking-tight">
        تم التدشين بحمد الله
      </h2>
      <div className="space-y-4 text-xl sm:text-2xl lg:text-3xl text-gold/95 font-medium">
        <p className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
          من الإنجاز إلى التوثيق الرقمي
        </p>
        <p className="animate-fade-in" style={{ animationDelay: "0.5s" }}>
          ذاكرة رقمية تحفظ الأثر وتوثق العطاء
        </p>
      </div>
      <p className="text-sm sm:text-base text-primary-foreground/60">
        سيتم تحويلك إلى الصفحة الرئيسية خلال لحظات...
      </p>
    </div>
  );
}

function CeremonialContainer({ children }: { children: React.ReactNode }) {
  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 overflow-y-auto bg-primary text-primary-foreground flex flex-col items-center justify-center p-6"
    >
      {/* Ceremonial ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-gold/8 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[700px] h-[700px] rounded-full bg-primary-foreground/5 blur-3xl" />
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-gold/5 blur-3xl" />
      </div>

      {/* Ornamental gold borders */}
      <div className="absolute top-10 left-10 right-10 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
      <div className="absolute bottom-10 left-10 right-10 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
      <div className="absolute top-10 bottom-10 right-10 w-px bg-gradient-to-b from-transparent via-gold/30 to-transparent hidden lg:block" />
      <div className="absolute top-10 bottom-10 left-10 w-px bg-gradient-to-b from-transparent via-gold/30 to-transparent hidden lg:block" />

      {/* Corner ornaments */}
      <div className="absolute top-6 left-6 w-16 h-16 border-t-2 border-l-2 border-gold/40 rounded-tl-2xl hidden lg:block" />
      <div className="absolute top-6 right-6 w-16 h-16 border-t-2 border-r-2 border-gold/40 rounded-tr-2xl hidden lg:block" />
      <div className="absolute bottom-6 left-6 w-16 h-16 border-b-2 border-l-2 border-gold/40 rounded-bl-2xl hidden lg:block" />
      <div className="absolute bottom-6 right-6 w-16 h-16 border-b-2 border-r-2 border-gold/40 rounded-br-2xl hidden lg:block" />

      <div className="relative z-10 w-full max-w-5xl mx-auto text-center">
        {children}
      </div>
    </div>
  );
}
