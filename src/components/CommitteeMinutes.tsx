import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ClipboardList, Upload, FileText, Image as ImageIcon, Download, Loader2, Calendar, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ACCEPT_ANY_FILE, MAX_UPLOAD_SIZE, MAX_UPLOAD_SIZE_LABEL, safeStorageKey } from "@/lib/uploads";
import { FilePreview } from "@/components/FilePreview";

interface Minute {
  id: string;
  title: string;
  notes: string | null;
  meeting_date: string | null;
  file_url: string | null;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  created_by: string | null;
}

interface Props {
  committeeId: string;
  committeeName: string;
  canManage: boolean;
}

export function CommitteeMinutes({ committeeId, committeeName, canManage }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<Minute[]>([]);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [meetingDate, setMeetingDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string; type: string; path: string } | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("committee_minutes" as any)
      .select("*")
      .eq("committee_id", committeeId)
      .order("meeting_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    setItems(((data ?? []) as unknown) as Minute[]);
  };

  useEffect(() => { load(); }, [committeeId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return toast.error("لا تملك صلاحية رفع المحاضر");
    if (!file) return toast.error("يرجى اختيار ملف المحضر");
    if (file.size > MAX_UPLOAD_SIZE) return toast.error(`حجم الملف أكبر من ${MAX_UPLOAD_SIZE_LABEL}`);
    setUploading(true);
    try {
      const path = safeStorageKey(file.name, committeeId);
      const { error: upErr } = await supabase.storage.from("minutes").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) { toast.error("تعذر رفع الملف", { description: upErr.message }); return; }

      const { error } = await supabase.from("committee_minutes" as any).insert({
        committee_id: committeeId,
        title: title || `محضر اجتماع ${committeeName} - ${meetingDate}`,
        notes: notes || null,
        meeting_date: meetingDate || null,
        file_url: path,
        file_type: file.type,
        file_size: file.size,
        created_by: user?.id ?? null,
      });
      if (error) { toast.error("تعذر الحفظ", { description: error.message }); return; }
      toast.success("تم حفظ المحضر بنجاح");
      setTitle(""); setNotes(""); setFile(null);
      load();
    } finally {
      setUploading(false);
    }
  };

  const open = async (r: Minute) => {
    if (!r.file_url) return;
    const { data, error } = await supabase.storage.from("minutes").createSignedUrl(r.file_url, 60 * 30);
    if (error || !data?.signedUrl) return toast.error("تعذّر فتح الملف", { description: error?.message });
    setPreview({ url: data.signedUrl, name: r.title, type: r.file_type ?? "", path: r.file_url });
  };

  const downloadByPath = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("minutes").download(path);
    if (error || !data) return toast.error("تعذّر التحميل", { description: error?.message });
    const url = URL.createObjectURL(data);
    const ext = path.split(".").pop() || "";
    const safe = name.replace(/[^\p{L}\p{N} _-]/gu, "");
    const link = document.createElement("a");
    link.href = url;
    link.download = ext ? `${safe}.${ext}` : safe;
    document.body.appendChild(link); link.click(); link.remove();
    URL.revokeObjectURL(url);
    toast.success("بدأ التحميل");
  };

  const remove = async (r: Minute) => {
    if (!canManage) return;
    if (!confirm(`حذف المحضر "${r.title}"؟`)) return;
    if (r.file_url) await supabase.storage.from("minutes").remove([r.file_url]);
    const { error } = await supabase.from("committee_minutes" as any).delete().eq("id", r.id);
    if (error) return toast.error("تعذّر الحذف", { description: error.message });
    toast.success("تم الحذف");
    load();
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
          className="group relative inline-flex items-center gap-2.5 rounded-2xl border bg-card hover:bg-gold/5 hover:border-gold/40 px-4 py-3 shadow-sm hover:shadow-md transition-all"
          aria-label="محاضر الاجتماعات"
        >
          <span className="h-10 w-10 rounded-xl bg-gradient-to-br from-gold/25 to-primary/15 text-gold-foreground flex items-center justify-center group-hover:from-gold group-hover:to-gold/80 group-hover:text-gold-foreground transition shadow-sm">
            <ClipboardList className="h-5 w-5" />
          </span>
          <span className="text-start">
            <span className="block text-sm font-bold leading-tight">محاضر الاجتماعات</span>
            <span className="block text-[11px] text-muted-foreground mt-0.5">
              {items.length > 0 ? `${items.length} محضر · انقر للعرض` : "انقر لرفع محضر جديد"}
            </span>
          </span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-l from-gold/10 via-primary/5 to-transparent">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-5 w-5 text-gold" />
            محاضر اجتماعات لجنة {committeeName}
            <Badge variant="outline" className="text-[10px] ms-auto border-gold/40 text-gold-foreground bg-gold/10">
              {items.length} محضر
            </Badge>
          </DialogTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            ارفع محاضر اجتماعات اللجنة بصيغ PDF / Word / صور لتكون متاحة لكل أعضاء اللجنة والإدارة
          </p>
        </DialogHeader>

        {canManage && (
          <form onSubmit={submit} className="p-5 space-y-3 border-b bg-muted/20">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">عنوان المحضر</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`مثال: اجتماع ${committeeName} الأسبوعي`} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">تاريخ الاجتماع</Label>
                <Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ملف المحضر</Label>
              <label className="flex items-center justify-center gap-2 h-9 px-3 rounded-md border border-dashed border-input cursor-pointer hover:border-gold/60 hover:bg-gold/5 transition text-xs">
                <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground truncate">{file ? file.name : "اختر ملف المحضر للرفع"}</span>
                <input
                  type="file"
                  accept={ACCEPT_ANY_FILE}
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ملاحظات (اختياري)</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملخّص أهم القرارات أو الحضور" />
            </div>
            <Button type="submit" disabled={uploading || !file} className="bg-gradient-to-r from-gold to-gold/80 text-gold-foreground hover:opacity-90">
              {uploading ? <Loader2 className="h-4 w-4 ms-1 animate-spin" /> : <Upload className="h-4 w-4 ms-1" />}
              {uploading ? "جاري الرفع..." : "رفع المحضر"}
            </Button>
          </form>
        )}

        <div className="divide-y max-h-[420px] overflow-y-auto">
          {items.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">لا توجد محاضر مرفوعة بعد</p>
          )}
          {items.map((r) => (
            <div key={r.id} className="px-5 py-3 flex items-center gap-3 hover:bg-muted/20 transition">
              <span className="h-9 w-9 rounded-lg bg-gradient-to-br from-gold/20 to-primary/10 text-gold-foreground flex items-center justify-center shrink-0">
                {isImg(r.file_type) ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                  {r.meeting_date && (
                    <Badge variant="outline" className="text-[10px] gap-1 border-gold/40 text-gold-foreground bg-gold/10">
                      <Calendar className="h-3 w-3" /> {new Date(r.meeting_date).toLocaleDateString("ar-SA")}
                    </Badge>
                  )}
                  {fmtSize(r.file_size) && <span>{fmtSize(r.file_size)}</span>}
                  <span>· رُفع {new Date(r.created_at).toLocaleDateString("ar-SA")}</span>
                </p>
                {r.notes && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{r.notes}</p>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button size="sm" variant="outline" onClick={() => open(r)} title="معاينة">
                  <Eye className="h-3.5 w-3.5 ms-1" /> معاينة
                </Button>
                <Button size="sm" onClick={() => r.file_url && downloadByPath(r.file_url, r.title)} title="تحميل" className="bg-gradient-to-r from-gold to-gold/80 text-gold-foreground hover:opacity-90">
                  <Download className="h-3.5 w-3.5 ms-1" /> تحميل
                </Button>
                {canManage && (
                  <Button size="sm" variant="ghost" onClick={() => remove(r)} title="حذف" className="text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
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