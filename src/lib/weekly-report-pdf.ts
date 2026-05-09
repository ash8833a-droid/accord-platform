import html2pdf from "html2pdf.js";
import logo from "@/assets/logo.png";

const PRIMARY = "#0D7C66";
const GOLD = "#D4A95E";
const TEAL = "#0D7C66";
const AMBER = "#D97706";
const RED = "#DC2626";
const SLATE_900 = "#0F172A";
const SLATE_700 = "#334155";
const SLATE_500 = "#64748B";
const SLATE_300 = "#CBD5E1";
const SLATE_100 = "#F1F5F9";

interface InsightItem { name: string; detail: string; }

interface Args {
  weekStart: Date;
  overallRate: number;
  overallDelta: number | null;
  overdueTasks: number;
  topCommittee: { name: string; rate: number } | null;
  leaders: InsightItem[];
  monitoring: InsightItem[];
  urgent: InsightItem[];
  statusLabel: string;
}

function deltaText(d: number | null): string {
  if (d === null) return "—";
  if (d === 0) return "0%";
  return d > 0 ? `+${d}%` : `${d}%`;
}
function deltaColor(d: number | null): string {
  if (d === null || d === 0) return SLATE_500;
  return d > 0 ? TEAL : RED;
}

function spotlightHtml(title: string, subtitle: string, accent: string, items: InsightItem[], rec: string, empty: string): string {
  return `
    <section class="spot" style="border-right: 4px solid ${accent}">
      <div class="spot-head">
        <h3>${title}</h3>
        <span class="spot-count" style="background:${accent}1A; color:${accent}">${items.length}</span>
      </div>
      <p class="spot-sub">${subtitle}</p>
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
      <div class="rec" style="background:${accent}10; border:1px solid ${accent}33; color:${accent === GOLD ? "#92400E" : accent}">
        <b>توصية:</b> ${rec}
      </div>
    </section>`;
}

