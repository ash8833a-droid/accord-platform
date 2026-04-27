import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Upload, User, Phone, IdCard, Camera, FileImage, StickyNote, ClipboardList, Globe2, Crown, Eye, Pencil, Send } from "lucide-react";

export const Route = createFileRoute("/register-groom")({
  component: RegisterGroomPage,
  head: ({ match }) => {
    const canonicalUrl = "https://lajnat-zawaj.org/register-groom";
    const ogUrl = "https://lajnat-zawaj.org/og-register-groom.jpg";
    void match;
    return {
      meta: [
        { title: "تسجيل العرسان — لجنة الزواج الجماعي" },
        {
          name: "description",
          content:
            "بكل فخرٍ ندعوك لتسجيل بياناتك والانضمام إلى ركب العرسان في برنامج الزواج الجماعي — خطوة ميسّرة نحو بداية مباركة.",
        },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonicalUrl },
        { property: "og:site_name", content: "لجنة الزواج الجماعي" },
        { property: "og:title", content: "دعوة لتسجيل بيانات العريس" },
        {
          property: "og:description",
          content:
            "بارك الله لك… أكمل تسجيل بياناتك للانضمام لبرنامج الزواج الجماعي بخطوات بسيطة وآمنة.",
        },
        { property: "og:image", content: ogUrl },
        { property: "og:image:secure_url", content: ogUrl },
        { property: "og:image:type", content: "image/jpeg" },
        { property: "og:image:width", content: "640" },
        { property: "og:image:height", content: "640" },
        { property: "og:image:alt", content: "شعار لجنة الزواج الجماعي" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "دعوة لتسجيل بيانات العريس" },
        {
          name: "twitter:description",
          content:
            "بارك الله لك… أكمل تسجيل بياناتك للانضمام لبرنامج الزواج الجماعي بخطوات بسيطة وآمنة.",
        },
        { name: "twitter:image", content: ogUrl },
      ],
      links: [{ rel: "canonical", href: canonicalUrl }],
    };
  },
});

const isValidSaPhone = (p: string) => /^05\d{8}$/.test(p.trim());
const isQuadName = (n: string) => n.trim().split(/\s+/).filter(Boolean).length >= 4;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_EXT = /\.(jpe?g|png|webp)$/i;
const formatBytes = (b: number) => `${(b / (1024 * 1024)).toFixed(2)} م.ب`;

/** الحدود المعتمدة من اللجنة. */
const MAX_EXTRA_SHEEP = 2;
const BASE_CARDS_MEN = 50;
const BASE_CARDS_WOMEN = 30;

