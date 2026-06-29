import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, Trash2, Plus, Undo2, Pencil, X } from "lucide-react";
import { printHtmlDocument } from "@/lib/print-frame";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  loadHtml: () => Promise<string>;
  printTitle: string;
}

/**
 * Interactive editor that lets the user add / edit / delete any item in
 * the generated report HTML before printing. The body is wrapped in a
 * `contentEditable` container; clicking an element selects it so the user
 * can delete it or insert a new row beside it.
 */
export function ReportEditorDialog({ open, onOpenChange, title, loadHtml, printTitle }: Props) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<HTMLElement | null>(null);
  const historyRef = useRef<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    loadHtml()
      .then((h) => { setHtml(h); historyRef.current = []; })
      .catch((e) => toast.error("تعذّر تحميل التقرير", { description: String(e?.message ?? e) }))
      .finally(() => setLoading(false));
  }, [open, loadHtml]);

  const clearSelection = () => {
    if (selectedRef.current) selectedRef.current.style.outline = "";
    selectedRef.current = null;
    setSelectedTag("");
  };

  const snapshot = () => {
    if (containerRef.current) historyRef.current.push(containerRef.current.innerHTML);
    if (historyRef.current.length > 50) historyRef.current.shift();
  };

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target || target === containerRef.current) return;
    // Skip selecting deep text nodes; pick the meaningful block
    let el: HTMLElement | null = target;
    // If clicking inside a TD, select the TR by default for easy row delete
    if (el.tagName === "TD" || el.tagName === "TH") {
      const tr = el.closest("tr") as HTMLElement | null;
      if (tr) el = tr;
    }
    if (selectedRef.current && selectedRef.current !== el) {
      selectedRef.current.style.outline = "";
    }
    selectedRef.current = el;
    el.style.outline = "2px dashed #C4A25C";
    el.style.outlineOffset = "2px";
    setSelectedTag(el.tagName.toLowerCase());
  };

  const deleteSelected = () => {
    const el = selectedRef.current;
    if (!el) { toast.info("اختر عنصراً أولاً بالنقر عليه"); return; }
    snapshot();
    el.remove();
    clearSelection();
  };

  const addRow = () => {
    const el = selectedRef.current;
    const tr = el?.closest("tr") as HTMLTableRowElement | null;
    const tbody = (tr?.parentElement ?? el?.closest("tbody")) as HTMLTableSectionElement | null;
    if (!tbody) { toast.info("اختر صفاً داخل جدول لإضافة صف جديد"); return; }
    snapshot();
    const reference = tr ?? tbody.lastElementChild as HTMLTableRowElement | null;
    const cols = reference ? reference.cells.length : (tbody.closest("table")?.querySelector("thead tr")?.children.length ?? 1);
    const newRow = document.createElement("tr");
    for (let i = 0; i < cols; i++) {
      const td = document.createElement("td");
      td.innerHTML = "—";
      newRow.appendChild(td);
    }
    if (tr && tr.nextSibling) tbody.insertBefore(newRow, tr.nextSibling);
    else tbody.appendChild(newRow);
    // auto-select the new row
    if (selectedRef.current) selectedRef.current.style.outline = "";
    selectedRef.current = newRow;
    newRow.style.outline = "2px dashed #C4A25C";
    newRow.style.outlineOffset = "2px";
    setSelectedTag("tr");
  };

  const undo = () => {
    const last = historyRef.current.pop();
    if (!last || !containerRef.current) { toast.info("لا يوجد ما يمكن التراجع عنه"); return; }
    clearSelection();
    containerRef.current.innerHTML = last;
  };

  const handleInput = () => {
    // mark as edited via snapshot only on structural changes; text edits are tracked by browser
  };

  const handlePrint = async () => {
    if (!containerRef.current) return;
    clearSelection();
    // Strip any leftover outline styles we added on selection
    const cleanWrap = containerRef.current.cloneNode(true) as HTMLElement;
    cleanWrap.querySelectorAll<HTMLElement>("[style*='outline']").forEach((n) => {
      n.style.outline = "";
      n.style.outlineOffset = "";
    });
    try {
      await printHtmlDocument(cleanWrap.innerHTML, printTitle);
    } catch (e: any) {
      toast.error("تعذّرت الطباعة", { description: String(e?.message ?? e) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) clearSelection(); onOpenChange(o); }}>
      <DialogContent
        dir="rtl"
        className="max-w-6xl w-[96vw] h-[92vh] p-0 overflow-hidden flex flex-col bg-slate-50"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-b bg-white shrink-0">
          <div className="flex items-center gap-2 ms-auto">
            <span className="text-xs text-slate-500 hidden sm:inline">
              <Pencil className="inline h-3.5 w-3.5 ms-1" />
              انقر على أي عنصر لتعديله أو حذفه — يمكنك الكتابة مباشرة داخل النص
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={addRow} className="gap-1.5">
            <Plus className="h-4 w-4" /> إضافة صف
          </Button>
          <Button size="sm" variant="outline" onClick={deleteSelected} className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50">
            <Trash2 className="h-4 w-4" /> حذف العنصر {selectedTag ? `(${selectedTag})` : ""}
          </Button>
          <Button size="sm" variant="outline" onClick={undo} className="gap-1.5">
            <Undo2 className="h-4 w-4" /> تراجع
          </Button>
          <Button size="sm" onClick={handlePrint} className="gap-1.5 bg-teal-700 hover:bg-teal-800 text-white">
            <Printer className="h-4 w-4" /> طباعة / PDF
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Editable canvas */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin ms-2" /> جاري تجهيز التقرير...
            </div>
          ) : (
            <div className="mx-auto max-w-[210mm] bg-white shadow-md rounded-md p-6">
              <div
                ref={containerRef}
                contentEditable
                suppressContentEditableWarning
                onClick={handleClick}
                onInput={handleInput}
                className="report-edit-canvas outline-none"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}