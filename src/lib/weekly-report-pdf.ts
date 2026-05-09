import logo from "@/assets/logo.png";
import { printHtmlDocument } from "@/lib/print-frame";

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

function sectionHtml(opts: {
  number: string; title: string; subtitle: string; accent: string;
  items: InsightItem[]; empty: string;
}): string {
  const { number, title, subtitle, accent, items, empty } = opts;
  return `
    <section class="sec" style="border-right: 3px solid ${accent}">
      <div class="sec-head">
        <span class="sec-num" style="color:${accent}">${number}</span>
        <div class="sec-titles">
          <h3>${title}</h3>
          <p class="sec-sub">${subtitle}</p>
        </div>
        <span class="sec-count" style="background:${accent}14; color:${accent}; border:1px solid ${accent}33">${items.length}</span>
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

function buildRecommendations(leaders: InsightItem[], monitoring: InsightItem[], urgent: InsightItem[]): InsightItem[] {
  const recs: InsightItem[] = [];
  urgent.forEach((u) => recs.push({ name: u.name, detail: "تدخّل مؤسسي من إدارة اللجنة لمعالجة المهام المتعثّرة وإعادة جدولتها وفق الأولوية." }));
  monitoring.forEach((m) => recs.push({ name: m.name, detail: "متابعة أسبوعية مع رئيس اللجنة وتحديد تواريخ نهائية واضحة." }));
  leaders.forEach((l) => recs.push({ name: l.name, detail: "تعميم تجربة اللجنة كنموذج تشغيلي على بقية اللجان." }));
  return recs.slice(0, 6);
}

export function getWeeklyReportPrintHtml(args: Args): string {
  const { weekStart, overallRate, overallDelta, overdueTasks, topCommittee, leaders, monitoring, urgent, statusLabel } = args;
  const today = new Date().toLocaleDateString("ar-SA-u-ca-gregory", {
    year: "numeric", month: "long", day: "numeric",
  });
  const week = weekStart.toLocaleDateString("ar-SA-u-ca-gregory", {
    year: "numeric", month: "long", day: "numeric",
  });

  return `
    <div dir="rtl" class="page">
      <div class="watermark"></div>

      <header>
        <img src="${logo}" alt="logo" class="brand-logo" />
        <div class="head-text">
          <p class="kicker">ملخص الأداء التنفيذي · مذكرة رسمية</p>
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
          <div class="kpi-label">مهام تستوجب المعالجة</div>
          <div class="kpi-row"><span class="kpi-value" style="color:${overdueTasks > 0 ? RED : TEAL}">${overdueTasks}</span></div>
          <div class="kpi-sub">${overdueTasks === 0 ? "لا توجد مهام عالقة" : "مهام تحتاج تدخّل"}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">اللجنة الأعلى أداءً</div>
          <div class="kpi-row"><span class="kpi-value-text">${topCommittee ? topCommittee.name : "—"}</span></div>
          <div class="kpi-sub">${topCommittee ? `إنجاز ${topCommittee.rate}%` : "لا توجد بيانات كافية"}</div>
        </div>
      </div>

      ${sectionHtml({ number: "01", title: "إنجازات الأسبوع", subtitle: "أبرز اللجان التي تجاوزت المستهدف", accent: TEAL, items: leaders, empty: "لا توجد إنجازات بارزة هذا الأسبوع." })}
      ${sectionHtml({ number: "02", title: "تحديات العمل", subtitle: "مهام متأخرة تستوجب المعالجة والمتابعة", accent: AMBER, items: [...urgent, ...monitoring].slice(0, 6), empty: "لا توجد تحديات تشغيلية هذا الأسبوع." })}
      ${sectionHtml({ number: "03", title: "توصيات التحسين", subtitle: "إجراءات مقترحة لكل لجنة", accent: GOLD, items: buildRecommendations(leaders, monitoring, urgent), empty: "لا توجد توصيات إضافية — الأداء العام مستقر." })}

      <div class="signature">
        <div class="sig-block">
          <div class="sig-label">إعداد: إدارة اللجنة</div>
          <div class="sig-line">التوقيع</div>
        </div>
        <div class="sig-block">
          <div class="sig-label">اعتماد اللجنة المنظمة</div>
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

      .sec { position:relative; background:#fff; border:1px solid ${SLATE_100}; border-radius: 10px; padding: 16px 18px; margin-bottom: 12px; page-break-inside: avoid; }
      .sec-head { display:flex; align-items:flex-start; gap: 12px; padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px solid ${SLATE_100}; }
      .sec-num { font-size: 22px; font-weight: 800; line-height: 1; letter-spacing: 1px; min-width: 36px; }
      .sec-titles { flex: 1; }
      .sec-titles h3 { margin: 0; font-size: 15px; font-weight: 800; color:${SLATE_900}; letter-spacing: -0.2px; }
      .sec-sub { margin: 2px 0 0; font-size: 11px; color: ${SLATE_500}; }
      .sec-count { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; align-self: center; }
      .sec ul { list-style: none; padding: 0; margin: 0; }
      .sec li { display:flex; gap: 10px; padding: 7px 0; border-bottom: 1px solid ${SLATE_100}; }
      .sec li:last-child { border-bottom: none; }
      .bullet { width:7px; height:7px; border-radius:50%; margin-top: 6px; flex-shrink: 0; display:inline-block; }
      .item-name { font-size: 12px; font-weight: 700; color: ${SLATE_900}; }
      .item-detail { font-size: 10.5px; color: ${SLATE_700}; margin-top: 2px; line-height: 1.55; }
      .empty { color: ${SLATE_500}; font-size: 11px; padding: 4px 0 8px; margin: 0; }

      .signature { position:relative; display:flex; gap: 32px; margin-top: 22px; padding-top: 14px; border-top: 1px dashed ${SLATE_300}; page-break-inside: avoid; }
      .sig-block { flex:1; }
      .sig-label { font-size: 11px; color: ${SLATE_500}; margin-bottom: 32px; }
      .sig-line { font-size: 11px; color: ${SLATE_700}; border-top: 1px solid ${SLATE_300}; padding-top: 6px; }

      footer { position:relative; margin-top: 16px; text-align:center; color:#94A3B8; font-size: 10px; }
      @page { size: A4 portrait; margin: 12mm 10mm 14mm; }
      @media print { html, body { margin:0; background:#fff; } .page { padding:0; } }
    </style>`;
}

export async function exportWeeklyReportPdf(args: Args): Promise<void> {
  const html = getWeeklyReportPrintHtml(args);
  await printHtmlDocument(html, `weekly-leadership-${args.weekStart.toISOString().slice(0, 10)}`);
}
