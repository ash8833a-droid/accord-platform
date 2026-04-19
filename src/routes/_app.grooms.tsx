import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  HeartHandshake, Plus, FileCheck2, FolderOpen, User, Phone, Users, Heart,
  StickyNote, IdCard, Camera, ClipboardList, Globe2, Crown, Upload, X, ImageIcon, FileImage,
  Pencil, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { GroomDetailsDialog } from "@/components/grooms/GroomDetailsDialog";
import { supabase as sb } from "@/integrations/supabase/client";

const REQUEST_TYPES = [
  { value: "extra_sheep", label: "زيادة في عدد الذبائح", icon: "🐑" },
  { value: "transfer", label: "تنازل لعريس آخر", icon: "🤝" },
  { value: "decline_extra", label: "اعتذار عن الزيادة", icon: "🙏" },
  { value: "none", label: "لا يوجد طلبات", icon: "—" },
];

export const Route = createFileRoute("/_app/grooms")({
  component: GroomsPage,
});

type GroomStatus = "new" | "under_review" | "approved" | "rejected" | "completed";

interface Groom {
  id: string;
  full_name: string;
  phone: string;
  family_branch: string;
  bride_name: string | null;
  wedding_date: string | null;
  status: GroomStatus;
  notes: string | null;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  new: { label: "جديد", cls: "bg-muted text-foreground" },
  under_review: { label: "قيد المراجعة", cls: "bg-warning/20 text-warning-foreground" },
  approved: { label: "معتمد", cls: "bg-success text-success-foreground" },
  rejected: { label: "مرفوض", cls: "bg-destructive text-destructive-foreground" },
  completed: { label: "مكتمل", cls: "bg-gradient-gold text-gold-foreground" },
};

