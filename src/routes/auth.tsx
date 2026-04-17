import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Logo, AnimatedRings } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { user, signIn, signUp, loading } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user && !loading) nav({ to: "/dashboard" });
  }, [user, loading, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await signIn(email, password);
        if (error) toast.error("تعذّر تسجيل الدخول", { description: error });
        else toast.success("مرحباً بعودتك");
      } else {
        if (!fullName.trim()) {
          toast.error("الرجاء إدخال الاسم الكامل");
          return;
        }
        const { error } = await signUp(email, password, fullName, phone);
        if (error) toast.error("تعذّر إنشاء الحساب", { description: error });
        else toast.success("تم إنشاء الحساب بنجاح");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2" dir="rtl">
      {/* Hero panel */}
      <div className="hidden lg:flex relative overflow-hidden bg-gradient-hero text-primary-foreground p-12 flex-col justify-between">
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-gold/20 blur-3xl animate-float" />
        <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-primary-glow/30 blur-3xl" />

        <Logo size={56} />

        <div className="relative z-10 space-y-8">
          <AnimatedRings className="w-72 h-44 mx-auto" />
          <div className="text-center space-y-3">
            <h1 className="text-4xl font-black leading-tight">
              <span className="text-shimmer-gold">منصة الزواج الجماعي</span>
            </h1>
            <p className="text-lg text-primary-foreground/80 max-w-md mx-auto leading-relaxed">
              منظومة مؤسسية متكاملة لإدارة لجان البرنامج، تحصيل الاشتراكات، ومتابعة العرسان بكل شفافية.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto pt-4">
            {[
              { n: "11", l: "سنة من العطاء" },
              { n: "8", l: "لجان متخصصة" },
              { n: "300", l: "ريال اشتراك سنوي" },
            ].map((s) => (
              <div key={s.l} className="text-center glass rounded-xl p-3">
                <div className="text-2xl font-bold text-shimmer-gold">{s.n}</div>
                <div className="text-xs text-primary-foreground/70">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-primary-foreground/60 text-center">© منصة البرنامج العائلي</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-6 animate-fade-up">
          <div className="lg:hidden flex justify-center">
            <Logo size={48} />
          </div>

          <div className="space-y-2 text-center lg:text-right">
            <h2 className="text-3xl font-bold">{mode === "in" ? "تسجيل الدخول" : "إنشاء حساب جديد"}</h2>
            <p className="text-muted-foreground text-sm">
              {mode === "in" ? "ادخل بياناتك للوصول إلى المنصة" : "أنشئ حسابك للمشاركة في البرنامج"}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "up" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">الاسم الكامل</Label>
                  <Input
                    id="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="مثال: أحمد بن محمد"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">رقم الجوال (اختياري)</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="05xxxxxxxx"
                    dir="ltr"
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw">كلمة المرور</Label>
              <Input
                id="pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                dir="ltr"
              />
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-gradient-hero text-primary-foreground hover:opacity-90 shadow-elegant h-11 text-base font-semibold"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
              {mode === "in" ? "دخول" : "إنشاء الحساب"}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            {mode === "in" ? "ليس لديك حساب؟" : "لديك حساب؟"}{" "}
            <button
              onClick={() => setMode(mode === "in" ? "up" : "in")}
              className="text-primary font-semibold hover:underline"
            >
              {mode === "in" ? "أنشئ واحداً" : "سجّل الدخول"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
