import { useState } from "react";
import { ExternalLink, Download, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FilePreviewProps {
  url: string;
  name?: string;
  type?: string;
  className?: string;
  onDownload?: () => void;
}

/**
 * معاينة موحّدة وآمنة للملفات داخل المنصة.
 * - الصور: عرض مباشر <img>
 * - PDF وغيره: محاولة تضمين عبر <object> ثم Google Docs Viewer كبديل،
 *   مع أزرار "فتح في تبويب جديد" و"تحميل" دائماً متاحة لتفادي حظر Chrome.
 */
export function FilePreview({ url, name, type, className = "", onDownload }: FilePreviewProps) {
  const [objectFailed, setObjectFailed] = useState(false);
  const [viewerFailed, setViewerFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const isImage = (type ?? "").startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url);
  const isPdf = type === "application/pdf" || /\.pdf(\?|$)/i.test(url);

  // Google Docs Viewer كبديل احترافي يتجاوز قيود X-Frame-Options
  const gviewUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;

  // تحميل افتراضي عبر fetch — يعمل دائماً حتى دون تمرير onDownload
  const handleFallbackDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = name || "file";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // كحل أخير، فتح الرابط مباشرة
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  };

  const triggerDownload = onDownload ?? handleFallbackDownload;

  return (
    <div className={`flex flex-col h-full bg-background ${className}`}>
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b bg-gradient-to-l from-primary/5 to-transparent shrink-0">
        <p className="text-sm font-bold truncate flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <span className="truncate">{name ?? "معاينة الملف"}</span>
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border bg-background hover:bg-muted transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" /> فتح في تبويب جديد
          </a>
          <button
            onClick={triggerDownload}
            disabled={downloading}
            className="text-[11px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gradient-to-r from-primary to-primary/85 text-primary-foreground font-bold hover:opacity-90 transition shadow-sm disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" /> {downloading ? "جاري التحميل..." : "تحميل"}
          </button>
        </div>
      </div>

      <div className="flex-1 bg-muted/20 overflow-auto flex items-center justify-center min-h-[60vh]">
        {isImage ? (
          <img src={url} alt={name ?? ""} className="max-h-full max-w-full object-contain" />
        ) : isPdf ? (
          !objectFailed ? (
            <object
              data={url}
              type="application/pdf"
              className="w-full h-full min-h-[70vh]"
              onError={() => setObjectFailed(true)}
            >
              {!viewerFailed ? (
                <iframe
                  src={gviewUrl}
                  title={name ?? "معاينة"}
                  className="w-full h-full min-h-[70vh] border-0"
                  onError={() => setViewerFailed(true)}
                />
              ) : (
                <FallbackBlocked url={url} onDownload={triggerDownload} />
              )}
            </object>
          ) : !viewerFailed ? (
            <iframe
              src={gviewUrl}
              title={name ?? "معاينة"}
              className="w-full h-full min-h-[70vh] border-0"
              onError={() => setViewerFailed(true)}
            />
          ) : (
            <FallbackBlocked url={url} onDownload={triggerDownload} />
          )
        ) : (
          <FallbackBlocked url={url} onDownload={triggerDownload} message="هذا النوع من الملفات غير قابل للمعاينة المباشرة." />
        )}
      </div>
    </div>
  );
}

function FallbackBlocked({ url, onDownload, message }: { url: string; onDownload?: () => void; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-10 text-center max-w-md">
      <div className="h-14 w-14 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
        <AlertCircle className="h-7 w-7 text-amber-600" />
      </div>
      <div>
        <p className="text-sm font-bold mb-1">تعذّر عرض الملف داخل الصفحة</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {message ?? "قام المتصفح بحظر المعاينة المضمّنة. يمكنك فتح الملف في تبويب جديد أو تحميله مباشرةً."}
        </p>
      </div>
      <div className="flex gap-2">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline" className="gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" /> فتح في تبويب جديد
          </Button>
        </a>
        {onDownload && (
          <Button size="sm" onClick={onDownload} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> تحميل الملف
          </Button>
        )}
      </div>
    </div>
  );
}