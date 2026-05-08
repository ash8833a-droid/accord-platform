import html2pdf from "html2pdf.js";
import logo from "@/assets/logo.png";

const PRIMARY = "#064e3b";
const ACCENT = "#d97706";

function fmtSar(n: number): string {
  return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(n) + " ر.س";
}

export interface DashboardPdfData {
  year: number | "all";
  kpis: {
    totalTasks: number;
    completionRate: number;
    totalMarriages: number;
    netBalance: number;
  };
  finance: { label: string; revenues: number; expenses: number }[];
  committees: { name: string; total: number; done: number; rate: number }[];
  revenues: number;
  expenses: number;
}

export async function exportDashboardPdf(data: DashboardPdfData): Promise<void> {
  const today = new Date().toLocaleDateString("ar-SA-u-ca-gregory", {
    year: "numeric", month: "long", day: "numeric",
  });
  const period = data.year === "all" ? "كل السنوات" : `سنة ${data.year}`;

  const kpiCards = [
    { label: "إجمالي المهام", value: data.kpis.totalTasks },
    { label: "نسبة الإنجاز العامة", value: `${data.kpis.completionRate}%` },
    { label: "إجمالي الزيجات", value: data.kpis.totalMarriages },
    { label: "صافي الرصيد المالي", value: fmtSar(data.kpis.netBalance) },
  ];

  const totalRev = data.revenues;
  const totalExp = data.expenses;

  const financeRows = data.finance
    .filter((r) => r.revenues > 0 || r.expenses > 0)
    .map((r) => `
      <tr>
        <td>${r.label}</td>
        <td class="num">${fmtSar(r.revenues)}</td>
        <td class="num">${fmtSar(r.expenses)}</td>
        <td class="num ${r.revenues - r.expenses >= 0 ? "pos" : "neg"}">${fmtSar(r.revenues - r.expenses)}</td>
      </tr>`).join("");

  const committeeRows = data.committees.map((c) => `
    <tr>
      <td>${c.name}</td>
      <td class="num">${c.total}</td>
      <td class="num">${c.done}</td>
      <td class="num"><b style="color:${PRIMARY}">${c.rate}%</b></td>
    </tr>`).join("");

  const html = `
  <div dir="rtl" lang="ar" style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color:#111; padding: 24px; background:#fff;">
    <style>
      .hdr { display:flex; align-items:center; justify-content:space-between; gap:16px;
             border-bottom: 3px solid ${PRIMARY}; padding-bottom: 14px; margin-bottom: 20px; }
      .hdr .logo { width:84px; height:84px; object-fit:contain; }
      .hdr .title { flex:1; text-align:center; }
      .hdr .title h1 { margin:0; color:${PRIMARY}; font-size: 22px; font-weight: 800; }
      .hdr .title h2 { margin:4px 0 0; color:${ACCENT}; font-size: 13px; font-weight: 600; }
      .hdr .meta { font-size: 11px; color:#444; text-align:left; min-width: 130px; }
      .hdr .meta b { color:${PRIMARY}; }

      h3.section { color:#fff; background:${PRIMARY}; padding: 8px 14px;
                   border-right: 5px solid ${ACCENT}; font-size: 14px;
                   border-radius: 4px; margin: 22px 0 12px; }

      .kpis { display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; }
      .kpi { border:1px solid #e5e7eb; border-top:3px solid ${ACCENT};
             border-radius:8px; padding:12px; text-align:center; background:#fafafa; }
      .kpi .lbl { font-size: 11px; color:#555; }
      .kpi .val { font-size: 18px; font-weight: 800; color:${PRIMARY}; margin-top:4px; }

      table { width:100%; border-collapse: collapse; font-size: 11px; }
      thead th { background:${PRIMARY}; color:#fff; padding: 8px 10px;
                 border:1px solid ${PRIMARY}; font-weight:700; text-align:right; }
      tbody td { padding: 7px 10px; border:1px solid #d1d5db; text-align:right; }
      tbody tr:nth-child(even) td { background:#f9fafb; }
      td.num { font-variant-numeric: tabular-nums; font-weight: 600; }
      td.pos { color:#065f46; }
      td.neg { color:#b91c1c; }
      tfoot td { background:#f3f4f6; font-weight:800; color:${PRIMARY};
                 border:1px solid #d1d5db; padding: 8px 10px; text-align:right; }

      .footer { margin-top: 28px; border-top: 1px solid #d1d5db; padding-top: 10px;
                font-size: 10px; color:#666; display:flex; justify-content:space-between; }
      .badge { display:inline-block; background:${ACCENT}; color:#fff;
               padding: 3px 10px; border-radius:12px; font-size:10px; font-weight:700; }
    </style>

    <div class="hdr">
      <div class="meta">
        <div>تاريخ الطباعة:</div>
        <div><b>${today}</b></div>
        <div style="margin-top:6px"><span class="badge">${period}</span></div>
      </div>
      <div class="title">
        <h1>لجنة الزواج الجماعي</h1>
        <h2>قبيلة الهملة من قريش</h2>
      </div>
      <img class="logo" src="${logo}" alt="logo" />
    </div>

    <h3 class="section">المؤشرات الرئيسية</h3>
    <div class="kpis">
      ${kpiCards.map((c) => `
        <div class="kpi">
          <div class="lbl">${c.label}</div>
          <div class="val">${c.value}</div>
        </div>`).join("")}
    </div>

    <h3 class="section">النظرة المالية — الإيرادات مقابل المصروفات</h3>
    <table>
      <thead>
        <tr><th>الشهر</th><th>الإيرادات</th><th>المصروفات</th><th>الرصيد</th></tr>
      </thead>
      <tbody>
        ${financeRows || `<tr><td colspan="4" style="text-align:center;color:#888">لا توجد بيانات مالية للفترة</td></tr>`}
      </tbody>
      <tfoot>
        <tr>
          <td>الإجمالي</td>
          <td class="num">${fmtSar(totalRev)}</td>
          <td class="num">${fmtSar(totalExp)}</td>
          <td class="num">${fmtSar(totalRev - totalExp)}</td>
        </tr>
      </tfoot>
    </table>

    <h3 class="section">مستويات إنجاز اللجان الفرعية</h3>
    <table>
      <thead>
        <tr><th>اللجنة</th><th>إجمالي المهام</th><th>المُنجزة</th><th>نسبة الإنجاز</th></tr>
      </thead>
      <tbody>
        ${committeeRows || `<tr><td colspan="4" style="text-align:center;color:#888">لا توجد بيانات للجان</td></tr>`}
      </tbody>
    </table>

    <div class="footer">
      <span>© لجنة الزواج الجماعي — قبيلة الهملة من قريش</span>
      <span>تم التوليد آلياً من لوحة الأداء التنفيذية</span>
    </div>
  </div>`;

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = "794px"; // A4 width @ 96dpi
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    await html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename: `تقرير-الأداء-${data.year === "all" ? "كل-السنوات" : data.year}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      })
      .from(container.firstElementChild as HTMLElement)
      .save();
  } finally {
    document.body.removeChild(container);
  }
}
