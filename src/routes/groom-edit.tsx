import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { lookupGroomByPhone } from "@/lib/grooms-public.functions";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2, Phone, Search, Camera, IdCard, CheckCircle2,
  ArrowRight, ImageIcon, ClipboardList, User as UserIcon, Info,
} from "lucide-react";

export const Route = createFileRoute("/groom-edit")({
  component: GroomEditPage,
  head: () => ({
    meta: [
      { title: "متابعة طلب العريس — لجنة الزواج الجماعي" },
      {
        name: "description",
        content: "ابحث عن حالة طلبك المسجَّل في برنامج الزواج الجماعي.",
      },
    ],
  }),
});

const REQUEST_TYPE_LABELS: Record<string, string> = {
  extra_sheep: "زيادة في عدد الذبائح",
  transfer: "تنازل لعريس آخر",
  decline_extra: "اعتذار عن الزيادة",
  none: "لا يوجد طلبات",
};

interface Groom {
  id: string;
  full_name: string;
  phone: string;
  family_branch: string;
  photo_url: string | null;
  national_id_url: string | null;
  request_type: string | null;
  request_details: string | null;
  status: string;
  created_at: string;
}

function normalizePhone(p: string) {
  const trimmed = p.replace(/[\s\-()]/g, "").trim();
  if (trimmed.startsWith("00966")) return "0" + trimmed.slice(5);
  if (trimmed.startsWith("+966")) return "0" + trimmed.slice(4);
  if (trimmed.startsWith("966") && trimmed.length === 12) return "0" + trimmed.slice(3);
  return trimmed;
}

function GroomEditPage() {
  const [phone, setPhone] = useState("");
  const [searching, setSearching] = useState(false);
  const [groom, setGroom] = useState<Groom | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = normalizePhone(phone);
    if (!p || p.length < 9) {
      toast.error("رجاءً أدخل رقم جوال صحيح");
      return;
    }
    setSearching(true);
    try {
      const { groom: row } = await lookupGroomByPhone({ data: { phone: p } });
      if (!row) {
        toast.error("لم يُعثر على طلب بهذا الرقم", {
          description: "تأكد من الرقم أو سجّل طلباً جديداً أولاً.",
        });
        setGroom(null);
        return;
      }
      setGroom(row as Groom);
      toast.success("تم العثور على طلبك");
    } catch (err: any) {
      toast.error("تعذّر البحث", { description: err.message });
    } finally {
      setSearching(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Logo size={32} />
          <Link to="/" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
            <ArrowRight className="h-3.5 w-3.5" />
            الرئيسية
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <section className="rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-soft">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Search className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold">متابعة طلب العريس</h1>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                أدخل رقم جوالك المسجَّل لعرض حالة طلبك. لتعديل البيانات أو إضافة
                طلب جديد، استخدم الرابط الشخصي الذي وصلك عند التسجيل.
              </p>
            </div>
          </div>
        </section>

        {!groom && (
          <section className="rounded-2xl border bg-card p-6 shadow-soft">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-1.5">
                  <Phone className="h-4 w-4 text-primary" />
                  رقم الجوال المسجَّل
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  placeholder="05xxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="text-right text-lg h-12"
                  autoComplete="tel"
                />
              </div>
              <Button type="submit" disabled={searching} size="lg" className="w-full gap-2">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {searching ? "جارٍ البحث..." : "عرض حالة طلبي"}
              </Button>
            </form>

            <div className="mt-4 pt-4 border-t text-center">
              <p className="text-xs text-muted-foreground">
                لم تسجّل بعد؟{" "}
                <Link to="/register-groom" className="text-primary font-medium hover:underline">
                  سجّل طلبك من هنا
                </Link>
              </p>
            </div>
          </section>
        )}

        {groom && (
          <>
            <section className="rounded-2xl border bg-card p-5 shadow-soft">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <UserIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold">{groom.full_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {groom.family_branch} · {groom.phone}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setGroom(null); setPhone(""); }}>
                  بحث آخر
                </Button>
              </div>
              <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 px-2 py-1 rounded-full">
                <CheckCircle2 className="h-3 w-3" />
                الحالة: {groom.status}
              </div>
            </section>

            <section className="rounded-2xl border bg-amber-50 border-amber-200 p-5 shadow-soft">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900 leading-relaxed">
                  لتعديل الصور أو إضافة طلب جديد، استخدم رابطك الشخصي الذي وصلك
                  عند التسجيل. إذا فقدت الرابط، تواصل مع اللجنة لإعادة إرساله.
                </div>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <ReadOnlyImage label="الصورة الشخصية" icon={<Camera className="h-4 w-4 text-primary" />} url={groom.photo_url} />
              <ReadOnlyImage label="صورة الهوية" icon={<IdCard className="h-4 w-4 text-primary" />} url={groom.national_id_url} />
            </div>

            <section className="rounded-2xl border bg-card p-5 shadow-soft space-y-2">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                <h2 className="font-bold">الطلب الحالي</h2>
              </div>
              <p className="text-sm">
                <span className="text-muted-foreground">نوع الطلب: </span>
                <span className="font-medium">
                  {REQUEST_TYPE_LABELS[groom.request_type ?? "none"] ?? groom.request_type ?? "—"}
                </span>
              </p>
              {groom.request_details && (
                <p className="text-sm whitespace-pre-wrap">
                  <span className="text-muted-foreground">التفاصيل: </span>
                  {groom.request_details}
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function ReadOnlyImage({ label, icon, url }: { label: string; icon: React.ReactNode; url: string | null }) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-soft space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-bold text-sm">{label}</h2>
      </div>
      <div className="aspect-square rounded-xl border-2 border-dashed bg-muted/30 overflow-hidden flex items-center justify-center">
        {url ? (
          <img src={url} alt={label} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
        )}
      </div>
    </section>
  );
}