import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FAMILY_BRANCHES } from "@/lib/family-branches";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Upload, Heart } from "lucide-react";

export const Route = createFileRoute("/register-groom")({
  component: RegisterGroomPage,
  head: () => ({
    meta: [
      { title: "تسجيل عريس جديد — لجنة الزواج الجماعي" },
      { name: "description", content: "نموذج تسجيل العرسان للانضمام لبرنامج الزواج الجماعي" },
      { property: "og:title", content: "تسجيل عريس جديد" },
      { property: "og:description", content: "سجّل بياناتك للانضمام لبرنامج الزواج الجماعي" },
    ],
  }),
});

const isValidSaPhone = (p: string) => /^05\d{8}$/.test(p.trim());

async function uploadPublic(file: File, prefix: string): Promise<string | null> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("groom-public").upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) {
    console.error(error);
    return null;
  }
  const { data } = supabase.storage.from("groom-public").getPublicUrl(path);
  return data.publicUrl;
}

function RegisterGroomPage() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [familyBranch, setFamilyBranch] = useState("");
  const [brideName, setBrideName] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [specialRequests, setSpecialRequests] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return toast.error("الرجاء إدخال اسم العريس");
    if (!isValidSaPhone(phone)) {
      return toast.error("رقم الجوال غير صحيح", {
        description: "يجب أن يبدأ بـ 05 ويتكون من 10 أرقام",
      });
    }
    if (!familyBranch) return toast.error("الرجاء اختيار فرع العائلة");

    setBusy(true);
    try {
      let national_id_url: string | null = null;
      let photo_url: string | null = null;

      if (idFile) {
        if (idFile.size > 5 * 1024 * 1024) throw new Error("حجم صورة الهوية يجب أن يكون أقل من 5 ميغابايت");
        national_id_url = await uploadPublic(idFile, "id");
      }
      if (photoFile) {
        if (photoFile.size > 5 * 1024 * 1024) throw new Error("حجم الصورة الشخصية يجب أن يكون أقل من 5 ميغابايت");
        photo_url = await uploadPublic(photoFile, "photo");
      }

      const { error } = await supabase.from("grooms").insert({
        full_name: fullName.trim(),
        phone: phone.trim(),
        family_branch: familyBranch,
        bride_name: brideName.trim() || null,
        wedding_date: weddingDate || null,
        national_id: nationalId.trim() || null,
        national_id_url,
        photo_url,
        special_requests: specialRequests.trim() || null,
        status: "new",
        created_by: null,
      });
      if (error) throw error;
      setDone(true);
      toast.success("تم استلام طلبك بنجاح", {
        description: "ستتواصل معك اللجنة قريباً للمتابعة",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "تعذّر إرسال الطلب";
      toast.error("خطأ", { description: msg });
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-gold/5 p-6" dir="rtl">
        <div className="max-w-md w-full text-center bg-card rounded-3xl shadow-elegant border p-8 space-y-5 animate-fade-up">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center">
            <CheckCircle2 className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">تم استلام طلبك</h1>
          <p className="text-muted-foreground leading-relaxed">
            بارك الله لك وبارك عليك وجمع بينكما في خير. ستراجع اللجنة بياناتك وتتواصل معك قريباً عبر رقم جوالك.
          </p>
          <Button
            onClick={() => {
              setDone(false);
              setFullName(""); setPhone(""); setFamilyBranch(""); setBrideName("");
              setWeddingDate(""); setNationalId(""); setIdFile(null); setPhotoFile(null);
              setSpecialRequests("");
            }}
            variant="outline"
            className="w-full"
          >
            تسجيل عريس آخر
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-gold/5 py-8 px-4" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
        <header className="text-center space-y-3">
          <div className="flex justify-center"><Logo size={56} /></div>
          <h1 className="text-3xl font-black">
            <span className="text-shimmer-gold">تسجيل عريس جديد</span>
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            عبّئ النموذج التالي للانضمام لبرنامج الزواج الجماعي. ستراجع اللجنة طلبك وتتواصل معك.
          </p>
        </header>

        <form onSubmit={submit} className="bg-card rounded-3xl shadow-elegant border p-6 md:p-8 space-y-5">
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <Heart className="h-4 w-4" /> البيانات الأساسية
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">اسم العريس الكامل *</Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="مثال: أحمد بن محمد" required />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">رقم الجوال *</Label>
                <Input id="phone" type="tel" dir="ltr" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xxxxxxxx" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch">فرع العائلة *</Label>
                <Select value={familyBranch} onValueChange={setFamilyBranch}>
                  <SelectTrigger id="branch"><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                  <SelectContent>
                    {FAMILY_BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bride">اسم العروس (اختياري)</Label>
                <Input id="bride" value={brideName} onChange={(e) => setBrideName(e.target.value)} placeholder="اسم العروس" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">تاريخ الزواج المتوقع (اختياري)</Label>
                <Input id="date" type="date" value={weddingDate} onChange={(e) => setWeddingDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nid">رقم الهوية الوطنية (اختياري)</Label>
              <Input id="nid" dir="ltr" maxLength={10} value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="10 أرقام" />
            </div>
          </section>

          <section className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <Upload className="h-4 w-4" /> المرفقات (اختياري)
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="idfile">صورة الهوية الوطنية</Label>
                <Input id="idfile" type="file" accept="image/*,application/pdf" onChange={(e) => setIdFile(e.target.files?.[0] ?? null)} />
                {idFile && <p className="text-xs text-muted-foreground truncate">{idFile.name}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="photofile">الصورة الشخصية للعريس</Label>
                <Input id="photofile" type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
                {photoFile && <p className="text-xs text-muted-foreground truncate">{photoFile.name}</p>}
              </div>
            </div>
          </section>

          <section className="space-y-2 pt-4 border-t">
            <Label htmlFor="req">ملاحظات وطلبات خاصة (اختياري)</Label>
            <Textarea id="req" value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} placeholder="مثال: زيادة ذبائح، ضيوف خاصون، طلبات إضافية..." rows={4} />
          </section>

          <Button type="submit" disabled={busy} className="w-full bg-gradient-hero text-primary-foreground hover:opacity-90 shadow-elegant h-12 text-base font-semibold">
            {busy && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
            إرسال الطلب
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            بإرسالك للنموذج فإنك توافق على مراجعة بياناتك من قِبَل اللجنة المختصة.
          </p>
        </form>

        <div className="text-center">
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary transition">
            العودة للصفحة الرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}