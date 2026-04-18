import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Upload, Image as ImageIcon, IdCard, Loader2, Save, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  groomId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

interface GroomDetails {
  id: string;
  full_name: string;
  photo_url: string | null;
  national_id_url: string | null;
  extra_sheep: number;
  extra_cards_men: number;
  extra_cards_women: number;
  external_participation: boolean;
  external_participation_details: string | null;
  special_requests: string | null;
}

export function GroomDetailsDialog({ groomId, open, onOpenChange, onSaved }: Props) {
  const [data, setData] = useState<GroomDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [idUploading, setIdUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: g, error } = await supabase
        .from("grooms")
        .select("id, full_name, photo_url, national_id_url, extra_sheep, extra_cards_men, extra_cards_women, external_participation, external_participation_details, special_requests")
        .eq("id", groomId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !g) {
        toast.error("تعذّر تحميل بيانات العريس");
        setLoading(false);
        return;
      }
      setData(g as GroomDetails);
      // Load signed URLs for previews
      const [p, i] = await Promise.all([
        g.photo_url ? supabase.storage.from("groom-docs").createSignedUrl(g.photo_url, 3600) : Promise.resolve({ data: null }),
        g.national_id_url ? supabase.storage.from("groom-docs").createSignedUrl(g.national_id_url, 3600) : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;
      setPhotoPreview((p.data as any)?.signedUrl ?? null);
      setIdPreview((i.data as any)?.signedUrl ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, groomId]);

  const uploadFile = async (file: File, kind: "photo" | "id") => {
    if (!data) return;
    const setUploading = kind === "photo" ? setPhotoUploading : setIdUploading;
    const field = kind === "photo" ? "photo_url" : "national_id_url";
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${data.id}/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("groom-docs").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) {
        toast.error("فشل رفع الملف", { description: upErr.message });
        return;
      }
      // Delete old file if exists
      const oldPath = data[field];
      if (oldPath) await supabase.storage.from("groom-docs").remove([oldPath]);

      const { error: updErr } = await supabase.from("grooms").update({ [field]: path }).eq("id", data.id);
      if (updErr) {
        toast.error("تعذّر حفظ الرابط", { description: updErr.message });
        return;
      }
      const { data: signed } = await supabase.storage.from("groom-docs").createSignedUrl(path, 3600);
      setData({ ...data, [field]: path } as GroomDetails);
      if (kind === "photo") setPhotoPreview(signed?.signedUrl ?? null);
      else setIdPreview(signed?.signedUrl ?? null);
      toast.success(kind === "photo" ? "تم رفع الصورة الشخصية" : "تم رفع الهوية الوطنية");
    } finally {
      setUploading(false);
    }
  };

  const removeFile = async (kind: "photo" | "id") => {
    if (!data) return;
    const field = kind === "photo" ? "photo_url" : "national_id_url";
    const path = data[field];
    if (!path) return;
    await supabase.storage.from("groom-docs").remove([path]);
    await supabase.from("grooms").update({ [field]: null }).eq("id", data.id);
    setData({ ...data, [field]: null } as GroomDetails);
    if (kind === "photo") setPhotoPreview(null); else setIdPreview(null);
    toast.success("تم حذف الملف");
  };

  const save = async () => {
    if (!data) return;
    setSaving(true);
    const { error } = await supabase
      .from("grooms")
      .update({
        extra_sheep: Number(data.extra_sheep) || 0,
        extra_cards_men: Number(data.extra_cards_men) || 0,
        extra_cards_women: Number(data.extra_cards_women) || 0,
        external_participation: data.external_participation,
        external_participation_details: data.external_participation_details,
        special_requests: data.special_requests,
      })
      .eq("id", data.id);
    setSaving(false);
    if (error) {
      toast.error("تعذّر الحفظ", { description: error.message });
      return;
    }
    toast.success("تم حفظ طلبات العريس");
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IdCard className="h-5 w-5 text-primary" />
            مستندات وطلبات العريس
            {data && <Badge variant="outline" className="ms-2">{data.full_name}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {loading || !data ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Attachments */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FileSlot
                title="الصورة الشخصية"
                icon={<ImageIcon className="h-4 w-4" />}
                preview={photoPreview}
                hasFile={!!data.photo_url}
                uploading={photoUploading}
                accept="image/*"
                onUpload={(f) => uploadFile(f, "photo")}
                onRemove={() => removeFile("photo")}
              />
              <FileSlot
                title="الهوية الوطنية"
                icon={<IdCard className="h-4 w-4" />}
                preview={idPreview}
                hasFile={!!data.national_id_url}
                uploading={idUploading}
                accept="image/*,application/pdf"
                onUpload={(f) => uploadFile(f, "id")}
                onRemove={() => removeFile("id")}
              />
            </div>

            {/* Requests */}
            <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5 space-y-4">
              <h3 className="font-bold text-sm">طلبات العريس الإضافية</h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <NumField
                  label="ذبائح إضافية"
                  value={data.extra_sheep}
                  onChange={(v) => setData({ ...data, extra_sheep: v })}
                />
                <NumField
                  label="كروت رجال إضافية"
                  value={data.extra_cards_men}
                  onChange={(v) => setData({ ...data, extra_cards_men: v })}
                />
                <NumField
                  label="كروت نساء إضافية"
                  value={data.extra_cards_women}
                  onChange={(v) => setData({ ...data, extra_cards_women: v })}
                />
              </div>

              <div className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 cursor-pointer">
                    <ExternalLink className="h-4 w-4 text-primary" />
                    مشاركة خارجية خاصة
                  </Label>
                  <Switch
                    checked={data.external_participation}
                    onCheckedChange={(c) => setData({ ...data, external_participation: c })}
                  />
                </div>
                {data.external_participation && (
                  <Textarea
                    placeholder="تفاصيل المشاركة الخارجية (نوعها، عدد المشاركين، أي ترتيبات لازمة...)"
                    value={data.external_participation_details ?? ""}
                    onChange={(e) => setData({ ...data, external_participation_details: e.target.value })}
                    rows={3}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>طلبات أو ملاحظات أخرى</Label>
                <Textarea
                  placeholder="أي طلبات إضافية يرغب العريس بإضافتها..."
                  value={data.special_requests ?? ""}
                  onChange={(e) => setData({ ...data, special_requests: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>إلغاء</Button>
          <Button onClick={save} disabled={saving || loading} className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            حفظ الطلبات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value))} dir="ltr" className="h-9" />
    </div>
  );
}

function FileSlot({
  title, icon, preview, hasFile, uploading, accept, onUpload, onRemove,
}: {
  title: string;
  icon: React.ReactNode;
  preview: string | null;
  hasFile: boolean;
  uploading: boolean;
  accept: string;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const isImage = preview && !preview.toLowerCase().includes(".pdf");
  return (
    <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold flex items-center gap-2">{icon}{title}</p>
        {hasFile && (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[10px]">مرفوع</Badge>
        )}
      </div>

      <div className="relative h-36 rounded-xl bg-muted/30 border overflow-hidden flex items-center justify-center">
        {preview ? (
          isImage ? (
            <img src={preview} alt={title} className="h-full w-full object-cover" />
          ) : (
            <a href={preview} target="_blank" rel="noreferrer" className="text-xs text-primary underline flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> فتح الملف
            </a>
          )
        ) : (
          <p className="text-xs text-muted-foreground">لم يُرفع بعد</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <label className="flex-1">
          <input
            type="file"
            accept={accept}
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = "";
            }}
          />
          <span className={`flex items-center justify-center gap-2 h-9 rounded-md text-xs font-medium border bg-primary/10 text-primary hover:bg-primary/15 transition cursor-pointer ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {hasFile ? "استبدال" : "رفع"}
          </span>
        </label>
        {hasFile && (
          <Button type="button" variant="outline" size="sm" className="h-9 px-2 text-destructive" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
