/**
 * Client-side conversion of .docx / .xlsx files to PDF blobs.
 * Used so attachments can be previewed and downloaded as PDF directly.
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

/**
 * Render an HTML element to a multi-page PDF Blob by rasterizing it with
 * html2canvas — this preserves Arabic / RTL glyphs because the browser does
 * the text shaping, not jsPDF.
 */
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

  // Source-pixel height per page (we slice the big canvas into pages)
  const pxPerPage = (canvas.width * (pageH - margin * 2)) / usableW;

  let renderedHeight = 0;
  let pageIndex = 0;
  while (renderedHeight < canvas.height) {
    const sliceHeight = Math.min(pxPerPage, canvas.height - renderedHeight);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;
    const ctx = pageCanvas.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(
      canvas,
      0, renderedHeight, canvas.width, sliceHeight,
      0, 0, canvas.width, sliceHeight,
    );
    const imgData = pageCanvas.toDataURL("image/jpeg", 0.92);
    if (pageIndex > 0) pdf.addPage();
    const drawH = (sliceHeight * usableW) / canvas.width;
    pdf.addImage(img

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