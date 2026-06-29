import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ClipboardList,
  Upload,
  Sparkles,
  Loader2,
  FileText,
  ClipboardPaste,
  Save,
  Eye,
  Download,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { ACCEPT_ANY_FILE, MAX_UPLOAD_SIZE, MAX_UPLOAD_SIZE_LABEL, safeStorageKey } from "@/lib/uploads";
import { DotsPattern } from "@/components/decor/DotsPattern";
import { BRAND_LOGO_DATA_URI } from "@/assets/brand-logo";
import { analyzePlan, type PlanAnalysis } from "@/lib/analyze-plan.functions";
import { FilePreview } from "@/components/FilePreview";
import { UnifiedPlanView, splitPlanDescription } from "./UnifiedPlanView";

interface Plan {
  id: string;
  title: string;
  description: string | null;
  file_url: string | null;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

const PLAN_PREFIX = "[PLAN]";

interface Props {
  committeeId: string;
  committeeName: string;
}

export function CommitteePlanPanel({ committeeId, committeeName }: Props) {
  const { user } = useAuth();
  const runAnalyze = useServerFn(analyzePlan);

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Plan[]>([]);
  const [title, setTitle] = useState("");
  const [pasted, setPasted] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<PlanAnalysis | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string; type: string } | null>(null);
  const [textPreview, setTextPreview] = useState<{ title: string; content: string; analysis: string | null } | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("reports")
      .select("id,title,description,file_url,file_type,file_size,created_at")
      .eq("committee_id", committeeId)
      .ilike("title", `${PLAN_PREFIX}%`)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Plan[]);
  };
  useEffect(() => {
    if (open) load();
  }, [open, committeeId]);

  const reset = () => {
    setTitle("");
    setPasted("");
    setFile(null);
    setAnalysis(null);
  };

  const uploadFile = async (): Promise<{ path: string; type: string; size: number } | null> => {
    if (!file) return null;
    if (file.size > MAX_UPLOAD_SIZE) {
      toast.error(`حجم الملف أكبر من ${MAX_UPLOAD_SIZE_LABEL}`);
      return null;
    }
    const path = safeStorageKey(file.name, committeeId);
    const { error } = await supabase.storage.from("reports").upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (error) {
      toast.error("تعذر رفع الملف", { description: error.message });
      return null;
    }
    return { path, type: file.type || "application/octet-stream", size: file.size };
  };

  const handleAnalyze = async () => {
    if (!file && !pasted.trim()) {
      toast.error("ارفق ملفاً أو الصق محتوى الخطة أولاً");
      return;
    }
    setAnalyzing(true);
    try {
      let storage_path: string | undefined;
      let mime_type: string | undefined;
      let filename: string | undefined;
      if (file) {
        const up = await uploadFile();
        if (!up) return;
        storage_path = up.path;
        mime_type = up.type;
        filename = file.name;
      }
      const res = await runAnalyze({
        data: {
          storage_path,
          filename,
          mime_type,
          pasted_text: pasted.trim() || undefined,
          committee_name: committeeName,
        },
      });
      setAnalysis(res);
      toast.success("تم التحليل الذكي للخطة");
      // persist file (without analysis) so subsequent save just stores metadata
      if (storage_path) {
        // store transient info on file ref via closure variables
        (file as any).__uploaded = { path: storage_path, type: mime_type, size: file?.size };
      }
    } catch (e: any) {
      toast.error("تعذر التحليل", { description: e?.message });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!file && !pasted.trim()) {
      toast.error("لا توجد خطة لحفظها");
      return;
    }
    setSaving(true);
    try {
      let storage_path: string | null = null;
      let mime: string | null = null;
      let size: number | null = null;
      const cached = (file as any)?.__uploaded as { path: string; type: string; size: number } | undefined;
      if (cached) {
        storage_path = cached.path;
        mime = cached.type;
        size = cached.size;
      } else if (file) {
        const up = await uploadFile();
        if (!up) return;
        storage_path = up.path;
        mime = up.type;
        size = up.size;
      }
      const description = [
        pasted.trim() ? "— محتوى الخطة —\n" + pasted.trim() : "",
        analysis ? "\n— التحليل الذكي —\n" + analysisToText(analysis) : "",
      ].filter(Boolean).join("\n\n").slice(0, 8000) || null;

      const finalTitle = `${PLAN_PREFIX} ${title.trim() || "خطة " + committeeName}`.slice(0, 200);
      const { error } = await supabase.from("reports").insert({
        title: finalTitle,
        description,
        committee_id: committeeId,
        file_url: storage_path,
        file_type: mime,
        file_size: size,
        created_by: user?.id ?? null,
      });
      if (error) {
        toast.error("تعذر الحفظ", { description: error.message });
        return;
      }
      toast.success("تم حفظ الخطة بنجاح");
      reset();
      load();
    } finally {
      setSaving(false);
    }
  };

  const openPreview = async (r: Plan) => {
    if (!r.file_url) {
      const { content, analysis } = splitPlanDescription(r.description);
      if (!content) {
        toast.error("لا يوجد محتوى لعرضه");
        return;
      }
      setTextPreview({ title: displayTitle(r.title), content, analysis });
      return;
    }
    const { data, error } = await supabase.storage.from("reports").createSignedUrl(r.file_url, 60 * 30);
    if (error || !data?.signedUrl) {
      toast.error("تعذر فتح الملف", { description: error?.message });
      return;
    }
    setPreview({ url: data.signedUrl, name: r.title.replace(PLAN_PREFIX, "").trim(), type: r.file_type ?? "" });
  };

  const downloadPlan = async (r: Plan) => {
    const name = displayTitle(r.title) || "خطة";
    if (!r.file_url) {
      // No attached file → download textual content as .txt
      const content = r.description?.trim();
      if (!content) {
        toast.error("لا يوجد محتوى قابل للتنزيل");
        return;
      }
      const blob = new Blob(["\ufeff" + content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return;
    }
    const filename = r.file_url.split("/").pop() || displayTitle(r.title);
    const { data, error } = await supabase.storage
      .from("reports")
      .createSignedUrl(r.file_url, 60 * 5, { download: filename });
    if (error || !data?.signedUrl) {
      toast.error("تعذر تنزيل الملف", { description: error?.message });
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const displayTitle = (t: string) => t.replace(PLAN_PREFIX, "").trim();

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label="الخطة التشغيلية للجنة"
            className="group inline-flex items-center gap-2.5 rounded-2xl border bg-card hover:bg-primary/5 hover:border-primary/40 px-4 py-3 shadow-sm hover:shadow-md transition-all"
          >
            <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition">
              <ClipboardList className="h-5 w-5" />
            </span>
            <span className="text-start">
              <span className="block text-sm font-bold leading-tight">الخطة التشغيلية</span>
              <span className="block text-[11px] text-muted-foreground mt-0.5">
                ارفق · الصق · حلّل ذكياً
              </span>
            </span>
          </button>
        </DialogTrigger>

        <DialogContent
          dir="rtl"
          className="max-w-3xl p-0 overflow-hidden bg-white rounded-[2rem] border-0 shadow-2xl"
        >
          {/* Branded header — white bg with light dot pattern */}
          <div className="relative px-6 pt-6 pb-5 border-b border-slate-100 bg-white overflow-hidden">
            <DotsPattern
              className="absolute inset-0 text-primary/15"
              fade="bl"
              cols={14}
              rows={5}
              radius={4}
            />
            <div className="relative flex items-center gap-4">
              <div className="h-16 w-16 shrink-0 flex items-center justify-center">
                <img
                  src={BRAND_LOGO_DATA_URI}
                  alt="شعار اللجنة"
                  className="h-16 w-16 object-contain drop-shadow-sm"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-slate-500 tracking-wide">
                  لجنة الزواج الجماعي للعائلة
                </p>
                <DialogTitle className="text-xl font-bold text-slate-900 mt-0.5">
                  الخطة التشغيلية — {committeeName}
                </DialogTitle>
                <p className="text-[12px] text-slate-500 mt-1">
                  ارفع ملف الخطة، أو الصق محتواها، أو دع الذكاء الاصطناعي يحللها لك في خطوة واحدة.
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/5">
                {items.length} خطة محفوظة
              </Badge>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto bg-white">
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">عنوان الخطة</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`مثال: الخطة التشغيلية للحفل الثاني عشر — ${committeeName}`}
                  className="bg-slate-50 border-slate-100 rounded-xl h-11 focus-visible:bg-white"
                />
              </div>

              <Tabs defaultValue="upload" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-slate-100 p-1 rounded-xl h-auto gap-1">
                  <TabsTrigger value="upload" className="rounded-lg gap-1.5 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm py-2">
                    <Upload className="h-3.5 w-3.5" /> ارفاق ملف
                  </TabsTrigger>
                  <TabsTrigger value="paste" className="rounded-lg gap-1.5 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm py-2">
                    <ClipboardPaste className="h-3.5 w-3.5" /> لصق محتوى
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="rounded-lg gap-1.5 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm py-2">
                    <Sparkles className="h-3.5 w-3.5" /> التحليل الذكي
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="mt-4">
                  <label className="flex flex-col items-center justify-center gap-2 py-8 px-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition">
                    <Upload className="h-7 w-7 text-primary" />
                    <span className="text-sm font-semibold text-slate-700">
                      {file ? file.name : "اختر ملف الخطة (PDF / Word / صورة)"}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      الحد الأقصى {MAX_UPLOAD_SIZE_LABEL}
                    </span>
                    <input
                      type="file"
                      accept={ACCEPT_ANY_FILE}
                      className="hidden"
                      onChange={(e) => {
                        setFile(e.target.files?.[0] ?? null);
                        setAnalysis(null);
                      }}
                    />
                  </label>
                </TabsContent>

                <TabsContent value="paste" className="mt-4">
                  <Textarea
                    rows={10}
                    value={pasted}
                    onChange={(e) => { setPasted(e.target.value); setAnalysis(null); }}
                    placeholder="الصق هنا محتوى الخطة التشغيلية كاملاً (الأهداف، المراحل، المسؤوليات، الجدول الزمني...)"
                    className="bg-slate-50 border-slate-100 rounded-xl resize-none focus-visible:bg-white text-sm leading-7"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    يمكنك دمج اللصق مع ارفاق ملف — وسيُحلَّل الاثنان معاً.
                  </p>
                </TabsContent>

                <TabsContent value="ai" className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 text-[12px] text-amber-900 leading-6">
                    اضغط «حلّل الخطة» لاستخراج الأهداف والمراحل والمخاطر والتوصيات تلقائياً من الملف أو النص الملصق. النتيجة تُحفظ مع الخطة عند الضغط على «حفظ».
                  </div>
                  <Button
                    type="button"
                    onClick={handleAnalyze}
                    disabled={analyzing || (!file && !pasted.trim())}
                    className="gap-2 bg-gradient-to-l from-primary to-primary/80 text-primary-foreground rounded-xl h-11 px-5"
                  >
                    {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {analyzing ? "جاري التحليل..." : "حلّل الخطة بالذكاء الاصطناعي"}
                  </Button>

                  {analysis && <AnalysisView a={analysis} />}
                </TabsContent>
              </Tabs>
            </div>

            {items.length > 0 && (
              <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                <p className="text-[11px] font-semibold text-slate-500 mb-2 tracking-wide">
                  الخطط المحفوظة سابقاً
                </p>
                <div className="space-y-2">
                  {items.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 bg-white border border-slate-100 rounded-xl px-3 py-2">
                      <span className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{displayTitle(r.title)}</p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <Calendar className="h-3 w-3" />
                          {new Date(r.created_at).toLocaleDateString("ar-SA")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => openPreview(r)}>
                          <Eye className="h-3.5 w-3.5 ms-1" /> فتح
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => downloadPlan(r)}>
                          <Download className="h-3.5 w-3.5 ms-1" /> تنزيل
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => { setOpen(false); reset(); }} className="text-slate-600 rounded-xl">
              إغلاق
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || (!file && !pasted.trim())}
              className="gap-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl h-11 px-6"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ الخطة
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent dir="rtl" className="max-w-5xl w-[95vw] h-[88vh] p-0 overflow-hidden flex flex-col">
          <DialogTitle className="sr-only">{preview?.name ?? "معاينة الخطة"}</DialogTitle>
          {preview && <FilePreview url={preview.url} name={preview.name} type={preview.type} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!textPreview} onOpenChange={(o) => !o && setTextPreview(null)}>
        <DialogContent dir="rtl" className="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden bg-slate-50">
          <DialogTitle className="sr-only">{textPreview?.title ?? "معاينة الخطة"}</DialogTitle>
          <div className="overflow-y-auto p-4 sm:p-6">
            {textPreview && (
              <UnifiedPlanView
                title={textPreview.title}
                committeeName={committeeName}
                content={textPreview.content}
                analysisText={textPreview.analysis}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function analysisToText(a: PlanAnalysis): string {
  const sections: string[] = [];
  if (a.summary) sections.push("الملخص: " + a.summary);
  const block = (label: string, arr: string[]) =>
    arr.length ? `${label}:\n` + arr.map((x) => "• " + x).join("\n") : "";
  [
    ["الأهداف", a.objectives],
    ["المراحل والمحطات", a.milestones],
    ["المسؤوليات", a.responsibilities],
    ["المخاطر والفجوات", a.risks],
    ["التوصيات", a.recommendations],
  ].forEach(([l, v]) => {
    const s = block(l as string, v as string[]);
    if (s) sections.push(s);
  });
  return sections.join("\n\n");
}

function AnalysisView({ a }: { a: PlanAnalysis }) {
  const Section = ({ title, items, tone }: { title: string; items: string[]; tone: string }) => {
    if (!items.length) return null;
    return (
      <div className={`rounded-xl border ${tone} p-3`}>
        <p className="text-[11px] font-bold mb-2">{title}</p>
        <ul className="space-y-1.5 text-[12px] leading-6 list-disc pe-5">
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </div>
    );
  };
  return (
    <div className="space-y-3">
      {a.summary && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <p className="text-[11px] font-bold text-primary mb-1">الملخص</p>
          <p className="text-[12px] leading-6 text-slate-700">{a.summary}</p>
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-3">
        <Section title="الأهداف" items={a.objectives} tone="border-emerald-100 bg-emerald-50/60 text-emerald-900" />
        <Section title="المراحل والمحطات" items={a.milestones} tone="border-sky-100 bg-sky-50/60 text-sky-900" />
        <Section title="المسؤوليات" items={a.responsibilities} tone="border-violet-100 bg-violet-50/60 text-violet-900" />
        <Section title="المخاطر والفجوات" items={a.risks} tone="border-rose-100 bg-rose-50/60 text-rose-900" />
      </div>
      <Section title="التوصيات" items={a.recommendations} tone="border-amber-100 bg-amber-50/60 text-amber-900" />
    </div>
  );
}