import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2, Phone, Search, Camera, IdCard, Upload, CheckCircle2,
  ArrowRight, ImageIcon, Send, ClipboardList, User as UserIcon,
} from "lucide-react";

export const Route = createFileRoute("/groom-edit")({
  component: GroomEditPage,
  head: () => ({
    meta: [
      { title: "تعديل بيانات العريس — لجنة الزواج الجماعي" },
      {
        name: "description",
        content: "حدّث صورك أو أضف طلباً جديداً لطلب التسجيل في برنامج الزواج الجماعي.",
      },
    ],
  }),
});

const REQUEST_TYPES = [
  { value: "extra_sheep", label: "زيادة في عدد الذبائح" },
  { value: "transfer", label: "تنازل لعريس آخر" },
  { value: "decline_extra", label: "اعتذار عن الزيادة" },
  { value: "none", label: "لا يوجد طلبات" },
];

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

async function uploadPublic(file: File, prefix: string): Promise<string | null> {
  const { safeStorageKey } = await import("@/lib/uploads");
  const path = safeStorageKey(file.name, prefix);
  const { error } = await supabase.storage.from("groom-public").upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) {
    console.error(error);
    toast.error("تعذّر رفع الملف");
    return null;
  }
  const { data } = supabase.storage.from("groom-public").getPublicUrl(path);
  return data.publicUrl;
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
  const [saving, setSaving] = useState(false);

  // form state for the editable fields
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [requestType, setRequestType] = useState<string>("none");
  const [requestDetails, setRequestDetails] = useState<string>("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = normalizePhone(phone);
    if (!p || p.length < 9) {
      toast.error("رجاءً أدخل رقم جوال صحيح");
      return;
    }
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from("grooms")
        .select("id, full_name, phone, family_branch, photo_url, national_id_url, request_type, request_details, status, created_at")
        .eq("phone", p)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("لم يُعثر على طلب بهذا الرقم", {
          description: "تأكد من الرقم أو سجّل طلباً جديداً أولاً.",
        });
        setGroom(null);
        return;
      }
      setGroom(data as Groom);
      setRequestType((data as Groom).request_type ?? "none");
      setRequestDetails((data as Groom).request_details ?? "");
      toast.success("تم العثور على طلبك");
    } catch (err: any) {
      toast.error("تعذّر البحث", { description: err.message });
    } finally {
      setSearching(false);
    }
  };

  const handleSave = async () => {
    if (!groom) return;
    setSaving(true);
    try {
      const updates: {
        photo_url?: string;
        national_id_url?: string;
        request_type?: string;
        request_details?: string | null;
      } = {};
      if (photoFile) {
        const url = await uploadPublic(photoFile, "photo");
        if (url) updates.photo_url = url;
      }
      if (idFile) {
        const url = await uploadPublic(idFile, "id");
        if (url) updates.national_id_url = url;
      }
      if (requestType !== (groom.request_type ?? "none")) updates.request_type = requestType;
      if (requestDetails !== (groom.request_details ?? "")) updates.request_details = requestDetails || null;

      if (Object.keys(updates).length === 0) {
        toast.info("لم تُجرِ أي تغييرات للحفظ");
        return;
      }

      const { error } = await supabase
        .from("grooms")
        .update(updates)
        .eq("id", groom.id);
      if (error) throw error;

      toast.success("تم حفظ التعديلات بنجاح", {
        description: "ستراجعها اللجنة قريباً وتتواصل معك.",
      });

      // refresh
      setGroom({
        ...groom,
        ...(updates.photo_url !== undefined ? { photo_url: updates.photo_url } : {}),
        ...(updates.national_id_url !== undefined ? { national_id_url: updates.national_id_url } : {}),
        ...(updates.request_type !== undefined ? { request_type: updates.request_type } : {}),
        ...(updates.request_details !== undefined ? { request_details: updates.request_details } : {}),
      });
      setPhotoFile(null);
      setIdFile(null);
    } catch (err: any) {
      toast.error("تعذّر الحفظ", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Logo size="sm" />
          <Link to="/" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
            <ArrowRight className="h-3.5 w-3.5" />
            الرئيسية
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Hero */}
        <section className="rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-soft">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Camera className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold">تعديل بيانات طلب العريس</h1>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                يمكنك تحديث صورك الشخصية وصورة الهوية أو إضافة طلب جديد بعد إرسال
                بياناتك. أدخل رقم جوالك المسجَّل للوصول إلى طلبك.
              </p>
            </div>
          </div>
        </section>

        {/* Search by phone */}
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
                <p className="text-[11px] text-muted-foreground">
                  استخدم نفس الرقم الذي سجّلت به طلبك أوّل مرة.
                </p>
              </div>
              <Button type="submit" disabled={searching} size="lg" className="w-full gap-2">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {searching ? "جارٍ البحث..." : "البحث عن طلبي"}
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

        {/* Edit form */}
        {groom && (
          <>
            {/* Summary card */}
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
            </section>

            {/* Photo */}
            <PhotoEditor
              label="الصورة الشخصية"
              icon={<Camera className="h-4 w-4 text-primary" />}
              currentUrl={groom.photo_url}
              file={photoFile}
              onFile={setPhotoFile}
              hint="صورة شخصية حديثة وواضحة (JPG / PNG)"
            />

            {/* National ID */}
            <PhotoEditor
              label="صورة الهوية"
              icon={<IdCard className="h-4 w-4 text-primary" />}
              currentUrl={groom.national_id_url}
              file={idFile}
              onFile={setIdFile}
              hint="صورة واضحة من الهوية الوطنية"
            />

            {/* Request */}
            <section className="rounded-2xl border bg-card p-5 shadow-soft space-y-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                <h2 className="font-bold">طلب جديد للجنة</h2>
              </div>
              <div className="space-y-2">
                <Label>نوع الطلب</Label>
                <Select value={requestType} onValueChange={setRequestType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REQUEST_TYPES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {requestType !== "none" && (
                <div className="space-y-2">
                  <Label>تفاصيل الطلب</Label>
                  <Textarea
                    rows={3}
                    value={requestDetails}
                    onChange={(e) => setRequestDetails(e.target.value)}
                    placeholder="اكتب تفاصيل طلبك بوضوح حتى تتمكن اللجنة من دراسته..."
                  />
                </div>
              )}
            </section>

            <Button
              onClick={handleSave}
              disabled={saving}
              size="lg"
              className="w-full gap-2 bg-gradient-hero text-primary-foreground"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}
            </Button>
          </>
        )}
      </main>
    </div>
  );
}

