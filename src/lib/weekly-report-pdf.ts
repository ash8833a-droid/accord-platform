import html2pdf from "html2pdf.js";
import logo from "@/assets/logo.png";

const PRIMARY = "#0F766E";
const TEAL = "#0F766E";
const AMBER = "#D97706";
const RED = "#DC2626";
const SLATE_900 = "#0F172A";
const SLATE_500 = "#64748B";
const SLATE_100 = "#F1F5F9";

interface InsightItem {
  name: string;
  detail: string;
}

interface Args {
  weekStart: Date;
  overallRate: number;
  activeCommittees: number;
  overdueTasks: number;
  excellence: InsightItem[];
  weakness: InsightItem[];
  critical: InsightItem[];
}

function kpiHtml(label: string, value: string | number): string {
  return `
    <div class="kpi">
      <div class="kpi-value">${value}</div>
      <div class="kpi-label">${label}</div>
    </div>`;
}

function insightHtml(title: string, subtitle: string, accent: string, items: InsightItem[], empty: string): string {
  return `
    <section class="insight" style="border-right: 4px solid ${accent}">
      <div class="insight-head">
        <h2 style="color:${SLATE_900}">${title}</h2>
        <p>${subtitle}</p>
      </div>
      ${items.length === 0
        ? `<p class="empty">${empty}</p>`
        : `<ul>${items.map((i) => `
            <li>
              <span class="bullet" style="background:${accent}"></span>
              <div>
                <div class="item-name">${i.name}</div>
                <div class="item-detail">${i.detail}</div>
              </div>
            </li>`).join("")}</ul>`}
    </section>`;
}

export async function exportWeeklyReportPdf(args: Args): Promise<void> {
  const { weekStart, overallRate, activeCommittees, overdueTasks, excellence, weakness, critical } = args;
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
          <h1>الملخص التنفيذي للأمانة</h1>
          <p>أسبوع يبدأ من ${week} · تاريخ التصدير: ${today}</p>
        </div>
      </header>

      <div class="kpis">
        ${kpiHtml("نسبة الإنجاز الكلي", `${overallRate}%`)}
        ${kpiHtml("المهام المتأخرة", overdueTasks)}
        ${kpiHtml("اللجان النشطة", activeCommittees)}
      </div>

      ${insightHtml("نقاط التميّز", "لجان متقدّمة في الإنجاز", TEAL, excellence, "لم تُسجَّل لجان عند مستوى تميّز هذا الأسبوع.")}
      ${insightHtml("نقاط الضعف", "تقدّم بطيء يحتاج إلى دعم", AMBER, weakness, "لا توجد لجان ضمن مرحلة الضعف.")}
      ${insightHtml("مواطن الخلل", "تدخّل عاجل من الأمانة", RED, critical, "لا توجد اختناقات حرجة هذا الأسبوع.")}

      <footer>منظومة لجنة الزواج الجماعي · تقرير تنفيذي تلقائي</footer>
    </div>

    <style>
      .page { font-family: 'Noto Naskh Arabic','Segoe UI',sans-serif; color:${SLATE_900}; padding: 28px; }
      header { display:flex; gap:16px; align-items:center; border-bottom: 2px solid ${PRIMARY}; padding-bottom: 14px; margin-bottom: 22px; }
      header img { width: 56px; height: 56px; object-fit: contain; }
      header h1 { margin:0; color:${PRIMARY}; font-size: 22px; font-weight: 700; }
      header p { margin:4px 0 0; color:${SLATE_500}; font-size: 12px; }

      .kpis { display:flex; gap: 14px; margin-bottom: 22px; }
      .kpi { flex:1; background:#fff; border:1px solid ${SLATE_100}; border-radius: 14px; padding: 16px 18px; }
      .kpi-value { font-size: 26px; font-weight: 700; color: ${SLATE_900}; }
      .kpi-label { font-size: 12px; color: ${SLATE_500}; margin-top: 4px; }

      .insight { background:#fff; border:1px solid ${SLATE_100}; border-radius: 14px; padding: 18px 20px; margin-bottom: 14px; }
      .insight-head h2 { margin:0; font-size: 15px; font-weight: 700; }
      .insight-head p { margin: 2px 0 12px; font-size: 11px; color: ${SLATE_500}; }
      .insight ul { list-style: none; padding: 0; margin: 0; }
      .insight li { display:flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid ${SLATE_100}; }
      .insight li:last-child { border-bottom: none; }
      .bullet { width:8px; height:8px; border-radius:50%; margin-top: 7px; flex-shrink: 0; }
      .item-name { font-size: 13px; font-weight: 600; color: ${SLATE_900}; }
      .item-detail { font-size: 11px; color: ${SLATE_500}; margin-top: 2px; }
      .empty { color: ${SLATE_500}; font-size: 12px; padding: 4px 0 0; margin: 0; }

      footer { margin-top: 24px; text-align:center; color:#94A3B8; font-size: 11px; border-top: 1px solid ${SLATE_100}; padding-top: 10px; }
    </style>`;

  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);

  await html2pdf()
    .from(container)
    .set({
      margin: 10,
      filename: `executive-summary-${weekStart.toISOString().slice(0, 10)}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    })
    .save();

  document.body.removeChild(container);
}
