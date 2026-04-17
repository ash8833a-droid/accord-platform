import * as XLSX from "xlsx";

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
    ["تقرير اللجنة المالية — برنامج الزواج الجماعي"],
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
    background: linear-gradient(135deg, #1B4F58 0%, #2A6B75 50%, #1B4F58 100%);
    color: #fff; padding: 22px 26px; margin-bottom: 18px;
    box-shadow: 0 10px 30px -10px rgba(27,79,88,0.4);
  }
  .header::after {
    content: ""; position: absolute; left: -40px; top: -40px; width: 200px; height: 200px;
    background: radial-gradient(circle, rgba(196,162,92,0.35), transparent 70%);
    border-radius: 50%;
  }
  .header-pattern {
    position: absolute; inset: 0; opacity: 0.12;
    background-image:
      repeating-linear-gradient(45deg, #C4A25C 0 1px, transparent 1px 14px),
      repeating-linear-gradient(-45deg, #C4A25C 0 1px, transparent 1px 14px);
  }
  .h-row { display: flex; justify-content: space-between; align-items: center; position: relative; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .logo {
    width: 56px; height: 56px; border-radius: 14px;
    background: linear-gradient(135deg, #C4A25C, #E0C784);
    display: flex; align-items: center; justify-content: center;
    font-size: 26px; font-weight: 900; color: #1B4F58;
    box-shadow: 0 4px 14px rgba(196,162,92,0.4);
  }
  .brand h1 { margin: 0; font-size: 18pt; font-weight: 900; letter-spacing: 0.3px; }
  .brand p  { margin: 2px 0 0; font-size: 10pt; opacity: 0.85; }
  .h-meta { text-align: left; font-size: 9pt; opacity: 0.9; line-height: 1.6; }
  .h-meta b { display: block; font-size: 11pt; color: #F4D88A; margin-bottom: 2px; }

  .title-bar {
    display: flex; align-items: center; gap: 10px; margin: 14px 0 10px;
  }
  .title-bar .bar { width: 5px; height: 28px; background: linear-gradient(180deg, #C4A25C, #1B4F58); border-radius: 3px; }
  .title-bar h2 { margin: 0; font-size: 14pt; font-weight: 800; color: #1B4F58; }

  .cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 16px; }
  .card {
    border-radius: 12px; padding: 12px 10px; position: relative; overflow: hidden;
    border: 1px solid #E5E7EB; background: #fff;
  }
  .card.teal { background: linear-gradient(135deg, #1B4F58 0%, #2A6B75 100%); color: #fff; }
  .card.gold { background: linear-gradient(135deg, #C4A25C 0%, #E0C784 100%); color: #2A1F0A; }
  .card .label { font-size: 9pt; opacity: 0.85; margin-bottom: 6px; font-weight: 500; }
  .card .value { font-size: 14pt; font-weight: 900; }
  .card::after {
    content: ""; position: absolute; left: -10px; bottom: -10px; width: 50px; height: 50px;
    border-radius: 50%; background: rgba(255,255,255,0.12);
  }

  table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 9.5pt; margin-top: 6px; }
  thead th {
    background: linear-gradient(135deg, #1B4F58, #2A6B75); color: #fff;
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
  td.ttl { text-align: right; font-weight: 600; color: #1B4F58; }
  td.amt { font-weight: 700; color: #1B4F58; font-variant-numeric: tabular-nums; }

  .footer {
    margin-top: 18px; padding-top: 12px; border-top: 2px dashed #C4A25C;
    display: flex; justify-content: space-between; font-size: 8.5pt; color: #6B7280;
  }
  .footer .stamp {
    color: #1B4F58; font-weight: 700;
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
    background: #1B4F58; color: #fff; border: 0; padding: 10px 18px;
    border-radius: 10px; font-family: inherit; font-weight: 700; cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-size: 11pt;
  }
  .toolbar button.gold { background: #C4A25C; color: #1B4F58; }
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
        <div class="logo">ز</div>
        <div>
          <h1>منصة الزواج الجماعي العائلي</h1>
          <p>تقرير اللجنة المالية — طلبات الصرف والاشتراكات</p>
        </div>
      </div>
      <div class="h-meta">
        <b>مرجع التقرير</b>
        ${filename}<br/>
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
    <div>
      <span class="stamp">منصة الزواج الجماعي العائلي</span> — وثيقة رسمية تمثل بيانات اللحظة وقت التصدير
    </div>
    <div>صفحة ١ — جودة وشفافية</div>
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
