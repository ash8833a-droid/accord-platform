import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload, FileText, Image as ImageIcon, Trash2, Download, Loader2 } from "lucide-react";
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

  const load = async () => {
    const { data } = await supabase
      .from("task_attachments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Attachment[]);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    load();
  }, [taskId]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
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

  const open = async (a: Attachment) => {
    const { data, error } = await supabase.storage
      .from("task-attachments")
      .createSignedUrl(a.file_path, 60 * 10);
    if (error || !data?.signedUrl) return toast.error("تعذر فتح الملف", { description: error?.message });
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
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
  const fmtSize = (n: number | null) => {
    if (!n) return "";
    if (n < 1024) return `${n} ب`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} ك.ب`;
    return `${(n / 1024 / 1024).toFixed(1)} م.ب`;
  };

  return (
    <div className={compact ? "space-y-2" : "rounded-xl border bg-muted/20 p-3 space-y-2"}>
      {!compact && (
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-bold flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5 text-primary" /> المرفقات ({items.length})
          </h5>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {items.map((a) => (
          <div
            key={a.id}
            className="group flex items-center gap-1.5 ps-2 pe-1 py-1 rounded-md bg-card border text-[11px] hover:border-primary/40 transition"
          >
            <button
              type="button"
              onClick={() => open(a)}
              className="flex items-center gap-1.5 min-w-0 max-w-[180px]"
              title={a.file_name}
            >
              {isImage(a) ? (
                <ImageIcon className="h-3 w-3 text-emerald-600 shrink-0" />
              ) : (
                <FileText className="h-3 w-3 text-sky-600 shrink-0" />
              )}
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
            {(userId === a.uploaded_by) && (
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

        <label className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-dashed border-input cursor-pointer hover:border-primary/60 hover:bg-muted/40 transition text-[11px] text-muted-foreground">
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          <span>{uploading ? "جاري الرفع..." : "إرفاق ملف/صورة"}</span>
          <input
            type="file"
            className="hidden"
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
            onChange={onUpload}
            disabled={uploading}
          />
        </label>
      </div>
    </div>
  );
}
