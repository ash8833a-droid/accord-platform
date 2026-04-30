import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Logo, AnimatedRings } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { COMMITTEES } from "@/lib/committees";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const isValidSaPhone = (p: string) => /^05\d{8}$/.test(p.trim());

function AuthPage() {
  const { user, signIn, signUp, loading, hasRole } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [committeeId, setCommitteeId] = useState<string>("");
  const [committees, setCommittees] = useState<{ id: string; name: string; type: string }[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      // التوجيه بعد الدخول حسب الدور
      if (hasRole("admin")) nav({ to: "/admin" });
      else if (hasRole("quality")) nav({ to: "/reports" });
      else nav({ to: "/ideas" });
    }
  }, [user, loading, nav, hasRole]);

  useEffect(() => {
    supabase
      .from("committees")
      .select("id,name,type")
      .order("name")
      .then(({ data }) => setCommittees(data ?? []));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidSaPhone(phone)) {
      toast.error("رقم الجوال غير صحيح", { description: "يجب أن يبدأ بـ 05 ويتكون من 10 أرقام" });
      return;
    }
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await signIn(phone, password);
        if (error) toast.error("تعذّر تسجيل الدخول", { description: error });
        else toast.success("مرحباً بعودتك");
      } else {
        if (!fullName.trim()) return toast.error("الرجاء إدخال الاسم الكامل");
        const { error } = await signUp(
          phone,
          password,
          fullName,
          "",
          committeeId || undefined,
          notes || undefined,
        );
        if (error) toast.error("تعذّر إنشاء الحساب", { description: error });
        else toast.success("تم إرسال طلبك", { description: "حسابك قيد المراجعة من الإدارة العليا" });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2" dir="rtl">
      <div className="hidden lg:flex relative overflow-hidden bg-gradient-hero text-primary-foreground p-12 flex-col justify-between">
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-gold/20 blur-3xl animate-float" />
        <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-primary-glow/30 blur-3xl" />

        <Logo size={56} />

        <div className="relative z-10 space-y-8">
          <AnimatedRings className="w-72 h-44 mx-auto" />
          <div className="text-center space-y-3">
            <h1 className="text-4xl font-black leading-tight">
              <span className="text-shimmer-gold">منصة القبيلة</span>
            </h1>
            <p className="text-sm text-gold/80 font-semibold tracking-wide">لقبيلة الهملة من قريش</p>
            <p className="text-lg text-primary-foreground/85 max-w-md mx-auto leading-relaxed pt-2">
              حيث تجتمع الهِمَمُ على الإتقان، وتتكاتف الأيدي بمنهجيةٍ مؤسسيةٍ راقية، لِتُثمِرَ عملاً نوعياً يليقُ بأصالة قبيلتنا ويبقى أثره.
            </p>
          </div>
        </div>

        <p className="relative z-10 text-xs text-primary-foreground/60 text-center">© جميع الحقوق محفوظة</p>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-6 animate-fade-up">
          <div className="lg:hidden flex justify-center">
            <Logo size={48} />
          </div>

          <div className="space-y-2 text-center lg:text-right">
            <h2 className="text-3xl font-bold">{mode === "in" ? "تسجيل الدخول" : "طلب انضمام جديد"}</h2>
            <p className="text-muted-foreground text-sm">
              {mode === "in"
                ? "ادخل برقم جوالك وكلمة المرور"
                : "أرسل طلب انضمامك ليتم اعتماده من الإدارة العليا"}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "up" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">الاسم الكامل *</Label>
                  <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="مثال: أحمد بن محمد" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cmt">اللجنة المطلوب الانضمام إليها (اختياري)</Label>
                  <Select value={committeeId} onValueChange={setCommitteeId}>
                    <SelectTrigger id="cmt"><SelectValue placeholder="اختر لجنة" /></SelectTrigger>
                    <SelectContent>
                      {committees.map((c) => {
                        const meta = COMMITTEES.find((m) => m.type === c.type);
                        return <SelectItem key={c.id} value={c.id}>{meta?.label ?? c.name}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">ملاحظات (اختياري)</Label>
                  <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="أي معلومات إضافية تود ذكرها للإدارة" rows={2} />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="phone">رقم الجوال</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xxxxxxxx" required dir="ltr" maxLength={10} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw">كلمة المرور</Label>
              <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} dir="ltr" />
            </div>

            <Button type="submit" disabled={busy} className="w-full bg-gradient-hero text-primary-foreground hover:opacity-90 shadow-elegant h-11 text-base font-semibold">
              {busy && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
              {mode === "in" ? "دخول" : "إرسال طلب الانضمام"}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            {mode === "in" ? "ليس لديك حساب؟" : "لديك حساب؟"}{" "}
            <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="text-primary font-semibold hover:underline">
              {mode === "in" ? "أنشئ طلب انضمام" : "سجّل الدخول"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
