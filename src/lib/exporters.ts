import * as XLSX from "xlsx";
import { BRAND_LOGO_DATA_URI } from "@/assets/brand-logo";
import { DEFAULT_BRAND, BrandIdentity } from "@/lib/brand";

// Runtime brand cache used by exports. Updated by initBrandForExports().
let exportBrand: BrandIdentity = DEFAULT_BRAND;
let exportLogoSrc: string = BRAND_LOGO_DATA_URI;

export function setExportBrand(b: BrandIdentity, logoDataUri?: string) {
  exportBrand = b;
  exportLogoSrc = logoDataUri || b.logo_url || BRAND_LOGO_DATA_URI;
}

export interface ReportSignature {
  name: string;        // اسم رئيس اللجنة
  title?: string;      // المسمى الوظيفي مثل "رئيس اللجنة المالية"
  committee?: string;  // اسم اللجنة
}

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

const arabicStatus = (s: string) => {
  const map: Record<string, string> = {
    pending: "قيد المراجعة",
    approved: "معتمد",
    rejected: "مرفوض",
    paid: "مصروف",
  };
  return map[s] ?? s;
};

const todayAr = () =>
  new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());

/* ---------- CSV ---------- */
export function exportRequestsCSV(rows: ExportRequest[], filename: string) {
  const headers = ["العنوان", "اللجنة", "المبلغ (ر.س)", "الحالة", "التاريخ", "الوصف"];
  const escape = (v: string) => `"${(v ?? "").toString().replace(/"/g, '""')}"`;
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((r) =>
      [r.title, r.committee, r.amount, arabicStatus(r.status), r.date, r.description]
        .map((v) => escape(String(v)))
        .join(","),
    ),
  ];
  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `${filename}.csv`);
}

