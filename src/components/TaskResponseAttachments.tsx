import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Paperclip,
  Upload,
  FileText,
  Image as ImageIcon,
  Trash2,
  Download,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { MAX_UPLOAD_SIZE, MAX_UPLOAD_SIZE_LABEL, safeStorageKey } from "@/lib/uploads";

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
  responseId: string;
  taskId: string;
  committeeId: string;
  ownerUserId: string;
  /** Current viewer id, used to show delete button only to uploader/admin */
  currentUserId: string | null;
  canUpload: boolean;
}

const MAX_SIZE = MAX_UPLOAD_SIZE;
const BUCKET = "task-response-attachments";

export function TaskResponseAttachments({
  responseId,
  taskId,
  committeeId,
  ownerUserId,
  currentUserId,
  canUpload,
}: Props) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("task_response_attachments" as any)
      .select("id, file_name, file_path, file_type, file_size, uploaded_by, created_at")
      .eq("response_id", responseId)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as any as Attachment[]);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responseId]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_SIZE) return toast.error(`حجم الملف أكبر من ${MAX_UPLOAD_SIZE_LABEL}`);
    if (!currentUserId) return toast.error("سجّل الدخول أولاً");
    setUploading(true);
    try {
      // First folder MUST be committee_id (storage RLS checks it)
      const path = safeStorageKey(file.name, `${committeeId}/${taskId}/${responseId}`);
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (upErr) {
        toast.error("تعذّر رفع الملف", { description: upErr.message });
        return;
      }
      const { error: insErr } = await supabase
        .from("task_response_attachments" as any)
        .insert({
          response_id: responseId,
          task_id: taskId,
          committee_id: committeeId,
          file_name: file.name,
          file_path: path,
          file_type: file.type || null,
          file_size: file.size,
          uploaded_by: currentUserId,
        });
      if (insErr) {
        toast.error("تعذّر حفظ بيانات المرفق", { description: insErr.message });
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
      .from(BUCKET)
      .createSignedUrl(a.file_path, 60 * 10);
    if (error || !data?.signedUrl)
      return toast.error("تعذّر فتح الملف", { description: error?.message });
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const download = async (a: Attachment) => {
    const { data, error } = await supabase.storage.from(BUCKET).download(a.file_path);
    if (error || !data) return toast.error("تعذّر التحميل", { description: error?.message });
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = a.file_name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const remove = async (a: Attachment) => {
    if (!confirm(`حذف المرفق "${a.file_name}"؟`)) return;
    await supabase.storage.from(BUCKET).remove([a.file_path]);
    const { error } = await supabase
      .from("task_response_attachments" as any)
      .delete()
      .eq("id", a.id);
    if (error) return toast.error("تعذّر الحذف", { description: error.message });
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

  if (items.length === 0 && !canUpload) return null;

  return (
    <div className="pt-1.5 mt-1 border-t border-dashed border-border/50">
      <div className="flex items-center gap-1 mb-1 text-[10.5px] font-bold text-muted-foreground">
        <Paperclip className="h-3 w-3" /> مرفقات الرد {items.length > 0 && `(${items.length})`}
      </div>
      <div className="flex flex-wrap gap-1">
        {items.map((a) => {
          const canDelete =
            currentUserId && (a.uploaded_by === currentUserId || ownerUserId === currentUserId);
          return (
            <div
              key={a.id}
              className="group flex items-center gap-1 ps-1.5 pe-0.5 py-0.5 rounded-md bg-card border text-[10.5px] hover:border-primary/40 transition"
            >
              <button
                type="button"
                onClick={() => open(a)}
                className="flex items-center gap-1 min-w-0 max-w-[160px]"
                title={a.file_name}
              >
                {isImage(a) ? (
                  <ImageIcon className="h-3 w-3 text-emerald-600 shrink-0" />
                ) : (
                  <FileText className="h-3 w-3 text-sky-600 shrink-0" />
                )}
                <span className="truncate">{a.file_name}</span>
                {a.file_size && (
                  <span className="text-muted-foreground shrink-0">{fmtSize(a.file_size)}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => download(a)}
                className="h-4 w-4 rounded hover:bg-primary/10 hover:text-primary flex items-center justify-center"
                aria-label="تحميل"
              >
                <Download className="h-3 w-3" />
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => remove(a)}
                  className="h-4 w-4 rounded hover:bg-destructive/10 hover:text-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  aria-label="حذف"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
        {canUpload && (
          <label className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-dashed border-input cursor-pointer hover:border-primary/60 hover:bg-muted/40 transition text-[10.5px] text-muted-foreground">
            {uploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Upload className="h-3 w-3" />
            )}
            <span>{uploading ? "جاري الرفع..." : "إرفاق ملف/صورة"}</span>
            <input
              type="file"
              className="hidden"
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={onUpload}
              disabled={uploading}
            />
          </label>
        )}
      </div>
    </div>
  );
}