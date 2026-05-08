import html2pdf from "html2pdf.js";
import logo from "@/assets/logo.png";

const PRIMARY = "#064e3b";
const SUCCESS = "#059669";
const WARNING = "#dc2626";

interface Row {
  id: string;
  name: string;
  total: number;
  done: number;
  overdue: number;
  rate: number;
  delta: number | null;
}

interface Args {
  weekStart: Date;
  top: Row[];
  delayed: Row[];
}

function deltaText(d: number | null): string {
  if (d === null) return "—";
  if (d === 0) return "0%";
  return d > 0 ? `+${d}%` : `${d}%`;
}

function deltaColor(d: number | null): string {
  if (d === null || d === 0) return "#6b7280";
  return d > 0 ? SUCCESS : WARNING;
}

function rowHtml(r: Row, accent: string): string {
  const fill = Math.max(0, Math.min(100, r.rate));
  return `
    <div class="row">
      <div class="row-head">
        <div class="row-name">
          <span class="dot" style="background:${accent}"></span>
          ${r.name}
          <span class="delta" style="color:${deltaColor(r.delta)}">${deltaText(r.delta)}</span>
        </div>
        <div class="row-meta"><b>${r.rate}%</b> · ${r.done}/${r.total}${r.overdue > 0 ? ` · <span style="color:${WARNING}">${r.overdue} متأخرة</span>` : ""}</div>
      </div>
      <div class="bar"><div class="bar-fill" style="width:${fill}%; background:${accent}"></div></div>
    </div>`;
}

export async function exportWeeklyReportPdf({ weekStart, top, delayed }: Args): Promise<void> {
  const today = new Date().toLocaleDateString("ar-SA-u-ca-gregory", {
    year: "numeric", month: "long", day: "numeric",
  });
  const week = weekStart.toLocaleDateString("ar-SA-u-ca-gregory", {
    year: "numeric", month: "long", day: "numeric",
  });

  const html = `
    <div dir="rtl" class="page">
      <header>
        <img src="${logo}" alt="logo" />
        <div>
          <h1>الملخص الأسبوعي للأداء</h1>
          <p>أسبوع يبدأ من ${week} · تاريخ التصدير: ${today}</p>
        </div>
      </header>

      <section>
        <h2 style="color:${SUCCESS}">الأفضل أداءً (${top.length})</h2>
        ${top.length === 0
          ? `<p class="empty">لا توجد لجان وصلت إلى 100% بعد.</p>`
          : top.map((r) => rowHtml(r, SUCCESS)).join("")}
      </section>

      <section>
        <h2 style="color:${WARNING}">تحتاج إلى متابعة (${delayed.length})</h2>
        ${delayed.length === 0
          ? `<p class="empty">لا توجد لجان متأخرة هذا الأسبوع.</p>`
          : delayed.map((r) => rowHtml(r, WARNING)).join("")}
      </section>

      <footer>منظومة لجنة الزواج الجماعي · تقرير تلقائي</footer>
    </div>

    <style>
      .page { font-family: 'Noto Naskh Arabic','Segoe UI',sans-serif; color:#111827; padding: 24px; }
      header { display:flex; gap:16px; align-items:center; border-bottom: 3px solid ${PRIMARY}; padding-bottom: 12px; margin-bottom: 16px; }
      header img { width: 56px; height: 56px; object-fit: contain; }
      header h1 { margin:0; color:${PRIMARY}; font-size: 22px; }
      header p { margin:4px 0 0; color:#6b7280; font-size: 12px; }
      h2 { font-size: 16px; margin: 18px 0 10px; }
      .row { padding: 8px 10px; margin-bottom: 8px; border:1px solid #e5e7eb; border-radius: 8px; }
      .row-head { display:flex; justify-content:space-between; align-items:center; gap:8px; font-size: 13px; margin-bottom: 6px; }
      .row-name { display:flex; align-items:center; gap:8px; font-weight:600; }
      .dot { width:8px; height:8px; border-radius:50%; display:inline-block; }
      .delta { font-size: 11px; font-weight: 700; margin-right: 4px; }
      .row-meta { font-size: 12px; color:#374151; }
      .bar { background:#f3f4f6; height: 8px; border-radius: 999px; overflow:hidden; }
      .bar-fill { height: 100%; }
      .empty { color:#6b7280; font-size: 12px; padding: 8px 0; }
      footer { margin-top: 24px; text-align:center; color:#9ca3af; font-size: 11px; border-top: 1px solid #e5e7eb; padding-top: 8px; }
    </style>`;

  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);

  await html2pdf()
    .from(container)
    .set({
      margin: 10,
      filename: `weekly-performance-${weekStart.toISOString().slice(0, 10)}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    })
    .save();

  document.body.removeChild(container);
}