export async function exportWeeklyReportPdf(args: Args): Promise<void> {
  const { weekStart, overallRate, overallDelta, overdueTasks, topCommittee, leaders, monitoring, urgent, statusLabel } = args;
  const today = new Date().toLocaleDateString("ar-SA-u-ca-gregory", {
    year: "numeric", month: "long", day: "numeric",
  });
  const week = weekStart.toLocaleDateString("ar-SA-u-ca-gregory", {
    year: "numeric", month: "long", day: "numeric",
  });

  const html = `
    <div dir="rtl" class="page">
      <div class="watermark"></div>

      <header>
        <img src="${logo}" alt="logo" class="brand-logo" />
        <div class="head-text">
          <p class="kicker">نبض القيادة · مذكرة تنفيذية</p>
          <h1>التقرير الأسبوعي للأداء العام</h1>
          <p class="meta">أسبوع ${week} · تاريخ التصدير: ${today}</p>
        </div>
        <div class="status-badge">${statusLabel}</div>
      </header>

      <div class="kpis">
        <div class="kpi">
          <div class="kpi-label">نسبة الإنجاز الكلي</div>
          <div class="kpi-row">
            <span class="kpi-value">${overallRate}%</span>
            <span class="kpi-delta" style="color:${deltaColor(overallDelta)}">${deltaText(overallDelta)}</span>
          </div>
          <div class="kpi-sub">مقارنة بالأسبوع السابق</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">اختناقات حرجة</div>
          <div class="kpi-row"><span class="kpi-value" style="color:${overdueTasks > 0 ? RED : TEAL}">${overdueTasks}</span></div>
          <div class="kpi-sub">${overdueTasks === 0 ? "لا توجد مهام عالقة" : "مهام تحتاج تدخّل"}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">اللجنة الأعلى أداءً</div>
          <div class="kpi-row"><span class="kpi-value-text">${topCommittee ? topCommittee.name : "—"}</span></div>
          <div class="kpi-sub">${topCommittee ? `إنجاز ${topCommittee.rate}%` : "لا توجد بيانات كافية"}</div>
        </div>
      </div>

      ${spotlightHtml("الرواد", "لجان تجاوزت المستهدف", TEAL, leaders, "إبراز التجربة وتعميمها كنموذج على بقية اللجان.", "لا توجد لجان ضمن مستوى الريادة هذا الأسبوع.")}
      ${spotlightHtml("تحت المتابعة", "تأخر يسير في بعض المهام", GOLD, monitoring, "تواصل دوري مع رؤساء اللجان لإزالة العوائق التشغيلية.", "لا توجد لجان تحت المتابعة.")}
      ${spotlightHtml("تنبيه عاجل", "اختناقات تتطلب تدخل الأمانة", RED, urgent, "يتطلب دعم لوجستي وقرار عاجل من الأمانة العامة.", "لا توجد تنبيهات عاجلة.")}

      <div class="signature">
        <div class="sig-block">
          <div class="sig-label">إعداد: الأمانة العامة</div>
          <div class="sig-line">التوقيع</div>
        </div>
        <div class="sig-block">
          <div class="sig-label">اعتماد الأمانة العامة</div>
          <div class="sig-line">التوقيع والتاريخ</div>
        </div>
      </div>

      <footer>منظومة لجنة الزواج الجماعي · مذكرة تنفيذية رسمية</footer>
    </div>

    <style>
      .page { all: initial; font-family: 'Noto Naskh Arabic','Segoe UI','Tahoma',sans-serif; color: ${SLATE_900}; padding: 24px 28px; background:#fff; position:relative; direction: rtl; display:block; }
      .page * { box-sizing: border-box; }
      .watermark {
        position:absolute; inset:0;
        background-image: radial-gradient(circle at 100% 0%, ${PRIMARY}0F 0%, transparent 45%), radial-gradient(circle at 0% 100%, ${GOLD}14 0%, transparent 45%);
        pointer-events:none;
      }
      header { position:relative; display:flex; gap:14px; align-items:center; border-bottom: 2px solid ${PRIMARY}; padding-bottom: 14px; margin-bottom: 20px; }
      header .brand-logo { width: 56px; height: 56px; object-fit: contain; }
      .head-text { flex:1; }
      .kicker { margin:0; color:${PRIMARY}; font-size: 10px; font-weight:700; letter-spacing: 1px; }
      header h1 { margin:4px 0 2px; color:${SLATE_900}; font-size: 20px; font-weight: 700; }
      header .meta { margin:0; color:${SLATE_500}; font-size: 11px; }
      .status-badge { background: ${PRIMARY}1A; color: ${PRIMARY}; font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 999px; border: 1px solid ${PRIMARY}33; white-space: nowrap; }

      .kpis { position:relative; display:flex; gap: 12px; margin-bottom: 18px; }
      .kpi { flex:1; background:#fff; border:1px solid ${SLATE_100}; border-radius: 12px; padding: 14px 16px; }
      .kpi-label { font-size: 11px; color: ${SLATE_500}; }
      .kpi-row { display:flex; align-items:baseline; gap: 8px; margin-top: 6px; }
      .kpi-value { font-size: 24px; font-weight: 700; color: ${SLATE_900}; }
      .kpi-value-text { font-size: 16px; font-weight: 700; color: ${SLATE_900}; }
      .kpi-delta { font-size: 12px; font-weight: 700; }
      .kpi-sub { font-size: 10px; color: ${SLATE_500}; margin-top: 4px; }

      .spot { position:relative; background:#fff; border:1px solid ${SLATE_100}; border-radius: 12px; padding: 14px 16px; margin-bottom: 12px; page-break-inside: avoid; }
      .spot-head { display:flex; justify-content:space-between; align-items:center; }
      .spot-head h3 { margin:0; font-size: 14px; font-weight: 700; color:${SLATE_900}; }
      .spot-count { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; }
      .spot-sub { margin: 2px 0 10px; font-size: 11px; color: ${SLATE_500}; }
      .spot ul { list-style: none; padding: 0; margin: 0 0 10px; }
      .spot li { display:flex; gap: 9px; padding: 6px 0; border-bottom: 1px solid ${SLATE_100}; }
      .spot li:last-child { border-bottom: none; }
      .bullet { width:7px; height:7px; border-radius:50%; margin-top: 6px; flex-shrink: 0; display:inline-block; }
      .item-name { font-size: 12px; font-weight: 700; color: ${SLATE_900}; }
      .item-detail { font-size: 10.5px; color: ${SLATE_700}; margin-top: 1px; }
      .empty { color: ${SLATE_500}; font-size: 11px; padding: 4px 0 8px; margin: 0; }
      .rec { font-size: 10.5px; padding: 8px 10px; border-radius: 8px; line-height: 1.6; }

      .signature { position:relative; display:flex; gap: 32px; margin-top: 22px; padding-top: 14px; border-top: 1px dashed ${SLATE_300}; page-break-inside: avoid; }
      .sig-block { flex:1; }
      .sig-label { font-size: 11px; color: ${SLATE_500}; margin-bottom: 32px; }
      .sig-line { font-size: 11px; color: ${SLATE_700}; border-top: 1px solid ${SLATE_300}; padding-top: 6px; }

      footer { position:relative; margin-top: 16px; text-align:center; color:#94A3B8; font-size: 10px; }
    </style>`;

  const container = document.createElement("div");
  // Render inside an isolated iframe so the app's CSS (which uses oklch())
  // never reaches html2canvas. html2canvas chokes on oklch and freezes the tab.
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position: fixed; left: -10000px; top: 0; width: 820px; height: 1200px; border: 0; opacity: 0; pointer-events: none;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"></head><body style="margin:0;background:#fff;color:#0F172A;font-family:'Segoe UI','Tahoma',sans-serif;">${html}</body></html>`);
  doc.close();
  // Wait for images (logo) to load so html2canvas captures them.
  await new Promise<void>((resolve) => {
    const imgs = Array.from(doc.images);
    if (imgs.length === 0) return resolve();
    let pending = imgs.length;
    const done = () => { if (--pending <= 0) resolve(); };
    imgs.forEach((img) => {
      if (img.complete) done();
      else { img.addEventListener("load", done); img.addEventListener("error", done); }
    });
    setTimeout(resolve, 1500); // safety timeout
  });
  container.appendChild(doc.body.firstElementChild as HTMLElement);

  try {
    await (html2pdf() as any)
      .from(doc.body)
      .set({
        margin: [12, 10, 14, 10],
        filename: `weekly-leadership-${weekStart.toISOString().slice(0, 10)}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      })
      .toPdf()
      .get("pdf")
      .then((pdf: any) => {
        const total = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= total; i++) {
          pdf.setPage(i);
          pdf.setFontSize(8);
          pdf.setTextColor(148, 163, 184);
          const w = pdf.internal.pageSize.getWidth();
          const h = pdf.internal.pageSize.getHeight();
          pdf.text(`صفحة ${i} من ${total}`, w / 2, h - 5, { align: "center" });
        }
      })
      .save();
  } finally {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  }
}
