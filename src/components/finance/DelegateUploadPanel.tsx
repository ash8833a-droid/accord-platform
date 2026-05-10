import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Upload, Loader2, CheckCircle2, X, FileScan, Wand2 } from "lucide-react";

interface PreviewRow {
  donor_name: string;
  amount: number;
  contribution_date: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function DelegateUploadPanel({ onSaved }: { onSaved?: () => void }) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [defaultDate, setDefaultDate] = useState<string>(today);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);

  const extract = async () => {
    if (!file) return;
    setExtracting(true);
    setRows(null);
    try {
      const fileBase64 = await fileToBase64(file);
      const mimeType = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
      toast.info("جارٍ استخراج البيانات بالذكاء الاصطناعي... قد يستغرق 30–60 ثانية");
      const { data, error } = await supabase.functions.invoke("extract-contributions", {
        body: { fileBase64, mimeType, defaultDate },
      });
      if (error) { toast.error("فشل الاستخراج: " + error.message); return; }
      if (data?.error) { toast.error(data.error); return; }
      const extracted = (data?.rows ?? []) as PreviewRow[];
      if (extracted.length === 0) { toast.warning("لم يتم العثور على مساهمات في الملف"); return; }
      setRows(extracted);
      toast.success(`تم استخراج ${extracted.length} مساهمة — راجعها ثم اضغط حفظ الكل`);
    } catch (e) {
      toast.error("خطأ غير متوقع: " + (e as Error).message);
    } finally {
      setExtracting(false);
    }
  };

  const save = async () => {
    if (!rows || rows.length === 0) return;
    setSaving(true);
    const payload = rows
      .filter((r) => r.donor_name.trim() && r.amount > 0)
      .map((r) => ({
        donor_name: r.donor_name.trim(),
        amount: r.amount,
        contribution_date: r.contribution_date || today,
        recorded_by: user?.id ?? null,
      }));
    const { error } = await supabase.from("family_contributions").insert(payload);
    setSaving(false);
    if (error) { toast.error("تعذّر الحفظ: " + error.message); return; }
    toast.success(`تم حفظ ${payload.length} مساهمة في السجل المالي`);
    setRows(null); setFile(null);
    onSaved?.();
  };

  const updateRow = (i: number, patch: Partial<PreviewRow>) => {
    setRows((prev) => prev ? prev.map((r, idx) => idx === i ? { ...r, ...patch } : r) : prev);
  };
  const removeRow = (i: number) => {
    setRows((prev) => prev ? prev.filter((_, idx) => idx !== i) : prev);
  };

  const total = rows?.reduce((s, r) => s + Number(r.amount || 0), 0) ?? 0;
  const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(n);

  return (
    <Card dir="rtl" className="border-primary/20 overflow-hidden">
      <div className="px-5 py-4 border-b bg-gradient-to-l from-primary/8 via-primary/3 to-transparent">
        <h3 className="font-bold flex items-center gap-2 text-primary">
          <FileScan className="h-5 w-5" /> بوابة المناديب — استخراج تلقائي
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          ارفع كشف المساهمات (PDF أو صورة)، وسيقوم النظام بقراءة الأسماء والمبالغ والتواريخ تلقائياً ثم إضافتها لسجل مساهمات أفراد القبيلة بعد مراجعتك.
        </p>
      </div>
      <CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs">الملف (PDF / JPG / PNG)</Label>
            <Input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRows(null); }}
              disabled={extracting || saving}
            />
          </div>
          <div>
            <Label className="text-xs">التاريخ الافتراضي إن لم يُذكر</Label>
            <Input type="date" value={defaultDate} onChange={(e) => setDefaultDate(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={extract} disabled={!file || extracting || saving} className="gap-2 bg-gradient-hero text-primary-foreground">
            {extracting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> جارٍ الاستخراج...</>
              : <><Wand2 className="h-4 w-4" /> ارفع واستخرج بالذكاء الاصطناعي</>}
          </Button>
        </div>

        {rows && rows.length > 0 && (
          <div className="border rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/40 flex items-center justify-between text-xs">
              <span className="font-semibold flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {rows.length} مساهمة جاهزة للمراجعة · إجمالي: <span className="tabular-nums">{fmt(total)} ر.س</span>
              </span>
              <Button onClick={save} disabled={saving} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                اعتماد وحفظ الكل
              </Button>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/20 text-muted-foreground sticky top-0">
                  <tr className="text-right">
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">اسم المساهم</th>
                    <th className="px-3 py-2 font-medium w-28">المبلغ (ر.س)</th>
                    <th className="px-3 py-2 font-medium w-40">التاريخ</th>
                    <th className="px-3 py-2 font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t hover:bg-muted/10">
                      <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-2 py-1.5">
                        <Input value={r.donor_name} onChange={(e) => updateRow(i, { donor_name: e.target.value })} className="h-8" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input type="number" min={1} value={r.amount}
                          onChange={(e) => updateRow(i, { amount: Number(e.target.value) || 0 })} className="h-8 tabular-nums" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input type="date" value={r.contribution_date}
                          onChange={(e) => updateRow(i, { contribution_date: e.target.value })} className="h-8" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Button variant="ghost" size="icon" onClick={() => removeRow(i)} className="h-7 w-7 text-rose-600">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}