import logo from "@/assets/logo.png";
import { printHtmlDocument } from "@/lib/print-frame";
import { fmtArDate } from "@/lib/report-shared";

export interface InsightItem { name: string; detail: string; }

export interface CommitteePdfRow {
  name: string;
  total: number;
  done: number;
  overdue: number;
  rate: number;
  delta: number | null;
}

interface Args {
  weekStart: Date;
  overallRate: number;
  overallDelta: number | null;
  overdueTasks: number;
  topCommittee: { name: string; rate: number } | null;
  committees: CommitteePdfRow[];
}

const TEAL = "#0D7C66";
const TEAL_DARK = "#0a5b4d";
const SLATE_900 = "#0F172A";
const SLATE_700 = "#334155";
const SLATE_500 = "#64748B";
const SLATE_300 = "#CBD5E1";
const SLATE_200 = "#E2E8F0";
const SLATE_100 = "#F1F5F9";
const SLATE_50  = "#F8FAFC";
const GOLD = "#C4A25C";

/** Subtle geometric dot/grid pattern (no text). Print-safe. */
function geometricPatternUrl(): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'>` +
      `<g fill='none' stroke='%23E2E8F0' stroke-width='0.6'>` +
        `<path d='M0 22 H44 M22 0 V44'/>` +
      `</g>` +
      `<circle cx='22' cy='22' r='1.1' fill='%23CBD5E1'/>` +
    `</svg>`;
  return `url("data:image/svg+xml;utf8,${svg}")`;
}

function deltaText(d: number | null): string {
  if (d === null) return "—";
  if (d === 0) return "0%";
  return d > 0 ? `+${d}%` : `${d}%`;
}

function tierFor(c: CommitteePdfRow): "excellent" | "stable" | "watch" | "critical" {
  if (c.total === 0) return "watch";
  if (c.rate >= 80 && c.overdue === 0) return "excellent";
  if (c.rate < 40 || c.overdue > 2) return "critical";
  if (c.rate < 70 || c.overdue > 0) return "watch";
  return "stable";
}

function excellenceText(c: CommitteePdfRow): string {
  if (c.total === 0) return "اللجنة في طور تفعيل الخطة التشغيلية ولم تُسجَّل بعد مهام قياس.";
  const parts: string[] = [];
  if (c.rate >= 80) parts.push(`بلوغ نسبة إنجاز ${c.rate}% تتجاوز المستهدف الأسبوعي`);
  else if (c.rate >= 60) parts.push(`الحفاظ على معدل إنجاز ${c.rate}% ضمن النطاق الجيد`);
  else parts.push(`تنفيذ ${c.done} مهمة من أصل ${c.total} ضمن خطة الأسبوع`);
  if (c.overdue === 0 && c.total > 0) parts.push("الالتزام الكامل بالمواعيد دون تسجيل أي تأخير");
  if (c.delta !== null && c.delta > 0) parts.push(`تحسّن أسبوعي بنسبة +${c.delta}% مقارنةً بالأسبوع السابق`);
  return parts.join(" · ") + ".";
}

function improvementText(c: CommitteePdfRow): string {
  if (c.total === 0) return "الهدف: اعتماد خطة عمل أسبوعية واضحة وإسناد مهام محددة لرفع جاهزية اللجنة.";
  const parts: string[] = [];
  if (c.overdue > 0) parts.push(`الهدف: إغلاق ${c.overdue} مهمة متأخرة خلال 72 ساعة لرفع كفاءة الاستجابة`);
  if (c.rate < 80) parts.push(`الهدف: رفع نسبة الإنجاز من ${c.rate}% إلى 85% خلال الأسبوع القادم`);
  if (c.delta !== null && c.delta < 0) parts.push("الهدف: مراجعة أسباب تراجع الأداء وإعادة توزيع المهام على الفريق");
  if (parts.length === 0) parts.push("الهدف: المحافظة على هذا المستوى وتطوير زمن الاستجابة لكل مهمة");
  return parts.join(" · ") + ".";
}

