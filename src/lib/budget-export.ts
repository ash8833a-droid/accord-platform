import * as XLSX from "xlsx";
import { BRAND_LOGO_DATA_URI } from "@/assets/brand-logo";

export interface BudgetExportRow {
  item_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  notes?: string | null;
}

export interface BudgetExportGroup {
  committee_name: string;
  rows: BudgetExportRow[];
}

const fmt = (n: number) => new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(n);

const todayAr = () =>
  new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());

function escapeHtml(s: string) {
  return (s ?? "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildRef(prefix: string) {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${prefix}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/* ---------- Excel ---------- */

export function exportBudgetXLSX(opts: {
  filename: string;
  groups: BudgetExportGroup[];
}) {
  const wb = XLSX.utils.book_new();
  const overall = opts.groups.reduce((a, g) => a + g.rows.reduce((s, r) => s + Number(r.total_cost), 0), 0);

  // Summary sheet
  const summary: (string | number)[][] = [
    ["لجنة الزواج الجماعي — تقرير الميزانية"],
    [`تاريخ التصدير: ${todayAr()}`],
    [],
    ["اللجنة", "عدد البنود", "الإجمالي (ر.س)", "النسبة %"],
  ];
  opts.groups.forEach((g) => {
    const total = g.rows.reduce((s, r) => s + Number(r.total_cost), 0);
    const pct = overall > 0 ? (total / overall) * 100 : 0;
    summary.push([g.committee_name, g.rows.length, total, Number(pct.toFixed(2))]);
  });
  summary.push([]);
  summary.push(["الإجمالي العام", "", overall, 100]);
  const ws = XLSX.utils.aoa_to_sheet(summary);
  ws["!cols"] = [{ wch: 32 }, { wch: 14 }, { wch: 18 }, { wch: 12 }];
  ws["!views"] = [{ RTL: true }];
  XLSX.utils.book_append_sheet(wb, ws, "ملخص");

  // One sheet per committee
  opts.groups.forEach((g) => {
    const data: (string | number)[][] = [
      [`اللجنة: ${g.committee_name}`],
      [],
      ["#", "البند", "الكمية", "تكلفة الوحدة (ر.س)", "الإجمالي (ر.س)", "ملاحظات"],
    ];
    g.rows.forEach((r, i) => {
      data.push([i + 1, r.item_name, Number(r.quantity), Number(r.unit_cost), Number(r.total_cost), r.notes ?? ""]);
    });
    const total = g.rows.reduce((s, r) => s + Number(r.total_cost), 0);
    data.push([]);
    data.push(["", "الإجمالي", "", "", total, ""]);
    const sheet = XLSX.utils.aoa_to_sheet(data);
    sheet["!cols"] = [{ wch: 5 }, { wch: 32 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 28 }];
    sheet["!views"] = [{ RTL: true }];
    const safeName = g.committee_name.slice(0, 28).replace(/[\\/?*[\]:]/g, " ");
    XLSX.utils.book_append_sheet(wb, sheet, safeName || "لجنة");
  });

  XLSX.writeFile(wb, `${opts.filename}.xlsx`);
}

/* ---------- PDF (branded HTML → print) ---------- */

export function exportBudgetPDF(opts: {
  title: string;
  groups: BudgetExportGroup[];
  filenamePrefix?: string;
}) {
  const ref = buildRef(opts.filenamePrefix ?? "BUD");
  const overall = opts.groups.reduce((a, g) => a + g.rows.reduce((s, r) => s + Number(r.total_cost), 0), 0);

  const groupHtml = opts.groups
    .map((g) => {
      const total = g.rows.reduce((s, r) => s + Number(r.total_cost), 0);
      const rowsHtml =
        g.rows.length === 0
          ? `<tr><td colspan="5" class="empty">لا توجد بنود مسجلة</td></tr>`
          : g.rows
              .map(
                (r, i) => `
              <tr>
                <td>${i + 1}</td>
                <td class="ttl">${escapeHtml(r.item_name)}</td>
                <td>${fmt(Number(r.quantity))}</td>
                <td>${fmt(Number(r.unit_cost))}</td>
                <td class="amt">${fmt(Number(r.total_cost))}</td>
              </tr>`,
              )
              .join("");
      return `
      <div class="group">
        <div class="group-head">
          <div class="bar"></div>
          <h2>${escapeHtml(g.committee_name)}</h2>
          <span class="count">${g.rows.length} بند</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:6%">#</th>
              <th style="width:46%">البند</th>
              <th style="width:12%">الكمية</th>
              <th style="width:18%">تكلفة الوحدة (ر.س)</th>
              <th style="width:18%">الإجمالي (ر.س)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" class="ttl-final">إجمالي ${escapeHtml(g.committee_name)}</td>
              <td class="amt-final">${fmt(total)} ر.س</td>
            </tr>
          </tfoot>
        </table>
      </div>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(opts.title)} — ${ref}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 14mm 12mm 16mm; }
  * { box-sizing: border-box; }
  html, body {
    font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif;
    color: #1f2937; margin: 0; padding: 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .header {
    display: flex; align-items: center; gap: 14px;
    border-bottom: 3px solid #1B4F58; padding-bottom: 12px; margin-bottom: 18px;
  }
  .header .logo {
    width: 64px; height: 64px; border-radius: 14px;
    background: #fff; padding: 4px; box-shadow: 0 4px 14px rgba(0,0,0,0.08);
    border: 1px solid #E5E7EB;
  }
  .header .logo img { width: 100%; height: 100%; display: block; }
  .header .titles { flex: 1; }
  .header .kicker { margin: 0; font-size: 9pt; font-weight: 700; letter-spacing: 1px; color: #C4A25C; }
  .header h1 { margin: 4px 0 2px; font-size: 18pt; font-weight: 900; color: #1B4F58; }
  .header .meta { margin: 0; font-size: 10pt; color: #6B7280; }
  .header .ref {
    text-align: left; font-size: 9pt; color: #374151;
    border: 1px solid #E5E7EB; border-radius: 8px; padding: 8px 10px; min-width: 160px;
  }
  .header .ref b { display: block; color: #1B4F58; font-size: 11pt; margin-top: 2px; }

  .grand {
    display: flex; justify-content: space-between; align-items: center;
    background: linear-gradient(135deg, #1B4F58, #2A6B76); color: #fff;
    border-radius: 12px; padding: 14px 18px; margin-bottom: 18px;
    box-shadow: 0 8px 20px -10px rgba(27,79,88,0.4);
  }
  .grand .label { font-size: 11pt; opacity: 0.9; font-weight: 600; }
  .grand .value { font-size: 20pt; font-weight: 900; color: #F5D98C; }

  .group { margin-bottom: 18px; page-break-inside: avoid; }
  .group-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .group-head .bar { width: 5px; height: 24px; background: linear-gradient(180deg, #C4A25C, #1B4F58); border-radius: 3px; }
  .group-head h2 { margin: 0; font-size: 13pt; font-weight: 800; color: #1B4F58; flex: 1; }
  .group-head .count {
    font-size: 9pt; padding: 3px 10px; border-radius: 999px;
    background: #FBF7EE; color: #8C6E2E; font-weight: 700;
    border: 1px solid #F1E4C1;
  }

  table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 10pt; }
  thead th {
    background: #1B4F58; color: #fff; padding: 9px 8px; text-align: center;
    font-weight: 700; font-size: 10pt;
  }
  thead th:first-child { border-radius: 0 8px 8px 0; }
  thead th:last-child  { border-radius: 8px 0 0 8px; }
  tbody td {
    padding: 8px; text-align: center; border-bottom: 1px solid #F1E9D6;
  }
  tbody tr:nth-child(even) td { background: #FBF7EE; }
  td.ttl { text-align: right; font-weight: 600; color: #1B4F58; }
  td.amt { font-weight: 700; color: #1B4F58; font-variant-numeric: tabular-nums; }
  td.empty { padding: 20px; color: #9CA3AF; font-style: italic; }
  tfoot td {
    padding: 10px 8px; background: #FFF8E8; border-top: 2px solid #C4A25C;
    font-weight: 800;
  }
  td.ttl-final { text-align: right; color: #1B4F58; }
  td.amt-final { text-align: center; color: #1B4F58; font-size: 12pt; font-variant-numeric: tabular-nums; }

  .footer {
    margin-top: 22px; padding-top: 10px; border-top: 1px dashed #C4A25C;
    display: flex; justify-content: space-between; color: #6B7280; font-size: 8.5pt;
  }
  .footer .stamp { color: #1B4F58; font-weight: 700; }

  .toolbar { position: fixed; top: 12px; left: 12px; z-index: 10; display: flex; gap: 8px; }
  .toolbar button {
    background: #1B4F58; color: #fff; border: 0; padding: 10px 18px; border-radius: 10px;
    font-family: inherit; font-weight: 700; cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-size: 11pt;
  }
  .toolbar button.gold { background: #C4A25C; color: #1B4F58; }
  @media print { .toolbar { display: none; } }
</style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
    <button class="gold" onclick="window.close()">إغلاق</button>
  </div>

  <div class="header">
    <div class="logo"><img id="brand-logo" src="${BRAND_LOGO_DATA_URI}" alt="شعار اللجنة"/></div>
    <div class="titles">
      <p class="kicker">لجنة الزواج الجماعي</p>
      <h1>${escapeHtml(opts.title)}</h1>
      <p class="meta">${todayAr()}</p>
    </div>
    <div class="ref">مرجع التقرير<b>${escapeHtml(ref)}</b></div>
  </div>

  <div class="grand">
    <div class="label">الإجمالي العام للميزانية المطلوبة</div>
    <div class="value">${fmt(overall)} ر.س</div>
  </div>

  ${groupHtml}

  <div class="footer">
    <div><span class="stamp">لجنة الزواج الجماعي</span> — وثيقة رسمية تمثل بيانات اللحظة وقت التصدير</div>
    <div>مرجع: ${escapeHtml(ref)}</div>
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

  const win = window.open("", "_blank", "width=1100,height=820");
  if (!win) {
    alert("يرجى السماح بالنوافذ المنبثقة لتصدير التقرير");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}