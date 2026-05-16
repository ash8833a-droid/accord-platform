import * as XLSX from "xlsx";
import { BRAND_LOGO_DATA_URI } from "@/assets/brand-logo";

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  committee_name: string;
  status: string;
  priority: string;
  due_date: string | null;
  assignee_name: string | null;
  created_at: string;
  updated_at: string;
  responses_count: number;
  attachments_count: number;
  is_overdue: boolean;
  days_late: number;
}

export interface TaskReportSummary {
  total: number;
  todo: number;
  in_progress: number;
  done: number;
  cancelled: number;
  overdue: number;
  completion_rate: number;
  with_responses: number;
}

export interface CommitteePerf {
  committee_name: string;
  total: number;
  done: number;
  overdue: number;
  completion_rate: number;
}

const STATUS_AR: Record<string, string> = {
  todo: "لم تبدأ",
  in_progress: "قيد التنفيذ",
  done: "منجزة",
  cancelled: "ملغاة",
  blocked: "متوقفة",
};
const PRIORITY_AR: Record<string, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  urgent: "عاجلة",
};

const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(n);

const todayAr = () =>
  new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  }).format(new Date());

const arDate = (d: string | null) =>
  d
    ? new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
        year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date(d))
    : "—";

function escapeHtml(s: string) {
  return (s ?? "").toString()
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function exportTasksXLSX(
  rows: TaskRow[],
  summary: TaskReportSummary,
  perCommittee: CommitteePerf[],
  filename: string,
) {
  const wb = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ["منصة لجنة الزواج الجماعي — تقرير المهام"],
    [`تاريخ التصدير: ${todayAr()}`],
    [],
    ["المؤشر", "القيمة"],
    ["إجمالي المهام", summary.total],
    ["لم تبدأ", summary.todo],
    ["قيد التنفيذ", summary.in_progress],
    ["منجزة", summary.done],
    ["ملغاة", summary.cancelled],
    ["متأخرة", summary.overdue],
    ["نسبة الإنجاز %", summary.completion_rate],
    ["مهام تلقت ردوداً", summary.with_responses],
  ]);
  summarySheet["!cols"] = [{ wch: 28 }, { wch: 16 }];
  summarySheet["!views"] = [{ RTL: true }];
  XLSX.utils.book_append_sheet(wb, summarySheet, "ملخص");

  const perfSheet = XLSX.utils.aoa_to_sheet([
    ["اللجنة", "إجمالي المهام", "المنجزة", "المتأخرة", "نسبة الإنجاز %"],
    ...perCommittee.map((p) => [p.committee_name, p.total, p.done, p.overdue, p.completion_rate]),
  ]);
  perfSheet["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 16 }];
  perfSheet["!views"] = [{ RTL: true }];
  XLSX.utils.book_append_sheet(wb, perfSheet, "أداء اللجان");

  const detailSheet = XLSX.utils.aoa_to_sheet([
    ["#", "العنوان", "اللجنة", "الحالة", "الأولوية", "المكلَّف",
     "تاريخ الاستحقاق", "أيام التأخير", "الردود", "المرفقات",
     "تاريخ الإنشاء", "آخر تحديث", "الوصف"],
    ...rows.map((r, i) => [
      i + 1, r.title, r.committee_name,
      STATUS_AR[r.status] ?? r.status, PRIORITY_AR[r.priority] ?? r.priority,
      r.assignee_name ?? "—", arDate(r.due_date),
      r.is_overdue ? r.days_late : 0,
      r.responses_count, r.attachments_count,
      arDate(r.created_at), arDate(r.updated_at), r.description ?? "",
    ]),
  ]);
  detailSheet["!cols"] = [
    { wch: 5 }, { wch: 32 }, { wch: 22 }, { wch: 12 }, { wch: 12 },
    { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 10 },
    { wch: 14 }, { wch: 14 }, { wch: 40 },
  ];
  detailSheet["!views"] = [{ RTL: true }];
  XLSX.utils.book_append_sheet(wb, detailSheet, "تفاصيل المهام");

  const overdue = rows.filter((r) => r.is_overdue);
  const overdueSheet = XLSX.utils.aoa_to_sheet([
    ["#", "العنوان", "اللجنة", "المكلَّف", "تاريخ الاستحقاق", "أيام التأخير", "الحالة"],
    ...overdue.map((r, i) => [
      i + 1, r.title, r.committee_name, r.assignee_name ?? "—",
      arDate(r.due_date), r.days_late, STATUS_AR[r.status] ?? r.status,
    ]),
  ]);
  overdueSheet["!cols"] = [
    { wch: 5 }, { wch: 32 }, { wch: 22 }, { wch: 18 },
    { wch: 14 }, { wch: 12 }, { wch: 14 },
  ];
  overdueSheet["!views"] = [{ RTL: true }];
  XLSX.utils.book_append_sheet(wb, overdueSheet, "المتأخرة");

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportTasksPDF(
  rows: TaskRow[],
  summary: TaskReportSummary,
  perCommittee: CommitteePerf[],
  filename: string,
  signerName?: string,
) {
  const PRIMARY = "#1B4F58";
  const GOLD = "#C4A25C";

  const statusBadge = (s: string) => {
    const tone: Record<string, string> = {
      todo: "background:#E5E7EB;color:#374151",
      in_progress: "background:#DBEAFE;color:#1E40AF",
      done: "background:#DCFCE7;color:#166534",
      cancelled: "background:#FEE2E2;color:#991B1B",
      blocked: "background:#FEF3C7;color:#92400E",
    };
    return `<span style="${tone[s] ?? "background:#E5E7EB;color:#374151"};padding:3px 10px;border-radius:999px;font-size:9pt;font-weight:600;display:inline-block;">${STATUS_AR[s] ?? s}</span>`;
  };

  const priorityBadge = (p: string) => {
    const tone: Record<string, string> = {
      low: "background:#F3F4F6;color:#6B7280",
      medium: "background:#DBEAFE;color:#1E40AF",
      high: "background:#FED7AA;color:#9A3412",
      urgent: "background:#FEE2E2;color:#991B1B",
    };
    return `<span style="${tone[p] ?? ""};padding:2px 8px;border-radius:6px;font-size:8.5pt;font-weight:600;">${PRIORITY_AR[p] ?? p}</span>`;
  };

  const cards = [
    { label: "إجمالي المهام", value: fmt(summary.total), accent: "teal" },
    { label: "منجزة", value: fmt(summary.done), accent: "gold" },
    { label: "قيد التنفيذ", value: fmt(summary.in_progress), accent: "teal" },
    { label: "متأخرة", value: fmt(summary.overdue), accent: "gold" },
    { label: "نسبة الإنجاز", value: `${summary.completion_rate}%`, accent: "teal" },
  ];

  const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
<title>${escapeHtml(filename)}</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif; color: #1f2937; margin: 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .header { border-radius: 18px;
    background: linear-gradient(135deg, ${PRIMARY} 0%, #2A6B76 50%, ${PRIMARY} 100%);
    color: #fff; padding: 22px 26px; margin-bottom: 18px; position: relative; overflow: hidden; }
  .header::after { content: ""; position: absolute; left: -40px; top: -40px; width: 200px; height: 200px;
    background: radial-gradient(circle, ${GOLD}55, transparent 70%); border-radius: 50%; }
  .h-row { display: flex; justify-content: space-between; align-items: center; position: relative; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .logo { width: 64px; height: 64px; border-radius: 14px; background: rgba(255,255,255,0.95); padding: 4px; }
  .logo img { width: 100%; height: 100%; }
  .brand h1 { margin: 0; font-size: 18pt; font-weight: 900; }
  .brand p { margin: 2px 0 0; font-size: 10pt; opacity: 0.85; }
  .h-meta { text-align: left; font-size: 9pt; line-height: 1.6; }
  .h-meta b { display: block; color: ${GOLD}; font-size: 11pt; }
  .title-bar { display: flex; align-items: center; gap: 10px; margin: 14px 0 10px; }
  .title-bar .bar { width: 5px; height: 28px; background: linear-gradient(180deg, ${GOLD}, ${PRIMARY}); border-radius: 3px; }
  .title-bar h2 { margin: 0; font-size: 14pt; font-weight: 800; color: ${PRIMARY}; }
  .cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 16px; }
  .card { border-radius: 12px; padding: 12px 10px; border: 1px solid #E5E7EB; }
  .card.teal { background: linear-gradient(135deg, ${PRIMARY}, #2A6B76); color: #fff; }
  .card.gold { background: linear-gradient(135deg, ${GOLD}, #D4B574); color: #2A1F0A; }
  .card .label { font-size: 9pt; opacity: 0.85; margin-bottom: 6px; }
  .card .value { font-size: 14pt; font-weight: 900; }
  table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 9pt; margin-top: 6px; }
  thead th { background: linear-gradient(135deg, ${PRIMARY}, #2A6B76); color: #fff;
    padding: 9px 6px; text-align: center; font-weight: 700; font-size: 9.5pt; }
  thead th:first-child { border-radius: 0 10px 10px 0; }
  thead th:last-child { border-radius: 10px 0 0 10px; }
  tbody td { padding: 8px 6px; text-align: center; border-bottom: 1px solid #F1E9D6; vertical-align: middle; }
  tbody tr:nth-child(even) td { background: #FBF7EE; }
  td.ttl { text-align: right; font-weight: 600; color: ${PRIMARY}; }
  .late { color: #991B1B; font-weight: 700; }
  .footer { margin-top: 20px; padding-top: 12px; border-top: 2px dashed ${GOLD}; font-size: 8.5pt; color: #6B7280; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 14px; }
  .sig-box { border: 1px solid ${GOLD}77; border-radius: 12px; padding: 14px 16px;
    background: linear-gradient(135deg, ${GOLD}11, ${PRIMARY}08); }
  .sig-box .sig-label { font-size: 9pt; color: #6B7280; }
  .sig-box .sig-name { font-size: 12pt; font-weight: 800; color: ${PRIMARY}; margin: 4px 0 36px; }
  .sig-line { border-top: 1.5px dotted ${PRIMARY}; padding-top: 4px; text-align: center; font-size: 8pt; color: #9CA3AF; }
  .empty { text-align: center; padding: 30px; color: #9CA3AF; border: 2px dashed #E5E7EB; border-radius: 12px; }
  @media print { .no-print { display: none !important; } tr { page-break-inside: avoid; } thead { display: table-header-group; } }
  .toolbar { position: fixed; top: 12px; left: 12px; z-index: 10; display: flex; gap: 8px; }
  .toolbar button { background: ${PRIMARY}; color: #fff; border: 0; padding: 10px 18px;
    border-radius: 10px; font-family: inherit; font-weight: 700; cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
  .toolbar button.gold { background: ${GOLD}; color: ${PRIMARY}; }
</style></head>
<body>
  <div class="toolbar no-print">
    <button onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
    <button class="gold" onclick="window.close()">إغلاق</button>
  </div>
  <div class="header">
    <div class="h-row">
      <div class="brand">
        <div class="logo"><img src="${BRAND_LOGO_DATA_URI}" alt="logo"/></div>
        <div>
          <h1>منصة لجنة الزواج الجماعي</h1>
          <p>تقرير أداء المهام عبر اللجان</p>
        </div>
      </div>
      <div class="h-meta">
        <b>مرجع التقرير</b>
        ${escapeHtml(filename)}<br/>${todayAr()}
      </div>
    </div>
  </div>

  <div class="title-bar"><div class="bar"></div><h2>الملخص التنفيذي</h2></div>
  <div class="cards">
    ${cards.map((c) => `<div class="card ${c.accent}"><div class="label">${c.label}</div><div class="value">${c.value}</div></div>`).join("")}
  </div>

  <div class="title-bar"><div class="bar"></div><h2>أداء اللجان (${fmt(perCommittee.length)} لجنة)</h2></div>
  ${perCommittee.length === 0 ? `<div class="empty">لا توجد بيانات</div>` : `
  <table>
    <thead><tr>
      <th style="width:35%">اللجنة</th><th>إجمالي</th><th>منجزة</th><th>متأخرة</th><th>نسبة الإنجاز</th>
    </tr></thead>
    <tbody>
      ${perCommittee.map((p) => `
        <tr>
          <td class="ttl">${escapeHtml(p.committee_name)}</td>
          <td>${fmt(p.total)}</td>
          <td style="color:${PRIMARY};font-weight:700">${fmt(p.done)}</td>
          <td class="${p.overdue > 0 ? "late" : ""}">${fmt(p.overdue)}</td>
          <td><b>${p.completion_rate}%</b></td>
        </tr>`).join("")}
    </tbody>
  </table>`}

  <div class="title-bar"><div class="bar"></div><h2>تفاصيل المهام (${fmt(rows.length)} مهمة)</h2></div>
  ${rows.length === 0 ? `<div class="empty">لا توجد مهام مسجلة</div>` : `
  <table>
    <thead><tr>
      <th style="width:4%">#</th><th style="width:30%">العنوان</th>
      <th style="width:18%">اللجنة</th><th style="width:11%">الحالة</th>
      <th style="width:10%">الأولوية</th><th style="width:13%">الاستحقاق</th>
      <th style="width:14%">المكلَّف</th>
    </tr></thead>
    <tbody>
      ${rows.map((r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td class="ttl">${escapeHtml(r.title)}</td>
          <td>${escapeHtml(r.committee_name)}</td>
          <td>${statusBadge(r.status)}</td>
          <td>${priorityBadge(r.priority)}</td>
          <td class="${r.is_overdue ? "late" : ""}">${arDate(r.due_date)}${r.is_overdue ? `<br/><small>متأخرة ${r.days_late} يوم</small>` : ""}</td>
          <td>${escapeHtml(r.assignee_name ?? "—")}</td>
        </tr>`).join("")}
    </tbody>
  </table>`}

  <div class="footer">
    <div class="signatures">
      <div class="sig-box">
        <div class="sig-label">اعتمد من قِبل</div>
        <div class="sig-name">${escapeHtml(signerName ?? "................................")}</div>
        <div class="sig-line">التوقيع والتاريخ</div>
      </div>
      <div class="sig-box">
        <div class="sig-label">اطّلع عليه</div>
        <div class="sig-name">................................</div>
        <div class="sig-line">رئيس اللجنة العليا — التوقيع والتاريخ</div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:14px;">
      <div><b style="color:${PRIMARY}">منصة لجنة الزواج الجماعي</b> — وثيقة رسمية</div>
      <div>${todayAr()}</div>
    </div>
  </div>

  <script>
    window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 500); });
  </script>
</body></html>`;

  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) { alert("يرجى السماح بالنوافذ المنبثقة لتصدير التقرير"); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

/** First (top) task from each committee — for an executive "urgent dispatch" sheet. */
export interface FirstTaskRow {
  committee_name: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assignee_name: string | null;
  created_at: string;
  is_overdue: boolean;
  days_late: number;
}

export function exportFirstTasksPDF(
  items: FirstTaskRow[],
  filename: string,
  signerName?: string,
) {
  // Institutional white-background template — formal, government-grade.
  const PRIMARY = "#0D5C4A"; // Deep institutional teal
  const INK = "#0F172A";
  const MUTED = "#64748B";
  const RULE = "#D9D2C0";
  const GOLD = "#A8853A";

  const ref = `LZJ-UT-${new Date().getFullYear()}-${String(items.length).padStart(3, "0")}`;
  const priorityLabel = (p: string) => PRIORITY_AR[p] ?? p;
  const statusLabel = (s: string) => STATUS_AR[s] ?? s;

  const rows = items.length === 0
    ? `<tr><td colspan="6" class="empty">لا توجد مهام مسجلة</td></tr>`
    : items.map((t, i) => `
        <tr>
          <td class="num">${fmt(i + 1)}</td>
          <td class="committee">${escapeHtml(t.committee_name)}</td>
          <td class="task">
            <div class="t-title">${escapeHtml(t.title)}</div>
            ${t.description ? `<div class="t-desc">${escapeHtml(t.description)}</div>` : ""}
          </td>
          <td>${escapeHtml(t.assignee_name ?? "—")}</td>
          <td class="${t.is_overdue ? "late" : ""}">
            ${arDate(t.due_date)}
            ${t.is_overdue ? `<div class="late-tag">متأخرة ${fmt(t.days_late)} يوم</div>` : ""}
          </td>
          <td>
            ${t.status === "done"
              ? `<div class="done-badge">✓ تم الإنجاز</div>`
              : `<div class="pending-badge">${statusLabel(t.status)}</div>`}
          </td>
        </tr>`).join("");

  const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
<title>${escapeHtml(filename)}</title>
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Tajawal:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 18mm 16mm 20mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Tajawal','Segoe UI',Tahoma,Arial,sans-serif; color:${INK};
    background:#fff; margin:0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* === Letterhead === */
  .letterhead { display:grid; grid-template-columns: 1fr auto 1fr; align-items:center;
    gap: 18px; padding-bottom: 14px; border-bottom: 2px solid ${PRIMARY}; }
  .lh-right { display:flex; align-items:center; gap:12px; }
  .lh-logo { width: 72px; height: 72px; flex-shrink:0; }
  .lh-logo img { width:100%; height:100%; object-fit: contain; }
  .lh-org h1 { margin:0; font-family:'Amiri',serif; font-size: 17pt; font-weight:700; color:${PRIMARY}; letter-spacing:-0.2px; }
  .lh-org p { margin: 2px 0 0; font-size: 9pt; color:${MUTED}; }
  .lh-center { text-align:center; }
  .lh-center .crest { width: 6px; height: 38px; margin: 0 auto 6px;
    background: linear-gradient(180deg, ${GOLD}, ${PRIMARY}); border-radius: 3px; }
  .lh-center .stamp { font-size: 7.5pt; letter-spacing: 3px; color:${GOLD}; font-weight:700; }
  .lh-left { text-align:left; font-size: 8.5pt; color:${MUTED}; line-height:1.7; }
  .lh-left b { display:block; color:${INK}; font-size:9pt; font-weight:700; }

  /* === Document title === */
  .doc-title { text-align:center; margin: 22px 0 4px; }
  .doc-title .kicker { font-size: 8pt; letter-spacing: 6px; color:${GOLD}; font-weight:700; margin-bottom:4px; }
  .doc-title h2 { margin:0; font-family:'Amiri',serif; font-size: 22pt; font-weight:700; color:${INK}; }
  .doc-title .sub { font-size: 10pt; color:${MUTED}; margin-top:6px; }
  .divider { display:flex; align-items:center; justify-content:center; gap:10px; margin: 14px 0 18px; }
  .divider .line { flex:1; height:1px; background: ${RULE}; max-width:140px; }
  .divider .dot { width:6px; height:6px; background:${GOLD}; transform: rotate(45deg); }

  /* === Reference table === */
  .ref-table { width:100%; border-collapse:collapse; margin-bottom: 16px;
    border: 1px solid ${RULE}; font-size: 9pt; }
  .ref-table td { padding: 8px 12px; border: 1px solid ${RULE}; }
  .ref-table td.k { background:#FAF8F2; color:${PRIMARY}; font-weight:700; width: 18%; }
  .ref-table td.v { color:${INK}; }

  /* === Preamble === */
  .preamble { font-size: 10pt; line-height: 1.85; color:${INK}; margin: 0 0 18px;
    padding: 14px 16px; border-right: 3px solid ${PRIMARY}; background:#FAFBFB; }
  .preamble b { color:${PRIMARY}; font-weight:700; }

  /* === Section heading === */
  .section-h { display:flex; align-items:baseline; gap:10px; margin: 4px 0 8px;
    padding-bottom: 6px; border-bottom: 1px solid ${RULE}; }
  .section-h h3 { margin:0; font-family:'Amiri',serif; font-size: 14pt; color:${PRIMARY}; font-weight:700; }
  .section-h .count { font-size: 9pt; color:${MUTED}; }

  /* === Main table === */
  table.main { width:100%; border-collapse:collapse; font-size: 9.5pt; }
  table.main thead th { background:${PRIMARY}; color:#fff; padding: 10px 8px;
    font-weight:700; font-size: 9.5pt; text-align:center; border:1px solid ${PRIMARY}; }
  table.main tbody td { padding: 10px 8px; border: 1px solid ${RULE};
    text-align:center; vertical-align: top; color:${INK}; }
  table.main tbody tr { page-break-inside: avoid; }
  table.main tbody tr:nth-child(even) td { background: #FAFBFB; }
  td.num { width: 5%; font-weight:700; color:${PRIMARY}; }
  td.committee { width: 18%; font-weight:700; color:${PRIMARY}; text-align:right; }
  td.task { width: 38%; text-align:right; }
  .t-title { font-weight:700; color:${INK}; margin-bottom:4px; line-height:1.5; }
  .t-desc { font-size: 8.5pt; color:${MUTED}; line-height:1.6;
    display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
  .status { font-weight:700; color:${INK}; }
  .prio { font-size: 8pt; color:${GOLD}; margin-top: 3px; font-weight:700; }
  .done-badge { display:inline-block; padding: 4px 10px; border-radius: 999px;
    background: #E7F5EF; color: #0D5C4A; border: 1px solid #0D5C4A;
    font-weight: 700; font-size: 9pt; }
  .pending-badge { display:inline-block; padding: 4px 10px; border-radius: 999px;
    background: #FAF6E8; color: ${GOLD}; border: 1px solid ${GOLD};
    font-weight: 700; font-size: 9pt; }
  .late { color:#9B1C1C; font-weight:700; }
  .late-tag { display:inline-block; margin-top:4px; font-size: 7.5pt; padding: 1px 8px;
    border: 1px solid #9B1C1C; border-radius: 999px; color:#9B1C1C; font-weight:700; }
  td.empty { padding: 40px; color:${MUTED}; }

  /* === Signatures === */
  .sig-grid { display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-top: 28px;
    page-break-inside: avoid; }
  .sig { border-top: 2px solid ${PRIMARY}; padding-top: 8px; min-height: 110px; }
  .sig .role { font-size: 9pt; color:${PRIMARY}; font-weight:700; margin-bottom: 6px; }
  .sig .name { font-size: 10pt; color:${INK}; font-weight:700; min-height: 18px; }
  .sig .lbl { font-size: 8pt; color:${MUTED}; margin-top: 48px; padding-top: 4px;
    border-top: 1px dotted ${MUTED}; text-align:center; }

  /* === Footer === */
  .doc-footer { margin-top: 22px; padding-top: 10px; border-top: 1px solid ${RULE};
    display:flex; justify-content:space-between; font-size: 8pt; color:${MUTED}; }
  .doc-footer b { color:${PRIMARY}; }

  /* === Print === */
  @media print {
    .no-print { display:none !important; }
    thead { display: table-header-group; }
  }
  .toolbar { position:fixed; top:12px; left:12px; z-index:10; display:flex; gap:8px; }
  .toolbar button { background:${PRIMARY}; color:#fff; border:0; padding:10px 18px;
    border-radius:6px; font-family:inherit; font-weight:700; cursor:pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
  .toolbar button.alt { background:#fff; color:${PRIMARY}; border:1px solid ${PRIMARY}; }
</style></head>
<body>
  <div class="toolbar no-print">
    <button onclick="window.print()">طباعة / حفظ PDF</button>
    <button class="alt" onclick="window.close()">إغلاق</button>
  </div>

  <header class="letterhead">
    <div class="lh-right">
      <div class="lh-logo"><img src="${BRAND_LOGO_DATA_URI}" alt="شعار اللجنة"/></div>
      <div class="lh-org">
        <h1>لجنة الزواج الجماعي</h1>
        <p>قبيلة الهَملة من قُريش</p>
      </div>
    </div>
    <div class="lh-center">
      <div class="crest"></div>
      <div class="stamp">وثيقة رسمية</div>
    </div>
    <div class="lh-left">
      <b>المرجع</b>${ref}
      <br/><b>التاريخ</b>${todayAr()}
    </div>
  </header>

  <div class="doc-title">
    <div class="kicker">رسالة تحفيزية</div>
    <h2>أبرز مهمَّة لكل لجنة</h2>
    <div class="sub">نحو إنجازٍ مشرِّفٍ يليق بعطائكم</div>
  </div>

  <div class="divider"><span class="line"></span><span class="dot"></span><span class="line"></span></div>

  <table class="ref-table">
    <tr>
      <td class="k">عدد اللجان</td><td class="v">${fmt(items.length)}</td>
      <td class="k">طبيعة الوثيقة</td><td class="v">متابعة تحفيزية</td>
    </tr>
    <tr>
      <td class="k">جهة الإصدار</td><td class="v">إدارة المتابعة والجودة</td>
      <td class="k">حالة الوثيقة</td><td class="v">سارية المفعول</td>
    </tr>
  </table>

  <div class="preamble">
    إخوتي الكرام أعضاء اللجان، تحية تقديرٍ واعتزازٍ بجهودكم المباركة. نضع بين أيديكم
    <b>أبرز مهمَّة قائمة في كلِّ لجنة</b> وفق ترتيب الخطة المعتمدة، تذكيراً ودافعاً
    لمواصلة العطاء وإتمامها بأحسن صورة. جعل الله أعمالكم في ميزان حسناتكم،
    وبارك في أوقاتكم وجهودكم.
  </div>

  <div class="section-h">
    <h3>جدول المهام</h3>
    <span class="count">(${fmt(items.length)} لجنة)</span>
  </div>

  <table class="main">
    <thead>
      <tr>
        <th>م</th>
        <th>اللجنة</th>
        <th>المهمة</th>
        <th>المكلَّف</th>
        <th>تاريخ الاستحقاق</th>
        <th>حالة الإنجاز</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="sig-grid">
    <div class="sig">
      <div class="role">أعدَّه</div>
      <div class="name">إدارة المتابعة والجودة</div>
      <div class="lbl">الاسم والتوقيع — التاريخ</div>
    </div>
    <div class="sig">
      <div class="role">اعتمده</div>
      <div class="name">${escapeHtml(signerName ?? "")}</div>
      <div class="lbl">رئيس اللجنة العليا — التوقيع</div>
    </div>
    <div class="sig">
      <div class="role">للاطلاع</div>
      <div class="name">رؤساء اللجان</div>
      <div class="lbl">الاسم والتوقيع — التاريخ</div>
    </div>
  </div>

  <div class="doc-footer">
    <div><b>لجنة الزواج الجماعي</b> — قبيلة الهَملة من قُريش</div>
    <div>${ref}</div>
  </div>

  <script>
    window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 500); });
  </script>
</body></html>`;

  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) { alert("يرجى السماح بالنوافذ المنبثقة لتصدير التقرير"); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
