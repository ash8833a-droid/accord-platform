import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Loader2, Camera, IdCard, Upload, CheckCircle2, ArrowRight,
  ImageIcon, Send, ClipboardList, User as UserIcon, ShieldCheck, AlertCircle,
} from "lucide-react";

export const Route = createFileRoute("/groom-edit/$token")({
  component: GroomEditByTokenPage,
  head: () => ({
    meta: [
      { title: "تعديل بياناتي — لجنة الزواج الجماعي" },
      { name: "robots", content: "noindex, nofollow" },
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
  national_id: string | null;
  family_branch: string;
  photo_url: string | null;
  national_id_url: string | null;
  request_type: string | null;
  request_details: string | null;
  status: string;
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

function GroomEditByTokenPage() {
  const { token } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [groom, setGroom] = useState<Groom | null>(null);
  const [saving, setSaving] = useState(false);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [requestType, setRequestType] = useState<string>("none");
  const [requestDetails, setRequestDetails] = useState<string>("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("grooms")
        .select("id, full_name, phone, national_id, family_branch, photo_url, national_id_url, request_type, request_details, status")
        .eq("edit_token", token)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setNotFound(true);
      } else {
        setGroom(data as Groom);
        setRequestType((data as Groom).request_type ?? "none");
        setRequestDetails((data as Groom).request_details ?? "");
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleSave = async () => {
    if (!groom) return;
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {};
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
        setSaving(false);
        return;
      }

      const { error } = await supabase.from("grooms").update(updates).eq("id", groom.id);
      if (error) throw error;
      toast.success("تم حفظ التعديلات بنجاح");
      setGroom({ ...groom, ...updates } as Groom);
      setPhotoFile(null);
      setIdFile(null);
      if (photoPreview) { URL.revokeObjectURL(photoPreview); setPhotoPreview(null); }
      if (idPreview) { URL.revokeObjectURL(idPreview); setIdPreview(null); }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "تعذّر الحفظ";
      toast.error("تعذّر الحفظ", { description: msg });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !groom) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-4 rounded-2xl border bg-card p-8 shadow-soft">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">الرابط غير صالح</h1>
          <p className="text-sm text-muted-foreground">
            هذا الرابط منتهي أو غير صحيح. تواصل مع اللجنة أو سجّل من جديد.
          </p>
          <Link to="/" className="inline-block text-sm text-primary hover:underline">العودة للرئيسية</Link>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Logo size={32} />
          <Link to="/" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
            <ArrowRight className="h-3.5 w-3.5" /> الرئيسية
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <section className="rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-soft">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold">تعديل بياناتي — رابط خاص</h1>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                هذه الصفحة مخصّصة لك حصراً. يمكنك تحديث صورك أو إضافة طلب جديد للجنة دون إعادة التسجيل.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <UserIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold">{groom.full_name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{groom.family_branch} · {groom.phone}</p>
            </div>
          </div>
        </section>

        <PhotoEditor
          label="الصورة الشخصية"
          icon={<Camera className="h-4 w-4 text-primary" />}
          currentUrl={groom.photo_url}
          file={photoFile}
          preview={photoPreview}
          onFile={(f) => {
            if (photoPreview) URL.revokeObjectURL(photoPreview);
            setPhotoPreview(f ? URL.createObjectURL(f) : null);
            setPhotoFile(f);
          }}
          hint="صورة شخصية حديثة وواضحة (JPG / PNG / WebP)"
        />

        <PhotoEditor
          label="صورة الهوية"
          icon={<IdCard className="h-4 w-4 text-primary" />}
          currentUrl={groom.national_id_url}
          file={idFile}
          preview={idPreview}
          onFile={(f) => {
            if (idPreview) URL.revokeObjectURL(idPreview);
            setIdPreview(f ? URL.createObjectURL(f) : null);
            setIdFile(f);
          }}
          hint="صورة واضحة من الهوية الوطنية"
        />

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
                placeholder="اكتب تفاصيل طلبك بوضوح..."
              />
            </div>
          )}
        </section>

        <Button onClick={handleSave} disabled={saving} size="lg" className="w-full gap-2 bg-gradient-hero text-primary-foreground">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}
        </Button>
      </main>
    </div>
  );
}

function PhotoEditor({
  label, icon, currentUrl, file, preview, onFile, hint,
}: {
  label: string;
  icon: React.ReactNode;
  currentUrl: string | null;
  file: File | null;
  preview: string | null;
  onFile: (f: File | null) => void;
  hint: string;
}) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-soft space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="font-bold">{label}</h2>
        </div>
        {currentUrl && !file && (
          <span className="text-[11px] inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="h-3 w-3" /> مرفوعة سابقاً
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">الحالية</p>
          <div className="aspect-square rounded-xl border-2 border-dashed bg-muted/30 overflow-hidden flex items-center justify-center">
            {currentUrl ? <img src={currentUrl} alt={label} className="w-full h-full object-cover" /> : <ImageIcon className="h-8 w-8 text-muted-foreground/40" />}
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">الجديدة</p>
          <div className="aspect-square rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 overflow-hidden flex items-center justify-center">
            {preview ? <img src={preview} alt="جديدة" className="w-full h-full object-cover" /> : <Upload className="h-8 w-8 text-primary/40" />}
          </div>
        </div>
      </div>
      <div>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          id={`file-${label}`}
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        <label htmlFor={`file-${label}`} className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg border bg-card hover:bg-muted/40 cursor-pointer text-sm font-medium transition">
          <Upload className="h-4 w-4" />
          {file ? "تغيير الصورة المختارة" : currentUrl ? "استبدال الصورة الحالية" : "اختر صورة"}
        </label>
        {file && (
          <button type="button" onClick={() => onFile(null)} className="mt-2 w-full text-xs text-muted-foreground hover:text-destructive">
            إلغاء التحديد
          </button>
        )}
        <p className="text-[11px] text-muted-foreground mt-2">{hint}</p>
      </div>
    </section>
  );
}

// suppress unused Input import warning when file is included
void Input;