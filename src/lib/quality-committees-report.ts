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

    .sign { margin-top: 22px; display:flex; justify-content: space-between; gap:20px; font-size:11px; color:${SLATE_700}; }
    .sign .box { flex:1; border-top:1.5px solid ${SLATE_200}; padding-top:6px; text-align:center; }
    .sign .box b { color:${SLATE_900}; }
  `;
}

export async function exportQualityCommitteesReport(opts: { authorName?: string } = {}): Promise<void> {
  const all = await gather();
  const sorted = [...all].sort((a, b) => (b.rate - b.overdue * 5) - (a.rate - a.overdue * 5));
  const today = fmtArDate(new Date());

  // ---- المهام العاجلة خلال الأيام الأربعة قبل الحفل ----
  const now = new Date(); now.setHours(0,0,0,0);
  const horizon = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
  const committeeNameById = new Map(all.map((c) => [c.id, c.name] as const));
  const { data: upRaw } = await supabase
    .from("committee_tasks")
    .select("id, committee_id, title, status, due_date")
    .neq("status", "completed");
  const upcoming = ((upRaw ?? []) as Array<{ id: string; committee_id: string; title: string; status: string; due_date: string | null }>)
    .filter((t) => {
      if (!t.due_date) return false;
      const d = new Date(t.due_date);
      return d <= horizon; // includes already-overdue items
    })
    .sort((a, b) => new Date(a.due_date as string).getTime() - new Date(b.due_date as string).getTime());

  const fmtDay = (s: string) => {
    try {
      return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { day: "numeric", month: "long" }).format(new Date(s));
    } catch { return s; }
  };

  const upcomingRows = upcoming.length === 0
    ? `<tr><td colspan="4" style="text-align:center;color:${SLATE_500};padding:14px">لا توجد مهام مجدولة خلال الأيام الأربعة القادمة.</td></tr>`
    : upcoming.map((t) => {
        const dueDate = new Date(t.due_date as string);
        const isOverdue = dueDate < now;
        const label = isOverdue ? "متأخرة" : "عاجلة";
        const color = isOverdue ? "#B91C1C" : "#B45309";
        return `<tr>
          <td><b>${t.title}</b></td>
          <td>${committeeNameById.get(t.committee_id) ?? "—"}</td>
          <td>${fmtDay(t.due_date as string)}</td>
          <td><span class="badge" style="background:#FEF3C7;color:${color};border-color:#FDE68A">${label}</span></td>
        </tr>`;
      }).join("");

  // ---- المهام المشتركة بين أكثر من لجنة ----
  const sharedTasks: Array<{ title: string; lead: string; partners: string[]; note: string }> = [
    {
      title: "التغطية الإعلامية والتوثيق المرئي للحفل",
      lead: "لجنة الإعلام",
      partners: ["اللجنة العليا", "لجنة الاستقبال", "لجنة الجودة"],
      note: "تتطلب تنسيقاً مسبقاً لخطة التصوير ومواقع الكاميرات وقائمة اللحظات الواجب توثيقها، وتسليم المادة الخام للجنة الجودة للأرشفة.",
    },
    {
      title: "استقبال الضيوف وكبار الشخصيات",
      lead: "لجنة الاستقبال",
      partners: ["اللجنة العليا", "لجنة الإعلام", "لجنة التشريفات"],
      note: "تكامل ضروري بين قائمة المدعوين الرسميين، وخطة الجلوس، وتغطية الوصول إعلامياً.",
    },
    {
      title: "إدارة الوقت والبرنامج التفصيلي للحفل",
      lead: "اللجنة العليا",
      partners: ["لجنة الإعلام", "لجنة الإعاشة", "لجنة العرسان"],
      note: "اعتماد جدول زمني موحّد (Run-of-Show) يلتزم به الجميع، وتوزيعه قبل 48 ساعة من موعد الحفل.",
    },
    {
      title: "ترتيب دخول العرسان وتسلسل التكريم",
      lead: "لجنة العرسان",
      partners: ["اللجنة العليا", "لجنة الإعلام", "لجنة التشريفات"],
      note: "بروفة ميدانية مشتركة لضمان انسيابية الدخول والتقاط اللحظات التذكارية بجودة عالية.",
    },
    {
      title: "الإعاشة وتوزيع الوجبات",
      lead: "لجنة الإعاشة",
      partners: ["لجنة الاستقبال", "اللجنة المالية"],
      note: "تأكيد الأعداد النهائية، واعتماد الصرف المالي، وتنسيق توقيت التقديم مع برنامج الحفل.",
    },
    {
      title: "اعتماد الصرف العاجل للمتطلبات اللحظية",
      lead: "اللجنة المالية",
      partners: ["جميع اللجان"],
      note: "تفعيل مسار صرف سريع خلال الأيام الأربعة الأخيرة بصلاحية رئيس اللجنة المالية لضمان عدم تعطّل أي لجنة.",
    },
  ];

  const sharedRows = sharedTasks.map((s) => `
    <tr>
      <td><b>${s.title}</b></td>
      <td><span class="badge" style="background:${tierMeta("leader").bg};color:${tierMeta("leader").fg};border-color:${tierMeta("leader").border}">${s.lead}</span></td>
      <td>${s.partners.map((p) => `<span class="chip">${p}</span>`).join(" ")}</td>
      <td style="color:${SLATE_700};font-size:10.5px;line-height:1.7">${s.note}</td>
    </tr>
  `).join("");

  const leaders = sorted.filter((c) => c.tier === "leader");
  const actives = sorted.filter((c) => c.tier === "active");
  const stables = sorted.filter((c) => c.tier === "stable");
  const needs   = sorted.filter((c) => c.tier === "needs");

  const totalTasks = all.reduce((a, c) => a + c.total, 0);
  const totalDone = all.reduce((a, c) => a + c.done, 0);
  const totalOverdue = all.reduce((a, c) => a + c.overdue, 0);
  const overallRate = totalTasks === 0 ? 0 : Math.round((totalDone / totalTasks) * 100);

  const execLines = [
    `يرصد هذا التقرير قراءةً شاملةً لأداء ${pluralLajna(all.length)} تعمل ضمن منظومة الزواج الجماعي خلال الدورة الحالية، ويُقدّم تشخيصاً مهنياً يستند إلى مؤشرات فعلية مستخرجة من المنصة.`,
    `يأتي هذا التقرير قبل <b>أربعة أيام فقط</b> من موعد الحفل، مما يستوجب تركيزاً مضاعفاً على المهام العاجلة والمهام المشتركة بين أكثر من لجنة لضمان جاهزية تامة يوم التنفيذ.`,
    `بلغت نسبة الإنجاز الكلية <b>${overallRate}%</b> بإجمالي <b>${totalDone}</b> مهمة منجزة من أصل <b>${totalTasks}</b>، مع تسجيل <b>${totalOverdue}</b> مهمة خارج الجدول الزمني تستوجب المعالجة.`,
    leaders.length > 0
      ? `تبرز <b>${pluralLajna(leaders.length)}</b> ضمن مستوى الريادة بأداءٍ يتجاوز المستهدفات المعتمدة، فيما تواصل <b>${pluralLajna(actives.length)}</b> عملها بفاعلية ضمن النطاق المقبول.`
      : `لم تبلغ أي لجنة مستوى الريادة بعد، ما يستدعي توحيد الجهد ورفع وتيرة التنفيذ في الأسابيع القادمة.`,
    needs.length > 0
      ? `تستدعي <b>${pluralLajna(needs.length)}</b> دعماً مؤسسياً مركّزاً لإعادة المسار إلى مستويات الأداء المعتمدة، وقد أُدرجت توصيات محددة لكل لجنة في القسم التفصيلي.`
      : `لا توجد لجان تحت دائرة الخطر، وهو مؤشر إيجابي على تكامل المنظومة وانضباط التنفيذ.`,
  ];

  const rankingRows = sorted.map((c, i) => {
    const t = tierMeta(c.tier);
    return `<tr>
      <td><span class="rank-num">${i + 1}</span></td>
      <td><b>${c.name}</b></td>
      <td>${c.rate}%</td>
      <td>${c.done}/${c.total}</td>
      <td style="color:${c.overdue > 0 ? "#B91C1C" : SLATE_700}">${c.overdue}</td>
      <td>${c.evalAvg !== null ? c.evalAvg.toFixed(1) + "/5" : "—"}</td>
      <td><span class="badge" style="background:${t.bg};color:${t.fg};border-color:${t.border}">${t.label}</span></td>
    </tr>`;
  }).join("");

  const author = opts.authorName ? opts.authorName : "رئيس لجنة الجودة";

  const html = `
    <div class="doc">
      <header class="hdr">
        <img src="${BRAND_LOGO_DATA_URI}" alt="" />
        <div class="accent"></div>
        <div style="flex:1">
          <h1>التقرير التفصيلي لأداء لجان الزواج الجماعي</h1>
          <p class="sub">إعداد لجنة الجودة · رؤية مؤسسية لقياس نقاط القوة وفرص التطوير</p>
          <p class="meta">تاريخ الإصدار: <b>${today}</b> · الجهة المُصدِرة: <b>لجنة الجودة</b> · عدد اللجان المشمولة: <b>${all.length}</b></p>
        </div>
      </header>

      <section class="section">
        <div class="section-head"><span class="bar"></span><h2>الموجز التنفيذي</h2><span class="desc">قراءة مؤسسية لمسار الأداء العام</span></div>
        <div class="exec">
          ${execLines.map((p) => `<p>${p}</p>`).join("")}
        </div>
      </section>

      <section class="section">
        <div class="section-head"><span class="bar"></span><h2>المؤشرات الكلية</h2></div>
        <div class="summary">
          <div class="sum"><span class="l">نسبة الإنجاز</span><span class="v">${overallRate}%</span></div>
          <div class="sum"><span class="l">مهام منجزة</span><span class="v">${totalDone}</span></div>
          <div class="sum"><span class="l">مهام متأخرة</span><span class="v" style="color:${totalOverdue > 0 ? "#B91C1C" : TEAL_DARK}">${totalOverdue}</span></div>
          <div class="sum"><span class="l">لجان قائدة</span><span class="v">${leaders.length}</span></div>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><span class="bar"></span><h2>الترتيب المؤسسي للجان</h2><span class="desc">من الأعلى أداءً إلى الأحوج للتطوير</span></div>
        <div class="ranking">
          <table>
            <thead><tr><th>#</th><th>اللجنة</th><th>الإنجاز</th><th>المنفّذ</th><th>المتأخّرة</th><th>تقييم الجودة</th><th>التصنيف</th></tr></thead>
            <tbody>${rankingRows}</tbody>
          </table>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><span class="bar"></span><h2>التشخيص التفصيلي لكل لجنة</h2><span class="desc">القوة · الضعف · التوصيات</span></div>
        <div class="cards">${sorted.map(cardHtml).join("")}</div>
      </section>

      <div class="closing">
        <div class="lbl">خاتمة لجنة الجودة</div>
        <div class="msg">
          نُثمّن الجهد المُخلِص الذي تبذله جميع اللجان، ونؤكد أن هذا التشخيص جاء بأسلوبٍ مؤسسيٍّ يَصدُر عن الحرص لا التَّنقُّص، وغايتُه تعزيزُ ما تحقّق، ودعمُ ما يحتاج إلى تقويةٍ، لنرتقي معاً بمسيرة الزواج الجماعي إلى مستوى التميّز الذي يَليق بقبيلتنا الكريمة.
        </div>
      </div>

      <div class="sign">
        <div class="box"><b>${author}</b><br/>رئيس لجنة الجودة</div>
        <div class="box"><b>التوقيع</b><br/>……………………………</div>
        <div class="box"><b>الاعتماد</b><br/>اللجنة العليا</div>
      </div>
    </div>
    <style>${css()}</style>
  `;

  await printHtmlDocument(html, "التقرير التفصيلي لأداء اللجان - لجنة الجودة");
}