function buildExecutiveSummary(a: Args): { headline: string; impacts: { title: string; body: string }[] } {
  const active = a.committees.filter((c) => c.total > 0);
  const excellent = active.filter((c) => c.rate >= 80 && c.overdue === 0).length;
  const critical = active.filter((c) => c.rate < 40 || c.overdue > 2).length;
  const total = active.length;
  const readiness = a.overallRate;

  let headline: string;
  if (readiness >= 80) headline = `الجاهزية المؤسسية مرتفعة بمعدل ${readiness}% — مؤشرات أداء اللجان تدل على تكامل تشغيلي قوي وقدرة على التنفيذ في الوقت المحدد.`;
  else if (readiness >= 60) headline = `الجاهزية العامة عند ${readiness}% — تكامل ملحوظ بين اللجان مع وجود فرص محددة لتحسين زمن الإنجاز ورفع الكفاءة.`;
  else headline = `الجاهزية العامة عند ${readiness}% — تتطلب المرحلة الحالية مواءمة أكبر بين اللجان وتسريع وتيرة التنفيذ لضمان بلوغ المستهدفات.`;

  const impacts: { title: string; body: string }[] = [];

  impacts.push({
    title: "التكامل بين اللجان",
    body: total === 0
      ? "لا توجد بيانات تنفيذية كافية حالياً لقياس مستوى التكامل بين اللجان."
      : `${excellent} من أصل ${total} لجنة تعمل ضمن مستوى الريادة، ما يُشير إلى مواءمة تشغيلية بنسبة ${Math.round((excellent / total) * 100)}% بين الفرق المنفذة والمستهدفات الموضوعة.`,
  });

  impacts.push({
    title: "أثر التأخيرات على المسار العام",
    body: a.overdueTasks === 0
      ? "لا توجد مهام متأخرة هذا الأسبوع — المسار التنفيذي محافظ على إيقاعه دون تأثير سلبي على الجدول الزمني."
      : `يوجد ${a.overdueTasks} مهمة خارج الجدول الزمني، وقد تُؤثّر على جاهزية المراحل اللاحقة إن لم تُعالَج خلال الأسبوع الحالي.`,
  });

  impacts.push({
    title: "اتجاه الأداء العام",
    body: a.overallDelta === null
      ? "هذه أول لقطة قياس مرجعية، وستُستخدم لرصد الاتجاه في الأسابيع القادمة."
      : a.overallDelta > 0
      ? `اتجاه إيجابي بمعدل +${a.overallDelta}% مقارنةً بالأسبوع السابق — مؤشر على تحسّن مستدام في كفاءة التنفيذ.`
      : a.overallDelta < 0
      ? `تراجع بنسبة ${a.overallDelta}% مقارنةً بالأسبوع السابق — يستدعي مراجعة أولويات التشغيل وإعادة توزيع الموارد.`
      : "ثبات في الأداء العام مقارنةً بالأسبوع السابق — استقرار يدعم اعتماد تحسينات نوعية.",
  });

  if (critical > 0) {
    impacts.push({
      title: "بؤر الانتباه المؤسسي",
      body: `${critical} لجنة تحتاج إلى دعم تشغيلي مركّز هذا الأسبوع لإعادة المسار إلى مستويات الإنجاز المعتمدة.`,
    });
  }

  return { headline, impacts };
}

function buildCallToAction(a: Args): string {
  if (a.overdueTasks === 0 && a.overallRate >= 80) {
    return "حافظوا على هذا الإيقاع المؤسسي المتميز، وعمّموا أفضل الممارسات بين اللجان لتعزيز التميز المستدام.";
  }
  if (a.overdueTasks > 0) {
    return `ادعموا اللجان المعنية لإغلاق ${a.overdueTasks} مهمة عالقة هذا الأسبوع، ورفع مؤشر الالتزام بالمواعيد إلى 100%.`;
  }
  return "ركّزوا الأسبوع القادم على رفع نسبة الإنجاز الكلي بمقدار 10% عبر متابعة دقيقة لمسارات اللجان.";
}

function tierBadge(t: ReturnType<typeof tierFor>): { label: string; bg: string; fg: string; border: string } {
  switch (t) {
    case "excellent": return { label: "أداء متميّز", bg: "#ECFDF5", fg: "#047857", border: "#A7F3D0" };
    case "stable":    return { label: "أداء مستقر", bg: "#F0F9FF", fg: "#0369A1", border: "#BAE6FD" };
    case "watch":     return { label: "تحت المتابعة", bg: "#FEF3C7", fg: "#92400E", border: "#FDE68A" };
    case "critical":  return { label: "يحتاج معالجة", bg: "#FEE2E2", fg: "#B91C1C", border: "#FECACA" };
  }
}