function GroomsPage() {
  const [grooms, setGrooms] = useState<Groom[]>([]);
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    full_name: "", phone: "", family_branch: "", notes: "",
    wedding_date: "",
    request_type: "none", request_details: "",
    external_participation: false, external_participation_details: "",
    vip_guests: "",
    extra_sheep: 0, extra_cards_men: 0, extra_cards_women: 0,
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("grooms").select("*");
    const list = (data ?? []) as Groom[];
    const today = new Date().toISOString().slice(0, 10);
    list.sort((a, b) => {
      const ax = a.wedding_date && a.wedding_date >= today ? 0 : 1;
      const bx = b.wedding_date && b.wedding_date >= today ? 0 : 1;
      if (ax !== bx) return ax - bx;
      if (a.wedding_date && b.wedding_date) return a.wedding_date.localeCompare(b.wedding_date);
      if (a.wedding_date) return -1;
      if (b.wedding_date) return 1;
      return 0;
    });
    setGrooms(list);
  };
  useEffect(() => {
    load();
  }, []);

  const onPickFile = (file: File | null, kind: "photo" | "id") => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("الحد الأقصى لحجم الملف 8 ميجابايت");
      return;
    }
    const url = URL.createObjectURL(file);
    if (kind === "photo") { setPhotoFile(file); setPhotoPreview(url); }
    else { setIdFile(file); setIdPreview(url); }
  };

  const uploadOne = async (file: File, folder: string) => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage.from("groom-docs").upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    return path;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      let photo_url: string | null = null;
      let national_id_url: string | null = null;
      if (photoFile) photo_url = await uploadOne(photoFile, "photos");
      if (idFile) national_id_url = await uploadOne(idFile, "ids");

      const payload: any = { ...form, wedding_date: form.wedding_date || null, photo_url, national_id_url };
      const { error } = await supabase.from("grooms").insert(payload);
      if (error) throw error;

      toast.success("تم تسجيل العريس بنجاح");
      setForm({
        full_name: "", phone: "", family_branch: "", notes: "",
        wedding_date: "",
        request_type: "none", request_details: "",
        external_participation: false, external_participation_details: "",
        vip_guests: "",
        extra_sheep: 0, extra_cards_men: 0, extra_cards_women: 0,
      });
      setPhotoFile(null); setIdFile(null); setPhotoPreview(null); setIdPreview(null);
      setOpen(false);
      load();
    } catch (err: any) {
      toast.error("تعذر الحفظ", { description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const updateStatus = async (id: string, status: GroomStatus) => {
    await supabase.from("grooms").update({ status }).eq("id", id);
    load();
  };

  const stats = {
    total: grooms.length,
    approved: grooms.filter((g) => g.status === "approved" || g.status === "completed").length,
    pending: grooms.filter((g) => g.status === "new" || g.status === "under_review").length,
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">سجل العرسان</h1>
          <p className="text-muted-foreground mt-1">قاعدة بيانات شاملة لطلبات العرسان والمستندات</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-hero text-primary-foreground shadow-elegant">
              <Plus className="h-4 w-4 ms-1" /> تسجيل عريس
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">تسجيل عريس جديد</DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">الحقول المميزة بـ * إلزامية</p>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-5 pt-3">
              <Section title="البيانات الأساسية" icon={User} tone="primary">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="الاسم الرباعي *" icon={User}>
                    <Input
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      required
                      placeholder="الاسم الأول واسم الأب والجد واسم العائلة"
                      pattern="^\s*\S+(\s+\S+){3,}\s*$"
                      title="الرجاء كتابة الاسم الرباعي (أربعة مقاطع على الأقل)"
                    />
                  </Field>
                  <Field label="رقم الجوال *" icon={Phone}>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required dir="ltr" />
                  </Field>
                  <Field label="الفرع العائلي *">
                    <Input value={form.family_branch} onChange={(e) => setForm({ ...form, family_branch: e.target.value })} required />
                  </Field>
                  <Field label="تاريخ الزفاف">
                    <Input
                      type="date"
                      dir="ltr"
                      value={form.wedding_date}
                      onChange={(e) => setForm({ ...form, wedding_date: e.target.value })}
                    />
                  </Field>
                </div>
              </Section>

              <Section title="المستندات والصور" icon={FileImage} tone="emerald">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FileUploader
                    label="صورة شخصية للعريس"
                    icon={Camera}
                    accept="image/*"
                    preview={photoPreview}
                    onChange={(f) => onPickFile(f, "photo")}
                    onClear={() => { setPhotoFile(null); setPhotoPreview(null); }}
                    hint="JPG / PNG — حتى 8 ميجابايت"
                  />
                  <FileUploader
                    label="صورة الهوية الوطنية"
                    icon={IdCard}
                    accept="image/*"
                    preview={idPreview}
                    onChange={(f) => onPickFile(f, "id")}
                    onClear={() => { setIdFile(null); setIdPreview(null); }}
                    hint="صورة واضحة للوجهين"
                  />
                </div>
              </Section>

              <Section title="طلبات العريس" icon={ClipboardList} tone="amber">
                <Field label="نوع الطلب" icon={ClipboardList}>
                  <Select value={form.request_type} onValueChange={(v) => setForm({ ...form, request_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REQUEST_TYPES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          <span className="ms-1">{r.icon}</span> {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {form.request_type !== "none" && (
                  <Field label="تفاصيل الطلب">
                    <Textarea
                      value={form.request_details}
                      onChange={(e) => setForm({ ...form, request_details: e.target.value })}
                      placeholder="اذكر التفاصيل (العدد، اسم العريس المستفيد من التنازل، إلخ...)"
                      rows={2}
                    />
                  </Field>
                )}
              </Section>

              <Section title="ذبائح وكروت إضافية" icon={ClipboardList} tone="emerald">
                <p className="text-[11px] text-muted-foreground">العدد الإضافي فوق المخصّص الأساسي للعريس.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="عدد الذبائح الزيادة">
                    <Input type="number" min={0} dir="ltr" value={form.extra_sheep}
                      onChange={(e) => setForm({ ...form, extra_sheep: Math.max(0, Number(e.target.value) || 0) })} />
                  </Field>
                  <Field label="عدد كروت الرجال الإضافية">
                    <Input type="number" min={0} dir="ltr" value={form.extra_cards_men}
                      onChange={(e) => setForm({ ...form, extra_cards_men: Math.max(0, Number(e.target.value) || 0) })} />
                  </Field>
                  <Field label="عدد كروت النساء الإضافية">
                    <Input type="number" min={0} dir="ltr" value={form.extra_cards_women}
                      onChange={(e) => setForm({ ...form, extra_cards_women: Math.max(0, Number(e.target.value) || 0) })} />
                  </Field>
                </div>
              </Section>

              <Section title="مشاركات خارجية" icon={Globe2} tone="sky">
                <p className="text-[11px] text-muted-foreground">
                  المقصود بها: <strong>القصائد، الشيلات، الكلمات الترحيبية</strong> أو ما شابهها مما يُقدَّم للعريس في الحفل.
                </p>
                <label className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={form.external_participation}
                    onChange={(e) => setForm({ ...form, external_participation: e.target.checked })}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm font-medium">يوجد قصائد / شيلات / كلمات مقدّمة للعريس</span>
                </label>
                {form.external_participation && (
                  <Field label="تفاصيل المشاركات (نوعها · اسم المُلقي · المدة التقريبية)">
                    <Textarea
                      value={form.external_participation_details}
                      onChange={(e) => setForm({ ...form, external_participation_details: e.target.value })}
                      placeholder="مثال: قصيدة من الشاعر فلان (٣ دقائق) — شيلة من المنشد فلان (٥ دقائق) — كلمة ترحيبية من ..."
                      rows={3}
                    />
                  </Field>
                )}
              </Section>

              <Section title="ضيوف الشخصيات الاعتبارية" icon={Crown} tone="gold">
                <Field label="أسماء وألقاب الضيوف (سعادة، شيخ، معالي، ...)" icon={Crown}>
                  <Textarea
                    value={form.vip_guests}
                    onChange={(e) => setForm({ ...form, vip_guests: e.target.value })}
                    placeholder="مثال: سعادة الأستاذ ... — الشيخ ... — معالي الدكتور ..."
                    rows={2}
                  />
                </Field>
              </Section>

              <Section title="ملاحظات إضافية" icon={StickyNote} tone="muted">
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </Section>

              <Button type="submit" disabled={uploading} className="w-full bg-gradient-hero text-primary-foreground h-11">
                {uploading ? "جارٍ الحفظ..." : "حفظ بيانات العريس"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-gradient-to-br from-primary/15 to-transparent p-5">
          <HeartHandshake className="h-6 w-6 text-primary mb-2" />
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-sm text-muted-foreground">إجمالي العرسان</p>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-success/15 to-transparent p-5">
          <FileCheck2 className="h-6 w-6 text-success mb-2" />
          <p className="text-2xl font-bold">{stats.approved}</p>
          <p className="text-sm text-muted-foreground">معتمدون</p>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-gold/15 to-transparent p-5">
          <FileCheck2 className="h-6 w-6 text-gold mb-2" />
          <p className="text-2xl font-bold">{stats.pending}</p>
          <p className="text-sm text-muted-foreground">قيد المراجعة</p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="text-right">
                <th className="px-4 py-3 font-medium">العريس</th>
                <th className="px-4 py-3 font-medium">الفرع</th>
                <th className="px-4 py-3 font-medium">الجوال</th>
                <th className="px-4 py-3 font-medium">العروس</th>
                <th className="px-4 py-3 font-medium">تاريخ الزفاف</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">المستندات والطلبات</th>
                <th className="px-4 py-3 font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {grooms.map((g) => {
                const b = STATUS_BADGE[g.status] ?? STATUS_BADGE.new;
                const today = new Date().toISOString().slice(0, 10);
                const upcoming = g.wedding_date && g.wedding_date >= today;
                return (
                  <tr key={g.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{g.full_name}</td>
                    <td className="px-4 py-3">{g.family_branch}</td>
                    <td className="px-4 py-3 text-muted-foreground" dir="ltr">{g.phone}</td>
                    <td className="px-4 py-3">{g.bride_name ?? "—"}</td>
                    <td className="px-4 py-3" dir="ltr">
                      {g.wedding_date ? (
                        <span className={upcoming ? "text-primary font-medium" : "text-muted-foreground"}>
                          {new Date(g.wedding_date).toLocaleDateString("ar-SA-u-ca-gregory", { year: "numeric", month: "short", day: "numeric" })}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3"><Badge className={b.cls}>{b.label}</Badge></td>
                    <td className="px-4 py-3">
                      {(g.status === "approved" || g.status === "completed") ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                          onClick={() => setDetailsId(g.id)}
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                          المستندات والطلبات
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">يُتاح بعد الاعتماد</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Select value={g.status} onValueChange={(v) => updateStatus(g.id, v as GroomStatus)}>
                        <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_BADGE).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                );
              })}
              {grooms.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">لم يُسجّل أي عريس بعد.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailsId && (
        <GroomDetailsDialog
          groomId={detailsId}
          open={!!detailsId}
          onOpenChange={(o) => !o && setDetailsId(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

const TONES: Record<string, string> = {
  primary: "from-primary/10 to-primary/0 border-primary/30 text-primary",
  emerald: "from-emerald-500/10 to-emerald-500/0 border-emerald-500/30 text-emerald-700",
  amber: "from-amber-500/10 to-amber-500/0 border-amber-500/30 text-amber-700",
  sky: "from-sky-500/10 to-sky-500/0 border-sky-500/30 text-sky-700",
  gold: "from-gold/15 to-gold/0 border-gold/40 text-gold-foreground",
  muted: "from-muted/40 to-muted/0 border-border text-foreground",
};

function Section({ title, icon: Icon, tone, children }: { title: string; icon: any; tone: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-3.5 space-y-3 ${TONES[tone]}`}>
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-background/70 flex items-center justify-center">
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon?: any; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1.5 text-foreground/80">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </Label>
      {children}
    </div>
  );
}

function FileUploader({
  label, icon: Icon, accept, preview, onChange, onClear, hint,
}: {
  label: string; icon: any; accept: string; preview: string | null;
  onChange: (f: File | null) => void; onClear: () => void; hint?: string;
}) {
  const inputId = `file-${label}`;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1.5 text-foreground/80">
        <Icon className="h-3.5 w-3.5" /> {label}
      </Label>
      {preview ? (
        <div className="relative group rounded-xl overflow-hidden border-2 border-emerald-500/40 bg-card aspect-[4/3]">
          <img src={preview} alt={label} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={onClear}
            className="absolute top-2 left-2 h-7 w-7 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg hover:bg-rose-700"
            aria-label="حذف"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold">✓ تم الرفع</div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="flex flex-col items-center justify-center gap-2 aspect-[4/3] rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-colors bg-background/50"
        >
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="h-5 w-5 text-primary" />
          </div>
          <span className="text-xs font-medium text-foreground">اضغط لاختيار ملف</span>
          {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
        </label>
      )}
      <input
        id={inputId}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
