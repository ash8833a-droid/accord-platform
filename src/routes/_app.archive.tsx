import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilePreview } from "@/components/FilePreview";
import { ACCEPT_ANY_FILE, MAX_UPLOAD_SIZE, MAX_UPLOAD_SIZE_LABEL, safeStorageKey } from "@/lib/uploads";
import { toast } from "sonner";
import {
  Archive, Upload, Loader2, Eye, Download, Trash2, Image as ImageIcon,
  Camera, Megaphone, CalendarRange, Wallet, Sparkles, FileText, Plus, History, Wand2,
  CheckCircle2, AlertCircle, Layers,
} from "lucide-react";
import { analyzeArchiveFile, type ArchiveAnalysis } from "@/lib/analyze-archive-file.functions";

export const Route = createFileRoute("/_app/archive")({
  component: ArchivePage,
});

type Category = "grooms" | "media" | "programs" | "finance" | "organization";

interface ArchiveItem {
  id: string;
  wedding_year: number;
  category: Category;
  title: string;
  description: string | null;
  file_url: string | null;
  file_type: string | null;
  file_size: number | null;
  created_by: string | null;
  created_at: string;
}

// السنوات الهجرية الموثّقة — أول زواج جماعي للجنة كان عام 1434هـ
const FIRST_HIJRI_YEAR = 1434;
const LAST_HIJRI_YEAR = 1446; // آخر سنة هجرية مكتملة (نحن الآن في 1447هـ)
const ARCHIVE_YEARS = Array.from(
  { length: LAST_HIJRI_YEAR - FIRST_HIJRI_YEAR + 1 },
  (_, i) => LAST_HIJRI_YEAR - i,
); // 1446..1434
const YEARS_COUNT = ARCHIVE_YEARS.length;

const CATEGORIES: { key: Category; label: string; icon: typeof Camera; color: string; gradient: string; description: string }[] = [
  { key: "grooms",       label: "صور العرسان",            icon: Camera,        color: "text-rose-600",    gradient: "from-rose-500 to-pink-600",     description: "ألبومات وصور العرسان من حفلات الزواج السابقة" },
  { key: "media",        label: "الجانب الإعلامي",        icon: Megaphone,     color: "text-sky-600",     gradient: "from-sky-500 to-indigo-600",    description: "تغطيات إعلامية، فيديوهات، نشرات، تصاميم وبوسترات" },
  { key: "programs",     label: "البرامج والفقرات",       icon: CalendarRange, color: "text-amber-600",   gradient: "from-amber-500 to-orange-600",  description: "أجندة الحفل، الفقرات، الكلمات، البرامج المصاحبة" },
  { key: "finance",      label: "الجانب المالي",          icon: Wallet,        color: "text-emerald-600", gradient: "from-emerald-500 to-teal-600",  description: "ميزانيات، تقارير صرف، مساهمات، ختامات مالية" },
  { key: "organization", label: "الخطط",                    icon: Sparkles,      color: "text-fuchsia-600", gradient: "from-fuchsia-500 to-purple-600", description: "جميع خطط التنظيم والتشغيل، الدروس المستفادة، المقترحات والتطوير" },
];

