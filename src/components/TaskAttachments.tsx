import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload, FileText, Image as ImageIcon, Trash2, Download, Loader2, Eye, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

interface Props {
  taskId: string;
  committeeId: string;
  /** Compact inline view (no header) */
  compact?: boolean;
}

const MAX_SIZE = 15 * 1024 * 1024; // 15 MB

export function TaskAttachments({ taskId, committeeId, compact = false }: Props) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ url: string; name: string; type: string } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("task_attachments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });
    const list = (data ?? []) as Attachment[];
    setItems(list);
    // Generate signed thumbnail URLs for images (lazy, parallel)
    const imgs = list.filter((a) => (a.file_type ?? "").startsWith("image/"));
    if (imgs.length) {
      const results = await Promise.all(
        imgs.map(async (a) => {
          const { data: signed } = await supabase.storage
            .from("task-attachments")
            .createSignedUrl(a.file_path, 60 * 60);
          return [a.id, signed?.signedUrl ?? ""] as const;
        }),
      );
      setThumbs(Object.fromEntries(results.filter(([, u]) => u)));
    } else {
      setThumbs({});
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    load();
  }, [taskId]);

  const uploadFile = async (file: File) => {
    if (file.size > MAX_SIZE) {
      return toast.error("حجم الملف أكبر من 15 ميجابايت");
    }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "_");
      const path = `${committeeId}/${taskId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("task-attachments")
        .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (upErr) {
        toast.error("تعذر رفع الملف", { description: upErr.message });
        return;
      }
      const { error: insErr } = await supabase.from("task_attachments").insert({
        task_id: taskId,
        file_name: file.name,
        file_path: path,
        file_type: file.type || null,
        file_size: file.size,
        uploaded_by: userId,
      });
      if (insErr) {
        toast.error("تعذر حفظ بيانات المرفق", { description: insErr.message });
        return;
      }
      toast.success("تم رفع المرفق");
      load();
    } finally {
      setUploading(false);
    }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const f of files) await uploadFile(f);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    for (const f of files) await uploadFile(f);
  };

  const openExternal = async (a: Attachment) => {
    const { data, error } = await supabase.storage
      .from("task-attachments")
      .createSignedUrl(a.file_path, 60 * 10);
    if (error || !data?.signedUrl) return toast.error("تعذر فتح الملف", { description: error?.message });
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const quickPreview = async (a: Attachment) => {
    const type = a.file_type ?? "";
    const { data, error } = await supabase.storage
      .from("task-attachments")
      .createSignedUrl(a.file_path, 60 * 30);
    if (error || !data?.signedUrl) return toast.error("تعذر المعاينة", { description: error?.message });
    // Images and PDFs preview inline; everything else opens in a new tab
    if (type.startsWith("image/") || type === "application/pdf") {
      setPreview({ url: data.signedUrl, name: a.file_name, type });
    } else {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
  };

  const download = async (a: Attachment) => {
    const { data, error } = await supabase.storage.from("task-attachments").download(a.file_path);
    if (error || !data) return toast.error("تعذر التحميل", { description: error?.message });
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = a.file_name;
    document.body.appendChild(link); link.click(); link.remove();
    URL.revokeObjectURL(url);
  };

  const remove = async (a: Attachment) => {
    if (!confirm(`حذف المرفق "${a.file_name}"؟`)) return;
    await supabase.storage.from("task-attachments").remove([a.file_path]);
    const { error } = await supabase.from("task_attachments").delete().eq("id", a.id);
    if (error) return toast.error("تعذر الحذف", { description: error.message });
    toast.success("تم الحذف");
    load();
  };

  const isImage = (a: Attachment) => (a.file_type ?? "").startsWith("image/");
  const isPdf = (a: Attachment) => (a.file_type ?? "") === "application/pdf";
  const fmtSize = (n: number | null) => {
    if (!n) return "";
    if (n < 1024) return `${n} ب`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} ك.ب`;
    return `${(n / 1024 / 1024).toFixed(1)} م.ب`;
  };

  return (
    <div
      className={compact ? "space-y-2" : "rounded-xl border bg-muted/20 p-3 space-y-2"}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
      }}
      onDrop={onDrop}
    >
      {!compact && (
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-bold flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5 text-primary" /> المرفقات ({items.length})
          </h5>
        </div>
      )}

      {/* Image thumbnails grid */}
      {items.some(isImage) && (
        <div className="flex flex-wrap gap-1.5">
          {items.filter(isImage).map((a) => (
            <div key={a.id} className="group relative h-16 w-16 rounded-lg overflow-hidden border border-border bg-muted/30">
              <button
                type="button"
                onClick={() => quickPreview(a)}
                className="absolute inset-0 w-full h-full"
                title={a.file_name}
              >
                {thumbs[a.id] ? (
                  <img src={thumbs[a.id]} alt={a.file_name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </button>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => quickPreview(a)}
                  className="h-6 w-6 rounded-md bg-white/90 hover:bg-white text-foreground flex items-center justify-center"
                  aria-label="معاينة"
                >
                  <Eye className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => download(a)}
                  className="h-6 w-6 rounded-md bg-white/90 hover:bg-white text-foreground flex items-center justify-center"
                  aria-label="تحميل"
                >
                  <Download className="h-3 w-3" />
                </button>
                {userId === a.uploaded_by && (
                  <button
                    type="button"
                    onClick={() => remove(a)}
                    className="h-6 w-6 rounded-md bg-white/90 hover:bg-destructive hover:text-destructive-foreground text-destructive flex items-center justify-center"
                    aria-label="حذف"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Non-image files chip list */}
      <div className="flex flex-wrap gap-1.5">
        {items.filter((a) => !isImage(a)).map((a) => (
          <div
            key={a.id}
            className="group flex items-center gap-1.5 ps-2 pe-1 py-1 rounded-md bg-card border text-[11px] hover:border-primary/40 transition"
          >
            <button
              type="button"
              onClick={() => quickPreview(a)}
              className="flex items-center gap-1.5 min-w-0 max-w-[180px]"
              title={a.file_name}
            >
              <FileText className={`h-3 w-3 shrink-0 ${isPdf(a) ? "text-rose-600" : "text-sky-600"}`} />
              <span className="truncate">{a.file_name}</span>
              {a.file_size && <span className="text-muted-foreground shrink-0">{fmtSize(a.file_size)}</span>}
            </button>
            <button
              type="button"
              onClick={() => download(a)}
              className="h-5 w-5 rounded hover:bg-primary/10 hover:text-primary flex items-center justify-center"
              aria-label="تحميل"
            >
              <Download className="h-3 w-3" />
            </button>
            {userId === a.uploaded_by && (
              <button
                type="button"
                onClick={() => remove(a)}
                className="h-5 w-5 rounded hover:bg-destructive/10 hover:text-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                aria-label="حذف"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}

        {/* Drag-and-drop / click upload zone */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-dashed transition text-[11px] ${
            dragActive
              ? "border-primary bg-primary/10 text-primary"
              : "border-input text-muted-foreground hover:border-primary/60 hover:bg-muted/40"
          } ${uploading ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          <span>{uploading ? "جاري الرفع..." : dragActive ? "أفلت الملف هنا" : "إرفاق / إفلات ملف"}</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
          onChange={onUpload}
          disabled={uploading}
        />
      </div>

      {/* Quick preview dialog (images + PDFs) */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent dir="rtl" className="max-w-4xl p-0 overflow-hidden">
          <DialogTitle className="sr-only">{preview?.name ?? "معاينة"}</DialogTitle>
          {preview && (
            <div className="bg-background">
              <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/40">
                <p className="text-sm font-bold truncate">{preview.name}</p>
                <div className="flex items-center gap-1">
                  <a
                    href={preview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted"
                  >
                    <Eye className="h-3 w-3" /> فتح كامل
                  </a>
                </div>
              </div>
              <div className="bg-black/5 max-h-[75vh] overflow-auto flex items-center justify-center">
                {preview.type.startsWith("image/") ? (
                  <img src={preview.url} alt={preview.name} className="max-h-[75vh] object-contain" />
                ) : (
                  <iframe src={preview.url} title={preview.name} className="w-full h-[75vh]" />
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
