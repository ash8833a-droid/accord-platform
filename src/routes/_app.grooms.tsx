import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  Pencil, Trash2, Share2, Copy, MessageCircle, Database, Search, Download,
  FileSpreadsheet, FileText, FileJson, Printer,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { GroomDetailsDialog } from "@/components/grooms/GroomDetailsDialog";
import { useBrand, brandLogoSrc, urlToDataUri } from "@/lib/brand";
import { supabase as sb } from "@/integrations/supabase/client";
import { useAppSetting } from "@/hooks/use-app-setting";

const REGISTER_LINK_KEY = "groom_registration_url";
const DEFAULT_REGISTRATION_URL = "https://lajnat-zawaj.org";

function useRegistrationUrl() {
  const { value } = useAppSetting<string>(REGISTER_LINK_KEY, "");
  const trimmed = (value ?? "").trim();
  return trimmed || DEFAULT_REGISTRATION_URL;
}

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
  const registrationUrl = useRegistrationUrl();

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
  const [editId, setEditId] = useState<string | null>(null);

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
    const { safeStorageKey } = await import("@/lib/uploads");
    const path = safeStorageKey(file.name, folder);
    const { error } = await sb.storage.from("groom-docs").upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    return path;
  };

  const resetForm = () => {
    setForm({
      full_name: "", phone: "", family_branch: "", notes: "",
      wedding_date: "",
      request_type: "none", request_details: "",
      external_participation: false, external_participation_details: "",
      vip_guests: "",
      extra_sheep: 0, extra_cards_men: 0, extra_cards_women: 0,
    });
    setPhotoFile(null); setIdFile(null); setPhotoPreview(null); setIdPreview(null);
    setEditId(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      let photo_url: string | null = null;
      let national_id_url: string | null = null;
      if (photoFile) photo_url = await uploadOne(photoFile, "photos");
      if (idFile) national_id_url = await uploadOne(idFile, "ids");

      const payload: any = { ...form, wedding_date: form.wedding_date || null, family_branch: form.family_branch?.trim() || "—" };
      if (photo_url) payload.photo_url = photo_url;
      if (national_id_url) payload.national_id_url = national_id_url;

      if (editId) {
        const { error } = await supabase.from("grooms").update(payload).eq("id", editId);
        if (error) throw error;
        toast.success("تم تحديث بيانات العريس");
      } else {
        const { error } = await supabase.from("grooms").insert(payload);
        if (error) throw error;
        toast.success("تم تسجيل العريس بنجاح");
      }

      resetForm();
      setOpen(false);
      load();
    } catch (err: any) {
      toast.error("تعذر الحفظ", { description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (g: Groom) => {
    const ge = g as any;
    setEditId(g.id);
    setForm({
      full_name: g.full_name ?? "",
      phone: g.phone ?? "",
      family_branch: g.family_branch ?? "",
      notes: g.notes ?? "",
      wedding_date: g.wedding_date ?? "",
      request_type: ge.request_type ?? "none",
      request_details: ge.request_details ?? "",
      external_participation: ge.external_participation ?? false,
      external_participation_details: ge.external_participation_details ?? "",
      vip_guests: ge.vip_guests ?? "",
      extra_sheep: ge.extra_sheep ?? 0,
      extra_cards_men: ge.extra_cards_men ?? 0,
      extra_cards_women: ge.extra_cards_women ?? 0,
    });
    setPhotoFile(null); setIdFile(null); setPhotoPreview(null); setIdPreview(null);
    setOpen(true);
  };

  const removeGroom = async (g: Groom) => {
    if (!confirm(`هل تريد حذف العريس "${g.full_name}" نهائياً؟`)) return;
    const { error } = await supabase.from("grooms").delete().eq("id", g.id);
    if (error) { toast.error("تعذّر الحذف", { description: error.message }); return; }
    toast.success("تم الحذف");
    load();
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
        <div className="flex gap-2">
        <GroomsDatabaseDialog grooms={grooms} />
        <ShareRegistrationLink url={registrationUrl} />
        <QuickWhatsAppShare url={registrationUrl} />
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild onClick={() => resetForm()}>
            <Button className="bg-gradient-hero text-primary-foreground shadow-elegant">
              <Plus className="h-4 w-4 ms-1" /> تسجيل عريس
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">{editId ? "تعديل بيانات العريس" : "تسجيل عريس جديد"}</DialogTitle>
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
                {uploading ? "جارٍ الحفظ..." : (editId ? "تحديث بيانات العريس" : "حفظ بيانات العريس")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
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
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">المستندات والطلبات</th>
                <th className="px-4 py-3 font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {grooms.map((g) => {
                const b = STATUS_BADGE[g.status] ?? STATUS_BADGE.new;
                return (
                  <tr key={g.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{g.full_name}</td>
                    <td className="px-4 py-3">{g.family_branch}</td>
                    <td className="px-4 py-3 text-muted-foreground" dir="ltr">{g.phone}</td>
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
                      <div className="flex items-center gap-2">
                        <Select value={g.status} onValueChange={(v) => updateStatus(g.id, v as GroomStatus)}>
                          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_BADGE).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-primary hover:bg-primary/10"
                          onClick={() => startEdit(g)}
                          title="تعديل"
                          aria-label="تعديل"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => removeGroom(g)}
                          title="حذف"
                          aria-label="حذف"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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

function ShareRegistrationLink({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(url);
  useEffect(() => { setDraft(url); }, [url]);

  const saveUrl = async () => {
    const next = draft.trim();
    if (!next) { toast.error("الرجاء إدخال رابط صحيح"); return; }
    try { new URL(next); } catch { toast.error("صيغة الرابط غير صحيحة"); return; }
    const { error } = await supabase
      .from("app_settings" as any)
      .upsert({ key: REGISTER_LINK_KEY, value: next }, { onConflict: "key" });
    if (error) toast.error("تعذّر حفظ الرابط");
    else toast.success("تم اعتماد الرابط — سيُستخدم في كل مشاركة");
  };

  const message = `🤍 بـارَكَ اللهُ لكَ وبارَكَ عليكَ وجَمَعَ بينَكُما في خَير 🤍
تتشرف لجنة الزواج الجماعي بقبيلة الهملة من قريش بدعوتكم للانضمام إلى البرنامج. يُرجى التكرّم بتسجيل بياناتكم عبر الرابط الرسمي أدناه:

🔗 ${url}

(تُعامل كافة البيانات المرفقة بسرية تامة).`;

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("تم نسخ نص الدعوة مع الرابط");
    } catch {
      toast.error("تعذّر النسخ، الرجاء المحاولة يدويًا");
    }
  };

  const copyLinkOnly = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("تم نسخ الرابط");
    } catch {
      toast.error("تعذّر النسخ");
    }
  };

  const sendWhatsApp = () => {
    const wa = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(wa, "_blank", "noopener");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-primary/30">
          <Share2 className="h-4 w-4 ms-1" /> مشاركة رابط التسجيل
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            دعوة العريس لتسجيل بياناته
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            نص جاهز ومُلهم يُرسل مع رابط التسجيل عبر واتساب أو أي تطبيق محادثة.
          </p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="rounded-2xl border bg-gradient-to-br from-primary/5 to-transparent p-4">
            <Textarea
              value={message}
              readOnly
              rows={14}
              className="resize-none bg-background/60 text-sm leading-7 font-medium"
              dir="rtl"
            />
          </div>

          <div className="space-y-2 rounded-xl border bg-muted/40 px-3 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Globe2 className="h-4 w-4 text-primary shrink-0" />
              <span>الرابط المعتمد للتسجيل (يُستخدم في كل أزرار المشاركة)</span>
            </div>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              dir="ltr"
              className="font-mono text-xs bg-background"
              placeholder="https://..."
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={saveUrl} className="bg-primary text-primary-foreground">
                اعتماد الرابط
              </Button>
              <Button size="sm" variant="ghost" onClick={copyLinkOnly}>
                <Copy className="h-3.5 w-3.5 ms-1" /> نسخ الرابط
              </Button>
              {draft.trim() !== url && (
                <span className="text-[11px] text-warning self-center">تغييرات غير محفوظة</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button onClick={copyMessage} className="bg-gradient-hero text-primary-foreground">
              <Copy className="h-4 w-4 ms-1" /> نسخ النص مع الرابط
            </Button>
            <Button onClick={sendWhatsApp} variant="outline" className="border-success/40 text-success-foreground">
              <MessageCircle className="h-4 w-4 ms-1" /> إرسال عبر واتساب
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const INVITATION_MESSAGE = (url: string) => `🤍 بـارَكَ اللهُ لكَ وبارَكَ عليكَ وجَمَعَ بينَكُما في خَير 🤍
تتشرف لجنة الزواج الجماعي بقبيلة الهملة من قريش بدعوتكم للانضمام إلى البرنامج. يُرجى التكرّم بتسجيل بياناتكم عبر الرابط الرسمي أدناه:

🔗 ${url}

(تُعامل كافة البيانات المرفقة بسرية تامة).`;

function QuickWhatsAppShare({ url }: { url: string }) {
  const handleClick = () => {
    const wa = `https://wa.me/?text=${encodeURIComponent(INVITATION_MESSAGE(url))}`;
    window.open(wa, "_blank", "noopener");
  };

  return (
    <Button
      onClick={handleClick}
      className="bg-[#25D366] hover:bg-[#1ebe57] text-white shadow-elegant"
      title="إرسال دعوة عبر واتساب مباشرة"
    >
      <MessageCircle className="h-4 w-4 ms-1" /> واتساب مباشر
    </Button>
  );
}

// ============ قاعدة بيانات العرسان (مرجع مؤسسي شامل) ============
const COMMITTEE_NAME = "لجنة الزواج الجماعي العائلي — قبيلة الهملة من قريش";
const COMMITTEE_TAGLINE = "مرجع رسمي · سجل العرسان عبر السنوات";

// تنسيق هجري + ميلادي
function formatHijri(d: Date) {
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
      day: "numeric", month: "long", year: "numeric",
    }).format(d) + " هـ";
  } catch {
    return "";
  }
}
function formatGregorian(d: Date) {
  return new Intl.DateTimeFormat("ar", {
    day: "2-digit", month: "long", year: "numeric",
  }).format(d) + " م";
}
function hijriYearOf(d: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year: "numeric" }).formatToParts(d);
    const y = parts.find((p) => p.type === "year")?.value ?? "";
    return y ? `${y}هـ` : "";
  } catch {
    return "";
  }
}

function GroomsDatabaseDialog({ grooms }: { grooms: Groom[] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const { brand } = useBrand();
  const [logoDataUri, setLogoDataUri] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const src = brandLogoSrc(brand);
      try {
        const uri = await urlToDataUri(src);
        if (!cancelled) setLogoDataUri(uri);
      } catch {
        if (!cancelled) setLogoDataUri(src);
      }
    })();
    return () => { cancelled = true; };
  }, [brand]);

  type Row = {
    seq: number;
    yearG: string; // ميلادي
    yearH: string; // هجري
    full_name: string;
    phone: string;
    family_branch: string;
    status: string;
  };

  const rows: Row[] = useMemo(() => {
    return grooms.map((g, i) => {
      const ge = g as any;
      const dateStr: string | null = ge.wedding_date || ge.created_at || null;
      const d = dateStr ? new Date(dateStr) : null;
      return {
        seq: i + 1,
        yearG: d ? String(d.getFullYear()) + "م" : "—",
        yearH: d ? hijriYearOf(d) : "—",
        full_name: g.full_name,
        phone: g.phone || "—",
        family_branch: g.family_branch || "—",
        status: STATUS_BADGE[g.status]?.label ?? g.status,
      };
    });
  }, [grooms]);

  const years = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.yearG));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (yearFilter !== "all" && r.yearG !== yearFilter) return false;
      if (!q) return true;
      return (
        r.full_name.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        r.family_branch.toLowerCase().includes(q) ||
        r.yearG.includes(q) || r.yearH.includes(q)
      );
    });
  }, [rows, search, yearFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.yearG !== b.yearG) return b.yearG.localeCompare(a.yearG);
      return a.full_name.localeCompare(b.full_name, "ar");
    }).map((r, i) => ({ ...r, seq: i + 1 }));
  }, [filtered]);

  // ===== تصدير: تواريخ ووسوم =====
  const now = new Date();
  const stampG = now.toISOString().slice(0, 10);
  const baseName = `قاعدة-بيانات-العرسان-${stampG}`;
  const hijriToday = formatHijri(now);
  const gregToday = formatGregorian(now);

  const headers = ["م", "السنة الهجرية", "السنة الميلادية", "الاسم الرباعي", "رقم الجوال", "الفرع العائلي", "الحالة"];

  const dataRows = () =>
    sorted.map((r) => [r.seq, r.yearH, r.yearG, r.full_name, r.phone, r.family_branch, r.status]);

  const guard = () => {
    if (sorted.length === 0) {
      toast.error("لا توجد بيانات للتصدير");
      return false;
    }
    return true;
  };

  // ===== Excel (XLSX) — منسّق بالكامل، RTL =====
  const exportXLSX = () => {
    if (!guard()) return;

    const aoa: (string | number)[][] = [
      [COMMITTEE_NAME],
      [COMMITTEE_TAGLINE],
      [`تاريخ التصدير: ${hijriToday}  ·  ${gregToday}`],
      [`إجمالي السجلات: ${sorted.length}  ·  عدد السنوات: ${years.length}`],
      [],
      headers,
      ...dataRows(),
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!views"] = [{ RTL: true }];
    ws["!cols"] = [
      { wch: 5 },   // م
      { wch: 16 },  // هجري
      { wch: 14 },  // ميلادي
      { wch: 32 },  // الاسم
      { wch: 16 },  // الجوال
      { wch: 22 },  // الفرع
      { wch: 14 },  // الحالة
    ];
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 6 } },
    ];

    // تنسيقات (cell-by-cell — مدعومة من xlsx CE في الكتابة)
    const setStyle = (addr: string, style: any) => {
      const c = ws[addr];
      if (c) c.s = style;
    };
    const titleStyle = {
      font: { bold: true, sz: 16, color: { rgb: "FFFFFF" }, name: "Tajawal" },
      fill: { patternType: "solid", fgColor: { rgb: "1B4F58" } },
      alignment: { horizontal: "center", vertical: "center", readingOrder: 2 },
    };
    const subStyle = {
      font: { bold: true, sz: 11, color: { rgb: "1B4F58" }, name: "Tajawal" },
      fill: { patternType: "solid", fgColor: { rgb: "FBF7EE" } },
      alignment: { horizontal: "center", vertical: "center", readingOrder: 2 },
    };
    const metaStyle = {
      font: { sz: 10, color: { rgb: "374151" }, name: "Tajawal" },
      fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } },
      alignment: { horizontal: "center", vertical: "center", readingOrder: 2 },
    };
    const headStyle = {
      font: { bold: true, sz: 11, color: { rgb: "FFFFFF" }, name: "Tajawal" },
      fill: { patternType: "solid", fgColor: { rgb: "1B4F58" } },
      alignment: { horizontal: "center", vertical: "center", readingOrder: 2, wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: "0F3138" } },
        bottom: { style: "thin", color: { rgb: "0F3138" } },
        left: { style: "thin", color: { rgb: "0F3138" } },
        right: { style: "thin", color: { rgb: "0F3138" } },
      },
    };
    const cellBase = {
      font: { sz: 10, name: "Tajawal", color: { rgb: "1F2937" } },
      alignment: { horizontal: "center", vertical: "center", readingOrder: 2, wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: "E5E7EB" } },
        bottom: { style: "thin", color: { rgb: "E5E7EB" } },
        left: { style: "thin", color: { rgb: "E5E7EB" } },
        right: { style: "thin", color: { rgb: "E5E7EB" } },
      },
    };
    const cellAlt = { ...cellBase, fill: { patternType: "solid", fgColor: { rgb: "FBF7EE" } } };
    const nameCell = { ...cellBase, alignment: { ...cellBase.alignment, horizontal: "right" }, font: { ...cellBase.font, bold: true } };
    const nameCellAlt = { ...cellAlt, alignment: { ...cellAlt.alignment, horizontal: "right" }, font: { ...cellAlt.font, bold: true } };

    setStyle("A1", titleStyle);
    setStyle("A2", subStyle);
    setStyle("A3", metaStyle);
    setStyle("A4", metaStyle);
    ws["!rows"] = [
      { hpt: 28 }, { hpt: 20 }, { hpt: 18 }, { hpt: 18 }, { hpt: 6 }, { hpt: 22 },
    ];

    // header row = index 5 (row 6)
    headers.forEach((_, idx) => {
      const addr = XLSX.utils.encode_cell({ r: 5, c: idx });
      setStyle(addr, headStyle);
    });
    // body rows
    sorted.forEach((_, rIdx) => {
      const r = 6 + rIdx;
      const isAlt = rIdx % 2 === 1;
      headers.forEach((_, cIdx) => {
        const addr = XLSX.utils.encode_cell({ r, c: cIdx });
        if (cIdx === 3) setStyle(addr, isAlt ? nameCellAlt : nameCell);
        else setStyle(addr, isAlt ? cellAlt : cellBase);
      });
    });

    // Freeze pane تحت الترويسة
    (ws as any)["!freeze"] = { xSplit: 0, ySplit: 6 };
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 5, c: 0 }, e: { r: 5 + sorted.length, c: 6 } }) };

    const wb = XLSX.utils.book_new();
    (wb as any).Props = {
      Title: "قاعدة بيانات العرسان",
      Subject: COMMITTEE_NAME,
      Author: COMMITTEE_NAME,
      CreatedDate: now,
    };
    XLSX.utils.book_append_sheet(wb, ws, "سجل العرسان");
    XLSX.writeFile(wb, `${baseName}.xlsx`);
    toast.success("تم تصدير ملف Excel منسّق");
  };

  // ===== CSV — مع UTF-8 BOM وعنوان توضيحي =====
  const exportCSV = () => {
    if (!guard()) return;
    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      escape(COMMITTEE_NAME),
      escape(`${COMMITTEE_TAGLINE} — ${hijriToday} · ${gregToday}`),
      "",
      headers.map(escape).join(","),
      ...dataRows().map((r) => r.map(escape).join(",")),
    ];
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    triggerDownload(blob, `${baseName}.csv`);
    toast.success("تم تصدير CSV");
  };

  // ===== JSON =====
  const exportJSON = () => {
    if (!guard()) return;
    const payload = {
      committee: COMMITTEE_NAME,
      tagline: COMMITTEE_TAGLINE,
      exported_at: { hijri: hijriToday, gregorian: gregToday, iso: now.toISOString() },
      total_records: sorted.length,
      total_years: years.length,
      records: sorted.map((r) => ({
        seq: r.seq,
        hijri_year: r.yearH,
        gregorian_year: r.yearG,
        full_name: r.full_name,
        phone: r.phone,
        family_branch: r.family_branch,
        status: r.status,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    triggerDownload(blob, `${baseName}.json`);
    toast.success("تم تصدير JSON");
  };

  // ===== PDF احترافي بهوية اللجنة =====
  const exportPDF = () => {
    if (!guard()) return;
    const escapeHtml = (s: string) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(baseName)}</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&family=Amiri:wght@700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 14mm 12mm 18mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Tajawal', Arial, sans-serif; color: #1f2937; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  .brand-bar {
    background: linear-gradient(135deg, #1B4F58 0%, #2A6B75 60%, #C4A25C 140%);
    color: #fff; padding: 18px 22px; border-radius: 14px;
    display: flex; justify-content: space-between; align-items: center;
    box-shadow: 0 6px 18px rgba(27,79,88,0.18);
  }
  .brand-left { display: flex; align-items: center; gap: 14px; }
  .seal {
    width: 64px; height: 64px; border-radius: 14px;
    background: #fff;
    padding: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.18), inset 0 0 0 2px rgba(196,162,92,0.55);
    display: flex; align-items: center; justify-content: center;
    overflow: hidden; flex-shrink: 0;
  }
  .seal img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .brand-title h1 { margin: 0; font-size: 16pt; font-weight: 800; letter-spacing: 0.2px; }
  .brand-title p { margin: 3px 0 0; font-size: 9pt; opacity: 0.92; }
  .brand-right { text-align: left; font-size: 9pt; line-height: 1.7; }
  .brand-right .lbl { opacity: 0.85; margin-inline-end: 4px; }
  .brand-right b { color: #FBF7EE; }

  .meta-strip {
    margin-top: 12px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
  }
  .stat {
    border: 1px solid #E5E7EB; background: #FBF7EE; border-radius: 10px;
    padding: 10px 12px; text-align: center;
  }
  .stat .v { font-size: 14pt; font-weight: 800; color: #1B4F58; }
  .stat .k { font-size: 8pt; color: #6B7280; margin-top: 2px; }

  table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 9.5pt; }
  thead th {
    background: #1B4F58; color: #fff; padding: 9px 6px;
    text-align: center; font-weight: 700; border: 1px solid #0F3138;
    font-size: 9pt;
  }
  tbody td {
    padding: 7px 6px; text-align: center; border: 1px solid #E5E7EB;
    vertical-align: middle;
  }
  tbody tr:nth-child(even) td { background: #FBF7EE; }
  td.name { text-align: right; font-weight: 700; color: #111827; }
  td.phone { direction: ltr; font-variant-numeric: tabular-nums; color: #374151; }
  td.seq { color: #6B7280; font-variant-numeric: tabular-nums; width: 36px; }
  .status-pill {
    display: inline-block; padding: 2px 8px; border-radius: 999px;
    background: #E8F1F2; color: #1B4F58; font-size: 8pt; font-weight: 700;
  }

  .footer-band {
    position: fixed; bottom: 6mm; right: 12mm; left: 12mm;
    border-top: 1.5px solid #C4A25C; padding-top: 6px;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 8pt; color: #6B7280;
  }
  .footer-band .right b { color: #1B4F58; }
  .footer-band .center { font-style: italic; }

  .toolbar { position: fixed; top: 10px; left: 10px; display: flex; gap: 6px; z-index: 9999; }
  .toolbar button {
    background: #1B4F58; color: #fff; border: 0; padding: 9px 16px;
    border-radius: 8px; font-family: inherit; font-weight: 700; cursor: pointer;
    box-shadow: 0 4px 10px rgba(0,0,0,0.15);
  }
  .toolbar .ghost { background: #C4A25C; color: #1B4F58; }
  @media print { .toolbar { display: none; } }
</style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
    <button class="ghost" onclick="window.close()">إغلاق</button>
  </div>

  <div class="brand-bar">
    <div class="brand-left">
      <div class="seal"><img id="brand-logo" src="${logoDataUri || brandLogoSrc(brand)}" alt="logo" crossorigin="anonymous"/></div>
      <div class="brand-title">
        <h1>${escapeHtml(COMMITTEE_NAME)}</h1>
        <p>${escapeHtml(COMMITTEE_TAGLINE)}</p>
      </div>
    </div>
    <div class="brand-right">
      <div><span class="lbl">التاريخ الهجري:</span> <b>${escapeHtml(hijriToday)}</b></div>
      <div><span class="lbl">التاريخ الميلادي:</span> <b>${escapeHtml(gregToday)}</b></div>
      <div><span class="lbl">المرجع:</span> <b>GRM-${stampG}</b></div>
    </div>
  </div>

  <div class="meta-strip">
    <div class="stat"><div class="v">${sorted.length}</div><div class="k">إجمالي العرسان</div></div>
    <div class="stat"><div class="v">${years.length}</div><div class="k">عدد السنوات</div></div>
    <div class="stat"><div class="v">${escapeHtml(years[years.length - 1] ?? "—")}</div><div class="k">أقدم سنة</div></div>
    <div class="stat"><div class="v">${escapeHtml(years[0] ?? "—")}</div><div class="k">أحدث سنة</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:6%">م</th>
        <th style="width:13%">السنة الهجرية</th>
        <th style="width:13%">السنة الميلادية</th>
        <th style="width:32%">الاسم الرباعي</th>
        <th style="width:14%">رقم الجوال</th>
        <th style="width:14%">الفرع العائلي</th>
        <th style="width:8%">الحالة</th>
      </tr>
    </thead>
    <tbody>
      ${sorted
        .map(
          (r) => `
        <tr>
          <td class="seq">${r.seq}</td>
          <td>${escapeHtml(r.yearH)}</td>
          <td>${escapeHtml(r.yearG)}</td>
          <td class="name">${escapeHtml(r.full_name)}</td>
          <td class="phone">${escapeHtml(r.phone)}</td>
          <td>${escapeHtml(r.family_branch)}</td>
          <td><span class="status-pill">${escapeHtml(r.status)}</span></td>
        </tr>`,
        )
        .join("")}
    </tbody>
  </table>

  <div class="footer-band">
    <div class="right">
      <b>${escapeHtml(COMMITTEE_NAME)}</b> — وثيقة رسمية معتمدة
    </div>
    <div class="center">صدر آلياً من نظام إدارة اللجنة</div>
    <div class="left">© ${new Date().getFullYear()}</div>
  </div>

  <script>
    window.addEventListener('load', () => {
      var img = document.getElementById('brand-logo');
      var go = function(){ setTimeout(function(){ window.print(); }, 350); };
      if (img && !img.complete) { img.onload = go; img.onerror = go; }
      else { go(); }
    });
  </script>
</body>
</html>`;

    const win = window.open("", "_blank", "width=1100,height=800");
    if (!win) { toast.error("يرجى السماح بالنوافذ المنبثقة"); return; }
    win.document.open(); win.document.write(html); win.document.close();
    toast.success("جارٍ تجهيز ملف PDF");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-primary/30 gap-2">
          <Database className="h-4 w-4" /> قاعدة بيانات العرسان
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-[95vw] lg:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <span className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center shadow-elegant">
              <Database className="h-6 w-6" />
            </span>
            <div className="flex-1">
              <div>قاعدة بيانات العرسان</div>
              <p className="text-xs text-muted-foreground font-normal mt-0.5">
                مرجع رسمي · {hijriToday} · {gregToday}
              </p>
            </div>
          </DialogTitle>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم، الجوال، الفرع، السنة…"
                className="pr-9"
              />
            </div>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="السنة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل السنوات</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2 bg-primary hover:bg-primary/90">
                  <Download className="h-4 w-4" /> تصدير
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>اختر صيغة التصدير</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={exportXLSX} className="gap-2 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel (.xlsx) منسّق
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportPDF} className="gap-2 cursor-pointer">
                  <Printer className="h-4 w-4 text-rose-600" /> PDF بهوية اللجنة
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportCSV} className="gap-2 cursor-pointer">
                  <FileText className="h-4 w-4 text-blue-600" /> CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportJSON} className="gap-2 cursor-pointer">
                  <FileJson className="h-4 w-4 text-amber-600" /> JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary" className="gap-1">
              <Database className="h-3 w-3" /> {sorted.length} عريس
            </Badge>
            <Badge variant="secondary">{years.length} سنة</Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-primary text-primary-foreground z-10">
              <tr>
                <th className="px-3 py-2.5 text-center text-xs font-bold w-12">م</th>
                <th className="px-3 py-2.5 text-center text-xs font-bold w-28">السنة الهجرية</th>
                <th className="px-3 py-2.5 text-center text-xs font-bold w-28">السنة الميلادية</th>
                <th className="px-3 py-2.5 text-right text-xs font-bold">الاسم الرباعي</th>
                <th className="px-3 py-2.5 text-right text-xs font-bold">رقم الجوال</th>
                <th className="px-3 py-2.5 text-right text-xs font-bold">الفرع العائلي</th>
                <th className="px-3 py-2.5 text-center text-xs font-bold">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                    لا توجد سجلات مطابقة
                  </td>
                </tr>
              ) : (
                sorted.map((r, i) => (
                  <tr key={i} className={`border-t hover:bg-primary/5 transition-colors ${i % 2 === 1 ? "bg-muted/30" : ""}`}>
                    <td className="px-3 py-2 text-center text-muted-foreground tabular-nums">{r.seq}</td>
                    <td className="px-3 py-2 text-center">
                      <Badge variant="outline" className="tabular-nums border-primary/30">{r.yearH}</Badge>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Badge variant="outline" className="tabular-nums">{r.yearG}</Badge>
                    </td>
                    <td className="px-3 py-2 font-semibold">{r.full_name}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground" dir="ltr">{r.phone}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.family_branch}</td>
                    <td className="px-3 py-2 text-center text-xs">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{r.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
