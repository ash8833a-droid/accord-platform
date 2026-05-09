import logo from "@/assets/logo.png";
import { printHtmlDocument } from "@/lib/print-frame";
import {
  REPORT_TOKENS, SHARED_PRINT_CSS,
  buildReferenceNumber, fmtArDate, watermarkCss,
} from "@/lib/report-shared";

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
  committees: { name: string; total: number; done: number; rate: number; overdue?: number; savings?: number }[];
  revenues: number;
  expenses: number;
}

function buildRecommendations(d: DashboardPdfData): string[] {
  const recs: string[] = [];
  const lagging = d.committees.filter((c) => c.total > 0 && c.rate < 50)
    .sort((a, b) => a.rate - b.rate).slice(0, 2);
  const overdueLeaders = d.committees.filter((c) => (c.overdue ?? 0) >= 3)
    .sort((a, b) => (b.overdue ?? 0) - (a.overdue ?? 0)).slice(0, 2);
  const champions = d.committees.filter((c) => c.total > 0 && c.rate >= 85)
    .sort((a, b) => b.rate - a.rate).slice(0, 2);

  if (lagging.length) {
    recs.push(`توصية: تكثيف الموارد البشرية في ${lagging.map((c) => c.name).join("، ")} للوصول إلى المستهدف خلال 15 يوماً.`);
  }
  if (overdueLeaders.length) {
    recs.push(`توصية: مراجعة الجدولة الزمنية لـ ${overdueLeaders.map((c) => c.name).join("، ")} وإغلاق المهام المتعثّرة خلال أسبوع.`);
  }
  if (d.kpis.completionRate < 60) {
    recs.push("توصية: عقد اجتماع تنسيقي عاجل بين رؤساء اللجان لإعادة ترتيب الأولويات ورفع نسبة الإنجاز العامة.");
  }
  if (d.kpis.netBalance < 0) {
    recs.push("توصية: إعادة تقييم سقف الإنفاق وتفعيل قنوات إضافية لجمع المساهمات لمعالجة العجز المالي.");
  }
  if (champions.length) {
    recs.push(`توصية: تعميم الممارسات التشغيلية لـ ${champions.map((c) => c.name).join("، ")} كنموذج مرجعي على بقية اللجان.`);
  }
  if (recs.length === 0) {
    recs.push("توصية: المحافظة على الأداء الحالي وتعزيز إجراءات الجودة والمتابعة الدورية.");
  }
  return recs.slice(0, 5);
}