async function uploadPublic(file: File, prefix: string): Promise<string | null> {
  const { safeStorageKey } = await import("@/lib/uploads");
  const path = safeStorageKey(file.name, prefix);
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
      toast.error("نوع الملف غير مدعوم", { description: "الصور فقط: JPG أو PNG أو WebP" });
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
  const [nationalId, setNationalId] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [extraSheep, setExtraSheep] = useState("");
  const [extraCardsMen, setExtraCardsMen] = useState("");
  const [extraCardsWomen, setExtraCardsWomen] = useState("");
  // Explicit yes/no acknowledgement for optional sections
  const [extraChoice, setExtraChoice] = useState<"" | "yes" | "no">("");
  const [externalChoice, setExternalChoice] = useState<"" | "yes" | "no">("");
  const [vipChoice, setVipChoice] = useState<"" | "yes" | "no">("");
  const [notesChoice, setNotesChoice] = useState<"" | "yes" | "no">("");
  const [externalParticipation, setExternalParticipation] = useState(false);
  const [externalDetails, setExternalDetails] = useState("");
  const [vipGuests, setVipGuests] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [idPreviewUrl, setIdPreviewUrl] = useState<string | null>(null);

  const reset = () => {
    setFullName(""); setPhone(""); setNationalId("");
    setIdFile(null); setPhotoFile(null);
    setExtraSheep(""); setExtraCardsMen(""); setExtraCardsWomen("");
    setExtraChoice(""); setExternalChoice(""); setVipChoice(""); setNotesChoice("");
    setExternalParticipation(false); setExternalDetails("");
    setVipGuests(""); setNotes("");
  };

  const validate = (): boolean => {
    if (!isQuadName(fullName)) { toast.error("الاسم يجب أن يكون رباعياً", { description: "الاسم الأول واسم الأب والجد واسم العائلة" }); return false; }
    if (!isValidSaPhone(phone)) { toast.error("رقم الجوال غير صحيح", { description: "يجب أن يبدأ بـ 05 ويتكون من 10 أرقام" }); return false; }
    if (!/^\d{10}$/.test(nationalId.trim())) { toast.error("رقم الهوية يجب أن يكون 10 أرقام"); return false; }
    if (!photoFile) { toast.error("الرجاء رفع الصورة الشخصية للعريس"); return false; }
    if (!idFile) { toast.error("الرجاء رفع صورة الهوية الوطنية"); return false; }

    // Explicit acknowledgements (must choose yes/no)
    if (!extraChoice) { toast.error("حدد: هل ترغب في ذبائح/كروت إضافية؟"); return false; }
    if (extraChoice === "yes") {
      if (!extraSheep && !extraCardsMen && !extraCardsWomen) {
        toast.error("أدخل قيمة في حقل واحد على الأقل من الذبائح أو الكروت الإضافية"); return false;
      }
    }
    if (!externalChoice) { toast.error("حدد: هل توجد مشاركات خارجية (قصائد/شيلات/كلمات)؟"); return false; }
    if (externalChoice === "yes" && !externalDetails.trim()) { toast.error("الرجاء كتابة تفاصيل المشاركات الخارجية"); return false; }
    if (!vipChoice) { toast.error("حدد: هل لديك ضيوف من الشخصيات الاعتبارية؟"); return false; }
    if (vipChoice === "yes" && !vipGuests.trim()) { toast.error("الرجاء كتابة أسماء وألقاب الضيوف"); return false; }
    if (!notesChoice) { toast.error("حدد: هل لديك ملاحظات إضافية؟"); return false; }
    if (notesChoice === "yes" && !notes.trim()) { toast.error("الرجاء كتابة الملاحظات الإضافية"); return false; }

    const sheep = Number(extraSheep) || 0;
    if (sheep < 0 || !Number.isFinite(sheep) || !Number.isInteger(sheep)) {
      toast.error("عدد الذبائح غير صحيح"); return false;
    }
    if (sheep > MAX_EXTRA_SHEEP) {
      toast.error(`الحدّ الأقصى للذبائح الإضافية ${MAX_EXTRA_SHEEP} ذبيحتان فقط`); return false;
    }
    return true;
  };

  const openPreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    // generate object URLs for preview
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    if (idPreviewUrl) URL.revokeObjectURL(idPreviewUrl);
    setPhotoPreviewUrl(photoFile ? URL.createObjectURL(photoFile) : null);
    setIdPreviewUrl(idFile ? URL.createObjectURL(idFile) : null);
    setPreviewOpen(true);
  };

  const submit = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const national_id_url = idFile ? await uploadPublic(idFile, "id") : null;
      const photo_url = photoFile ? await uploadPublic(photoFile, "photo") : null;

      const { error } = await supabase.from("grooms").insert({
        full_name: fullName.trim(),
        phone: phone.trim(),
        family_branch: "غير محدد",
        national_id: nationalId.trim(),
        national_id_url,
        photo_url,
        extra_sheep: Number(extraSheep) || 0,
        extra_cards_men: Number(extraCardsMen) || 0,
        extra_cards_women: Number(extraCardsWomen) || 0,
        external_participation: externalParticipation,
        external_participation_details: externalParticipation ? externalDetails.trim() : null,
        vip_guests: vipGuests.trim() || null,
        notes: notes.trim() || null,
        status: "new",
        created_by: null,
      });
      if (error) throw error;
      setPreviewOpen(false);
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
          <Button onClick={() => { setDone(false); reset(); }} variant="outline" className="w-full">
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

        <form onSubmit={openPreview} className="space-y-5">
          {/* Basic Info */}
          <section className="rounded-3xl border-2 border-primary/20 bg-card/60 backdrop-blur p-5 md:p-7 space-y-5 shadow-elegant">
            <div className="flex items-center gap-2 text-primary font-bold text-lg">
              <User className="h-5 w-5" /> البيانات الأساسية
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2"><User className="h-4 w-4" /> الاسم الرباعي <span className="text-destructive">*</span></Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="الاسم الأول واسم الأب والجد واسم العائلة" required />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="phone" className="flex items-center gap-2"><Phone className="h-4 w-4" /> رقم الجوال <span className="text-destructive">*</span></Label>
                <Input id="phone" type="tel" dir="ltr" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xxxxxxxx" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nid" className="flex items-center gap-2"><IdCard className="h-4 w-4" /> رقم الهوية الوطنية <span className="text-destructive">*</span></Label>
              <Input id="nid" dir="ltr" maxLength={10} value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="10 أرقام" required />
            </div>
          </section>

          {/* Documents */}
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
                hint="صورة واضحة للوجهين — حتى 5 ميغابايت"
                file={idFile}
                onFile={setIdFile}
              />
            </div>
          </section>

          {/* Extras: Sheep & Cards */}
          <section className="rounded-3xl border-2 border-primary/20 bg-card/60 backdrop-blur p-5 md:p-7 space-y-4 shadow-elegant">
            <div className="flex items-center gap-2 text-primary font-bold text-lg">
              <ClipboardList className="h-5 w-5" /> ذبائح وكروت إضافية
            </div>
            <p className="text-xs text-muted-foreground">العدد الإضافي فوق المخصّص الأساسي للعريس.</p>

            {/* بطاقة المخصّص الأساسي */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="text-[11px] font-bold text-primary mb-2">المخصَّصُ الأساسيُّ لكلِّ عريسٍ ابتداءً</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-card border p-2">
                  <div className="text-[10px] text-muted-foreground">ذبيحة</div>
                  <div className="font-extrabold text-lg text-primary">1</div>
                </div>
                <div className="rounded-xl bg-card border p-2">
                  <div className="text-[10px] text-muted-foreground">كروت رجال</div>
                  <div className="font-extrabold text-lg text-primary">{BASE_CARDS_MEN}</div>
                </div>
                <div className="rounded-xl bg-card border p-2">
                  <div className="text-[10px] text-muted-foreground">كروت نساء</div>
                  <div className="font-extrabold text-lg text-primary">{BASE_CARDS_WOMEN}</div>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                ما يُكتَبُ في الحقولِ أدناه هو <span className="font-bold text-foreground">الزيادةُ فقط</span> فوقَ هذا المخصَّص،
                والحدُّ الأقصى للذبائحِ الإضافيةِ <span className="font-bold text-foreground">ذبيحتان</span> ({MAX_EXTRA_SHEEP}) لا تتجاوزُهُما.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sheep">عدد الذبائح الزيادة (بحدٍّ أقصى {MAX_EXTRA_SHEEP})</Label>
                <Input
                  id="sheep"
                  type="number"
                  min={0}
                  max={MAX_EXTRA_SHEEP}
                  step={1}
                  dir="ltr"
                  value={extraSheep}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") return setExtraSheep("");
                    const n = Math.floor(Number(raw));
                    if (!Number.isFinite(n) || n < 0) return;
                    setExtraSheep(String(Math.min(n, MAX_EXTRA_SHEEP)));
                  }}
                  placeholder="0"
                />
                <p className="text-[10px] text-muted-foreground">قيمة كلِّ ذبيحةٍ إضافيةٍ على العريس: 2000 ر.س</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cm">عدد كروت الرجال الإضافية</Label>
                <Input id="cm" type="number" min={0} dir="ltr" value={extraCardsMen} onChange={(e) => setExtraCardsMen(e.target.value)} placeholder="0" />
                <p className="text-[10px] text-muted-foreground">الأساسيُّ {BASE_CARDS_MEN} كرتاً</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cw">عدد كروت النساء الإضافية</Label>
                <Input id="cw" type="number" min={0} dir="ltr" value={extraCardsWomen} onChange={(e) => setExtraCardsWomen(e.target.value)} placeholder="0" />
                <p className="text-[10px] text-muted-foreground">الأساسيُّ {BASE_CARDS_WOMEN} كرتاً</p>
              </div>
            </div>
          </section>

          {/* External participations */}
          <section className="rounded-3xl border-2 border-info/30 bg-info/5 backdrop-blur p-5 md:p-7 space-y-4 shadow-elegant">
            <div className="flex items-center gap-2 text-primary font-bold text-lg">
              <Globe2 className="h-5 w-5" /> مشاركات خارجية
            </div>
            <p className="text-xs text-muted-foreground">
              المقصود بها: <span className="font-semibold text-foreground">القصائد، الشيلات، الكلمات الترحيبية</span> أو ما شابهها مما يُقدَّم للعريس في الحفل.
            </p>

            <label className="flex items-center gap-3 rounded-xl border bg-card/50 p-3 cursor-pointer">
              <Checkbox
                id="ext"
                checked={externalParticipation}
                onCheckedChange={(v) => setExternalParticipation(v === true)}
              />
              <span className="text-sm font-medium">يوجد قصائد / شيلات / كلمات مقدّمة للعريس</span>
            </label>

            {externalParticipation && (
              <div className="space-y-2 animate-fade-up">
                <Label htmlFor="extd">تفاصيل المشاركات الخارجية <span className="text-destructive">*</span></Label>
                <Textarea id="extd" value={externalDetails} onChange={(e) => setExternalDetails(e.target.value)} rows={3} placeholder="اذكر نوع المشاركة، اسم مقدّمها، والمدة المتوقعة..." />
              </div>
            )}
          </section>

          {/* VIP Guests */}
          <section className="rounded-3xl border-2 border-gold/30 bg-gold/5 backdrop-blur p-5 md:p-7 space-y-3 shadow-elegant">
            <div className="flex items-center gap-2 text-primary font-bold text-lg">
              <Crown className="h-5 w-5" /> ضيوف الشخصيات الاعتبارية
            </div>
            <Label htmlFor="vip" className="flex items-center gap-2 text-sm">
              <Crown className="h-4 w-4" /> أسماء وألقاب الضيوف (سعادة، شيخ، معالي، ...)
            </Label>
            <Textarea id="vip" value={vipGuests} onChange={(e) => setVipGuests(e.target.value)} rows={3} placeholder="مثال: سعادة الأستاذ ... — الشيخ ... — معالي الدكتور ..." />
          </section>

          {/* Notes */}
          <section className="rounded-3xl border-2 border-primary/20 bg-card/60 backdrop-blur p-5 md:p-7 space-y-3 shadow-elegant">
            <div className="flex items-center gap-2 text-primary font-bold text-lg">
              <StickyNote className="h-5 w-5" /> ملاحظات إضافية
            </div>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="أي ملاحظات أو طلبات خاصة..." />
          </section>

          <Button type="submit" className="w-full bg-gradient-hero text-primary-foreground hover:opacity-90 shadow-elegant h-12 text-base font-semibold">
            <Eye className="h-4 w-4 ms-2" />
            معاينة الطلب قبل الإرسال
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            ستتمكن من مراجعة بياناتك في الخطوة التالية قبل الإرسال النهائي.
          </p>
        </form>

        <div className="text-center">
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary transition">
            العودة للصفحة الرئيسية
          </Link>
        </div>

        <PreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          busy={busy}
          onConfirm={submit}
          data={{
            fullName, phone, nationalId,
            extraSheep, extraCardsMen, extraCardsWomen,
            externalParticipation, externalDetails,
            vipGuests, notes,
            photoFile, idFile,
            photoPreviewUrl, idPreviewUrl,
          }}
        />
      </div>
    </div>
  );
}

