import { supabase } from "@/integrations/supabase/client";
import { BRAND_LOGO_DATA_URI } from "@/assets/brand-logo";
import { printHtmlDocument } from "@/lib/print-frame";

interface CommitteeRow {
  id: string;
  name: string;
  type: string;
  budget_allocated: number | null;
  budget_spent: number | null;
}

interface CommitteeMetrics {
  id: string;
  name: string;
  type: string;
  total: number;
  done: number;
  inProgress: number;
  todo: number;
  overdue: number;
  rate: number;
  evalAvg: number | null;
  evalCount: number;
  paidCount: number;
  pendingCount: number;
  budgetAllocated: number;
  budgetSpent: number;
  tier: "leader" | "active" | "stable" | "needs";
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

interface EngagementMetrics {
  committeeId: string;
  members: number;
  activeMembers: number; // logged in within last 30 days
  totalLogins: number;
  totalInteractions: number; // comments + responses
  lastActivity: Date | null;
  engagementRate: number; // 0-100
  topMembers: Array<{ name: string; lastLogin: Date | null; logins: number; interactions: number }>;
  inactiveMembers: string[];
}

const TEAL = "#0D7C66";
const TEAL_DARK = "#0a5b4d";
const GOLD = "#C4A25C";
const SLATE_900 = "#0F172A";
const SLATE_700 = "#334155";
const SLATE_500 = "#64748B";
const SLATE_200 = "#E2E8F0";
const SLATE_100 = "#F1F5F9";
const SLATE_50  = "#F8FAFC";

function fmtArDate(d: Date): string {
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
      day: "numeric", month: "long", year: "numeric",
    }).format(d) + " هـ";
  } catch { return d.toLocaleDateString("ar-SA"); }
}

// Arabic plural for "لجنة": 0 → لا توجد لجان · 1 → لجنة واحدة · 2 → لجنتان
// · 3-10 → N لجان · 11+ → N لجنة (تمييز مفرد منصوب)
function pluralLajna(n: number): string {
  if (n === 0) return "لا توجد لجان";
  if (n === 1) return "لجنة واحدة";
  if (n === 2) return "لجنتان";
  if (n >= 3 && n <= 10) return `${n} لجان`;
  return `${n} لجنة`;
}

function tierMeta(t: CommitteeMetrics["tier"]) {
  switch (t) {
    case "leader":  return { label: "لجنة قائدة", bg: "#ECFDF5", fg: "#047857", border: "#A7F3D0", color: "#10B981" };
    case "active":  return { label: "لجنة فاعلة", bg: "#F0F9FF", fg: "#0369A1", border: "#BAE6FD", color: "#0EA5E9" };
    case "stable":  return { label: "أداء مستقر", bg: "#FEF3C7", fg: "#92400E", border: "#FDE68A", color: "#D97706" };
    case "needs":   return { label: "تحتاج تقوية", bg: "#FEE2E2", fg: "#B91C1C", border: "#FECACA", color: "#B91C1C" };
  }
}

function fmtRelative(d: Date | null): string {
  if (!d) return "لم يسجّل دخولاً";
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days <= 0) return "اليوم";
  if (days === 1) return "أمس";
  if (days < 7) return `قبل ${days} أيام`;
  if (days < 30) return `قبل ${Math.floor(days / 7)} أسابيع`;
  if (days < 60) return "قبل شهر";
  return `قبل ${Math.floor(days / 30)} أشهر`;
}

function classify(m: Omit<CommitteeMetrics, "tier" | "strengths" | "weaknesses" | "recommendations">): CommitteeMetrics["tier"] {
  if (m.total === 0 && m.paidCount === 0) return "needs";
  if (m.rate >= 80 && m.overdue === 0) return "leader";
  if (m.rate >= 60 && m.overdue <= 1) return "active";
  if (m.rate >= 40) return "stable";
  return "needs";
}