function pageCss(patternUrl: string): string {
  return `
    @page {
      size: A4 portrait;
      margin: 16mm 12mm 18mm;
      @bottom-center {
        content: "صفحة " counter(page) " من " counter(pages);
        font-family: 'Noto Naskh Arabic','Segoe UI','Tahoma',sans-serif;
        font-size: 9.5pt; color: ${SLATE_500};
      }
    }
    @media print { html, body { margin:0; background:#fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    .doc {
      font-family: 'Noto Naskh Arabic','Segoe UI','Tahoma',sans-serif;
      color:${SLATE_900}; background:#fff; direction: rtl;
      position: relative; padding: 6px 4px 0;
    }
    .doc::before {
      content: ""; position: fixed; inset: 0;
      background-image: ${patternUrl};
      background-repeat: repeat; opacity: 0.55;
      pointer-events: none; z-index: 0;
    }
    .doc > * { position: relative; z-index: 1; }

    .hdr { display:flex; align-items:center; gap:14px; padding: 6px 4px 14px;
      border-bottom: 2px solid ${TEAL}; margin-bottom: 18px; }
    .hdr .logo { width: 56px; height: 56px; object-fit: contain; }
    .hdr h1 { margin:0; font-size:20px; font-weight:800; color:${SLATE_900}; line-height:1.4; }
    .hdr .sub { margin:4px 0 0; font-size:11px; color:${SLATE_500}; }
    .hdr .accent { width:6px; height:46px; background:${TEAL}; border-radius:3px; }

    .section { margin: 0 0 16px; page-break-inside: avoid; break-inside: avoid; }
    .section-head { display:flex; align-items:center; gap:10px; margin: 4px 0 10px; }
    .section-head .bar { width:4px; height:18px; background:${TEAL}; border-radius:2px; }
    .section-head h2 { margin:0; font-size:14px; font-weight:800; color:${SLATE_900}; letter-spacing:.2px; }
    .section-head .desc { margin-right:6px; font-size:10.5px; color:${SLATE_500}; }

    .exec {
      background: linear-gradient(135deg, #ffffff 0%, ${SLATE_50} 100%);
      border:1px solid ${SLATE_200}; border-right: 4px solid ${TEAL};
      border-radius:12px; padding:16px 18px;
    }
    .exec .head-line {
      font-size:13px; line-height:1.85; color:${SLATE_900}; font-weight:700;
      padding-bottom:10px; margin-bottom:12px; border-bottom:1px dashed ${SLATE_200};
    }
    .impact-grid { display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
    .impact { background:#fff; border:1px solid ${SLATE_100}; border-radius:10px; padding:10px 12px; }
    .impact h4 { margin:0 0 4px; font-size:11.5px; color:${TEAL_DARK}; font-weight:800; }
    .impact p  { margin:0; font-size:11px; color:${SLATE_700}; line-height:1.7; }

    .kpi-row { display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-bottom:14px; }
    .kpi { background:#fff; border:1px solid ${SLATE_200}; border-radius:10px; padding:10px 12px; }
    .kpi .l { font-size:10.5px; color:${SLATE_500}; }
    .kpi .v { font-size:18px; font-weight:800; color:${TEAL_DARK}; margin-top:2px; }
    .kpi .h { font-size:10.5px; color:${SLATE_700}; margin-top:2px; }

    .cards { display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
    .card {
      background:#fff; border:1px solid ${SLATE_200}; border-radius:12px;
      padding:12px 13px; page-break-inside: avoid; break-inside: avoid;
      border-right: 3px solid ${TEAL};
    }
    .card.excellent  { border-right-color:#10B981; }
    .card.stable     { border-right-color:#0EA5E9; }
    .card.watch      { border-right-color:#D97706; }
    .card.critical   { border-right-color:#B91C1C; }
    .card-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
    .card-head .name { font-size:12.5px; font-weight:800; color:${SLATE_900}; }
    .badge { font-size:9.5px; font-weight:700; padding:2px 8px; border-radius:999px; border:1px solid; }
    .stats { display:flex; gap:10px; font-size:10.5px; color:${SLATE_700}; margin-bottom:8px; }
    .stats span b { color:${SLATE_900}; }
    .progress { width:100%; height:6px; background:${SLATE_100}; border-radius:999px; overflow:hidden; margin-bottom:9px; }
    .progress > i { display:block; height:100%; background:${TEAL}; border-radius:999px; }
    .blk { margin-top:7px; }
    .blk .t { font-size:10.5px; font-weight:800; color:${TEAL_DARK}; margin-bottom:3px; }
    .blk.imp .t { color:${GOLD}; }
    .blk p { margin:0; font-size:10.5px; color:${SLATE_700}; line-height:1.65; }

    .cta {
      margin: 14px 0 6px;
      background: linear-gradient(135deg, ${TEAL} 0%, ${TEAL_DARK} 100%);
      color:#fff; border-radius:12px; padding:14px 18px;
      page-break-inside: avoid; break-inside: avoid;
    }
    .cta .label { font-size:10.5px; opacity:.85; letter-spacing:.6px; font-weight:700; text-transform:uppercase; }
    .cta .msg { margin-top:4px; font-size:13px; font-weight:700; line-height:1.7; }
  `;
}

