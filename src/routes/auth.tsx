import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { COMMITTEES } from "@/lib/committees";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, HeartHandshake, Building2, BookOpen, HandHeart } from "lucide-react";

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
  const [agreed, setAgreed] = useState(true);

  useEffect(() => {
    if (user && !loading) {
      if (hasRole("admin")) nav({ to: "/admin" });
      else if (hasRole("quality")) nav({ to: "/reports" });
      else nav({ to: "/admin/tasks" });
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
    if (!agreed) {
      toast.error("يجب الموافقة على سياسة الخصوصية أولاً");
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
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="mx-auto w-full max-w-md min-h-screen bg-transparent px-5 pt-8 pb-10 flex flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">أهلاً وسهلاً</p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5">مرحباً بك</h1>
          </div>
          <Logo size={40} withText={false} />
        </header>

        <section className="rounded-2xl bg-white shadow-sm border border-slate-100 p-5 sm:p-6 animate-fade-up">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">
              {mode === "in" ? "سجّل دخولك" : "طلب انضمام جديد"}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {mode === "in"
                ? "ادخل برقم جوالك وكلمة المرور للمتابعة"
                : "أرسل طلب انضمامك ليتم اعتماده من الإدارة العليا"}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "up" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-slate-700 text-xs">الاسم الكامل *</Label>
                  <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="مثال: أحمد بن محمد" required className="h-11 rounded-xl bg-slate-50 border-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cmt" className="text-slate-700 text-xs">اللجنة (اختياري)</Label>
                  <Select value={committeeId} onValueChange={setCommitteeId}>
                    <SelectTrigger id="cmt" className="h-11 rounded-xl bg-slate-50 border-slate-200"><SelectValue placeholder="اختر لجنة" /></SelectTrigger>
                    <SelectContent>
                      {committees.map((c) => {
                        const meta = COMMITTEES.find((m) => m.type === c.type);
                        return <SelectItem key={c.id} value={c.id}>{meta?.label ?? c.name}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes" className="text-slate-700 text-xs">ملاحظات (اختياري)</Label>
                  <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="أي معلومات إضافية" rows={2} className="rounded-xl bg-slate-50 border-slate-200" />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-slate-700 text-xs">رقم الجوال</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xxxxxxxx" required dir="ltr" maxLength={10} className="h-11 rounded-xl bg-slate-50 border-slate-200 text-right" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw" className="text-slate-700 text-xs">كلمة المرور</Label>
              <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} dir="ltr" className="h-11 rounded-xl bg-slate-50 border-slate-200 text-right" />
            </div>

            <label className="flex items-start gap-2 pt-1 cursor-pointer">
              <Checkbox
                id="agree"
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                className="mt-0.5 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
              />
              <span className="text-[11.5px] leading-relaxed text-slate-600">
                بمواصلتي، أوافق على <span className="text-emerald-700 font-semibold">سياسة الخصوصية</span> لمنصة الزواج الجماعي
              </span>
            </label>

            <Button
              type="submit"
              disabled={busy}
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold shadow-sm transition-all active:scale-[0.98]"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
              {mode === "in" ? "سجّل دخولك" : "إرسال طلب الانضمام"}
            </Button>
          </form>

          <div className="text-center text-xs text-slate-500 mt-4">
            {mode === "in" ? "ليس لديك حساب؟" : "لديك حساب؟"}{" "}
            <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="text-emerald-700 font-semibold hover:underline">
              {mode === "in" ? "أنشئ طلب انضمام" : "سجّل الدخول"}
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-base font-bold text-slate-900 text-right">خدماتنا</h3>
          <div className="grid grid-cols-2 gap-3">
            <ServiceCard to="/register-groom" icon={HeartHandshake} title="تسجيل عريس" tone="bg-rose-50 text-rose-600" />
            <ServiceCard to="/committees" icon={Building2} title="اللجان" tone="bg-emerald-50 text-emerald-600" />
            <ServiceCard to="/" icon={BookOpen} title="عن البرنامج" tone="bg-amber-50 text-amber-600" />
            <ServiceCard to="/" icon={HandHeart} title="ساهِم معنا" tone="bg-sky-50 text-sky-600" />
          </div>
        </section>

        <p className="text-[11px] text-slate-400 text-center mt-auto pt-4">
          © جميع الحقوق محفوظة — لجنة الزواج الجماعي
        </p>
      </div>
    </div>
  );
}

function ServiceCard({
  to,
  icon: Icon,
  title,
  tone,
}: {
  to: string;
  icon: typeof HeartHandshake;
  title: string;
  tone: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-2xl bg-white border border-slate-100 p-4 flex flex-col items-center justify-center gap-2 hover:shadow-sm transition-all active:scale-[0.98]"
    >
      <div className={`h-11 w-11 rounded-full flex items-center justify-center ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-xs font-semibold text-slate-800">{title}</span>
    </Link>
  );
}
