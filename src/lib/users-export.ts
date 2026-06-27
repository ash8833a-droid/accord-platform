import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { BRAND_LOGO_DATA_URI } from "@/assets/brand-logo";

export interface ExportUserRow {
  full_name: string;
  phone: string;
  family_branch: string | null;
  role_label: string;
  committee_name: string;
  status: string;
  created_at: string;
}

const HEADERS = ["#", "الاسم", "الجوال", "الفرع", "الصلاحية", "القسم", "الحالة", "تاريخ الإضافة"];

const todayAr = () =>
  new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const toMatrix = (rows: ExportUserRow[]) =>
  rows.map((r, i) => [
    i + 1,
    r.full_name,
    r.phone,
    r.family_branch ?? "—",
    r.role_label,
    r.committee_name,
    r.status,
    r.created_at,
  ]);

const escapeHtml = (s: string) =>
  (s ?? "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function exportUsersCSV(rows: ExportUserRow[], filename = "users") {
  const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    HEADERS.map(escape).join(","),
    ...toMatrix(rows).map((r) => r.map(escape).join(",")),
  ];
  download(new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
}

export function exportUsersXLSX(rows: ExportUserRow[], filename = "users") {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...toMatrix(rows)]);
  ws["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 22 }, { wch: 12 }, { wch: 16 }];
  ws["!views"] = [{ RTL: true }];
  XLSX.utils.book_append_sheet(wb, ws, "المستخدمون");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportUsersJSON(rows: ExportUserRow[], filename = "users") {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json;charset=utf-8" });
  download(blob, `${filename}.json`);
}

export function exportUsersPDF(rows: ExportUserRow[], filename = "users") {
  const body = rows
    .map(
      (r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td class="name">${escapeHtml(r.full_name)}</td>
        <td dir="ltr">${escapeHtml(r.phone)}</td>
        <td>${escapeHtml(r.family_branch ?? "—")}</td>
        <td>${escapeHtml(r.role_label)}</td>
        <td>${escapeHtml(r.committee_name)}</td>
        <td>${escapeHtml(r.status)}</td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>${escapeHtml(filename)}</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;800&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 14mm 12mm; }
body { font-family: 'Tajawal', Arial, sans-serif; color:#1f2937; margin:0; }
.header { background: linear-gradient(135deg,#1B4F58,#0f3338); color:#fff; padding:18px 22px; border-radius:14px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; }
.header h1 { margin:0; font-size:18pt; font-weight:800; }
.header .brand { display:flex; align-items:center; gap:14px; }
.header .logo { width:82px; height:82px; object-fit:contain; background:transparent; border:0; padding:0; box-shadow:none; filter:drop-shadow(0 7px 12px rgba(0,0,0,.18)); }
.header p { margin:4px 0 0; font-size:10pt; opacity:.85; }
.meta { font-size:9pt; color:#C4A25C; text-align:left; }
table { width:100%; border-collapse: separate; border-spacing:0; font-size:10pt; }
thead th { background:#1B4F58; color:#fff; padding:9px 6px; text-align:center; font-weight:700; }
thead th:first-child{ border-radius:0 8px 8px 0;} thead th:last-child{ border-radius:8px 0 0 8px;}
tbody td { padding:7px 6px; text-align:center; border-bottom:1px solid #F1E9D6; }
tbody tr:nth-child(even) td { background:#FBF7EE; }
td.name { text-align:right; font-weight:600; color:#1B4F58; }
.toolbar{ position:fixed; top:12px; left:12px; display:flex; gap:8px; }
.toolbar button{ background:#1B4F58; color:#fff; border:0; padding:9px 16px; border-radius:8px; font-family:inherit; font-weight:700; cursor:pointer; }
.toolbar button.gold{ background:#C4A25C; color:#1B4F58; }
@media print { .toolbar{ display:none; } tr{ page-break-inside:avoid; } thead{ display:table-header-group; } }
</style></head><body>
<div class="toolbar"><button onclick="window.print()">🖨️ طباعة / حفظ PDF</button><button class="gold" onclick="window.close()">إغلاق</button></div>
  <div class="header">
  <div class="brand"><img class="logo" src="${BRAND_LOGO_DATA_URI}" alt="شعار اللجنة"/><div><h1>بيان بأعضاء لجنة الزواج الجماعي</h1><p>إجمالي السجلات: ${rows.length}</p></div></div>
  <div class="meta">${todayAr()}</div>
</div>
<table>
  <thead><tr><th>#</th><th>الاسم</th><th>الجوال</th><th>الفرع</th><th>الصلاحية</th><th>القسم</th><th>الحالة</th></tr></thead>
  <tbody>${body || `<tr><td colspan="7" style="padding:30px;color:#9CA3AF;">لا توجد سجلات</td></tr>`}</tbody>
</table>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},300);});</script>
</body></html>`;

  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) { alert("يرجى السماح بالنوافذ المنبثقة"); return; }
  win.document.open(); win.document.write(html); win.document.close();
}

export async function exportCommitteeMembersPDF(filename = "committee-members") {
  const { data: committees } = await supabase.from("committees").select("id,name,type").order("name");
  const { data: members } = await supabase
    .from("team_members")
    .select("committee_id,full_name,role_title,phone")
    .order("display_order", { ascending: true })
    .order("full_name");

  const rows = (members ?? []).map((m, i) => {
    const committee = (committees ?? []).find((c) => c.id === m.committee_id);
    return `
      <tr>
        <td>${i + 1}</td>
        <td class="name">${escapeHtml(m.full_name)}</td>
        <td>${escapeHtml(m.role_title ?? "—")}</td>
        <td dir="ltr">${escapeHtml(m.phone ?? "—")}</td>
        <td>${escapeHtml(committee?.name ?? "—")}</td>
      </tr>`;
  }).join("");

  const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>${escapeHtml(filename)}</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;800&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 14mm 12mm; }
body { font-family: 'Tajawal', Arial, sans-serif; color:#1f2937; margin:0; }
.header { background: linear-gradient(135deg,#1B4F58,#0f3338); color:#fff; padding:18px 22px; border-radius:14px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; }
.header h1 { margin:0; font-size:18pt; font-weight:800; }
.header .brand { display:flex; align-items:center; gap:14px; }
.header .logo { width:82px; height:82px; object-fit:contain; background:transparent; border:0; padding:0; box-shadow:none; filter:drop-shadow(0 7px 12px rgba(0,0,0,.18)); }
.header p { margin:4px 0 0; font-size:10pt; opacity:.85; }
.meta { font-size:9pt; color:#C4A25C; text-align:left; }
table { width:100%; border-collapse: separate; border-spacing:0; font-size:10pt; }
thead th { background:#1B4F58; color:#fff; padding:9px 6px; text-align:center; font-weight:700; }
thead th:first-child{ border-radius:0 8px 8px 0;} thead th:last-child{ border-radius:8px 0 0 8px;}
tbody td { padding:7px 6px; text-align:center; border-bottom:1px solid #F1E9D6; }
tbody tr:nth-child(even) td { background:#FBF7EE; }
td.name { text-align:right; font-weight:600; color:#1B4F58; }
.toolbar{ position:fixed; top:12px; left:12px; display:flex; gap:8px; }
.toolbar button{ background:#1B4F58; color:#fff; border:0; padding:9px 16px; border-radius:8px; font-family:inherit; font-weight:700; cursor:pointer; }
.toolbar button.gold{ background:#C4A25C; color:#1B4F58; }
@media print { .toolbar{ display:none; } tr{ page-break-inside:avoid; } thead{ display:table-header-group; } }
</style></head><body>
<div class="toolbar"><button onclick="window.print()">🖨️ طباعة / حفظ PDF</button><button class="gold" onclick="window.close()">إغلاق</button></div>
<div class="header">
  <div class="brand"><img class="logo" src="${BRAND_LOGO_DATA_URI}" alt="شعار اللجنة"/><div><h1>بيان بأعضاء لجنة الزواج الجماعي</h1><p>إجمالي الأعضاء: ${members?.length ?? 0}</p></div></div>
  <div class="meta">${todayAr()}</div>
</div>
<table>
  <thead><tr><th>#</th><th>الاسم</th><th>المنصب</th><th>الجوال</th><th>اللجنة</th></tr></thead>
  <tbody>${rows || `<tr><td colspan="5" style="padding:30px;color:#9CA3AF;">لا توجد سجلات</td></tr>`}</tbody>
</table>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},300);});</script>
</body></html>`;

  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) { alert("يرجى السماح بالنوافذ المنبثقة"); return; }
  win.document.open(); win.document.write(html); win.document.close();
}