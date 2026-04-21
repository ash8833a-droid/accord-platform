import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface UrgentAlertValue {
  enabled: boolean;
  label: string;
}

const DEFAULT_VALUE: UrgentAlertValue = { enabled: true, label: "عاجل" };

export function UrgentAlertSettings({ isAdmin }: { isAdmin: boolean }) {
  const [value, setValue] = useState<UrgentAlertValue>(DEFAULT_VALUE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("app_settings" as any)
      .select("value")
      .eq("key", "urgent_alert")
      .maybeSingle()
      .then(({ data }) => {
        if (data && (data as any).value) {
          setValue({ ...DEFAULT_VALUE, ...((data as any).value as UrgentAlertValue) });
        }
        setLoading(false);
      });
  }, []);

  const save = async () => {
    if (!value.label.trim()) {
      toast.error("لا يمكن أن يكون النص فارغاً");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("app_settings" as any)
      .upsert(
        { key: "urgent_alert", value: value as any, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    setSaving(false);
    if (error) return toast.error("تعذّر الحفظ", { description: error.message });
    toast.success("تم حفظ الإعداد");
  };

  if (!isAdmin) {
    return (
      <div className="rounded-xl border bg-muted/30 p-6 text-center text-muted-foreground text-sm">
        هذه الإعدادات متاحة فقط لمدير النظام.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="rounded-2xl border bg-card p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-destructive/10 border border-destructive/30 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-bold text-base">تنبيه المهمة العاجلة</h3>
            <p className="text-xs text-muted-foreground mt-1">
              يظهر هذا التنبيه على أول مهمة في صفحة كل لجنة. يمكنك إيقافه أو تعديل نصه بدون تغيير الكود.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-4">
          <div>
            <Label className="font-semibold">تفعيل التنبيه</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              عند الإيقاف لن يظهر التنبيه لأي مستخدم.
            </p>
          </div>
          <Switch
            checked={value.enabled}
            onCheckedChange={(v) => setValue((prev) => ({ ...prev, enabled: v }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="urgent-label" className="font-semibold">نص التنبيه</Label>
          <Input
            id="urgent-label"
            value={value.label}
            onChange={(e) => setValue((prev) => ({ ...prev, label: e.target.value }))}
            placeholder="عاجل"
            maxLength={50}
          />
          <p className="text-[11px] text-muted-foreground">
            مثال: عاجل، أولوية قصوى، للتنفيذ اليوم…
          </p>
        </div>

        {/* معاينة */}
        <div className="rounded-xl border border-dashed p-4 bg-background">
          <p className="text-xs text-muted-foreground mb-2">معاينة:</p>
          {value.enabled ? (
            <div className="inline-flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-2.5 py-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
              </span>
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              <span className="text-[11px] font-bold text-destructive">{value.label || "عاجل"}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">التنبيه موقوف حالياً.</span>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            حفظ الإعدادات
          </Button>
        </div>
      </div>
    </div>
  );
}