function buildInsights(m: Omit<CommitteeMetrics, "strengths" | "weaknesses" | "recommendations">): {
  strengths: string[]; weaknesses: string[]; recommendations: string[];
} {
  const s: string[] = []; const w: string[] = []; const r: string[] = [];
  if (m.rate >= 80) s.push(`إنجاز متميّز للمهام بنسبة ${m.rate}%`);
  else if (m.rate >= 60) s.push(`معدل إنجاز جيد (${m.rate}%) ضمن النطاق المقبول`);
  if (m.overdue === 0 && m.total > 0) s.push("التزام كامل بالجداول الزمنية دون أي تأخير");
  if (m.evalAvg !== null && m.evalAvg >= 4) s.push(`تقييم نوعي مرتفع (${m.evalAvg.toFixed(1)}/5) من لجنة الجودة`);
  if (m.paidCount > 0 && m.budgetSpent > 0) s.push(`انضباط مالي بصرف ${m.paidCount} طلب معتمد`);
  if (s.length === 0) s.push("اللجنة في طور بناء أثر تشغيلي قابل للقياس.");

  if (m.total === 0) w.push("لا توجد مهام مُسجّلة لقياس الأداء حتى الآن");
  if (m.rate < 50 && m.total > 0) w.push(`انخفاض معدل الإنجاز إلى ${m.rate}%`);
  if (m.overdue > 0) w.push(`${m.overdue} مهمة تجاوزت الموعد المحدد`);
  if (m.evalAvg !== null && m.evalAvg < 3) w.push(`تقييم نوعي منخفض (${m.evalAvg.toFixed(1)}/5)`);
  if (m.pendingCount > 3) w.push(`تراكم ${m.pendingCount} طلب صرف بانتظار المعالجة`);
  if (w.length === 0) w.push("لا توجد مؤشرات سلبية جوهرية في هذه الدورة.");

  if (m.overdue > 0) r.push(`إغلاق المهام المتأخرة (${m.overdue}) خلال أسبوع وتعزيز آلية المتابعة الأسبوعية`);
  if (m.rate < 80 && m.total > 0) r.push("رفع نسبة الإنجاز عبر إعادة توزيع المهام وتحديد مالك واضح لكل مخرج");
  if (m.total === 0) r.push("اعتماد خطة عمل مفصّلة وتسجيل المهام في المنصة لتمكين القياس");
  if (m.evalAvg !== null && m.evalAvg < 4) r.push("معالجة ملاحظات لجنة الجودة وتوثيق الشواهد لرفع التقييم");
  if (r.length === 0) r.push("الاستمرار على نفس الإيقاع مع تطوير زمن الاستجابة لكل مخرج.");
  return { strengths: s, weaknesses: w, recommendations: r };
}

async function gather(): Promise<CommitteeMetrics[]> {
  const today = new Date(); today.setHours(0,0,0,0);
  const [{ data: cs }, { data: ts }, { data: evs }, { data: prs }] = await Promise.all([
    supabase.from("committees").select("id, name, type, budget_allocated, budget_spent"),
    supabase.from("committee_tasks").select("id, committee_id, status, due_date"),
    supabase.from("committee_evaluations").select("committee_type, final_score, percentage"),
    supabase.from("payment_requests").select("committee_id, status, amount"),
  ]);
  const committees = (cs ?? []) as CommitteeRow[];
  const tasks = (ts ?? []) as Array<{ committee_id: string; status: string; due_date: string | null }>;
  const evals = (evs ?? []) as Array<{ committee_type: string; final_score: number | null; percentage: number | null }>;
  const pays  = (prs ?? []) as Array<{ committee_id: string; status: string; amount: number | null }>;

  return committees.map((c) => {
    const ct = tasks.filter((t) => t.committee_id === c.id);
    const done = ct.filter((t) => t.status === "completed").length;
    const inProgress = ct.filter((t) => t.status === "in_progress").length;
    const todo = ct.filter((t) => t.status === "todo").length;
    const overdue = ct.filter((t) => t.status !== "completed" && t.due_date && new Date(t.due_date) < today).length;
    const total = ct.length;
    const rate = total === 0 ? 0 : Math.round((done / total) * 100);

    // Evaluations use committee_type. Normalize percentage (0-100) to a 0-5 scale for display.
    const ce = evals.filter((e) => e.committee_type === c.type && (e.percentage !== null || e.final_score !== null));
    const evalAvg = ce.length === 0
      ? null
      : ce.reduce((a, x) => a + (x.percentage !== null ? Number(x.percentage) / 20 : Number(x.final_score) / 20), 0) / ce.length;

    const cp = pays.filter((p) => p.committee_id === c.id);
    const paidCount = cp.filter((p) => p.status === "paid").length;
    const pendingCount = cp.filter((p) => p.status === "pending").length;

    const base = {
      id: c.id, name: c.name, type: c.type,
      total, done, inProgress, todo, overdue, rate,
      evalAvg, evalCount: ce.length,
      paidCount, pendingCount,
      budgetAllocated: Number(c.budget_allocated ?? 0),
      budgetSpent: Number(c.budget_spent ?? 0),
    };
    const tier = classify(base);
    const ins = buildInsights({ ...base, tier });
    return { ...base, tier, ...ins };
  });
}

