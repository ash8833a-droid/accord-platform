import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Eye, Download, FileText, ImageIcon, FileSpreadsheet, File as FileIcon, Loader2 } from "lucide-react";
import { AttachmentPreviewDialog } from "@/components/AttachmentPreviewDialog";
import { toast } from "sonner";

interface Props {
  /** اسم Bucket في Supabase Storage. اتركه فارغاً إذا الرابط مباشر (http). */
  bucket?: string;
  /** مسار داخل الـ bucket، أو رابط http كامل. */
  pathOrUrl: string;
  fileName: string;
  fileType?: string;
  fileSize?: number | null;
  /** هل الـ bucket عام؟ افتراضي false → يولّد signed URL. */
  isPublicBucket?: boolean;
  className?: string;
  compact?: boolean;
}

/**
 * مكوّن مرفق موحّد لكل المنصة.
 * يوفر زرّ معاينة (Eye) وزرّ تحميل (Download) — يفتحان نافذة المعاينة الموحّدة.
 */
export function AttachmentItem({
  bucket, pathOrUrl, fileName, fileType, fileSize, isPublicBucket = false, className = "", compact = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const isHttp = /^https?:\/\//i.test(pathOrUrl);

  const resolveUrl = async (): Promise<string | null> => {
    if (isHttp) return pathOrUrl;
    if (!bucket) return null;
    if (isPublicBucket) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(pathOrUrl);
      return data?.publicUrl ?? null;
    }
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(pathOrUrl, 3600);
    if (error) { toast.error("تعذّر تحضير الرابط"); return null; }
    return data?.signedUrl ?? null;
  };

  const openPreview = async () => {
    setResolving(true);
    const url = await resolveUrl();
    setResolving(false);
    if (!url) return;
    setResolvedUrl(url);
    setOpen(true);
  };

  const download = async () => {
    if (isHttp || !bucket) {
      // تنزيل مباشر عبر fetch
      try {
        const url = await resolveUrl();
        if (!url) return;
        const res = await fetch(url);
        const blob = await res.blob();
        triggerBlobDownload(blob, fileName);
      } catch {
        toast.error("فشل التحميل");
      }
      return;
    }
    const { data, error } = await supabase.storage.from(bucket).download(pathOrUrl);
    if (error || !data) { toast.error("فشل التحميل"); return; }
    triggerBlobDownload(data, fileName);
  };

  const Icon = pickIcon(fileName, fileType);

  return (
    <>
      <div className={`flex items-center justify-between gap-2 p-2.5 border rounded-lg bg-card hover:bg-muted/40 transition-colors ${className}`}>
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate">{fileName}</p>
            {!compact && fileSize ? (
              <p className="text-[11px] text-muted-foreground">{formatSize(fileSize)}</p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="icon" variant="ghost" onClick={openPreview} disabled={resolving} title="معاينة">
            {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="ghost" onClick={download} title="تحميل">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <AttachmentPreviewDialog
        open={open}
        onOpenChange={setOpen}
        url={resolvedUrl}
        name={fileName}
        type={fileType}
        onDownload={download}
      />
    </>
  );
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const safe = fileName.replace(/[\\/:*?"<>|]+/g, "_");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safe;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function pickIcon(name: string, type?: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if ((type ?? "").startsWith("image/") || ["png","jpg","jpeg","gif","webp","svg","bmp"].includes(ext)) return ImageIcon;
  if (type === "application/pdf" || ext === "pdf") return FileText;
  if (["xlsx","xls","csv"].includes(ext)) return FileSpreadsheet;
  return FileIcon;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
