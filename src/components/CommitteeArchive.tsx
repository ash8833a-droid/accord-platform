import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Archive, Upload, FileText, Image as ImageIcon, Download, Loader2, Calendar, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ACCEPT_ANY_FILE, MAX_UPLOAD_SIZE, MAX_UPLOAD_SIZE_LABEL, safeStorageKey } from "@/lib/uploads";
import { FilePreview } from "@/components/FilePreview";

interface Report {
  id: string;
  title: string;
  description: string | null;
  file_url: string | null;
  file_type: string | null;
  file_size: number | null;
  report_year: number;
  archive_year: number | null;
  is_archived: boolean;
  created_at: string;
}

interface Props {
  committeeId: string;
  committeeName: string;
}

export function CommitteeArchive({ committeeId, committeeName }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<Report[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string; type: string; path: string } | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("reports")
      .select("*")
      .eq("committee_id", committeeId)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Report[]);
  };

  useEffect(() => { load(); }, [committeeId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("يرجى اختيار ملف");
    if (file.size > MAX_UPLOAD_SIZE) return toast.error(`حجم الملف أكبر من ${MAX_UPLOAD_SIZE_LABEL}`);
    setUploading(true);
    try {
      const path = safeStorageKey(file.name, committeeId);
      const { error: upErr } = await supabase.storage.from("reports").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) { toast.error("تعذر رفع الملف", { description: upErr.message }); return; }

      const { error } = await supabase.from("reports").insert({
        title: title || file.name,
        description: desc || null,
        committee_id: committeeId,
        file_url: path,
        file_type: file.type,
        file_size: file.size,
        created_by: user?.id ?? null,
      });
      if (error) { toast.error("تعذر الحفظ", { description: error.message }); return; }
      toast.success("تم إضافة الملف للأرشيف", { description: "ستقوم الإدارة العليا بتسكينه حسب العام" });
      setTitle(""); setDesc(""); setFile(null);
      load();
    } finally {
      setUploading(false);
    }
  };

  const open = async (r: Report) => {
    if (!r.file_url) return;
    const { data, error } = await supabase.storage.from("reports").createSignedUrl(r.file_url, 60 * 30);
    if (error || !data?.signedUrl) return toast.error("تعذّر فتح الملف", { description: error?.message });
    setPreview({ url: data.signedUrl, name: r.title, type: r.file_type ?? "", path: r.file_url });
  };

  const download = async (r: Report) => {
    if (!r.file_url) return;
    const { data, error } = await supabase.storage.from("reports").download(r.file_url);
    if (error || !data) return toast.error("تعذّر التحميل", { description: error?.message });
    const url = URL.createObjectURL(data);
    const ext = r.file_url.split(".").pop() || "";
    const safeName = r.title.replace(/[^\p{L}\p{N} _-]/gu, "");
    const link = document.createElement("a");
    link.href = url;
    link.download = ext ? `${safeName}.${ext}` : safeName;
    document.body.appendChild(link); link.click(); link.remove();
    URL.revokeObjectURL(url);
    toast.success("بدأ التحميل");
  };

  const downloadByPath = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("reports").download(path);
    if (error || !data) return toast.error("تعذّر التحميل", { description: error?.message });
    const url = URL.createObjectURL(data);
    const ext = path.split(".").pop() || "";
    const safe = name.replace(/[^\p{L}\p{N} _-]/gu, "");
    const link = document.createElement("a");
    link.href = url;
    link.download = ext ? `${safe}.${ext}` : safe;
    document.body.appendChild(link); link.click(); link.remove();
    URL.revokeObjectURL(url);
  };

  const isImg = (t: string | null) => !!t && t.startsWith("image/");
  const fmtSize = (n: number | null) => {
    if (!n) return "";
    if (n < 1024) return `${n} ب`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} ك.ب`;
    return `${(n / 1024 / 1024).toFixed(1)} م.ب`;
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group inline-flex items-center gap-2.5 rounded-2xl border bg-card hover:bg-primary/5 hover:border-primary/40 px-4 py-3 shadow-sm hover:shadow-md transition-all"
          aria-label="أرشيف اللجنة"
        >
          <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition">
            <Archive className="h-5 w-5" />
          </span>
          <span className="text-start">
            <span className="block text-sm font-bold leading-tight">أرشيف اللجنة</span>
            <span className="block text-[11px] text-muted-foreground mt-0.5">
              {items.length > 0 ? `${items.length} ملف · انقر للفتح` : "انقر لرفع ملف"}
            </span>
          </span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-l from-primary/5 to-transparent">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Archive className="h-5 w-5 text-primary" />
            أرشيف اللجنة
            <Badge variant="outline" className="text-[10px] ms-auto">{items.length} ملف</Badge>
          </DialogTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            ارفع التقارير والصور والملفات السابقة لتظهر في صفحة التقارير وتُسكَّن من الإدارة العليا حسب العام
          </p>
        </DialogHeader>

        <form onSubmit={submit} className="p-5 space-y-3 border-b bg-muted/20">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">عنوان الملف</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`مثال: تقرير ${committeeName} السنوي`} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">الملف (PDF / صورة / Word / Excel)</Label>
              <label className="flex items-center justify-center gap-2 h-9 px-3 rounded-md border border-dashed border-input cursor-pointer hover:border-primary/60 hover:bg-muted/40 transition text-xs">
                <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground truncate">{file ? file.name : "اختر ملف للرفع"}</span>
                <input
                  type="file"
                  accept={ACCEPT_ANY_FILE}
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">وصف مختصر (اختياري)</Label>
            <Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="نبذة عن محتوى الملف أو الفترة التي يغطيها" />
          </div>
          <Button type="submit" disabled={uploading || !file} className="bg-gradient-hero text-primary-foreground">
            {uploading ? <Loader2 className="h-4 w-4 ms-1 animate-spin" /> : <Upload className="h-4 w-4 ms-1" />}
            {uploading ? "جاري الرفع..." : "إضافة للأرشيف"}
          </Button>
        </form>

        <div className="divide-y max-h-[420px] overflow-y-auto">
          {items.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">لا توجد ملفات في الأرشيف بعد</p>
          )}
          {items.map((r) => (
            <div key={r.id} className="px-5 py-3 flex items-center gap-3 hover:bg-muted/20 transition">
              <span className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                {isImg(r.file_type) ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                  {fmtSize(r.file_size)}
                  <span>·</span>
                  <span>{new Date(r.created_at).toLocaleDateString("ar-SA")}</span>
                  {r.archive_year && (
                    <Badge variant="outline" className="text-[10px] gap-1 border-gold/40 text-gold-foreground bg-gold/10">
                      <Calendar className="h-3 w-3" /> {r.archive_year}
                    </Badge>
                  )}
                  {r.is_archived && <Badge variant="secondary" className="text-[10px]">مُسكَّن</Badge>}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button size="sm" variant="outline" onClick={() => open(r)} title="معاينة">
                  <Eye className="h-3.5 w-3.5 ms-1" /> معاينة
                </Button>
                <Button size="sm" onClick={() => download(r)} title="تحميل" className="bg-gradient-gold text-gold-foreground">
                  <Download className="h-3.5 w-3.5 ms-1" /> تحميل
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent dir="rtl" className="max-w-5xl w-[95vw] h-[88vh] p-0 overflow-hidden flex flex-col">
          <DialogTitle className="sr-only">{preview?.name ?? "معاينة"}</DialogTitle>
          {preview && (
            <FilePreview
              url={preview.url}
              name={preview.name}
              type={preview.type}
              onDownload={() => downloadByPath(preview.path, preview.name)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
