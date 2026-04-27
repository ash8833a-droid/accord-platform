import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FilePreview } from "@/components/FilePreview";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  name?: string;
  type?: string;
  onDownload?: () => void;
}

/**
 * نافذة معاينة موحّدة لكل المرفقات في المنصة.
 * تعتمد دائماً على <FilePreview /> لضمان نفس التجربة (معاينة + فتح + تحميل).
 */
export function AttachmentPreviewDialog({ open, onOpenChange, url, name, type, onDownload }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 overflow-hidden flex flex-col">
        <VisuallyHidden>
          <DialogTitle>{name ?? "معاينة الملف"}</DialogTitle>
        </VisuallyHidden>
        {url ? (
          <FilePreview url={url} name={name} type={type} onDownload={onDownload} className="h-full" />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">جاري التحضير...</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