export function getDashboardPrintHtml(d: DashboardPdfData): string {
  const ref = buildReferenceNumber("RPT-A");
  const today = fmtArDate(new Date());
  const period = d.year === "all" ? "كل السنوات" : `سنة ${d.year}`;
  const wmCss = watermarkCss();
  const rate = Math.max(0, Math.min(100, d.kpis.completionRate));
  const totalRev = d.revenues;
  const totalExp = d.expenses;
  const recs = buildRecommendations(d);

  const financeRows = d.finance
    .filter((r) => r.revenues > 0 || r.expenses > 0)
    .map((r) => `
      <tr>
        <td>${r.label}</td>
        <td>${fmtSar(r.revenues)}</td>
        <td>${fmtSar(r.expenses)}</td>
        <td style="color:${r.revenues - r.expenses >= 0 ? REPORT_TOKENS.PRIMARY : REPORT_TOKENS.RED}">${fmtSar(r.revenues - r.expenses)}</td>
      </tr>`).join("");

  const committeeRows = d.committees.map((c) => `
    <tr>
      <td>${c.name}</td>
      <td>${c.total}</td>
      <td>${c.done}</td>
      <td><b style="color:${REPORT_TOKENS.PRIMARY}">${c.rate}%</b></td>
      <td>${c.overdue ?? 0}</td>
    </tr>`).join("");

  const gaps = d.committees
    .filter((c) => c.total > 0 && (c.rate < 50 || (c.overdue ?? 0) > 2))
    .sort((a, b) => (b.overdue ?? 0) - (a.overdue ?? 0) || a.rate - b.rate)
    .slice(0, 6);

  return `
    <div dir="rtl" class="doc">
      <div class="wm" style="background-image:${wmCss}"></div>

      <header class="hdr">
        <img src="${logo}" alt="logo" class="logo" />
        <div class="titles">
          <p class="kicker">تقرير الأداء التنفيذي · جاهز لاتخاذ القرار</p>
          <h1>تقرير الأداء العام للجنة الزواج الجماعي</h1>
          <p class="meta">${period} · صادر بتاريخ ${today}</p>
        </div>
        <div class="ref">
          رقم المرجع
          <b>${ref}</b>
          <span style="display:block;margin-top:4px;color:${REPORT_TOKENS.SLATE_500}">الفترة: ${period}</span>
        </div>
      </header>

      <!-- Pillar 1 -->
      <section class="pillar">
        <div class="pillar-head">
          <span class="pillar-num">01</span>
          <div class="pillar-title">
            <h3>ملخص الإنجاز الاستراتيجي</h3>
            <p>أبرز المؤشرات التنفيذية مقابل المستهدف</p>
          </div>
          <span class="badge">${rate}% من المستهدف</span>
        </div>
        <table style="margin-bottom:10px">
          <thead><tr><th>المؤشر</th><th>القيمة</th><th>الملاحظة</th></tr></thead>
          <tbody>
            <tr><td>إجمالي المهام</td><td><b>${d.kpis.totalTasks}</b></td><td>${d.kpis.totalTasks > 0 ? "ضمن النطاق التشغيلي" : "لا توجد مهام بعد"}</td></tr>
            <tr><td>نسبة الإنجاز العامة</td><td><b style="color:${REPORT_TOKENS.PRIMARY}">${rate}%</b></td><td>${rate >= 80 ? "أداء فوق المستهدف" : rate >= 50 ? "ضمن النطاق المقبول" : "دون المستهدف"}</td></tr>
            <tr><td>إجمالي العرسان</td><td><b>${d.kpis.totalMarriages}</b></td><td>${period}</td></tr>
            <tr><td>صافي الرصيد المالي</td><td><b style="color:${d.kpis.netBalance >= 0 ? REPORT_TOKENS.PRIMARY : REPORT_TOKENS.RED}">${fmtSar(d.kpis.netBalance)}</b></td><td>${d.kpis.netBalance >= 0 ? "فائض" : "عجز يستوجب المعالجة"}</td></tr>
          </tbody>
        </table>
        <div style="font-size:11px;color:${REPORT_TOKENS.SLATE_500};margin-bottom:6px">شريط الإنجاز الكلي مقابل المستهدف</div>
        <div class="progress"><span style="width:${rate}%"></span></div>
      </section>

      <!-- Finance + Committees consolidated -->
      <section class="pillar">
        <div class="pillar-head">
          <span class="pillar-num">·</span>
          <div class="pillar-title">
            <h3>النظرة المالية ومستويات إنجاز اللجان</h3>
            <p>تحليل تفصيلي للإيرادات والمصروفات وأداء كل لجنة</p>
          </div>
          <span class="badge">${fmtSar(totalRev - totalExp)}</span>
        </div>
        <table style="margin-bottom:14px">
          <thead><tr><th>الشهر</th><th>الإيرادات</th><th>المصروفات</th><th>الرصيد</th></tr></thead>
          <tbody>${financeRows || `<tr><td colspan="4" style="text-align:center;color:${REPORT_TOKENS.SLATE_500}">لا توجد بيانات مالية للفترة</td></tr>`}</tbody>
        </table>
        <table>
          <thead><tr><th>اللجنة</th><th>إجمالي المهام</th><th>المُنجزة</th><th>نسبة الإنجاز</th><th>المتأخرة</th></tr></thead>
          <tbody>${committeeRows || `<tr><td colspan="5" style="text-align:center;color:${REPORT_TOKENS.SLATE_500}">لا توجد بيانات للجان</td></tr>`}</tbody>
        </table>
      </section>

      <!-- Pillar 2 -->
      <section class="pillar warn">
        <div class="pillar-head">
          <span class="pillar-num">02</span>
          <div class="pillar-title">
            <h3>الفجوات التشغيلية ومواطن الخلل</h3>
            <p>لجان دون المستهدف أو ذات تراكم متأخرات يستدعي التدخّل</p>
          </div>
          <span class="badge" style="background:${REPORT_TOKENS.GOLD}1A;color:${REPORT_TOKENS.AMBER};border-color:${REPORT_TOKENS.GOLD}55">${gaps.length}</span>
        </div>
        ${gaps.length === 0
          ? `<p class="empty">لا توجد فجوات تشغيلية بارزة — الأداء العام ضمن النطاق المقبول.</p>`
          : `<ul class="item-list">${gaps.map((c) => `
              <li>
                <span class="dot"></span>
                <div>
                  <div class="item-name">${c.name}</div>
                  <div class="item-detail">إنجاز ${c.rate}% · ${c.done}/${c.total}${(c.overdue ?? 0) > 0 ? ` · ${c.overdue} مهمة متأخرة` : ""}</div>
                </div>
              </li>`).join("")}</ul>`}
      </section>

      <!-- Pillar 3 -->
      <section class="pillar">
        <div class="pillar-head">
          <span class="pillar-num">03</span>
          <div class="pillar-title">
            <h3>التوصيات الذكية ودعم القرار</h3>
            <p>إرشادات إدارية مقترحة استناداً إلى تحليل البيانات</p>
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

export async function exportDashboardPdf(data: DashboardPdfData): Promise<void> {
  await printHtmlDocument(
    getDashboardPrintHtml(data),
    `تقرير-الأداء-${data.year === "all" ? "كل-السنوات" : data.year}`,
  );
}
