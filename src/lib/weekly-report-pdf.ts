import logo from "@/assets/logo.png";
import { printHtmlDocument } from "@/lib/print-frame";
import {
  REPORT_TOKENS, SHARED_PRINT_CSS,
  buildReferenceNumber, fmtArDate, watermarkCss,
} from "@/lib/report-shared";

export interface InsightItem { name: string; detail: string; }

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

function buildRecommendations(a: Args): string[] {
  const recs: string[] = [];
  if (a.urgent.length > 0) {
    recs.push(`توصية: تخصيص دعم تشغيلي عاجل للجان (${a.urgent.slice(0, 2).map((u) => u.name).join("، ")}) لمعالجة المهام المتعثّرة وإعادة جدولتها وفق الأولوية.`);
  }
  if (a.overdueTasks > 0) {
    recs.push(`توصية: عقد جلسة متابعة استثنائية لمراجعة (${a.overdueTasks}) مهمة متأخرة وتحديد مسؤولي إغلاقها خلال 72 ساعة.`);
  }
  if (a.monitoring.length > 0) {
    recs.push("توصية: تفعيل مؤشرات أسبوعية دقيقة للجان قيد المتابعة وربطها بتنبيهات مبكّرة لرئيس اللجنة.");
  }
  if (a.leaders.length > 0) {
    recs.push(`توصية: تعميم تجربة (${a.leaders[0].name}) كنموذج تشغيلي مرجعي على بقية اللجان.`);
  }
  if (a.overallDelta !== null && a.overallDelta < 0) {
    recs.push("توصية: مراجعة خطة التشغيل الأسبوعية وإعادة توزيع الموارد بما يضمن استعادة معدل الإنجاز السابق.");
  }
  if (recs.length === 0) {
    recs.push("توصية: المحافظة على الأداء الحالي وتعزيز ثقافة التحسين المستمر داخل اللجان.");
  }
  return recs.slice(0, 5);
}

