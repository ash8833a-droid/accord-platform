import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { HeartHandshake, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2,
  Coins,
  Plus,
  Trash2,
  Users2,
  Send,
  Calendar,
  Home,
  Loader2,
} from "lucide-react";
import { FAMILY_BRANCHES, AMOUNT_OPTIONS } from "@/lib/family-branches";
import { submitFamilyShares } from "@/lib/public-shares.functions";
import { analyzeContributionsFile } from "@/lib/analyze-contributions.functions";

interface ContribRow {
  full_name: string;
  amount: number;
  notes: string;
}

const emptyRow = (): ContribRow => ({ full_name: "", amount: 300, notes: "" });
const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(n);

function ContributeSharesPage() {
  const { year } = Route.useParams();
  const hijriYear = Number(year);
  const validYear = Number.isFinite(hijriYear) && hijriYear >= 1300 && hijriYear <= 1600;

  const submit = useServerFn(submitFamilyShares);
  const analyze = useServerFn(analyzeContributionsFile);

  const [delegateName, setDelegateName] = useState("");
  const [branch, setBranch] = useState<string>(FAMILY_BRANCHES[0]);
  const [customBranch, setCustomBranch] = useState(false);
  const [rows, setRows] = useState<ContribRow[]>([emptyRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ count: number } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const total = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [rows],
  );

  const addRow = () => setRows((r) => [...r, emptyRow()]);
  const removeRow = (i: number) =>
    setRows((r) => (r.length === 1 ? r : r.filter((_, idx) => idx !== i)));
  const updateRow = (i: number, patch: Partial<ContribRow>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const idx = result.indexOf(",");
        resolve(idx >= 0 ? result.slice(idx + 1) : result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleSmartAnalyze = async (file: File) => {
    if (!file) return;
    const maxBytes = 12 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error("حجم الملف كبير جداً. الحد الأقصى 12 ميجابايت.");
      return;
    }
    setAnalyzing(true);
    const t = toast.loading("جارٍ التحليل الذكي للملف…");
    try {
      const base64 = await fileToBase64(file);
      const res = await analyze({
        data: {
          fileBase64: base64,
          mimeType: file.type || "application/octet-stream",
          defaultAmount: 300,
        },
      });
      if (!res.rows.length) {
        toast.error("لم يتم العثور على أسماء واضحة. حاول بصورة أو ملف أوضح.", { id: t });
        return;
      }
      // استبدال الصفوف بالنتائج المستخرجة
      const extracted: ContribRow[] = res.rows.map((r) => {
        // نقرّب المبلغ لأقرب خيار من القائمة
        const closest = AMOUNT_OPTIONS.reduce((p, c) =>
          Math.abs(c - r.amount) < Math.abs(p - r.amount) ? c : p,
        );
        return {
          full_name: r.full_name,
          amount: closest,
          notes: r.notes || "",
        };
      });
      setRows(extracted);
      toast.success(`تم استخراج ${res.count} مساهماً. يمكنك المراجعة قبل الإرسال.`, { id: t });
    } catch (e) {
      toast.error((e as Error).message || "فشل التحليل الذكي", { id: t });
    } finally {
      setAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!validYear) return;
    const name = delegateName.trim();
    const fam = branch.trim();
    if (name.length < 2) return toast.error("الرجاء كتابة اسم المندوب");
    if (fam.length < 2) return toast.error("الرجاء اختيار/كتابة الفرع العائلي");
    const cleaned = rows
      .map((r) => ({
        full_name: r.full_name.trim(),
        amount: Number(r.amount) || 0,
        notes: r.notes.trim() || null,
      }))
      .filter((r) => r.full_name.length >= 2 && r.amount > 0);
    if (cleaned.length === 0) {
      return toast.error("أضف مساهماً واحداً على الأقل باسم ومبلغ صحيح");
    }
    setSubmitting(true);
    try {
      const res = await submit({
        data: {
          hijri_year: hijriYear,
          delegate_name: name,
          family_branch: fam,
          contributors: cleaned,
        },
      });
      setDone({ count: res.inserted });
      toast.success(`تم تسجيل ${res.inserted} مساهم بنجاح`);
    } catch (e) {
      toast.error((e as Error).message || "حدث خطأ، حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  };

  if (!validYear) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-3">
            <h1 className="text-xl font-bold">رابط غير صالح</h1>
            <p className="text-sm text-muted-foreground">السنة الهجرية غير صحيحة في الرابط.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <Card className="max-w-md w-full border-emerald-200">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-extrabold">جزاكم الله خيراً</h1>
            <p className="text-sm text-muted-foreground leading-7">
              تم تسجيل <b className="text-foreground">{fmt(done.count)}</b> مساهماً من فرع
              <b className="text-foreground mx-1">{branch}</b>
              للسنة الهجرية <b className="text-foreground">{hijriYear}هـ</b>،
              وستظهر مباشرةً في سجل الإدارة المالية.
            </p>
            <div className="flex gap-2 justify-center pt-2">
              <Button
                onClick={() => {
                  setDone(null);
                  setRows([emptyRow()]);
                  setDelegateName("");
                }}
                className="gap-1"
              >
                <Plus className="h-4 w-4" /> إضافة قائمة جديدة
              </Button>
              <Link to="/">
                <Button variant="outline" className="gap-1">
                  <Home className="h-4 w-4" /> الرئيسية
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-muted/30 to-background pb-12">
      {/* Hero */}
      <div className="bg-gradient-to-l from-emerald-700 via-emerald-600 to-teal-600 text-white">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
              <HeartHandshake className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="text-xs opacity-85">لجنة الزواج الجماعي · الإدارة المالية</p>
              <h1 className="text-xl md:text-2xl font-extrabold">
                تسجيل مساهمات الفرع للزواج الـ12 — {hijriYear}هـ
              </h1>
            </div>
          </div>
          <p className="text-sm opacity-90 mt-3 leading-7">
            مرحباً بمندوب الفرع — يُرجى كتابة اسمك واختيار الفرع العائلي، ثم إضافة
            أسماء المساهمين من عائلتك مع مبلغ كل واحد. الإرسال يصل مباشرةً للإدارة
            المالية ويظهر في سجل أسهم الفروع.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-6">
        <Card className="shadow-elegant">
          <CardContent className="p-5 md:p-6 space-y-6">
            {/* Delegate */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Users2 className="h-4 w-4 text-emerald-600" />
                <h2 className="font-bold">بيانات المندوب</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label>اسم المندوب *</Label>
                  <Input
                    value={delegateName}
                    onChange={(e) => setDelegateName(e.target.value)}
                    placeholder="الاسم الكامل"
                    maxLength={120}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label>الفرع العائلي *</Label>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => {
                        const next = !customBranch;
                        setCustomBranch(next);
                        setBranch(next ? "" : FAMILY_BRANCHES[0]);
                      }}
                    >
                      {customBranch ? "اختر من القائمة" : "إضافة فرع جديد"}
                    </button>
                  </div>
                  {customBranch ? (
                    <Input
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="اكتب اسم الفرع"
                      maxLength={80}
                    />
                  ) : (
                    <Select value={branch} onValueChange={setBranch}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FAMILY_BRANCHES.map((b) => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                السنة الهجرية: <b className="text-foreground">{hijriYear}هـ</b>
              </div>
            </section>

            {/* Contributors */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-amber-600" />
                  <h2 className="font-bold">قائمة المساهمين</h2>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addRow} className="gap-1">
                  <Plus className="h-4 w-4" /> إضافة مساهم
                </Button>
              </div>

              {/* Smart AI analysis */}
              <div className="rounded-2xl border-2 border-dashed border-emerald-300 bg-gradient-to-l from-emerald-50 via-teal-50 to-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div>
                      <h3 className="font-bold text-emerald-900">التحليل الذكي ✨</h3>
                      <p className="text-xs text-emerald-900/80 leading-6">
                        ارفع صورة كشف الأسماء أو ملف (PDF / صورة / نص)، وسيقوم النظام بقراءة
                        الأسماء والمبالغ تلقائياً وتعبئتها في القائمة، ثم تستطيع المراجعة قبل الإرسال.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={analyzing}
                        className="gap-1 bg-gradient-to-l from-emerald-700 to-teal-600 text-white"
                      >
                        {analyzing ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحليل…</>
                        ) : (
                          <><Upload className="h-4 w-4" /> اختر صورة أو ملف</>
                        )}
                      </Button>
                      <span className="text-[11px] text-emerald-900/70 self-center">
                        يدعم: صور (JPG/PNG)، PDF، نص. الحد 12MB.
                      </span>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,application/pdf,text/plain,.txt,.csv"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleSmartAnalyze(f);
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {rows.map((row, i) => (
                  <div
                    key={i}
                    className="rounded-xl border bg-muted/30 p-3 grid md:grid-cols-12 gap-2 items-start"
                  >
                    <div className="md:col-span-1 text-sm font-bold text-muted-foreground pt-2 text-center">
                      #{i + 1}
                    </div>
                    <div className="md:col-span-5">
                      <Label className="text-xs">اسم المساهم</Label>
                      <Input
                        value={row.full_name}
                        onChange={(e) => updateRow(i, { full_name: e.target.value })}
                        placeholder="الاسم الكامل"
                        maxLength={120}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Label className="text-xs">المبلغ (ر.س)</Label>
                      <Select
                        value={String(row.amount)}
                        onValueChange={(v) => updateRow(i, { amount: Number(v) })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AMOUNT_OPTIONS.map((a) => (
                            <SelectItem key={a} value={String(a)}>{fmt(a)} ر.س</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs">ملاحظات</Label>
                      <Input
                        value={row.notes}
                        onChange={(e) => updateRow(i, { notes: e.target.value })}
                        placeholder="اختياري"
                        maxLength={120}
                      />
                    </div>
                    <div className="md:col-span-1 flex md:justify-center md:pt-6">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeRow(i)}
                        disabled={rows.length === 1}
                        title="حذف"
                      >
                        <Trash2 className="h-4 w-4 text-rose-600" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50 px-4 py-3">
                <span className="text-sm font-bold text-emerald-900">
                  الإجمالي: {rows.length} مساهم
                </span>
                <span className="text-base font-extrabold text-emerald-900">
                  {fmt(total)} ر.س
                </span>
              </div>
            </section>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                size="lg"
                onClick={handleSubmit}
                disabled={submitting}
                className="gap-2 bg-gradient-to-l from-emerald-700 to-teal-600 text-white"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> جارٍ الإرسال…</>
                ) : (
                  <><Send className="h-4 w-4" /> إرسال القائمة للإدارة المالية</>
                )}
              </Button>
              <p className="text-[11px] text-center text-muted-foreground">
                بإرسالك القائمة فأنت تُقرّ بصحة البيانات. ستصل مباشرةً للإدارة المالية للتدقيق.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/contribute-shares/$year")({
  component: ContributeSharesPage,
  head: ({ params }) => {
    const y = params.year;
    const canonicalUrl = `https://lajnat-zawaj.org/contribute-shares/${y}`;
    const ogUrl = "https://lajnat-zawaj.org/brand/zawaj-logo.png";
    const title = `مساهمات الفرع — الزواج الجماعي ${y}هـ`;
    const description = `دعوة لمندوب الفرع لتسجيل أسماء ومبالغ المساهمين من العائلة في الزواج الجماعي للسنة ${y}هـ. النموذج رسمي يصل مباشرةً للإدارة المالية في لجنة الزواج الجماعي.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "theme-color", content: "#0D7C66" },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonicalUrl },
        { property: "og:site_name", content: "لجنة الزواج الجماعي" },
        { property: "og:locale", content: "ar_SA" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:image", content: ogUrl },
        { property: "og:image:secure_url", content: ogUrl },
        { property: "og:image:type", content: "image/png" },
        { property: "og:image:width", content: "512" },
        { property: "og:image:height", content: "512" },
        { property: "og:image:alt", content: "شعار لجنة الزواج الجماعي" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: ogUrl },
      ],
      links: [{ rel: "canonical", href: canonicalUrl }],
    };
  },
  errorComponent: ({ error }) => (
    <div dir="rtl" className="min-h-screen flex items-center justify-center p-6">
      <p className="text-destructive">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div dir="rtl" className="min-h-screen flex items-center justify-center p-6">
      <p>الصفحة غير موجودة</p>
    </div>
  ),
});