/**
 * Client-side conversion of .docx / .xlsx files to PDF blobs.
 * Renders source content as HTML in a hidden DOM node, then rasterizes it
 * with html2canvas so Arabic / RTL text is preserved (jsPDF's built-in
 * fonts do not support Arabic shaping).
 */
import { jsPDF } from "jspdf";

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

/** Rasterize an HTML element into a multi-page A4 PDF blob. */
async function htmlElementToPdfBlob(
  el: HTMLElement,
  orientation: "portrait" | "landscape" = "portrait",
): Promise<Blob> {
  const html2canvas = (await import("html2canvas")).default;
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    windowWidth: el.scrollWidth,
  });

  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const usableW = pageW - margin * 2;
  const pxPerPage = (canvas.width * (pageH - margin * 2)) / usableW;

  let rendered = 0;
  let pageIndex = 0;
  while (rendered < canvas.height) {
    const sliceH = Math.min(pxPerPage, canvas.height - rendered);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceH;
    const ctx = pageCanvas.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(canvas, 0, rendered, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    const imgData = pageCanvas.toDataURL("image/jpeg", 0.92);
    if (pageIndex > 0) pdf.addPage();
    const drawH = (sliceH * usableW) / canvas.width;
    pdf.addImage(imgData, "JPEG", margin, margin, usableW, drawH, undefined, "FAST");
    rendered += sliceH;
    pageIndex += 1;
  }

  return pdf.output("blob");
}

const SHARED_CONTAINER_STYLE = [
  "position:fixed",
  "top:-10000px",
  "right:0",
  "width:794px",
  "padding:32px",
  "background:#ffffff",
  "color:#111827",
  "font-family:'Segoe UI', Tahoma, Arial, 'Noto Naskh Arabic', 'Geeza Pro', sans-serif",
  "font-size:14px",
  "line-height:1.9",
  "direction:rtl",
  "text-align:right",
  "word-wrap:break-word",
].join(";");

async function convertDocxToPdf(file: File): Promise<Blob> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

  const container = document.createElement("div");
  container.setAttribute("dir", "rtl");
  container.style.cssText = SHARED_CONTAINER_STYLE;
  container.innerHTML = `
    <style>
      h1,h2,h3,h4 { margin: 12px 0 8px; font-weight: 700; }
      p { margin: 6px 0; }
      table { border-collapse: collapse; width: 100%; margin: 8px 0; }
      th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; }
      ul, ol { padding-inline-start: 24px; }
      img { max-width: 100%; height: auto; }
    </style>
    ${html}
  `;
  document.body.appendChild(container);
  try {
    return await htmlElementToPdfBlob(container, "portrait");
  } finally {
    container.remove();
  }
}

async function convertXlsxToPdf(file: File): Promise<Blob> {
  const XLSX = await import("xlsx");
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: "array" });

  const container = document.createElement("div");
  container.setAttribute("dir", "rtl");
  container.style.cssText = SHARED_CONTAINER_STYLE
    .replace("width:794px", "width:1100px")
    .replace("font-size:14px", "font-size:12px");

  const parts: string[] = [
    `<style>
      h2 { margin: 16px 0 8px; font-weight: 700; color:#1e40af; font-size: 16px; }
      table { border-collapse: collapse; width: 100%; margin: 4px 0 16px; table-layout: auto; }
      th { background:#dbeafe; color:#1e3a8a; }
      th, td { border: 1px solid #94a3b8; padding: 4px 6px; text-align: right; vertical-align: top; word-break: break-word; }
    </style>`,
  ];

  wb.SheetNames.forEach((name) => {
    const sheet = wb.Sheets[name];
    // sheet_to_html gives a real HTML table that html2canvas can rasterize
    const tableHtml = XLSX.utils.sheet_to_html(sheet, { editable: false });
    parts.push(`<h2>${escapeHtml(name)}</h2>`);
    parts.push(tableHtml);
  });
  container.innerHTML = parts.join("");
  document.body.appendChild(container);
  try {
    return await htmlElementToPdfBlob(container, "landscape");
  } finally {
    container.remove();
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
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
