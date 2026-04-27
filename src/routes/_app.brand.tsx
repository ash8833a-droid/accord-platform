import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useBrand, fetchBrand, saveBrand, brandLogoSrc, BrandIdentity, DEFAULT_BRAND } from "@/lib/brand";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Save, RotateCcw, Palette, Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/brand")({
  component: BrandSettingsPage,
});

function BrandSettingsPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const { brand, refresh } = useBrand();
  const [form, setForm] = useState<BrandIdentity>(brand);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setForm(brand); }, [brand]);

  const set = <K extends keyof BrandIdentity>(k: K, v: BrandIdentity[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const onUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("يرجى اختيار ملف صورة");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("brand-assets").upload(path, file, {
        cacheControl: "3600", upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("brand-assets").getPublicUrl(path);
      set("logo_url", data.publicUrl);
      toast.success("تم رفع الشعار — لا تنس الحفظ");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "فشل الرفع";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await saveBrand(form);
      await fetchBrand();
      await refresh();
      toast.success("تم حفظ هوية اللجنة");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "فشل الحفظ";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const onReset = () => setForm(DEFAULT_BRAND);

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="max-w-xl mx-auto mt-12 text-center p-8 border rounded-xl bg-muted/40">
          <h1 className="text-xl font-bold mb-2">صلاحية المسؤول مطلوبة</h1>
          <p className="text-muted-foreground text-sm">صفحة إعدادات الهوية متاحة للإدارة العليا فقط.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-gold flex items-center justify-center">
              <Building2 className="h-5 w-5 text-gold-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">هوية اللجنة</h1>
              <p className="text-xs text-muted-foreground">الشعار والاسم والألوان — تظهر في رأس النظام وفي تصدير PDF / Excel</p>
            </div>
          </div>
        </div>

        {/* Live preview */}
        <Card className="overflow-hidden border-2" style={{ borderColor: form.gold_color + "55" }}>
          <div
            className="h-2 w-full"
            style={{
              background: `linear-gradient(90deg, ${form.primary_color}, ${form.gold_color}, ${form.primary_color})`,
            }}
          />
          <CardContent className="p-6 flex items-center gap-4">
            <img
              src={brandLogoSrc(form)}
              alt={form.name}
              className="h-16 w-16 rounded-full object-cover ring-2"
              style={{ borderColor: form.gold_color }}
            />
            <div>
              <div className="text-lg font-bold" style={{ color: form.primary_color }}>{form.name || "—"}</div>
              {form.subtitle && <div className="text-xs text-muted-foreground">{form.subtitle}</div>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> الشعار الرسمي</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4">
              <img src={brandLogoSrc(form)} alt="logo" className="h-20 w-20 rounded-xl object-cover ring-1 ring-border" />
              <div className="flex flex-col gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
                />
                <Button onClick={() => fileRef.current?.click()} disabled={uploading} variant="outline">
                  <Upload className="h-4 w-4 ml-1" />
                  {uploading ? "جارٍ الرفع..." : "رفع شعار جديد"}
                </Button>
                {form.logo_url && (
                  <Button variant="ghost" size="sm" onClick={() => set("logo_url", null)}>
                    استخدام الشعار الافتراضي
                  </Button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">يفضّل صورة مربعة بصيغة PNG شفافة، ودقّة لا تقل عن 512×512.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> الاسم والوصف</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="b-name">اسم اللجنة</Label>
              <Input id="b-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-sub">الوصف الفرعي</Label>
              <Input id="b-sub" value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" /> الألوان الرسمية</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>اللون الأساسي (تركوازي)</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.primary_color} onChange={(e) => set("primary_color", e.target.value)} className="h-10 w-14 rounded border" />
                <Input value={form.primary_color} onChange={(e) => set("primary_color", e.target.value)} className="font-mono" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>اللون الذهبي</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.gold_color} onChange={(e) => set("gold_color", e.target.value)} className="h-10 w-14 rounded border" />
                <Input value={form.gold_color} onChange={(e) => set("gold_color", e.target.value)} className="font-mono" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onReset}>
            <RotateCcw className="h-4 w-4 ml-1" /> استعادة الافتراضي
          </Button>
          <Button onClick={onSave} disabled={saving} className="bg-gradient-gold text-gold-foreground">
            <Save className="h-4 w-4 ml-1" />
            {saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}