export function getWeeklyReportPrintHtml(args: Args): string {
  const ref = buildReferenceNumber("RPT-W");
  const today = fmtArDate(new Date());
  const week = fmtArDate(args.weekStart);
  const wmCss = watermarkCss();
  const rate = Math.max(0, Math.min(100, args.overallRate));
  const recs = buildRecommendations(args);

  const gaps = [...args.urgent, ...args.monitoring].slice(0, 8);

  return `
    <div dir="rtl" class="doc">
      <div class="wm" style="background-image:${wmCss}"></div>

      <header class="hdr">
        <img src="${logo}" alt="logo" class="logo" />
        <div class="titles">
          <p class="kicker">مذكرة تنفيذية رسمية · جاهزة لاتخاذ القرار</p>
          <h1>التقرير الأسبوعي لأداء لجنة الزواج الجماعي</h1>
          <p class="meta">أسبوع ${week} · صادر بتاريخ ${today}</p>
        </div>
        <div class="ref">
          رقم المرجع
          <b>${ref}</b>
          <span style="display:block;margin-top:4px;color:${REPORT_TOKENS.SLATE_500}">الحالة: ${args.statusLabel}</span>
        </div>
      </header>

      <!-- Pillar 1 -->
      <section class="pillar">
        <div class="pillar-head">
          <span class="pillar-num">01</span>
          <div class="pillar-title">
            <h3>ملخص الإنجاز الاستراتيجي</h3>
            <p>الأداء العام للجان مقارنةً بالمستهدف الأسبوعي</p>
          </div>
          <span class="badge">${rate}% من المستهدف</span>
        </div>
        <table style="margin-bottom:10px">
          <thead><tr>
            <th>المؤشر</th><th>القيمة</th><th>الفارق الأسبوعي</th><th>الملاحظة</th>
          </tr></thead>
          <tbody>
            <tr>
              <td>نسبة الإنجاز الكلي</td>
              <td><b style="color:${REPORT_TOKENS.PRIMARY}">${rate}%</b></td>
              <td>${deltaText(args.overallDelta)}</td>
              <td>${rate >= 80 ? "أداء فوق المستهدف" : rate >= 50 ? "ضمن النطاق المقبول" : "دون المستهدف"}</td>
            </tr>
            <tr>
              <td>اللجنة الأعلى أداءً</td>
              <td colspan="2"><b>${args.topCommittee ? args.topCommittee.name : "—"}</b></td>
              <td>${args.topCommittee ? `إنجاز ${args.topCommittee.rate}%` : "بيانات غير كافية"}</td>
            </tr>
            <tr>
              <td>مهام تستوجب المعالجة</td>
              <td colspan="2"><b style="color:${args.overdueTasks > 0 ? REPORT_TOKENS.RED : REPORT_TOKENS.PRIMARY}">${args.overdueTasks}</b></td>
              <td>${args.overdueTasks === 0 ? "لا توجد متأخرات" : "تتطلب جدولة فورية"}</td>
            </tr>
          </tbody>
        </table>
        <div style="font-size:11px;color:${REPORT_TOKENS.SLATE_500};margin-bottom:6px">شريط الإنجاز مقابل المستهدف (100%)</div>
        <div class="progress"><span style="width:${rate}%"></span></div>
      </section>

      <!-- Pillar 2 -->
      <section class="pillar warn">
        <div class="pillar-head">
          <span class="pillar-num">02</span>
          <div class="pillar-title">
            <h3>الفجوات التشغيلية ومواطن الخلل</h3>
            <p>اللجان والمهام المتأخرة أو المتعثّرة التي تستوجب تدخّل إدارة اللجنة</p>
          </div>
          <span class="badge" style="background:${REPORT_TOKENS.GOLD}1A;color:${REPORT_TOKENS.AMBER};border-color:${REPORT_TOKENS.GOLD}55">${gaps.length}</span>
        </div>
        ${gaps.length === 0
          ? `<p class="empty">لا توجد فجوات تشغيلية هذا الأسبوع — الأداء العام مستقر.</p>`
          : `<ul class="item-list">${gaps.map((g) => `
              <li>
                <span class="dot"></span>
                <div>
                  <div class="item-name">${g.name}</div>
                  <div class="item-detail">${g.detail}</div>
                </div>
              </li>`).join("")}</ul>`}
      </section>

      <!-- Pillar 3 -->
      <section class="pillar">
        <div class="pillar-head">
          <span class="pillar-num">03</span>
          <div class="pillar-title">
            <h3>التوصيات الذكية ودعم القرار</h3>
            <p>إجراءات إدارية مقترحة بناءً على تحليل بيانات الأسبوع</p>
          </div>
          <span class="badge">${recs.length} توصية</span>
        </div>
        <ul class="item-list">${recs.map((r, i) => `
          <li>
            <span class="dot"></span>
            <div>
              <div class="item-name">توصية ${String(i + 1).padStart(2, "0")}</div>
              <div class="item-detail">${r}</div>
            </div>
          </li>`).join("")}</ul>
      </section>

      <div class="signature">
        <div class="sig-block">
          <div class="sig-label">إعداد: إدارة اللجنة</div>
          <div class="sig-line">التوقيع</div>
        </div>
        <div class="sig-block">
          <div class="sig-label">اعتماد الهيئة المنظمة</div>
          <div class="sig-line">التوقيع والتاريخ</div>
        </div>
      </div>

      <p class="doc-footer">منظومة لجنة الزواج الجماعي · ${ref} · مذكرة تنفيذية رسمية</p>
    </div>
    <style>${SHARED_PRINT_CSS}</style>
  `;
}

export async function exportWeeklyReportPdf(args: Args): Promise<void> {
  const html = getWeeklyReportPrintHtml(args);
  await printHtmlDocument(html, `weekly-leadership-${args.weekStart.toISOString().slice(0, 10)}`);
}