interface PreviewData {
  fullName: string; phone: string; nationalId: string;
  extraSheep: string; extraCardsMen: string; extraCardsWomen: string;
  externalParticipation: boolean; externalDetails: string;
  vipGuests: string; notes: string;
  photoFile: File | null; idFile: File | null;
  photoPreviewUrl: string | null; idPreviewUrl: string | null;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-dashed border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-end break-words">{value || <span className="text-muted-foreground">—</span>}</span>
    </div>
  );
}

function PreviewSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-muted/30 p-4 space-y-1">
      <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-2">
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

function PreviewDialog({
  open, onOpenChange, busy, onConfirm, data,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  busy: boolean;
  onConfirm: () => void;
  data: PreviewData;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Eye className="h-5 w-5 text-primary" /> معاينة الطلب قبل الإرسال
          </DialogTitle>
          <DialogDescription>
            راجع جميع البيانات بدقّة. اضغط «تأكيد وإرسال» لإرسال الطلب نهائياً، أو «تعديل» للرجوع للنموذج.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <PreviewSection icon={<User className="h-4 w-4" />} title="البيانات الأساسية">
            <Row label="الاسم الرباعي" value={data.fullName} />
            <Row label="رقم الجوال" value={<span dir="ltr">{data.phone}</span>} />
            <Row label="رقم الهوية الوطنية" value={<span dir="ltr">{data.nationalId}</span>} />
          </PreviewSection>

          <PreviewSection icon={<FileImage className="h-4 w-4" />} title="المستندات والصور">
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1 text-center">
                <p className="text-xs text-muted-foreground">صورة العريس</p>
                {data.photoPreviewUrl ? (
                  <img src={data.photoPreviewUrl} alt="العريس" className="mx-auto h-32 w-full object-cover rounded-lg border" />
                ) : <p className="text-xs">—</p>}
                <p className="text-[10px] text-muted-foreground truncate">{data.photoFile?.name}</p>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-xs text-muted-foreground">صورة الهوية</p>
                {data.idPreviewUrl ? (
                  <img src={data.idPreviewUrl} alt="الهوية" className="mx-auto h-32 w-full object-cover rounded-lg border" />
                ) : <p className="text-xs">—</p>}
                <p className="text-[10px] text-muted-foreground truncate">{data.idFile?.name}</p>
              </div>
            </div>
          </PreviewSection>

          <PreviewSection icon={<ClipboardList className="h-4 w-4" />} title="ذبائح وكروت إضافية">
            <Row label="ذبائح إضافية" value={data.extraSheep || "0"} />
            <Row label="كروت رجال إضافية" value={data.extraCardsMen || "0"} />
            <Row label="كروت نساء إضافية" value={data.extraCardsWomen || "0"} />
          </PreviewSection>

          <PreviewSection icon={<Globe2 className="h-4 w-4" />} title="مشاركات خارجية">
            <Row label="يوجد مشاركات" value={data.externalParticipation ? "نعم" : "لا"} />
            {data.externalParticipation && <Row label="التفاصيل" value={data.externalDetails} />}
          </PreviewSection>

          <PreviewSection icon={<Crown className="h-4 w-4" />} title="ضيوف الشخصيات الاعتبارية">
            <Row label="الأسماء والألقاب" value={data.vipGuests} />
          </PreviewSection>

          <PreviewSection icon={<StickyNote className="h-4 w-4" />} title="ملاحظات إضافية">
            <Row label="الملاحظات" value={data.notes} />
          </PreviewSection>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)} className="gap-2">
            <Pencil className="h-4 w-4" /> تعديل البيانات
          </Button>
          <Button type="button" disabled={busy} onClick={onConfirm} className="bg-gradient-hero text-primary-foreground gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            تأكيد وإرسال
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