function ArchivePage() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [year, setYear] = useState<number>(ARCHIVE_YEARS[0]);
  const [category, setCategory] = useState<Category | "all">("all");
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string; type: string; path: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("wedding_archive_items")
      .select("*")
      .eq("wedding_year", year)
      .order("created_at", { ascending: false });
    if (error) toast.error("تعذر تحميل الأرشيف", { description: error.message });
    setItems((data ?? []) as ArchiveItem[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [year]);

  const filtered = useMemo(
    () => (category === "all" ? items : items.filter((i) => i.category === category)),
    [items, category]
  );

  const countByCat = (c: Category) => items.filter((i) => i.category === c).length;

  const openItem = async (it: ArchiveItem) => {
    if (!it.file_url) return;
    const { data, error } = await supabase.storage.from("wedding-archive").createSignedUrl(it.file_url, 60 * 30);
    if (error || !data?.signedUrl) return toast.error("تعذر الفتح", { description: error?.message });
    setPreview({ url: data.signedUrl, name: it.title, type: it.file_type ?? "", path: it.file_url });
  };

  const downloadItem = async (it: ArchiveItem) => {
    if (!it.file_url) return;
    const { data, error } = await supabase.storage.from("wedding-archive").download(it.file_url);
    if (error || !data) return toast.error("تعذر التحميل", { description: error?.message });
    const url = URL.createObjectURL(data);
    const ext = it.file_url.split(".").pop() || "";
    const safe = it.title.replace(/[^\p{L}\p{N} _-]/gu, "");
    const a = document.createElement("a");
    a.href = url;
    a.download = ext ? `${safe}.${ext}` : safe;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const removeItem = async (it: ArchiveItem) => {
    if (!confirm(`حذف "${it.title}" من أرشيف ${it.wedding_year}هـ؟`)) return;
    if (it.file_url) await supabase.storage.from("wedding-archive").remove([it.file_url]);
    const { error } = await supabase.from("wedding_archive_items").delete().eq("id", it.id);
    if (error) return toast.error("تعذر الحذف", { description: error.message });
    toast.success("تم الحذف");
    load();
  };

  const isImg = (t: string | null) => !!t && t.startsWith("image/");

  return (
    <div className="space-y-8">
      {/* Inspiring hero */}
      <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary via-primary/90 to-gold p-8 text-primary-foreground shadow-elegant">
        <div className="absolute -top-16 -left-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-gold/30 blur-3xl" />
        <div className="relative flex items-start gap-5 flex-wrap">
          <div className="h-16 w-16 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
            <History className="h-8 w-8" />
          </div>
          <div className="flex-1 min-w-[260px]">
            <h1 className="text-3xl font-extrabold leading-tight">أرشيف الزواجات السابقة</h1>
            <p className="text-sm text-primary-foreground/85 mt-2 max-w-2xl leading-relaxed">
              ذاكرة اللجنة الموثّقة عبر السنين — صور العرسان، التغطيات الإعلامية، البرامج والفقرات،
              المالية، والتنظيم والمقترحات. أرشيف شامل وقابل للحفظ يستلهم منه القادمون ويبني عليه المطوّرون.
            </p>
            <div className="flex items-center gap-2 mt-4 flex-wrap text-xs">
              <Badge className="bg-white/20 text-primary-foreground border-0 backdrop-blur">{YEARS_COUNT} سنة موثّقة</Badge>
              <Badge className="bg-white/20 text-primary-foreground border-0 backdrop-blur">5 جوانب رئيسية</Badge>
              <Badge className="bg-gold/30 text-primary-foreground border-0 backdrop-blur">{FIRST_HIJRI_YEAR}هـ — {LAST_HIJRI_YEAR}هـ</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Year strip */}
      <div className="rounded-2xl border bg-card p-4 shadow-soft">
        <div className="flex items-center gap-2 mb-3">
          <Archive className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold">اختر السنة</h2>
          <span className="text-[11px] text-muted-foreground">من 1434هـ حتى 1446هـ</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {ARCHIVE_YEARS.map((y) => {
            const active = y === year;
            return (
              <button
                key={y}
                onClick={() => { setYear(y); setCategory("all"); }}
                className={`px-4 py-2.5 rounded-xl border text-sm font-bold transition ${
                  active
                    ? "bg-gradient-gold text-gold-foreground shadow-gold border-transparent scale-105"
                    : "bg-card hover:border-gold hover:shadow-gold hover:-translate-y-0.5"
                }`}
              >
                {y}هـ
              </button>
            );
          })}
        </div>
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <button
          onClick={() => setCategory("all")}
          className={`rounded-2xl border p-4 text-right transition ${
            category === "all" ? "border-primary bg-primary/5 shadow-elegant" : "bg-card hover:border-primary/40"
          }`}
        >
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-gold text-white flex items-center justify-center mb-2">
            <LayoutAll />
          </div>
          <p className="font-bold text-sm">الكل</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{items.length} عنصر</p>
        </button>
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const active = category === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`rounded-2xl border p-4 text-right transition ${
                active ? "border-primary bg-primary/5 shadow-elegant" : "bg-card hover:border-primary/40"
              }`}
            >
              <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${c.gradient} text-white flex items-center justify-center mb-2`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="font-bold text-sm">{c.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{countByCat(c.key)} عنصر</p>
            </button>
          );
        })}
      </div>

      {/* Add panel */}
      {user && (
        <div className="grid md:grid-cols-2 gap-3">
          <SmartDistributePanel year={year} onSaved={load} userId={user.id} />
          <UploadPanel
            year={year}
            defaultCategory={category === "all" ? "grooms" : category}
            onSaved={load}
            userId={user.id}
          />
        </div>
      )}

      {/* Items list */}
      <div className="rounded-2xl border bg-card shadow-soft overflow-hidden">
        <div className="px-6 py-4 border-b bg-gradient-to-l from-primary/5 to-transparent flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-primary" />
            <h2 className="font-bold">أرشيف {year}هـ</h2>
            <Badge variant="outline" className="text-[10px]">{filtered.length} عنصر</Badge>
            {category !== "all" && (
              <Badge className="text-[10px]">{CATEGORIES.find((c) => c.key === category)?.label}</Badge>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center text-muted-foreground gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> جاري التحميل...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <Archive className="h-12 w-12 mx-auto opacity-30 mb-3" />
            لا توجد عناصر في هذا التصنيف لعام {year}هـ.<br />
            ابدأ بإضافة أول ملف ليبدأ التوثيق.
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map((it) => {
              const cat = CATEGORIES.find((c) => c.key === it.category)!;
              const Icon = cat.icon;
              return (
                <li key={it.id} className="px-6 py-4 flex items-center gap-4 hover:bg-muted/20 transition flex-wrap">
                  <span className={`h-11 w-11 rounded-xl bg-gradient-to-br ${cat.gradient} text-white flex items-center justify-center shrink-0`}>
                    {isImg(it.file_type) ? <ImageIcon className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{it.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{cat.label}</Badge>
                      <span>{new Date(it.created_at).toLocaleDateString("ar-SA")}</span>
                      {it.description && <><span>·</span><span className="truncate max-w-[320px]">{it.description}</span></>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {it.file_url && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openItem(it)}>
                          <Eye className="h-3.5 w-3.5 ms-1" /> معاينة
                        </Button>
                        <Button size="sm" className="bg-gradient-gold text-gold-foreground" onClick={() => downloadItem(it)}>
                          <Download className="h-3.5 w-3.5 ms-1" /> تحميل
                        </Button>
                      </>
                    )}
                    {(isAdmin || it.created_by === user?.id) && (
                      <Button size="sm" variant="ghost" onClick={() => removeItem(it)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent dir="rtl" className="max-w-5xl w-[95vw] h-[88vh] p-0 overflow-hidden flex flex-col">
          <DialogTitle className="sr-only">{preview?.name ?? "معاينة"}</DialogTitle>
          {preview && (
            <FilePreview
              url={preview.url}
              name={preview.name}
              type={preview.type}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LayoutAll() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function UploadPanel({
  year, defaultCategory, onSaved, userId,
}: { year: number; defaultCategory: Category; onSaved: () => void; userId: string }) {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<Category>(defaultCategory);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ArchiveAnalysis | null>(null);
  const analyzeFn = useServerFn(analyzeArchiveFile);

  useEffect(() => { setCat(defaultCategory); }, [defaultCategory]);

  const resetForm = () => {
    setTitle(""); setDesc(""); setFile(null);
    setUploadedPath(null); setAnalysis(null);
  };

  // If user replaces the picked file, drop any previous upload reference.
  const onPickFile = (f: File | null) => {
    setFile(f);
    setUploadedPath(null);
    setAnalysis(null);
  };

  const ensureUpload = async (): Promise<string | null> => {
    if (uploadedPath) return uploadedPath;
    if (!file) return null;
    if (file.size > MAX_UPLOAD_SIZE) {
      toast.error(`حجم الملف أكبر من ${MAX_UPLOAD_SIZE_LABEL}`);
      return null;
    }
    const path = safeStorageKey(file.name, `${year}/${cat}`);
    const { error: upErr } = await supabase.storage.from("wedding-archive").upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (upErr) {
      toast.error("تعذر الرفع", { description: upErr.message });
      return null;
    }
    setUploadedPath(path);
    return path;
  };

  const runAnalysis = async () => {
    if (!file) return toast.error("اختر ملفًا أولًا");
    setAnalyzing(true);
    try {
      const path = await ensureUpload();
      if (!path) return;
      const result = await analyzeFn({
        data: {
          storage_path: path,
          filename: file.name,
          mime_type: file.type || "",
          description: desc.trim(),
          wedding_year: year,
        },
      });
      setAnalysis(result);
      setCat(result.category);
      if (result.suggested_title) setTitle(result.suggested_title);
      if (result.summary && !desc.trim()) setDesc(result.summary);
      toast.success("تم التحليل الذكي", {
        description: `صُنّف تحت: ${result.category_label}`,
      });
    } catch (e) {
      toast.error("تعذر التحليل", { description: e instanceof Error ? e.message : "" });
    } finally {
      setAnalyzing(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("يرجى اختيار ملف");
    if (!title.trim()) return toast.error("يرجى كتابة عنوان للملف");
    setBusy(true);
    try {
      const path = await ensureUpload();
      if (!path) return;
      const { error } = await supabase.from("wedding_archive_items").insert({
        wedding_year: year,
        category: cat,
        title: title.trim(),
        description: desc.trim() || null,
        file_url: path,
        file_type: file.type,
        file_size: file.size,
        created_by: userId,
      });
      if (error) { toast.error("تعذر الحفظ", { description: error.message }); return; }
      toast.success(`تمت الإضافة لأرشيف ${year}هـ`);
      resetForm();
      setOpen(false);
      onSaved();
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-gold/5 p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-gold text-white flex items-center justify-center">
            <Wand2 className="h-6 w-6" />
          </div>
          <div>
            <p className="font-bold text-sm">أضف ملف لأرشيف عام {year}هـ — مع تحليل ذكي تلقائي</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              يقرأ الذكاء الاصطناعي محتوى الملف ويصنّفه تلقائياً (صور عرسان، إعلامي، برامج، مالي، تنظيم) ويقترح عنواناً وملخصاً.
            </p>
          </div>
        </div>
        <DialogTrigger asChild>
          <Button className="bg-gradient-hero text-primary-foreground gap-2">
            <Plus className="h-4 w-4" /> إضافة ملف للأرشيف
          </Button>
        </DialogTrigger>
      </div>
      <DialogContent className="max-w-xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-primary" />
            ملف جديد في أرشيف {year}هـ
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">الملف</Label>
            <label className="flex items-center gap-2 h-10 px-3 rounded-md border border-dashed border-input cursor-pointer hover:border-primary/60 hover:bg-muted/40 transition text-xs">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground truncate flex-1">{file ? file.name : "اختر ملفًا للرفع"}</span>
              {file && <FileText className="h-3.5 w-3.5 text-primary" />}
              <input
                type="file"
                accept={ACCEPT_ANY_FILE}
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {file && (
              <Button
                type="button"
                variant="outline"
                onClick={runAnalysis}
                disabled={analyzing}
                className="w-full gap-2 border-fuchsia-300 hover:bg-fuchsia-50 hover:border-fuchsia-400"
              >
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4 text-fuchsia-600" />}
                {analyzing ? "جاري التحليل الذكي..." : "تحليل ذكي: صنّف الملف واقترح عنواناً تلقائياً"}
              </Button>
            )}
            {analysis && (
              <div className="rounded-xl border bg-gradient-to-br from-fuchsia-50 via-white to-amber-50 p-3 text-xs space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-fuchsia-600 hover:bg-fuchsia-600 text-white gap-1">
                    <Sparkles className="h-3 w-3" /> {analysis.category_label}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    دقة: {analysis.confidence === "high" ? "عالية" : analysis.confidence === "low" ? "منخفضة" : "متوسطة"}
                  </Badge>
                </div>
                {analysis.summary && <p className="text-muted-foreground">{analysis.summary}</p>}
                {analysis.reasoning && <p className="text-[10px] text-muted-foreground italic">السبب: {analysis.reasoning}</p>}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">التصنيف</Label>
            <Select value={cat} onValueChange={(v) => setCat(v as Category)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {CATEGORIES.find((c) => c.key === cat)?.description}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">عنوان الملف</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`مثال: ألبوم صور حفل ${year}هـ`} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">وصف مختصر (اختياري)</Label>
            <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="نبذة عن المحتوى أو الفترة" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button type="submit" disabled={busy || !file || !title.trim()} className="bg-gradient-hero text-primary-foreground">
              {busy ? <Loader2 className="h-4 w-4 ms-1 animate-spin" /> : <Upload className="h-4 w-4 ms-1" />}
              {busy ? "جاري الرفع..." : "حفظ في الأرشيف"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ----------------- Smart bulk-distribute panel -----------------

type DistItemStatus = "pending" | "uploading" | "analyzing" | "saving" | "done" | "error";

interface DistItem {
  id: string;
  file: File;
  status: DistItemStatus;
  category?: Category;
  category_label?: string;
  title?: string;
  summary?: string;
  confidence?: ArchiveAnalysis["confidence"];
  error?: string;
}

function SmartDistributePanel({
  year, onSaved, userId,
}: { year: number; onSaved: () => void; userId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DistItem[]>([]);
  const [running, setRunning] = useState(false);
  const analyzeFn = useServerFn(analyzeArchiveFile);

  const addFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    const next: DistItem[] = [];
    for (const f of Array.from(files)) {
      if (f.size > MAX_UPLOAD_SIZE) {
        toast.error(`"${f.name}" أكبر من ${MAX_UPLOAD_SIZE_LABEL}`);
        continue;
      }
      next.push({ id: crypto.randomUUID(), file: f, status: "pending" });
    }
    setItems((prev) => [...prev, ...next]);
  };

  const remove = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const update = (id: string, patch: Partial<DistItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const processOne = async (item: DistItem) => {
    try {
      // 1) Temporary upload under inbox/ so analyzer can fetch it
      update(item.id, { status: "uploading" });
      const tempPath = safeStorageKey(item.file.name, `${year}/_inbox`);
      const { error: upErr } = await supabase.storage
        .from("wedding-archive")
        .upload(tempPath, item.file, {
          contentType: item.file.type || "application/octet-stream",
          upsert: false,
        });
      if (upErr) throw new Error(upErr.message);

      // 2) Analyze
      update(item.id, { status: "analyzing" });
      const result = await analyzeFn({
        data: {
          storage_path: tempPath,
          filename: item.file.name,
          mime_type: item.file.type || "",
          description: "",
          wedding_year: year,
        },
      });

      // 3) Move to category folder (copy + remove)
      const finalPath = safeStorageKey(item.file.name, `${year}/${result.category}`);
      const { error: mvErr } = await supabase.storage
        .from("wedding-archive")
        .move(tempPath, finalPath);
      const usedPath = mvErr ? tempPath : finalPath;

      // 4) Insert archive row
      update(item.id, { status: "saving" });
      const { error: insErr } = await supabase.from("wedding_archive_items").insert({
        wedding_year: year,
        category: result.category,
        title: result.suggested_title || item.file.name.replace(/\.[^.]+$/, ""),
        description: result.summary || null,
        file_url: usedPath,
        file_type: item.file.type,
        file_size: item.file.size,
        created_by: userId,
      });
      if (insErr) throw new Error(insErr.message);

      update(item.id, {
        status: "done",
        category: result.category,
        category_label: result.category_label,
        title: result.suggested_title,
        summary: result.summary,
        confidence: result.confidence,
      });
    } catch (e) {
      update(item.id, {
        status: "error",
        error: e instanceof Error ? e.message : "خطأ غير معروف",
      });
    }
  };

  const runAll = async () => {
    const queue = items.filter((i) => i.status === "pending" || i.status === "error");
    if (!queue.length) return;
    setRunning(true);
    try {
      // Process serially to avoid overloading the AI gateway and storage.
      for (const it of queue) {
        // Reset error state before retry
        if (it.status === "error") update(it.id, { status: "pending", error: undefined });
        await processOne(it);
      }
      const doneCount = items.filter((i) => i.status === "done").length + queue.length;
      toast.success(`تم توزيع الملفات على أقسام الأرشيف`, {
        description: `الملفات المعالجة: ${doneCount}`,
      });
      onSaved();
    } finally {
      setRunning(false);
    }
  };

  const stats = useMemo(() => {
    const by: Record<string, number> = {};
    for (const it of items) {
      if (it.status === "done" && it.category_label) {
        by[it.category_label] = (by[it.category_label] || 0) + 1;
      }
    }
    return by;
  }, [items]);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setItems([]); } }}>
      <div className="rounded-2xl border-2 border-dashed border-fuchsia-300 bg-gradient-to-br from-fuchsia-50 via-white to-amber-50 p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-fuchsia-600 to-purple-700 text-white flex items-center justify-center">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <p className="font-bold text-sm">توزيع ذكي تلقائي — أرفق عدة ملفات مرة واحدة</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              يقرأ الذكاء الاصطناعي كل ملف ويرسله إلى قسمه: الصور لـ"صور العرسان"، الفواتير لـ"المالي"، الفقرات لـ"البرامج"، والخطط لـ"الخطط".
            </p>
          </div>
        </div>
        <DialogTrigger asChild>
          <Button className="bg-gradient-to-br from-fuchsia-600 to-purple-700 text-white gap-2 hover:opacity-95">
            <Sparkles className="h-4 w-4" /> ابدأ التوزيع الذكي
          </Button>
        </DialogTrigger>
      </div>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-fuchsia-600" />
            توزيع ذكي للملفات — أرشيف {year}هـ
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <label className="flex flex-col items-center justify-center gap-2 h-28 rounded-xl border-2 border-dashed border-fuchsia-300 cursor-pointer hover:bg-fuchsia-50/60 transition">
            <Upload className="h-6 w-6 text-fuchsia-600" />
            <span className="text-sm font-bold">اسحب الملفات هنا أو اختر عدة ملفات</span>
            <span className="text-[11px] text-muted-foreground">صور · PDF · مستندات · حد الحجم {MAX_UPLOAD_SIZE_LABEL} للملف</span>
            <input
              type="file"
              multiple
              accept={ACCEPT_ANY_FILE}
              className="hidden"
              onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }}
            />
          </label>

          {items.length > 0 && (
            <div className="rounded-xl border bg-card max-h-72 overflow-y-auto divide-y">
              {items.map((it) => (
                <div key={it.id} className="p-3 flex items-start gap-3 text-xs">
                  <div className="mt-0.5">
                    {it.status === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    {it.status === "error" && <AlertCircle className="h-4 w-4 text-rose-600" />}
                    {(it.status === "uploading" || it.status === "analyzing" || it.status === "saving") && (
                      <Loader2 className="h-4 w-4 animate-spin text-fuchsia-600" />
                    )}
                    {it.status === "pending" && <FileText className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{it.title || it.file.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {it.file.name} · {(it.file.size / 1024).toFixed(0)} KB
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {it.category_label && (
                        <Badge className="bg-fuchsia-600 hover:bg-fuchsia-600 text-white gap-1 text-[10px]">
                          <Sparkles className="h-3 w-3" /> {it.category_label}
                        </Badge>
                      )}
                      {it.status === "uploading" && <Badge variant="outline" className="text-[10px]">جاري الرفع…</Badge>}
                      {it.status === "analyzing" && <Badge variant="outline" className="text-[10px]">جاري التحليل…</Badge>}
                      {it.status === "saving" && <Badge variant="outline" className="text-[10px]">جاري الحفظ…</Badge>}
                      {it.status === "done" && <Badge variant="outline" className="text-[10px] text-emerald-700">تم</Badge>}
                      {it.status === "error" && (
                        <Badge variant="outline" className="text-[10px] text-rose-700">خطأ: {it.error}</Badge>
                      )}
                    </div>
                    {it.summary && it.status === "done" && (
                      <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{it.summary}</p>
                    )}
                  </div>
                  {!running && it.status !== "done" && (
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(it.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {Object.keys(stats).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(stats).map(([label, n]) => (
                <Badge key={label} variant="outline" className="text-[10px]">
                  {label}: {n}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={running}>
              إغلاق
            </Button>
            <Button
              type="button"
              onClick={runAll}
              disabled={running || !items.some((i) => i.status === "pending" || i.status === "error")}
              className="bg-gradient-to-br from-fuchsia-600 to-purple-700 text-white gap-2"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {running ? "جاري التوزيع الذكي…" : "ابدأ التحليل والتوزيع"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}