import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ExportRequest {
  title: string;
  committee: string;
  amount: number;
  status: string;
  date: string;
  description: string;
}

export interface FinanceSummary {
  totalCollected: number;
  totalSubs: number;
  pendingCount: number;
  totalPaid: number;
  delegatesCount: number;
}

const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(n);

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

/* ---------- CSV ---------- */
export function exportRequestsCSV(rows: ExportRequest[], filename: string) {
  const headers = ["العنوان", "اللجنة", "المبلغ (ر.س)", "الحالة", "التاريخ", "الوصف"];
  const escape = (v: string) => `"${(v ?? "").toString().replace(/"/g, '""')}"`;
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((r) =>
      [r.title, r.committee, r.amount, r.status, r.date, r.description].map((v) => escape(String(v))).join(","),
    ),
  ];
  // BOM for Arabic in Excel
  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `${filename}.csv`);
}

/* ---------- Excel (XLSX) ---------- */
export function exportRequestsXLSX(rows: ExportRequest[], filename: string, summary: FinanceSummary) {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ["تقرير اللجنة المالية"],
    [`تاريخ التصدير: ${new Date().toLocaleDateString("ar-SA")}`],
    [],
    ["البند", "القيمة"],
    ["إجمالي المحصّل (ر.س)", summary.totalCollected],
    ["عدد الاشتراكات المؤكدة", summary.totalSubs],
    ["عدد المناديب", summary.delegatesCount],
    ["طلبات قيد المراجعة", summary.pendingCount],
    ["إجمالي المصروف (ر.س)", summary.totalPaid],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 28 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "ملخص");

  // Requests sheet
  const requestsData = [
    ["العنوان", "اللجنة", "المبلغ (ر.س)", "الحالة", "التاريخ", "الوصف"],
    ...rows.map((r) => [r.title, r.committee, r.amount, r.status, r.date, r.description]),
  ];
  const wsRequests = XLSX.utils.aoa_to_sheet(requestsData);
  wsRequests["!cols"] = [
    { wch: 32 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 40 },
  ];
  if (!wsRequests["!views"]) wsRequests["!views"] = [{ RTL: true }];
  XLSX.utils.book_append_sheet(wb, wsRequests, "طلبات الصرف");

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/* ---------- PDF (branded) ---------- */
export function exportRequestsPDF(rows: ExportRequest[], filename: string, summary: FinanceSummary) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Brand header — gold band
  doc.setFillColor(196, 162, 92); // gold
  doc.rect(0, 0, pageW, 56, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Family Wedding Platform", 28, 26);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Finance Committee — Payment Requests Report", 28, 44);

  // Date
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(10);
  doc.text(`Exported: ${new Date().toLocaleString("en-GB")}`, pageW - 28, 80, { align: "right" });

  // Summary cards (numbers only — Arabic table content rendered as-is by autotable using built-in font)
  const summaryY = 100;
  const cards: [string, string][] = [
    ["Collected (SAR)", fmt(summary.totalCollected)],
    ["Confirmed Subs", String(summary.totalSubs)],
    ["Delegates", String(summary.delegatesCount)],
    ["Pending Reqs", String(summary.pendingCount)],
    ["Paid (SAR)", fmt(summary.totalPaid)],
  ];
  const cardW = (pageW - 56 - (cards.length - 1) * 10) / cards.length;
  cards.forEach((c, i) => {
    const x = 28 + i * (cardW + 10);
    doc.setFillColor(245, 240, 230);
    doc.roundedRect(x, summaryY, cardW, 50, 6, 6, "F");
    doc.setTextColor(120, 100, 60);
    doc.setFontSize(9);
    doc.text(c[0], x + 10, summaryY + 18);
    doc.setTextColor(20, 70, 80); // teal
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(c[1], x + 10, summaryY + 38);
    doc.setFont("helvetica", "normal");
  });

  // Table
  autoTable(doc, {
    startY: summaryY + 70,
    head: [["#", "Title", "Committee", "Amount (SAR)", "Status", "Date"]],
    body: rows.map((r, i) => [
      String(i + 1),
      r.title,
      r.committee,
      fmt(r.amount),
      r.status,
      r.date,
    ]),
    headStyles: {
      fillColor: [20, 70, 80], // teal
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },
    bodyStyles: { halign: "center", valign: "middle" },
    alternateRowStyles: { fillColor: [250, 247, 240] },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { halign: "left", cellWidth: 200 },
      2: { cellWidth: 130 },
      3: { cellWidth: 90 },
      4: { cellWidth: 80 },
      5: { cellWidth: 90 },
    },
    margin: { left: 28, right: 28 },
    styles: { fontSize: 9, cellPadding: 6 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setTextColor(150);
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 16,
      { align: "center" },
    );
  }

  doc.save(`${filename}.pdf`);
}