function cardHtml(m: CommitteeMetrics): string {
  const t = tierMeta(m.tier);
  const utilization = m.budgetAllocated > 0 ? Math.round((m.budgetSpent / m.budgetAllocated) * 100) : 0;
  const isQuality = m.type === "quality";
  const qualityNote = isQuality
    ? `<section class="blk note">
        <h4>ملاحظة منهجية حول طبيعة عمل لجنة الجودة</h4>
        <p>يرتبط أثر لجنة الجودة ارتباطًا مباشرًا بتفاعل بقية اللجان ومستوى منجزاتها؛ فالمؤشرات أعلاه تعكس تراكم الأداء المؤسسي العام لا الجهد الذاتي للجنة فحسب. أما ما هو موكول للّجنة من مهام محورية فقد أُنجز وفق المستهدف، ويشمل:</p>
        <ul>
          <li>المتابعة المستمرة لأعمال اللجان ورصد مؤشرات الأداء أولًا بأول.</li>
          <li>إصدار التقارير الدورية وتقديم القراءات التحليلية للجهات المعنية.</li>
          <li>صياغة معايير التقييم المؤسسي واعتمادها مرجعًا موحّدًا للقياس.</li>
          <li>تفعيل قناة تقييم الجمهور عبر رابط الاستبيان وضمان وصوله للمستفيدين.</li>
        </ul>
      </section>`
    : "";
  return `
    <article class="card" style="border-right-color:${t.color}">
      <header class="card-head">
        <h3 class="cname">${m.name}</h3>
        <span class="badge" style="background:${t.bg};color:${t.fg};border-color:${t.border}">${t.label}</span>
      </header>
      <div class="kpis">
        <div><span class="l">الإنجاز</span><span class="v">${m.rate}%</span></div>
        <div><span class="l">المنفّذ</span><span class="v">${m.done}/${m.total}</span></div>
        <div><span class="l">المتأخّرة</span><span class="v" style="color:${m.overdue > 0 ? "#B91C1C" : SLATE_900}">${m.overdue}</span></div>
        <div><span class="l">تقييم الجودة</span><span class="v">${m.evalAvg !== null ? m.evalAvg.toFixed(1) + "/5" : "—"}</span></div>
      </div>
      <div class="progress"><i style="width:${Math.max(2, m.rate)}%;background:${t.color}"></i></div>
      ${m.budgetAllocated > 0 ? `<p class="util">الاستفادة من الميزانية: <b>${utilization}%</b> · مصروف ${m.budgetSpent.toLocaleString("ar-SA")} من ${m.budgetAllocated.toLocaleString("ar-SA")} ر.س</p>` : ""}
      <section class="blk s">
        <h4>نقاط القوة</h4>
        <ul>${m.strengths.map((x) => `<li>${x}</li>`).join("")}</ul>
      </section>
      <section class="blk w">
        <h4>مواطن الضعف</h4>
        <ul>${m.weaknesses.map((x) => `<li>${x}</li>`).join("")}</ul>
      </section>
      <section class="blk r">
        <h4>توصيات لجنة الجودة</h4>
        <ul>${m.recommendations.map((x) => `<li>${x}</li>`).join("")}</ul>
      </section>
      ${qualityNote}
    </article>`;
}

