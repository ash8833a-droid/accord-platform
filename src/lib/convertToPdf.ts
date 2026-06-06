/**
 * Client-side conversion of .docx / .xlsx files to PDF blobs.
 * Used so attachments can be previewed and downloaded as PDF directly.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const DOCX_TYPES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const XLSX_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

export function isConvertibleToPdf(file: { name: string; type?: string | null }): boolean {
  const t = (file.type || "").toLowerCase();
  const n = file.name.toLowerCase();
  if (DOCX_TYPES.includes(t) || n.endsWith(".docx")) return true;
  if (XLSX_TYPES.includes(t) || n.endsWith(".xlsx") || n.endsWith(".xls")) return true;
  return false;
}

function isDocx(file: { name: string; type?: string | null }) {
  return DOCX_TYPES.includes((file.type || "").toLowerCase()) || file.name.toLowerCase().endsWith(".docx");
}

function isXlsx(file: { name: string; type?: string | null }) {
  const t = (file.type || "").toLowerCase();
  const n = file.name.toLowerCase();
  return XLSX_TYPES.includes(t) || n.endsWith(".xlsx") || n.endsWith(".xls");
}

/** Convert a docx blob to a PDF Blob using mammoth + jsPDF.html. */
async function convertDocxToPdf(file: File): Promise<Blob> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

  // Render in an offscreen container so jsPDF.html can capture it.
  const container = document.createElement("div");
  container.setAttribute("dir", "rtl");
  container.style.cssText = [
    "position:fixed",
    "top:-10000px",
    "right:0",
    "width:794px", // ~ A4 width @ 96dpi
    "padding:32px",
    "background:#fff",
    "color:#111",
    "font-family:Arial, 'Segoe UI', Tahoma, sans-serif",
    "font-size:14px",
    "line-height:1.7",
  ].join(";");
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    await pdf.html(container, {
      autoPaging: "text",
      margin: [24, 24, 24, 24],
      html2canvas: { scale: 0.6, useCORS: true, backgroundColor: "#ffffff" },
    });
    return pdf.output("blob");
  } finally {
    container.remove();
  }
}

/** Convert an xlsx file to PDF — one table per worksheet. */
async function convertXlsxToPdf(file: File): Promise<Blob> {
  const XLSX = await import("xlsx");
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });

  wb.SheetNames.forEach((name, idx) => {
    if (idx > 0) pdf.addPage();
    const sheet = wb.Sheets[name];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });
    pdf.setFontSize(14);
    pdf.text(name, 40, 30);
    if (rows.length) {
      const head = rows[0].map((c) => String(c ?? ""));
      const body = rows.slice(1).map((r) => r.map((c) => String(c ?? "")));
      autoTable(pdf, {
        head: [head],
        body,
        startY: 50,
        styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
        headStyles: { fillColor: [37, 99, 235] },
        margin: { left: 24, right: 24 },
      });
    }
  });

  return pdf.output("blob");
}

export async function convertFileToPdf(file: File): Promise<Blob | null> {
  try {
    if (isDocx(file)) return await convertDocxToPdf(file);
    if (isXlsx(file)) return await convertXlsxToPdf(file);
    return null;
  } catch (err) {
    console.error("convertFileToPdf failed", err);
    return null;
  }
}