export function getWeeklyReportPrintHtml(args: Args): string {
  const week = fmtArDate(args.weekStart);
  const today = fmtArDate(new Date());
  const rate = Math.max(0, Math.min(100, args.overallRate));
  const exec = buildExecutiveSummary(args);
  const cta = buildCallToAction(args);

  const sorted = [...args.committees].sort((a, b) => {
    const ra = (a.rate || 0) - (a.overdue * 5);
    const rb = (b.rate || 0) - (b.overdue * 5);
    return rb - ra;
  });

  const cards = sorted.map((c) => {
    const t = tierFor(c);
    const b = tierBadge(t);
    return `
      <div class="card ${t}">
        <div class="card-head">
          <div class="name">${c.name}</div>
          <span class="badge" style="background:${b.bg};color:${b.fg};border-color:${b.border}">${b.label}</span>
        </div>
        <div class="stats">
          <span>الإنجاز: <b>${c.rate}%</b></span>
          <span>المنفّذ: <b>${c.done}/${c.total}</b></span>
          <span>المتأخّرة: <b>${c.overdue}</b></span>
          <span>التغيّر: <b>${deltaText(c.delta)}</b></span>
        </div>
        <div class="progress"><i style="width:${Math.max(2, c.rate)}%"></i></div>
        <div class="blk exc">
          <div class="t">نقاط التميز</div>
          <p>${excellenceText(c)}</p>
        </div>
        <div class="blk imp">
          <div class="t">فرص التحسين</div>
          <p>${improvementText(c)}</p>
        </div>
      </div>`;
  }).join("");

  return `
    <div dir="rtl" class="doc">
      <header class="hdr">
        <img src="${logo}" alt="" class="logo" />
        <div class="accent"></div>
        <div style="flex:1">
          <h1>التقرير الشامل لأداء لجان الزواج الجماعي</h1>
          <p class="sub">أسبوع ${week} · صادر بتاريخ ${today}</p>
        </div>
      </header>

      <section class="section">
        <div class="section-head">
          <span class="bar"></span>
          <h2>الموجز التحليلي التنفيذي</h2>
          <span class="desc">قراءة مؤسسية لأثر الأداء المتقاطع بين اللجان</span>
        </div>
        <div class="exec">
          <div class="head-line">${exec.headline}</div>
          <div class="impact-grid">
            ${exec.impacts.map((i) => `
              <div class="impact">
                <h4>${i.title}</h4>
                <p>${i.body}</p>
              </div>`).join("")}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <span class="bar"></span>
          <h2>المؤشرات الرئيسية</h2>
          <span class="desc">قياس الأداء على مستوى المنظومة</span>
        </div>
        <div class="kpi-row">
          <div class="kpi"><div class="l">نسبة الإنجاز الكلي</div><div class="v">${rate}%</div><div class="h">${rate >= 80 ? "أداء يفوق المستهدف" : rate >= 50 ? "ضمن النطاق المقبول" : "دون المستهدف"}</div></div>
          <div class="kpi"><div class="l">المهام المتأخرة</div><div class="v" style="color:${args.overdueTasks > 0 ? "#B91C1C" : TEAL_DARK}">${args.overdueTasks}</div><div class="h">${args.overdueTasks === 0 ? "لا توجد متأخرات" : "تتطلب جدولة فورية"}</div></div>
          <div class="kpi"><div class="l">اللجنة الأعلى أداءً</div><div class="v" style="font-size:14px">${args.topCommittee ? args.topCommittee.name : "—"}</div><div class="h">${args.topCommittee ? `إنجاز ${args.topCommittee.rate}%` : "بيانات غير كافية"}</div></div>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <span class="bar"></span>
          <h2>التدقيق المؤسسي للجان</h2>
          <span class="desc">بطاقة رؤى مؤسسية لكل لجنة (${args.committees.length} لجنة)</span>
        </div>
        <div class="cards">${cards}</div>
      </section>

      <div class="cta">
        <div class="label">دعوة للتطوير</div>
        <div class="msg">${cta}</div>
      </div>
    </div>
    <style>${pageCss(geometricPatternUrl())}</style>
  `;
}

export async function exportWeeklyReportPdf(args: Args): Promise<void> {
  const html = getWeeklyReportPrintHtml(args);
  await printHtmlDocument(html, "التقرير الشامل لأداء لجان الزواج الجماعي");
}