function css(): string {
  return `
    @page { size: A4 portrait; margin: 14mm 12mm 16mm;
      @bottom-center { content: "صفحة " counter(page) " من " counter(pages);
        font-family: 'Tajawal','Amiri','Noto Naskh Arabic',serif; font-size: 9.5pt; color:${SLATE_500}; } }
    @media print { html,body { margin:0; background:#fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    body { font-family: 'Tajawal','Amiri','Noto Naskh Arabic','Segoe UI',sans-serif; color:${SLATE_900}; direction: rtl; }
    .doc { padding: 4px; }
    .hdr { display:flex; align-items:center; gap:14px; padding-bottom:14px; border-bottom: 2px solid ${TEAL}; margin-bottom:16px; }
    .hdr img { width: 78px; height: 78px; object-fit: contain; filter: drop-shadow(0 4px 8px rgba(13,124,102,0.18)); }
    .hdr .accent { width:5px; height:50px; background:${GOLD}; border-radius:3px; }
    .hdr h1 { margin:0; font-size:20px; font-weight:800; line-height:1.4; }
    .hdr .sub { margin:4px 0 0; font-size:11.5px; color:${SLATE_500}; }
    .meta { margin-top:6px; font-size:10.5px; color:${SLATE_700}; }
    .meta b { color:${TEAL_DARK}; }

    .section { margin: 0 0 18px; page-break-inside: avoid; }
    .section-head { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
    .section-head .bar { width:4px; height:18px; background:${GOLD}; border-radius:2px; }
    .section-head h2 { margin:0; font-size:14.5px; font-weight:800; color:${SLATE_900}; }
    .section-head .desc { font-size:10.5px; color:${SLATE_500}; }

    .exec { background: linear-gradient(135deg,#fff 0%, ${SLATE_50} 100%); border:1px solid ${SLATE_200}; border-right:4px solid ${TEAL}; border-radius:12px; padding:14px 16px; }
    .exec p { margin: 0 0 8px; font-size:12px; line-height:1.9; color:${SLATE_900}; }
    .exec p:last-child { margin-bottom: 0; }

    .summary { display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; margin: 0 0 14px; }
    .sum { background:#fff; border:1px solid ${SLATE_200}; border-radius:10px; padding:9px 10px; text-align:center; }
    .sum .l { font-size:10px; color:${SLATE_500}; display:block; }
    .sum .v { font-size:18px; font-weight:800; color:${TEAL_DARK}; display:block; margin-top:2px; }

    .ranking { background:#fff; border:1px solid ${SLATE_200}; border-radius:12px; overflow:hidden; }
    .ranking table { width:100%; border-collapse: collapse; font-size:11px; }
    .ranking th { background:${SLATE_50}; color:${SLATE_700}; font-weight:700; text-align:start; padding:8px 10px; border-bottom:1px solid ${SLATE_200}; }
    .ranking td { padding:8px 10px; border-bottom:1px solid ${SLATE_100}; color:${SLATE_900}; }
    .ranking tr:last-child td { border-bottom:0; }
    .rank-num { display:inline-block; width:22px; height:22px; line-height:22px; text-align:center; border-radius:999px; background:${GOLD}; color:#fff; font-weight:800; font-size:10.5px; }

    .cards { display:grid; grid-template-columns: 1fr; gap:12px; }
    .card { background:#fff; border:1px solid ${SLATE_200}; border-right:4px solid ${TEAL}; border-radius:12px; padding:13px 15px; page-break-inside: avoid; }
    .card-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
    .cname { margin:0; font-size:13.5px; font-weight:800; color:${SLATE_900}; }
    .badge { font-size:10px; font-weight:700; padding:3px 9px; border-radius:999px; border:1px solid; }
    .kpis { display:grid; grid-template-columns: repeat(4, 1fr); gap:6px; margin-bottom:8px; }
    .kpis > div { background:${SLATE_50}; border-radius:8px; padding:6px 8px; }
    .kpis .l { font-size:9.5px; color:${SLATE_500}; display:block; }
    .kpis .v { font-size:13px; font-weight:800; color:${SLATE_900}; display:block; }
    .progress { width:100%; height:6px; background:${SLATE_100}; border-radius:999px; overflow:hidden; margin-bottom:8px; }
    .progress > i { display:block; height:100%; border-radius:999px; }
    .util { margin: 0 0 8px; font-size:10.5px; color:${SLATE_700}; }
    .blk { margin-top:8px; }
    .blk h4 { margin:0 0 4px; font-size:11px; font-weight:800; }
    .blk.s h4 { color:#047857; }
    .blk.w h4 { color:#B91C1C; }
    .blk.r h4 { color:${GOLD}; }
    .blk ul { margin:0; padding-inline-start: 18px; }
    .blk li { font-size:10.8px; color:${SLATE_700}; line-height:1.75; margin-bottom:2px; }
    .blk.note { margin-top:10px; background:#FFF8E6; border:1px solid #F1D98C; border-radius:10px; padding:10px 12px; }
    .blk.note h4 { color:#7A5A00; margin-bottom:6px; font-size:11.5px; }
    .blk.note p { margin:0 0 6px; font-size:10.8px; color:${SLATE_700}; line-height:1.85; }
    .blk.note li { color:${SLATE_900}; }

    .closing { margin-top:14px; background: linear-gradient(135deg, ${TEAL} 0%, ${TEAL_DARK} 100%); color:#fff; border-radius:12px; padding:14px 16px; }
    .closing .lbl { font-size:10px; opacity:.85; letter-spacing:.5px; font-weight:700; }
    .closing .msg { margin-top:4px; font-size:12.5px; line-height:1.85; }

    .legacy { margin-top:14px; background: linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%); border:1.5px solid ${GOLD}; border-right:5px solid ${GOLD}; border-radius:12px; padding:14px 18px; page-break-inside: avoid; }
    .legacy .lbl { font-size:10.5px; font-weight:800; color:#7A5A00; letter-spacing:.5px; }
    .legacy .msg { margin-top:6px; font-size:12.5px; line-height:2; color:${SLATE_900}; font-weight:500; }

    .sign { margin-top: 22px; display:flex; justify-content: space-between; gap:20px; font-size:11px; color:${SLATE_700}; }
    .sign .box { flex:1; border-top:1.5px solid ${SLATE_200}; padding-top:6px; text-align:center; }
    .sign .box b { color:${SLATE_900}; }

    .countdown { display:flex; align-items:center; gap:12px; background: linear-gradient(135deg, #FFF8E6 0%, #FDE9B0 100%); border:1px solid ${GOLD}; border-right:5px solid ${GOLD}; border-radius:12px; padding:10px 14px; margin: 0 0 16px; }
    .countdown .cd-lbl { font-size:10.5px; font-weight:700; color:#7A5A00; letter-spacing:.3px; }
    .countdown .cd-val { font-size:16px; font-weight:800; color:${TEAL_DARK}; }
    .countdown .cd-note { margin-inline-start:auto; font-size:10.5px; color:${SLATE_700}; }
    .chip { display:inline-block; font-size:10px; padding:2px 8px; border-radius:999px; background:${SLATE_100}; color:${SLATE_700}; border:1px solid ${SLATE_200}; margin: 1px 0; }
  `;
}

