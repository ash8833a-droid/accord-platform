import { useRef, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDown, Loader2 } from "lucide-react";

interface MyTask {
  id: string;
  title: string;
  description?: string | null;
  status: "todo" | "in_progress" | "completed";
  priority: "low" | "medium" | "high" | "urgent";
  due_date?: string | null;
  committee_id: string;
  committee_name: string;
  committee_type: string;
}
interface MyPaymentRequest {
  id: string;
  title: string;
  amount: number;
  status: string;
  created_at: string;
  committee_id: string;
  committee_name: string;
  committee_type: string;
}

const PR_LABEL: Record<string, string> = {
  pending: "قيد الانتظار",
  approved: "معتمد",
  rejected: "مرفوض",
  paid: "مدفوع",
};
const STATUS_LABEL: Record<string, string> = {
  todo: "في الانتظار",
  in_progress: "قيد التنفيذ",
  completed: "مكتملة",
};
const PRIORITY_LABEL: Record<string, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  urgent: "عاجلة",
};

interface Props {
  userName: string;
  committeesCount: number;
  tasks: MyTask[];
  payments: MyPaymentRequest[];
}

export function PortalReportDialog({ userName, committeesCount, tasks, payments }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [generating, setGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const fromDate = new Date(from + "T00:00:00");
  const toDate = new Date(to + "T23:59:59");

  const inRange = (iso?: string | null) => {
    if (!iso) return false;
    const d = new Date(iso);
    return d >= fromDate && d <= toDate;
  };

  // Tasks: filter by created/due window — use due_date when present else include all (active)
  const filteredTasks = tasks.filter((t) => {
    // include if due_date in range, OR completed in range (approx via no created_at here) — we use due_date primarily
    if (t.due_date && inRange(t.due_date)) return true;
    // fallback: include open tasks (todo/in_progress) regardless if no due
    if (!t.due_date && t.status !== "completed") return true;
    return false;
  });
  const filteredPayments = payments.filter((p) => inRange(p.created_at));

  const total = filteredTasks.length;
  const done = filteredTasks.filter((t) => t.status === "completed").length;
  const inProg = filteredTasks.filter((t) => t.status === "in_progress").length;
  const todo = filteredTasks.filter((t) => t.status === "todo").length;
  const overdue = filteredTasks.filter(
    (t) => t.status !== "completed" && t.due_date && new Date(t.due_date) < new Date()
  ).length;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
  const pendingPay = filteredPayments.filter((p) => p.status === "pending").length;
  const paidPay = filteredPayments.filter((p) => p.status === "paid");
  const paidAmount = paidPay.reduce((s, p) => s + Number(p.amount || 0), 0);
  const requestedAmount = filteredPayments.reduce((s, p) => s + Number(p.amount || 0), 0);

  const arDate = (iso: string) => new Date(iso).toLocaleDateString("ar-SA");

  const handleGenerate = async () => {
    if (!printRef.current) return;
    setGenerating(true);
    try {
      // Make element visible for capture
      const node = printRef.current;
      node.style.position = "fixed";
      node.style.left = "0";
      node.style.top = "0";
      node.style.zIndex = "-1";
      node.style.opacity = "1";
      node.style.pointerEvents = "none";

      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        windowWidth: 794,
      });
      // restore hidden
      node.style.opacity = "0";
      node.style.zIndex = "-9999";

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`تقرير-بوابتي-${from}-إلى-${to}.pdf`);
      setOpen(false);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileDown className="h-4 w-4" /> تقرير PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>توليد تقرير PDF</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            يلخّص التقرير مهامك ومؤشرات الإنجاز وطلبات الصرف خلال الفترة المختارة.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="from">من</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to">إلى</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
            <div>المهام في النطاق: <b>{total}</b> · المكتمل: <b>{done}</b> · المتأخر: <b>{overdue}</b></div>
            <div>طلبات الصرف: <b>{filteredPayments.length}</b> · المدفوع: <b>{paidAmount.toLocaleString()} ر.س</b></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={generating}>إلغاء</Button>
          <Button onClick={handleGenerate} disabled={generating || from > to} className="gap-2">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            توليد وتنزيل
          </Button>
        </DialogFooter>

        {/* Hidden printable area */}
        <div
          ref={printRef}
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            zIndex: -9999,
            opacity: 0,
            width: "794px",
            background: "#ffffff",
            color: "#0f172a",
            padding: "32px",
            fontFamily: "'Noto Sans Arabic', 'Tajawal', system-ui, sans-serif",
            direction: "rtl",
          }}
        >
          <div style={{ borderBottom: "3px solid #0ea5e9", paddingBottom: "12px", marginBottom: "16px" }}>
            <h1 style={{ fontSize: "22px", fontWeight: 800, margin: 0 }}>تقرير بوابتي الشخصي</h1>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 0" }}>
              {userName} · من {arDate(from)} إلى {arDate(to)} · {committeesCount} لجنة
            </p>
          </div>

          <h2 style={{ fontSize: "14px", fontWeight: 700, margin: "12px 0 8px" }}>مؤشرات الإنجاز</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <tbody>
              {[
                ["إجمالي المهام", String(total)],
                ["مكتملة", `${done} (${completionRate}%)`],
                ["قيد التنفيذ", String(inProg)],
                ["في الانتظار", String(todo)],
                ["متأخرة", String(overdue)],
                ["طلبات الصرف", String(filteredPayments.length)],
                ["معلّقة", String(pendingPay)],
                ["إجمالي المطلوب", `${requestedAmount.toLocaleString()} ر.س`],
                ["إجمالي المدفوع", `${paidAmount.toLocaleString()} ر.س`],
              ].map(([k, v], i) => (
                <tr key={i} style={{ background: i % 2 ? "#f8fafc" : "#ffffff" }}>
                  <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0", width: "55%" }}>{k}</td>
                  <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0", fontWeight: 700 }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 style={{ fontSize: "14px", fontWeight: 700, margin: "18px 0 8px" }}>
            المهام ({filteredTasks.length})
          </h2>
          {filteredTasks.length === 0 ? (
            <p style={{ fontSize: "12px", color: "#64748b" }}>لا توجد مهام في هذا النطاق.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
              <thead>
                <tr style={{ background: "#0ea5e9", color: "#fff" }}>
                  <th style={{ padding: "6px", border: "1px solid #0284c7", textAlign: "right" }}>المهمة</th>
                  <th style={{ padding: "6px", border: "1px solid #0284c7" }}>اللجنة</th>
                  <th style={{ padding: "6px", border: "1px solid #0284c7" }}>الحالة</th>
                  <th style={{ padding: "6px", border: "1px solid #0284c7" }}>الأولوية</th>
                  <th style={{ padding: "6px", border: "1px solid #0284c7" }}>الاستحقاق</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.slice(0, 80).map((t, i) => (
                  <tr key={t.id} style={{ background: i % 2 ? "#f8fafc" : "#ffffff" }}>
                    <td style={{ padding: "6px", border: "1px solid #e2e8f0" }}>{t.title}</td>
                    <td style={{ padding: "6px", border: "1px solid #e2e8f0" }}>{t.committee_name}</td>
                    <td style={{ padding: "6px", border: "1px solid #e2e8f0" }}>{STATUS_LABEL[t.status]}</td>
                    <td style={{ padding: "6px", border: "1px solid #e2e8f0" }}>{PRIORITY_LABEL[t.priority]}</td>
                    <td style={{ padding: "6px", border: "1px solid #e2e8f0" }}>
                      {t.due_date ? arDate(t.due_date) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2 style={{ fontSize: "14px", fontWeight: 700, margin: "18px 0 8px" }}>
            طلبات الصرف ({filteredPayments.length})
          </h2>
          {filteredPayments.length === 0 ? (
            <p style={{ fontSize: "12px", color: "#64748b" }}>لا توجد طلبات صرف في هذا النطاق.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
              <thead>
                <tr style={{ background: "#0ea5e9", color: "#fff" }}>
                  <th style={{ padding: "6px", border: "1px solid #0284c7", textAlign: "right" }}>الطلب</th>
                  <th style={{ padding: "6px", border: "1px solid #0284c7" }}>اللجنة</th>
                  <th style={{ padding: "6px", border: "1px solid #0284c7" }}>التاريخ</th>
                  <th style={{ padding: "6px", border: "1px solid #0284c7" }}>المبلغ</th>
                  <th style={{ padding: "6px", border: "1px solid #0284c7" }}>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p, i) => (
                  <tr key={p.id} style={{ background: i % 2 ? "#f8fafc" : "#ffffff" }}>
                    <td style={{ padding: "6px", border: "1px solid #e2e8f0" }}>{p.title}</td>
                    <td style={{ padding: "6px", border: "1px solid #e2e8f0" }}>{p.committee_name}</td>
                    <td style={{ padding: "6px", border: "1px solid #e2e8f0" }}>{arDate(p.created_at)}</td>
                    <td style={{ padding: "6px", border: "1px solid #e2e8f0", fontWeight: 700 }}>
                      {Number(p.amount).toLocaleString()} ر.س
                    </td>
                    <td style={{ padding: "6px", border: "1px solid #e2e8f0" }}>{PR_LABEL[p.status] ?? p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p style={{ fontSize: "10px", color: "#94a3b8", marginTop: "20px", textAlign: "center" }}>
            تم التوليد في {new Date().toLocaleString("ar-SA")} · منصة القبيلة
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}