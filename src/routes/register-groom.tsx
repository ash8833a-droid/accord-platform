import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FAMILY_BRANCHES } from "@/lib/family-branches";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Upload, User, Phone, Calendar, IdCard, Camera, FileImage, StickyNote, Users } from "lucide-react";

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
const isQuadName = (n: string) => n.trim().split(/\s+/).filter(Boolean).length >= 4;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB max per file
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_EXT = /\.(jpe?g|png|webp)$/i;
const formatBytes = (b: number) => `${(b / (1024 * 1024)).toFixed(2)} م.ب`;

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

interface UploadCardProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  hint: string;
  file: File | null;
  onFile: (f: File | null) => void;
}

function UploadCard({ id, label, icon, hint, file, onFile }: UploadCardProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handle = (f: File | null) => {
    if (!f) {
      onFile(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      return;
    }
    const okType = ALLOWED_IMAGE_TYPES.includes(f.type) || ALLOWED_EXT.test(f.name);
    if (!okType) {
      toast.error("نوع الملف غير مدعوم", {
        description: "الصور فقط: JPG أو PNG أو WebP",
      });
      if (ref.current) ref.current.value = "";
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("حجم الملف كبير", {
        description: `الحد الأقصى ${formatBytes(MAX_BYTES)} — حجم ملفك ${formatBytes(f.size)}`,
      });
      if (ref.current) ref.current.value = "";
      return;
    }
    onFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-2 text-sm">
        {icon} {label} <span className="text-destructive">*</span>
      </Label>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="w-full rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition p-6 text-center group"
      >
        {preview ? (
          <img src={preview} alt="معاينة" className="mx-auto max-h-32 rounded-lg object-contain" />
        ) : (
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center group-hover:scale-110 transition">
            <Upload className="h-5 w-5 text-primary" />
          </div>
        )}
        <p className="mt-3 text-sm font-medium">{file ? file.name : "اضغط لاختيار ملف"}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </button>
      <Input
        ref={ref}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0] ?? null)}
      />
    </div>
  );
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
    if (!isQuadName(fullName)) return toast.error("الاسم يجب أن يكون رباعياً", { description: "الاسم الأول واسم الأب والجد واسم العائلة" });
    if (!isValidSaPhone(phone)) return toast.error("رقم الجوال غير صحيح", { description: "يجب أن يبدأ بـ 05 ويتكون من 10 أرقام" });
    if (!familyBranch) return toast.error("الرجاء اختيار فرع العائلة");
    if (!brideName.trim()) return toast.error("الرجاء إدخال اسم العروس");
    if (!weddingDate) return toast.error("الرجاء إدخال تاريخ الزفاف");
    if (!/^\d{10}$/.test(nationalId.trim())) return toast.error("رقم الهوية يجب أن يكون 10 أرقام");
    if (!photoFile) return toast.error("الرجاء رفع الصورة الشخصية للعريس");
    if (!idFile) return toast.error("الرجاء رفع صورة الهوية الوطنية");
    if (!specialRequests.trim()) return toast.error("الرجاء كتابة الملاحظات أو الطلبات الخاصة");

    setBusy(true);
    try {
      if (idFile.size > MAX_BYTES) throw new Error("حجم صورة الهوية يجب أن يكون أقل من 8 ميغابايت");
      if (photoFile.size > MAX_BYTES) throw new Error("حجم الصورة الشخصية يجب أن يكون أقل من 8 ميغابايت");

      const national_id_url = await uploadPublic(idFile, "id");
      const photo_url = await uploadPublic(photoFile, "photo");

      const { error } = await supabase.from("grooms").insert({
        full_name: fullName.trim(),
        phone: phone.trim(),
        family_branch: familyBranch,
        bride_name: brideName.trim(),
        wedding_date: weddingDate,
        national_id: nationalId.trim(),
        national_id_url,
        photo_url,
        special_requests: specialRequests.trim(),
        status: "new",
        created_by: null,
      });
      if (error) throw error;
      setDone(true);
      toast.success("تم استلام طلبك بنجاح", { description: "ستتواصل معك اللجنة قريباً للمتابعة" });
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
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-up">
        <header className="text-center space-y-3">
          <div className="flex justify-center"><Logo size={56} /></div>
          <h1 className="text-3xl md:text-4xl font-black">
            <span className="text-shimmer-gold">تسجيل عريس جديد</span>
          </h1>
          <p className="text-sm text-muted-foreground">الحقول المميزة بـ <span className="text-destructive font-bold">*</span> إلزامية</p>
        </header>

        <form onSubmit={submit} className="space-y-5">
          {/* Section: Basic Info */}
          <section className="rounded-3xl border-2 border-primary/20 bg-card/60 backdrop-blur p-5 md:p-7 space-y-5 shadow-elegant">
            <div className="flex items-center gap-2 text-primary font-bold text-lg">
              <User className="h-5 w-5" /> البيانات الأساسية
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2"><User className="h-4 w-4" /> الاسم الرباعي <span className="text-destructive">*</span></Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="الاسم الأول واسم الأب والجد واسم العائلة" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2"><Phone className="h-4 w-4" /> رقم الجوال <span className="text-destructive">*</span></Label>
                <Input id="phone" type="tel" dir="ltr" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xxxxxxxx" required />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="branch" className="flex items-center gap-2"><Users className="h-4 w-4" /> فرع العائلة <span className="text-destructive">*</span></Label>
                <Select value={familyBranch} onValueChange={setFamilyBranch}>
                  <SelectTrigger id="branch"><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                  <SelectContent>
                    {FAMILY_BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bride">اسم العروس <span className="text-destructive">*</span></Label>
                <Input id="bride" value={brideName} onChange={(e) => setBrideName(e.target.value)} placeholder="اسم العروس" required />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date" className="flex items-center gap-2"><Calendar className="h-4 w-4" /> تاريخ الزفاف <span className="text-destructive">*</span></Label>
                <Input id="date" type="date" value={weddingDate} onChange={(e) => setWeddingDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nid" className="flex items-center gap-2"><IdCard className="h-4 w-4" /> رقم الهوية الوطنية <span className="text-destructive">*</span></Label>
                <Input id="nid" dir="ltr" maxLength={10} value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="10 أرقام" required />
              </div>
            </div>
          </section>

          {/* Section: Documents */}
          <section className="rounded-3xl border-2 border-primary/20 bg-card/60 backdrop-blur p-5 md:p-7 space-y-5 shadow-elegant">
            <div className="flex items-center gap-2 text-primary font-bold text-lg">
              <FileImage className="h-5 w-5" /> المستندات والصور
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <UploadCard
                id="photofile"
                label="صورة شخصية للعريس"
                icon={<Camera className="h-4 w-4" />}
                hint="JPG / PNG / WebP — حتى 5 ميغابايت"
                file={photoFile}
                onFile={setPhotoFile}
              />
              <UploadCard
                id="idfile"
                label="صورة الهوية الوطنية"
                icon={<IdCard className="h-4 w-4" />}
                hint="صورة واضحة — JPG / PNG — حتى 5 ميغابايت"
                file={idFile}
                onFile={setIdFile}
              />
            </div>
          </section>

          {/* Section: Notes */}
          <section className="rounded-3xl border-2 border-primary/20 bg-card/60 backdrop-blur p-5 md:p-7 space-y-3 shadow-elegant">
            <div className="flex items-center gap-2 text-primary font-bold text-lg">
              <StickyNote className="h-5 w-5" /> الملاحظات والطلبات الخاصة
            </div>
            <Label htmlFor="req" className="text-sm">اكتب ملاحظاتك أو طلباتك الخاصة <span className="text-destructive">*</span></Label>
            <Textarea
              id="req"
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder="مثال: زيادة ذبائح، ضيوف خاصون، طلبات إضافية..."
              rows={4}
              required
            />
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