/* ---------- Excel (XLSX) ---------- */
export function exportRequestsXLSX(
  rows: ExportRequest[],
  filename: string,
  summary: FinanceSummary,
) {
  const wb = XLSX.utils.book_new();

  const summaryData = [
    [`${exportBrand.name} — تقرير اللجنة المالية`],
    [exportBrand.subtitle],
    [`تاريخ التصدير: ${todayAr()}`],
    [],
    ["البند", "القيمة"],
    ["إجمالي المحصّل (ر.س)", summary.totalCollected],
    ["عدد الاشتراكات المؤكدة", summary.totalSubs],
    ["عدد المناديب", summary.delegatesCount],
    ["طلبات قيد المراجعة", summary.pendingCount],
    ["إجمالي المصروف (ر.س)", summary.totalPaid],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 32 }, { wch: 22 }];
  wsSummary["!views"] = [{ RTL: true }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "ملخص");

  const requestsData = [
    ["#", "العنوان", "اللجنة", "المبلغ (ر.س)", "الحالة", "التاريخ", "الوصف"],
    ...rows.map((r, i) => [
      i + 1,
      r.title,
      r.committee,
      r.amount,
      arabicStatus(r.status),
      r.date,
      r.description,
    ]),
  ];
  const wsRequests = XLSX.utils.aoa_to_sheet(requestsData);
  wsRequests["!cols"] = [
    { wch: 5 },
    { wch: 32 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 40 },
  ];
  wsRequests["!views"] = [{ RTL: true }];
  XLSX.utils.book_append_sheet(wb, wsRequests, "طلبات الصرف");

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/* ---------- PDF (Arabic, branded, via print) ---------- */
export function exportRequestsPDF(
  rows: ExportRequest[],
  filename: string,
  summary: FinanceSummary,
  signature?: ReportSignature,
) {
  const statusBadge = (s: string) => {
    const tone: Record<string, string> = {
      pending: "background:#FEF3C7;color:#92400E",
      approved: "background:#DCFCE7;color:#166534",
      rejected: "background:#FEE2E2;color:#991B1B",
      paid: "background:#DBEAFE;color:#1E40AF",
    };
    return `<span style="${tone[s] ?? "background:#E5E7EB;color:#374151"};padding:3px 10px;border-radius:999px;font-size:10pt;font-weight:600;display:inline-block;">${arabicStatus(s)}</span>`;
  };

  const cards = [
    { label: "إجمالي المحصّل", value: `${fmt(summary.totalCollected)} ر.س`, accent: "teal" },
    { label: "اشتراكات مؤكدة", value: fmt(summary.totalSubs), accent: "gold" },
    { label: "عدد المناديب", value: fmt(summary.delegatesCount), accent: "teal" },
    { label: "قيد المراجعة", value: fmt(summary.pendingCount), accent: "gold" },
    { label: "إجمالي المصروف", value: `${fmt(summary.totalPaid)} ر.س`, accent: "teal" },
  ];

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>${filename}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  html, body {
    font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif;
    color: #1f2937; margin: 0; padding: 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  /* Decorative pattern background */
  body::before {
    content: ""; position: fixed; inset: 0; z-index: -1; opacity: 0.08;
    background-image:
      radial-gradient(circle at 20% 20%, #C4A25C 1.5px, transparent 2px),
      radial-gradient(circle at 80% 60%, #1B4F58 1.5px, transparent 2px),
      radial-gradient(circle at 50% 90%, #C4A25C 1px, transparent 2px);
    background-size: 40px 40px, 60px 60px, 35px 35px;
  }
  .header {
    position: relative; overflow: hidden; border-radius: 18px;
    background: linear-gradient(135deg, ${exportBrand.primary_color} 0%, ${shade(exportBrand.primary_color, 0.15)} 50%, ${exportBrand.primary_color} 100%);
    color: #fff; padding: 22px 26px; margin-bottom: 18px;
    box-shadow: 0 10px 30px -10px ${hexToRgba(exportBrand.primary_color, 0.4)};
  }
  .header::after {
    content: ""; position: absolute; left: -40px; top: -40px; width: 200px; height: 200px;
    background: radial-gradient(circle, ${hexToRgba(exportBrand.gold_color, 0.35)}, transparent 70%);
    border-radius: 50%;
  }
  .header-pattern {
    position: absolute; inset: 0; opacity: 0.12;
    background-image:
      repeating-linear-gradient(45deg, ${exportBrand.gold_color} 0 1px, transparent 1px 14px),
      repeating-linear-gradient(-45deg, ${exportBrand.gold_color} 0 1px, transparent 1px 14px);
  }
  .h-row { display: flex; justify-content: space-between; align-items: center; position: relative; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .logo-img {
    width: 64px; height: 64px; border-radius: 14px;
    background: rgba(255,255,255,0.95);
    padding: 4px;
    box-shadow: 0 4px 14px rgba(0,0,0,0.18);
  }
  .logo-img img { width: 100%; height: 100%; display: block; }
  .brand h1 { margin: 0; font-size: 18pt; font-weight: 900; letter-spacing: 0.3px; }
  .brand p  { margin: 2px 0 0; font-size: 10pt; opacity: 0.85; }
  .h-meta { text-align: left; font-size: 9pt; opacity: 0.9; line-height: 1.6; }
  .h-meta b { display: block; font-size: 11pt; color: ${exportBrand.gold_color}; margin-bottom: 2px; }

  .title-bar {
    display: flex; align-items: center; gap: 10px; margin: 14px 0 10px;
  }
  .title-bar .bar { width: 5px; height: 28px; background: linear-gradient(180deg, ${exportBrand.gold_color}, ${exportBrand.primary_color}); border-radius: 3px; }
  .title-bar h2 { margin: 0; font-size: 14pt; font-weight: 800; color: ${exportBrand.primary_color}; }

  .cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 16px; }
  .card {
    border-radius: 12px; padding: 12px 10px; position: relative; overflow: hidden;
    border: 1px solid #E5E7EB; background: #fff;
  }
  .card.teal { background: linear-gradient(135deg, ${exportBrand.primary_color} 0%, ${shade(exportBrand.primary_color, 0.15)} 100%); color: #fff; }
  .card.gold { background: linear-gradient(135deg, ${exportBrand.gold_color} 0%, ${shade(exportBrand.gold_color, 0.18)} 100%); color: #2A1F0A; }
  .card .label { font-size: 9pt; opacity: 0.85; margin-bottom: 6px; font-weight: 500; }
  .card .value { font-size: 14pt; font-weight: 900; }
  .card::after {
    content: ""; position: absolute; left: -10px; bottom: -10px; width: 50px; height: 50px;
    border-radius: 50%; background: rgba(255,255,255,0.12);
  }

  table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 9.5pt; margin-top: 6px; }
  thead th {
    background: linear-gradient(135deg, ${exportBrand.primary_color}, ${shade(exportBrand.primary_color, 0.15)}); color: #fff;
    padding: 10px 8px; text-align: center; font-weight: 700; font-size: 10pt;
    border: none;
  }
  thead th:first-child { border-radius: 0 10px 10px 0; }
  thead th:last-child  { border-radius: 10px 0 0 10px; }
  tbody td {
    padding: 9px 8px; text-align: center; border-bottom: 1px solid #F1E9D6;
    vertical-align: middle;
  }
  tbody tr:nth-child(even) td { background: #FBF7EE; }
  tbody tr:hover td { background: #F4ECD9; }
  td.ttl { text-align: right; font-weight: 600; color: ${exportBrand.primary_color}; }
  td.amt { font-weight: 700; color: ${exportBrand.primary_color}; font-variant-numeric: tabular-nums; }

  .footer {
    margin-top: 20px; padding-top: 12px; border-top: 2px dashed #C4A25C;
    font-size: 8.5pt; color: #6B7280;
  }
  .footer .stamp { color: ${exportBrand.primary_color}; font-weight: 700; }
  .signatures {
    display: grid; grid-template-columns: 1fr 1fr; gap: 18px;
    margin-top: 18px;
  }
  .sig-box {
    border: 1px solid ${hexToRgba(exportBrand.gold_color, 0.45)}; border-radius: 12px; padding: 14px 16px;
    background: linear-gradient(135deg, ${hexToRgba(exportBrand.gold_color, 0.06)}, ${hexToRgba(exportBrand.primary_color, 0.04)});
    position: relative;
  }
  .sig-box .sig-label { font-size: 9pt; color: #6B7280; margin-bottom: 4px; }
  .sig-box .sig-name { font-size: 12pt; font-weight: 800; color: ${exportBrand.primary_color}; margin-bottom: 2px; }
  .sig-box .sig-title { font-size: 9pt; color: #8C6E2E; font-weight: 600; margin-bottom: 36px; }
  .sig-line {
    border-top: 1.5px dotted ${exportBrand.primary_color}; padding-top: 4px;
    text-align: center; font-size: 8pt; color: #9CA3AF;
  }
  .sig-stamp {
    position: absolute; left: 16px; bottom: 18px;
    width: 70px; height: 70px; border: 2px solid ${exportBrand.gold_color}; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: ${exportBrand.gold_color}; font-weight: 900; font-size: 7pt; text-align: center;
    transform: rotate(-12deg); opacity: 0.55;
  }
  .footer-bottom {
    display: flex; justify-content: space-between; margin-top: 14px;
  }
  .empty {
    text-align: center; padding: 40px; color: #9CA3AF; font-size: 11pt;
    border: 2px dashed #E5E7EB; border-radius: 12px;
  }
  @media print {
    .no-print { display: none !important; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
  }
  .toolbar {
    position: fixed; top: 12px; left: 12px; z-index: 10;
    display: flex; gap: 8px;
  }
  .toolbar button {
    background: ${exportBrand.primary_color}; color: #fff; border: 0; padding: 10px 18px;
    border-radius: 10px; font-family: inherit; font-weight: 700; cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-size: 11pt;
  }
  .toolbar button.gold { background: ${exportBrand.gold_color}; color: ${exportBrand.primary_color}; }
</style>
</head>
<body>
  <div class="toolbar no-print">
    <button onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
    <button class="gold" onclick="window.close()">إغلاق</button>
  </div>

  <div class="header">
    <div class="header-pattern"></div>
    <div class="h-row">
      <div class="brand">
        <div class="logo-img"><img src="${exportLogoSrc}" alt="${escapeHtml(exportBrand.name)}" crossorigin="anonymous"/></div>
        <div>
          <h1>${escapeHtml(exportBrand.name)}</h1>
          <p>تقرير اللجنة المالية — طلبات الصرف والاشتراكات</p>
        </div>
      </div>
      <div class="h-meta">
        <b>مرجع التقرير</b>
        ${escapeHtml(filename)}<br/>
        ${todayAr()}
      </div>
    </div>
  </div>

  <div class="title-bar">
    <div class="bar"></div>
    <h2>الملخص التنفيذي</h2>
  </div>

  <div class="cards">
    ${cards
      .map(
        (c) => `
      <div class="card ${c.accent}">
        <div class="label">${c.label}</div>
        <div class="value">${c.value}</div>
      </div>`,
      )
      .join("")}
  </div>

  <div class="title-bar">
    <div class="bar"></div>
    <h2>تفاصيل طلبات الصرف (${fmt(rows.length)} طلب)</h2>
  </div>

  ${
    rows.length === 0
      ? `<div class="empty">لا توجد طلبات صرف مسجّلة في هذه الفترة</div>`
      : `<table>
    <thead>
      <tr>
        <th style="width:5%">#</th>
        <th style="width:28%">عنوان الطلب</th>
        <th style="width:18%">اللجنة</th>
        <th style="width:13%">المبلغ (ر.س)</th>
        <th style="width:12%">الحالة</th>
        <th style="width:14%">التاريخ</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td class="ttl">${escapeHtml(r.title)}</td>
          <td>${escapeHtml(r.committee)}</td>
          <td class="amt">${fmt(r.amount)}</td>
          <td>${statusBadge(r.status)}</td>
          <td>${escapeHtml(r.date)}</td>
        </tr>`,
        )
        .join("")}
    </tbody>
  </table>`
  }

  <div class="footer">
    <div class="signatures">
      <div class="sig-box">
        <div class="sig-label">اعتمد من قِبل</div>
        <div class="sig-name">${escapeHtml(signature?.name ?? "................................")}</div>
        <div class="sig-title">${escapeHtml(signature?.title ?? "رئيس اللجنة")}${signature?.committee ? " — " + escapeHtml(signature.committee) : ""}</div>
        <div class="sig-line">التوقيع والتاريخ</div>
        <div class="sig-stamp">ختم<br/>اللجنة</div>
      </div>
      <div class="sig-box">
        <div class="sig-label">اطّلع عليه</div>
        <div class="sig-name">................................</div>
        <div class="sig-title">رئيس اللجنة العليا للبرنامج</div>
        <div class="sig-line">التوقيع والتاريخ</div>
        <div class="sig-stamp">ختم<br/>الإدارة</div>
      </div>
    </div>
    <div class="footer-bottom">
      <div>
        <span class="stamp">${escapeHtml(exportBrand.name)}</span> — وثيقة رسمية تمثل بيانات اللحظة وقت التصدير
      </div>
      <div>صفحة ١ — جودة وشفافية</div>
    </div>
  </div>

  <script>
    window.addEventListener('load', () => setTimeout(() => window.print(), 600));
  </script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) {
    alert("يرجى السماح بالنوافذ المنبثقة لتصدير التقرير");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function escapeHtml(s: string) {
  return (s ?? "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ---------- color helpers ---------- */
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(27,79,88,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
function shade(hex: string, amount: number): string {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) + 255 * amount));
  const g = Math.min(255, Math.round(((n >> 8) & 255) + 255 * amount));
  const b = Math.min(255, Math.round((n & 255) + 255 * amount));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