export async function exportQualityCommitteesReport(opts: { authorName?: string } = {}): Promise<void> {
  const html = await buildQualityCommitteesReportHtml(opts);
  await printHtmlDocument(html, "تقرير الجودة المختصر - المهام المنجزة وغير المنجزة");
}

export async function buildQualityCommitteesReportHtml(opts: { authorName?: string } = {}): Promise<string> {
  const all = await gather();
  const today = fmtArDate(new Date());
  const now = new Date(); now.setHours(0, 0, 0, 0);

  const { data: allTasksRaw } = await supabase
    .from("committee_tasks")
    .select("id, committee_id, title, status, due_date")
    .order("committee_id", { ascending: true });
  const allTasks = (allTasksRaw ?? []) as Array<{ id: string; committee_id: string; title: string; status: string; due_date: string | null }>;

  const sorted = [...all].sort((a, b) => a.name.localeCompare(b.name, "ar"));

  // إزالة اللواحق بين قوسين مثل (التنفيذ)، (المراقبة)، (التخطيط)، (طلب عريس)
  const cleanTitle = (t: string) =>
    t.replace(/\s*[\(（][^()）]{1,40}[\)）]\s*/g, " ").replace(/\s+/g, " ").trim();

  let grandDone = 0, grandPending = 0;
  const allRows: string[] = [];

  sorted.forEach((c) => {
    const items = allTasks.filter((t) => t.committee_id === c.id);
    const done = items.filter((t) => t.status === "completed").length;
    const pending = items.length - done;
    grandDone += done;
    grandPending += pending;

    // رأس اللجنة
    allRows.push(
      `<tr class="grp"><td colspan="4">
        <span class="grp-name">${c.name}</span>
        <span class="grp-stat"><span class="dot ok"></span>${done} منجزة · <span class="dot no"></span>${pending} غير منجزة</span>
      </td></tr>`
    );

    if (items.length === 0) {
      allRows.push(`<tr><td colspan="4" class="empty-row">لا توجد مهام مسجّلة لهذه اللجنة.</td></tr>`);
      return;
    }

    items.forEach((t, i) => {
      const isDone = t.status === "completed";
      const dueDate = t.due_date ? new Date(t.due_date) : null;
      const isOverdue = !isDone && !!dueDate && dueDate < now;
      const cleanedTitle = cleanTitle(t.title);
      const isReady = /على\s*أتم\s*ال?ا?ستعداد/.test(cleanedTitle);
      const displayTitle = cleanedTitle.replace(/\s*على\s*أتم\s*ال?ا?ستعداد\s*$/, "").trim();
      const badge = isReady
        ? `<span class="pill ready">على أتم الاستعداد</span>`
        : isDone
          ? `<span class="pill ok">منجزة</span>`
          : isOverdue
            ? `<span class="pill no">متأخّرة</span>`
            : `<span class="pill no">لم تُنجَز</span>`;
      const dueText = dueDate ? dueDate.toLocaleDateString("ar-SA-u-ca-islamic-umalqura") : "—";
      allRows.push(
        `<tr class="row ${isReady ? "is-ready" : isDone ? "is-ok" : "is-no"}">
          <td class="idx">${i + 1}</td>
          <td class="title">${displayTitle}</td>
          <td class="due">${dueText}</td>
          <td class="st">${badge}</td>
        </tr>`
      );
    });
  });

  const overallRate = (grandDone + grandPending) === 0
    ? 0 : Math.round((grandDone / (grandDone + grandPending)) * 100);
  const author = opts.authorName ? opts.authorName : "رئيس لجنة الجودة";

  const html = `
    <div class="doc">
      <header class="hdr">
        <img src="${BRAND_LOGO_DATA_URI}" alt="" />
        <div class="accent"></div>
        <div style="flex:1">
          <h1>تقرير الجودة · حالة مهام اللجان</h1>
          <p class="meta">تاريخ الإصدار: <b>${today}</b> · اللجان: <b>${all.length}</b> · نسبة الإنجاز: <b>${overallRate}%</b></p>
        </div>
      </header>

      <div class="kpi-row">
        <div class="kpi"><span class="kpi-l">المهام المنجزة</span><span class="kpi-v ok">${grandDone}</span></div>
        <div class="kpi"><span class="kpi-l">المهام غير المنجزة</span><span class="kpi-v no">${grandPending}</span></div>
        <div class="kpi"><span class="kpi-l">نسبة الإنجاز</span><span class="kpi-v">${overallRate}%</span></div>
        <div class="kpi"><span class="kpi-l">عدد اللجان</span><span class="kpi-v">${all.length}</span></div>
      </div>

      <table class="qtbl">
        <thead>
          <tr>
            <th style="width:6%">#</th>
            <th style="width:60%">المهمة</th>
            <th style="width:18%">تاريخ الاستحقاق</th>
            <th style="width:16%">الحالة</th>
          </tr>
        </thead>
        <tbody>${allRows.join("")}</tbody>
      </table>

      <p class="legend">
        <span class="pill ok">منجزة</span> أُنجزت في وقتها ·
        <span class="pill ready">على أتم الاستعداد</span> جاهزة للتنفيذ يوم الحفل ·
        <span class="pill no">متأخّرة / لم تُنجَز</span> تستوجب المعالجة الفورية.
      </p>

      <div class="sign">
        <div class="box"><b>${author}</b><br/>رئيس لجنة الجودة</div>
        <div class="box"><b>التوقيع</b><br/>……………………………</div>
        <div class="box"><b>الاعتماد</b><br/>اللجنة العليا</div>
      </div>
    </div>
    <style>${css()}
      .kpi-row { display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; margin: 0 0 14px; }
      .kpi { background:#fff; border:1px solid ${SLATE_200}; border-radius:10px; padding:10px 12px; display:flex; flex-direction:column; gap:2px; }
      .kpi-l { font-size:10.5px; color:${SLATE_500}; }
      .kpi-v { font-size:18px; font-weight:800; color:${SLATE_900}; }
      .kpi-v.ok { color:#047857; }
      .kpi-v.no { color:#B91C1C; }

      .qtbl { width:100%; border-collapse: separate; border-spacing:0; background:#fff; border:1px solid ${SLATE_200}; border-radius:12px; overflow:hidden; font-size:11.5px; }
      .qtbl thead th { background: linear-gradient(180deg, ${TEAL} 0%, ${TEAL_DARK} 100%); color:#fff; font-weight:700; padding:9px 10px; text-align:start; font-size:11px; letter-spacing:.2px; }
      .qtbl tbody td { padding:8px 10px; border-bottom:1px solid ${SLATE_100}; color:${SLATE_900}; vertical-align: middle; }
      .qtbl tr:last-child td { border-bottom:0; }
      .qtbl tr.grp td { background: linear-gradient(90deg, #FFF8E6 0%, #FFFDF5 100%); border-top:2px solid ${GOLD}; padding:8px 12px; }
      .qtbl tr.grp .grp-name { font-weight:800; color:${TEAL_DARK}; font-size:12.5px; }
      .qtbl tr.grp .grp-stat { margin-inline-start:14px; font-size:10.5px; color:${SLATE_700}; }
      .qtbl .dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin: 0 3px 0 6px; vertical-align: baseline; }
      .qtbl .dot.ok { background:#10B981; }
      .qtbl .dot.no { background:#EF4444; }
      .qtbl .idx { color:${SLATE_500}; font-weight:700; text-align:center; width:6%; }
      .qtbl .title { font-weight:600; line-height:1.7; }
      .qtbl .due { color:${SLATE_700}; font-size:10.5px; white-space:nowrap; }
      .qtbl .st { text-align:center; }
      .qtbl .row.is-ok { background:#F6FFFB; }
      .qtbl .row.is-no { background:#FFF7F7; }
      .qtbl .row.is-ready { background:#FFF7EC; }
      .qtbl .empty-row { text-align:center; color:${SLATE_500}; font-style:italic; padding:12px; }

      .pill { display:inline-block; font-size:10.5px; font-weight:800; padding:3px 10px; border-radius:999px; border:1px solid; white-space:nowrap; }
      .pill.ok { background:#D1FAE5; color:#047857; border-color:#A7F3D0; }
      .pill.no { background:#FEE2E2; color:#B91C1C; border-color:#FECACA; }
      .pill.ready { background:#FFEDD5; color:#C2410C; border-color:#FED7AA; }

      .legend { margin:10px 2px 0; font-size:10.5px; color:${SLATE_700}; }
      .legend .pill { margin-inline-end:4px; }
    </style>
  `;

  return html;
}
