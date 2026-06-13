import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Upload, ShieldCheck } from "lucide-react";
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
    if (name.length < 2) return toast.error("الرجاء كتابة اسم الممثل");
    if (fam.length < 2) return toast.error("الرجاء اختيار/كتابة الأسرة");
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
      <div dir="rtl" className="min-h-screen flex items-center justify-center p-6 bg-[#F1F8F6]">
        <Card className="max-w-md w-full border-[#1F8A7A]/15 shadow-lg">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-[#1F8A7A] to-[#14655A] flex items-center justify-center shadow-md">
              <CheckCircle2 className="h-9 w-9 text-white" />
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
                className="gap-1 bg-[#1F8A7A] hover:bg-[#14655A] text-white"
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
    <div dir="rtl" className="min-h-screen bg-[#F1F8F6] pb-12">
      {/* Hero — هوية اللجنة (تيل + ذهبي) */}
      <div
        className="relative text-white overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #14655A 0%, #1F8A7A 55%, #1F8A7A 100%)",
        }}
      >
        {/* لمسة ذهبية رفيعة سفلية */}
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-l from-transparent via-[#D4A24C] to-transparent" />
        <div className="max-w-3xl mx-auto px-5 py-7">
          <div className="flex items-center gap-3.5">
            <div className="h-14 w-14 rounded-2xl bg-white p-1.5 shadow-md ring-1 ring-white/20 shrink-0">
              <img
                src="/brand/zawaj-logo.png"
                alt="لجنة الزواج الجماعي"
                className="h-full w-full object-contain"
                loading="eager"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] tracking-wide text-[#F0DDA4] font-semibold">
                لجنة الزواج الجماعي · الإدارة المالية
              </p>
              <h1 className="text-lg md:text-xl font-extrabold leading-tight mt-0.5">
                مساهمات الأسرة للزواج 12 سنة
                <span className="inline-block mx-2 text-[#F0DDA4]">·</span>
                {hijriYear}هـ
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-5">
        <Card className="shadow-xl border-[#1F8A7A]/10 overflow-hidden">
          {/* شريط رفيع علوي بهوية اللجنة */}
          <div className="h-1 bg-gradient-to-l from-[#D4A24C] via-[#1F8A7A] to-[#D4A24C]" />
          <CardContent className="p-5 md:p-6 space-y-5">
            {/* تعليمات مختصرة */}
            <p className="text-[13px] text-muted-foreground leading-7 border-r-2 border-[#D4A24C] pr-3">
              مرحباً بممثل الأسرة. يُرجى إدخال البيانات وتفاصيل المساهمين، أو إرفاق
              كشف للتحليل الآلي. تُوجَّه البيانات مباشرةً للإدارة المالية.
            </p>

            {/* Delegate */}
            <section className="space-y-3">
              <SectionHeader icon={Users2} title="بيانات الممثل" />
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">اسم الممثل *</Label>
                  <Input
                    value={delegateName}
                    onChange={(e) => setDelegateName(e.target.value)}
                    placeholder="الاسم الكامل"
                    maxLength={120}
                    className="mt-1 h-10"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs text-muted-foreground">الأسرة *</Label>
                    <button
                      type="button"
                      className="text-[11px] text-[#1F8A7A] hover:text-[#14655A] font-semibold hover:underline"
                      onClick={() => {
                        const next = !customBranch;
                        setCustomBranch(next);
                        setBranch(next ? "" : FAMILY_BRANCHES[0]);
                      }}
                    >
                      {customBranch ? "اختر من القائمة" : "إضافة أسرة جديدة"}
                    </button>
                  </div>
                  {customBranch ? (
                    <Input
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="اكتب اسم الأسرة"
                      maxLength={80}
                      className="h-10"
                    />
                  ) : (
                    <Select value={branch} onValueChange={setBranch}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FAMILY_BRANCHES.map((b) => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[#D4A24C]" />
                السنة الهجرية: <b className="text-foreground">{hijriYear}هـ</b>
              </div>
            </section>

            {/* Contributors */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <SectionHeader icon={Coins} title="قائمة المساهمين" accent="gold" />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addRow}
                  className="gap-1 border-[#1F8A7A]/30 text-[#1F8A7A] hover:bg-[#1F8A7A]/5"
                >
                  <Plus className="h-4 w-4" /> إضافة مساهم
                </Button>
              </div>

              {/* Smart AI analysis */}
              <div
                className="rounded-xl border bg-white p-3.5 flex items-center gap-3 relative overflow-hidden"
                style={{
                  borderColor: "rgba(27,79,88,0.18)",
                  boxShadow: "inset 0 0 0 1px rgba(196,162,92,0.08)",
                }}
              >
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#1F8A7A] to-[#14655A] text-[#F0DDA4] flex items-center justify-center shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-[#14655A] leading-tight">
                    التحليل الذكي للكشوفات
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    ارفع كشفاً (صورة / PDF / نص) ليتم استخراج الأسماء والمبالغ تلقائياً.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={analyzing}
                  className="gap-1.5 bg-[#1F8A7A] hover:bg-[#14655A] text-white shrink-0"
                >
                  {analyzing ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحليل…</>
                  ) : (
                    <><Upload className="h-4 w-4" /> رفع كشف</>
                  )}
                </Button>
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

              <div className="space-y-2">
                {rows.map((row, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-[#1F8A7A]/10 bg-white p-2.5 grid md:grid-cols-12 gap-2 items-center hover:border-[#1F8A7A]/25 transition"
                  >
                    <div className="md:col-span-1 flex md:justify-center">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#1F8A7A]/8 text-[#1F8A7A] text-[11px] font-bold">
                        {i + 1}
                      </span>
                    </div>
                    <div className="md:col-span-5">
                      <Input
                        value={row.full_name}
                        onChange={(e) => updateRow(i, { full_name: e.target.value })}
                        placeholder="اسم المساهم الكامل"
                        maxLength={120}
                        className="h-9 border-transparent bg-[#F1F8F6] focus-visible:bg-white focus-visible:border-[#1F8A7A]/40"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Select
                        value={String(row.amount)}
                        onValueChange={(v) => updateRow(i, { amount: Number(v) })}
                      >
                        <SelectTrigger className="h-9 border-transparent bg-[#F1F8F6] focus:bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AMOUNT_OPTIONS.map((a) => (
                            <SelectItem key={a} value={String(a)}>{fmt(a)} ر.س</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Input
                        value={row.notes}
                        onChange={(e) => updateRow(i, { notes: e.target.value })}
                        placeholder="ملاحظات"
                        maxLength={120}
                        className="h-9 border-transparent bg-[#F1F8F6] focus-visible:bg-white focus-visible:border-[#1F8A7A]/40"
                      />
                    </div>
                    <div className="md:col-span-1 flex md:justify-center">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeRow(i)}
                        disabled={rows.length === 1}
                        title="حذف"
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4 text-rose-500/80" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="flex items-center justify-between rounded-xl px-4 py-3 text-white"
                style={{ background: "linear-gradient(135deg, #1F8A7A 0%, #14655A 100%)" }}
              >
                <span className="text-[13px] font-semibold inline-flex items-center gap-2">
                  <Users2 className="h-4 w-4 text-[#F0DDA4]" />
                  الإجمالي · {rows.length} مساهم
                </span>
                <span className="text-lg font-extrabold tracking-tight text-[#F0DDA4]">
                  {fmt(total)} <span className="text-xs text-white/80 font-semibold">ر.س</span>
                </span>
              </div>
            </section>

            <div className="flex flex-col gap-2 pt-1">
              <Button
                size="lg"
                onClick={handleSubmit}
                disabled={submitting}
                className="gap-2 h-12 text-[15px] font-bold bg-[#1F8A7A] hover:bg-[#14655A] text-white shadow-md"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> جارٍ الإرسال…</>
                ) : (
                  <><Send className="h-4 w-4" /> إرسال القائمة للإدارة المالية</>
                )}
              </Button>
              <p className="text-[11px] text-center text-muted-foreground inline-flex items-center justify-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-[#1F8A7A]" />
                بإرسالك القائمة فأنت تُقرّ بصحة البيانات — تصل مباشرةً للإدارة المالية للتدقيق.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* فوتر مختصر بهوية اللجنة */}
        <p className="text-center text-[11px] text-muted-foreground mt-4">
          © لجنة الزواج الجماعي · {hijriYear}هـ
        </p>
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  accent = "teal",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  accent?: "teal" | "gold";
}) {
  const bg = accent === "gold" ? "bg-[#D4A24C]/12 text-[#8A6B23]" : "bg-[#1F8A7A]/10 text-[#1F8A7A]";
  return (
    <div className="flex items-center gap-2">
      <span className={`h-7 w-7 rounded-lg flex items-center justify-center ${bg}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <h2 className="font-bold text-[14px] text-[#14655A]">{title}</h2>
    </div>
  );
}

export const Route = createFileRoute("/contribute-shares/$year")({
  component: ContributeSharesPage,
  head: ({ params }) => {
    const y = params.year;
    const canonicalUrl = `https://lajnat-zawaj.org/contribute-shares/${y}`;
    const ogUrl = "https://lajnat-zawaj.org/brand/zawaj-logo.png";
    const title = `مساهمات الأسرة — الزواج الجماعي ${y}هـ`;
    const description = `دعوة لممثل الأسرة لتسجيل أسماء ومبالغ المساهمين من العائلة في الزواج الجماعي للسنة ${y}هـ. النموذج رسمي يصل مباشرةً للإدارة المالية في لجنة الزواج الجماعي.`;
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