interface PhotoEditorProps {
  label: string;
  icon: React.ReactNode;
  currentUrl: string | null;
  file: File | null;
  onFile: (f: File | null) => void;
  hint: string;
}

function PhotoEditor({ label, icon, currentUrl, file, onFile, hint }: PhotoEditorProps) {
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    if (f) {
      setPreview(URL.createObjectURL(f));
      onFile(f);
    } else {
      setPreview(null);
      onFile(null);
    }
  };

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-soft space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="font-bold">{label}</h2>
        </div>
        {currentUrl && !file && (
          <span className="text-[11px] inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="h-3 w-3" />
            مرفوعة سابقاً
          </span>
        )}
      </div>

      {/* current vs new */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">الحالية</p>
          <div className="aspect-square rounded-xl border-2 border-dashed bg-muted/30 overflow-hidden flex items-center justify-center">
            {currentUrl ? (
              <img src={currentUrl} alt={label} className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">الجديدة</p>
          <div className="aspect-square rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 overflow-hidden flex items-center justify-center">
            {preview ? (
              <img src={preview} alt="جديدة" className="w-full h-full object-cover" />
            ) : (
              <Upload className="h-8 w-8 text-primary/40" />
            )}
          </div>
        </div>
      </div>

      <div>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          id={`file-${label}`}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <label
          htmlFor={`file-${label}`}
          className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg border bg-card hover:bg-muted/40 cursor-pointer text-sm font-medium transition"
        >
          <Upload className="h-4 w-4" />
          {file ? "تغيير الصورة المختارة" : currentUrl ? "استبدال الصورة الحالية" : "اختر صورة"}
        </label>
        {file && (
          <button
            type="button"
            onClick={() => handleFile(null)}
            className="mt-2 w-full text-xs text-muted-foreground hover:text-destructive"
          >
            إلغاء التحديد
          </button>
        )}
        <p className="text-[11px] text-muted-foreground mt-2">{hint}</p>
      </div>
    </section>
  );
}