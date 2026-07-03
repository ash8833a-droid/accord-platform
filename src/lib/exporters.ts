import * as XLSX from "xlsx";
import { BRAND_LOGO_DATA_URI } from "@/assets/brand-logo";
import type { BrandIdentity } from "@/lib/brand";

// Local default to avoid circular import with brand.ts (which imports setExportBrand from this file).
const FALLBACK_BRAND: BrandIdentity = {
  name: "لجنة الزواج الجماعي",
  subtitle: "لقبيلة الهملة من قريش",
  logo_url: null,
  primary_color: "#1B4F58",
  gold_color: "#C4A25C",
};

// Runtime brand cache used by exports. Updated by initBrandForExports().
let exportBrand: BrandIdentity = FALLBACK_BRAND;
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

/* ---------- Comprehensive finance report types ---------- */
export interface FinanceComprehensiveData {
  // ملخص عام
  revenues: {
    groomSubs: number;         // اشتراكات العرسان (تحصيل ممثلي الأسر + مساهمة العرسان)
    familyContrib: number;     // مساهمات أفراد القبيلة (السنة الحالية + السجل التاريخي)
    deficitShare: number;      // حصص العجز
    total: number;             // الإجمالي
  };
  expenses: {
    paidRequests: number;      // طلبات صرف مصروفة
    budgetItemsTotal: number;  // مجموع بنود الميزانية
    total: number;             // الإجمالي
  };
  balance: number;             // الرصيد الحالي

  // تفاصيل
  delegates: Array<{ full_name: string; phone: string; family_branch: string; subs_count: number; collected: number }>;
  grooms: Array<{ full_name: string; family_branch: string; groom_contribution: number; deficit_share: number; contribution_paid: boolean }>;
  familyContributions: Array<{ donor_name: string; amount: number; date: string; notes?: string | null }>;
  historicalShareholders: Array<{ full_name: string; family_branch: string; amount: number; hijri_year: number }>;
  committees: Array<{ name: string; allocated: number; spent: number }>;
  budgetItems: Array<{ committee_name: string; item_name: string; quantity: number; unit_cost: number; total_cost: number }>;
  paymentRequests: ExportRequest[];
}

const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(n);
const fmtM = (n: number) => `${fmt(Math.round(Number(n) || 0))} ر.س`;

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
    ["عدد ممثلي الأسر", summary.delegatesCount],
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
    { label: "عدد ممثلي الأسر", value: fmt(summary.delegatesCount), accent: "teal" },
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
  body { background: #ffffff; }
  .header {
    position: relative; padding: 6px 0 18px; margin-bottom: 18px;
    border-bottom: 2px solid ${exportBrand.primary_color};
  }
  .header::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: -5px; height: 2px;
    background: ${exportBrand.gold_color};
  }
  .h-row { display: flex; justify-content: space-between; align-items: center; gap: 20px; }
  .brand { display: flex; align-items: center; gap: 18px; }
  .logo-img { width: 96px; height: 96px; background: transparent; }
  .logo-img img { width: 100%; height: 100%; display: block; object-fit: contain; background: transparent; }
  .brand h1 { margin: 0; font-size: 20pt; font-weight: 900; color: ${exportBrand.primary_color}; letter-spacing: 0.2px; }
  .brand p  { margin: 4px 0 0; font-size: 10.5pt; color: #475569; font-weight: 500; }
  .h-meta {
    text-align: left; font-size: 9pt; color: #475569; line-height: 1.7;
    border-right: 3px solid ${exportBrand.gold_color}; padding-right: 12px;
  }
  .h-meta b { display: block; font-size: 10.5pt; color: ${exportBrand.primary_color}; margin-bottom: 4px; font-weight: 800; }

  .title-bar {
    display: flex; align-items: center; gap: 10px; margin: 14px 0 10px;
  }
  .title-bar .bar { width: 5px; height: 28px; background: linear-gradient(180deg, ${exportBrand.gold_color}, ${exportBrand.primary_color}); border-radius: 3px; }
  .title-bar h2 { margin: 0; font-size: 14pt; font-weight: 800; color: ${exportBrand.primary_color}; }

  .cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 18px; }
  .card {
    border-radius: 10px; padding: 14px 12px; background: #fff;
    border: 1px solid #E5E7EB; border-top: 3px solid ${exportBrand.primary_color};
    text-align: center;
  }
  .card.gold { border-top-color: ${exportBrand.gold_color}; }
  .card .label { font-size: 9pt; color: #64748B; margin-bottom: 6px; font-weight: 600; }
  .card .value { font-size: 14pt; font-weight: 900; color: ${exportBrand.primary_color}; }
  .card.gold .value { color: #8C6E2E; }

  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-top: 6px; background: #fff; }
  thead th {
    background: ${exportBrand.primary_color}; color: #fff;
    padding: 10px 8px; text-align: center; font-weight: 700; font-size: 10pt;
    border: 1px solid ${exportBrand.primary_color};
  }
  tbody td {
    padding: 9px 8px; text-align: center; border: 1px solid #E5E7EB;
    vertical-align: middle; background: #fff;
  }
  tbody tr:nth-child(even) td { background: #FAFAF7; }
  td.ttl { text-align: right; font-weight: 600; color: #1f2937; }
  td.amt { font-weight: 800; color: ${exportBrand.primary_color}; font-variant-numeric: tabular-nums; }

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
    border: 1px solid ${hexToRgba(exportBrand.gold_color, 0.55)}; border-radius: 10px; padding: 14px 16px;
    background: #fff; position: relative;
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
    <div class="h-row">
      <div class="brand">
        <div class="logo-img"><img id="brand-logo" src="${exportLogoSrc}" alt="${escapeHtml(exportBrand.name)}"/></div>
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
    window.addEventListener('load', function(){
      var img = document.getElementById('brand-logo');
      var go = function(){ setTimeout(function(){ window.print(); }, 400); };
      if (img && !img.complete) { img.onload = go; img.onerror = go; }
      else { go(); }
    });
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
