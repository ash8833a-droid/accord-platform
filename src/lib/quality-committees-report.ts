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
  await printHtmlDocument(html, "التقرير التفصيلي لأداء اللجان - لجنة الجودة");
}

export async function buildQualityCommitteesReportHtml(opts: { authorName?: string } = {}): Promise<string> {
  const all = await gather();
  const sorted = [...all].sort((a, b) => (b.rate - b.overdue * 5) - (a.rate - a.overdue * 5));
  const today = fmtArDate(new Date());

  // ---- تفاعل الأعضاء مع المنصة ----
  const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [{ data: rolesRaw }, { data: logsRaw }, { data: respRaw }, { data: tcomRaw }, { data: pcomRaw }, { data: profsRaw }, { data: actLogRaw }, { data: postsRaw }, { data: payRaw }, { data: subsRaw }, { data: famRaw }, { data: groomsRaw }, { data: paidPayRaw }] = await Promise.all([
    supabase.from("user_roles").select("user_id, committee_id").not("committee_id", "is", null),
    supabase.from("user_activity_log").select("user_id, event_type, created_at").eq("event_type", "login"),
    supabase.from("task_responses").select("user_id, created_at"),
    supabase.from("task_comments").select("user_id, created_at"),
    supabase.from("committee_post_comments").select("user_id, created_at"),
    supabase.from("profiles").select("user_id, full_name"),
    supabase.from("task_activity_log").select("actor_user_id, committee_id, created_at").not("actor_user_id", "is", null),
    supabase.from("committee_posts").select("author_id, created_at"),
    supabase.from("payment_requests").select("requested_by, created_at"),
    supabase.from("subscriptions").select("amount, status"),
    supabase.from("family_contributions").select("amount"),
    supabase.from("grooms").select("groom_contribution, contribution_paid"),
    supabase.from("payment_requests").select("amount, status, committee_id"),
  ]);
  const roles = (rolesRaw ?? []) as Array<{ user_id: string; committee_id: string }>;
  const logs = (logsRaw ?? []) as Array<{ user_id: string; created_at: string }>;
  const responses = (respRaw ?? []) as Array<{ user_id: string | null; created_at: string }>;
  const tcom = (tcomRaw ?? []) as Array<{ user_id: string; created_at: string }>;
  const pcom = (pcomRaw ?? []) as Array<{ user_id: string; created_at: string }>;
  const actLog = (actLogRaw ?? []) as Array<{ actor_user_id: string; committee_id: string | null; created_at: string }>;
  const posts = (postsRaw ?? []) as Array<{ author_id: string | null; created_at: string }>;
  const pays = (payRaw ?? []) as Array<{ requested_by: string | null; created_at: string }>;
  const profMap = new Map<string, string>();
  for (const p of (profsRaw ?? []) as Array<{ user_id: string; full_name: string }>) profMap.set(p.user_id, p.full_name);

  type UserAgg = { logins: number; lastLogin: Date | null; interactions: number; lastInteraction: Date | null };
  const userAgg = new Map<string, UserAgg>();
  const touch = (id: string) => {
    let a = userAgg.get(id);
    if (!a) { a = { logins: 0, lastLogin: null, interactions: 0, lastInteraction: null }; userAgg.set(id, a); }
    return a;
  };
  for (const l of logs) {
    const a = touch(l.user_id); a.logins += 1;
    const d = new Date(l.created_at);
    if (!a.lastLogin || d > a.lastLogin) a.lastLogin = d;
  }
  const addInter = (uid: string | null, when: string) => {
    if (!uid) return;
    const a = touch(uid); a.interactions += 1;
    const d = new Date(when);
    if (!a.lastInteraction || d > a.lastInteraction) a.lastInteraction = d;
  };
  for (const r of responses) addInter(r.user_id, r.created_at);
  for (const c of tcom) addInter(c.user_id, c.created_at);
  for (const c of pcom) addInter(c.user_id, c.created_at);
  for (const a of actLog) addInter(a.actor_user_id, a.created_at);
  for (const p of posts) addInter(p.author_id, p.created_at);
  for (const p of pays) addInter(p.requested_by, p.created_at);

  const engByCommittee = new Map<string, EngagementMetrics>();
  // group users by committee (excluding admin head row when only role-only entries)
  const membersByCom = new Map<string, Set<string>>();
  for (const r of roles) {
    if (!membersByCom.has(r.committee_id)) membersByCom.set(r.committee_id, new Set());
    membersByCom.get(r.committee_id)!.add(r.user_id);
  }
  for (const c of all) {
    const memberIds = Array.from(membersByCom.get(c.id) ?? []);
    const members = memberIds.length;
    let activeMembers = 0;
    let totalLogins = 0;
    let totalInteractions = 0;
    let lastActivity: Date | null = null;
    const enriched = memberIds.map((uid) => {
      const a = userAgg.get(uid);
      const lastLogin = a?.lastLogin ?? null;
      const logins = a?.logins ?? 0;
      const interactions = a?.interactions ?? 0;
      totalLogins += logins;
      totalInteractions += interactions;
      // العضو نشط إذا له أي نشاط (دخول أو تفاعل) خلال 30 يوم
      const lastInter = a?.lastInteraction ?? null;
      const lastAny = [lastLogin, lastInter].filter(Boolean).sort((x, y) => (y as Date).getTime() - (x as Date).getTime())[0] as Date | undefined;
      if (lastAny && lastAny >= thirtyAgo) activeMembers += 1;
      const cand = [lastLogin, a?.lastInteraction ?? null].filter(Boolean) as Date[];
      for (const d of cand) if (!lastActivity || d > lastActivity) lastActivity = d;
      return { uid, name: profMap.get(uid) ?? "عضو", lastLogin, logins, interactions };
    });
    const engagementRate = members === 0 ? 0 : Math.round((activeMembers / members) * 100);
    const topMembers = enriched
      .slice()
      .sort((a, b) => (b.logins + b.interactions * 2) - (a.logins + a.interactions * 2))
      .slice(0, 5)
      .map((m) => ({ name: m.name, lastLogin: m.lastLogin, logins: m.logins, interactions: m.interactions }));
    const inactiveMembers = enriched
      .filter((m) => !m.lastLogin || m.lastLogin < thirtyAgo)
      .map((m) => m.name);
    engByCommittee.set(c.id, {
      committeeId: c.id, members, activeMembers, totalLogins, totalInteractions,
      lastActivity, engagementRate, topMembers, inactiveMembers,
    });
  }

  const engRows = sorted.map((c) => {
    const e = engByCommittee.get(c.id);
    if (!e) return "";
    const color = e.engagementRate >= 70 ? "#047857" : e.engagementRate >= 40 ? "#B45309" : "#B91C1C";
    return `<tr>
      <td><b>${c.name}</b></td>
      <td>${e.members}</td>
      <td><span style="color:${color};font-weight:700">${e.activeMembers}</span> <span style="color:${SLATE_500};font-size:10px">(${e.engagementRate}%)</span></td>
      <td>${e.totalLogins}</td>
      <td>${e.totalInteractions}</td>
      <td style="color:${SLATE_700};font-size:10.5px">${fmtRelative(e.lastActivity)}</td>
    </tr>`;
  }).join("");

  const totalMembers = Array.from(engByCommittee.values()).reduce((a, e) => a + e.members, 0);
  const totalActive = Array.from(engByCommittee.values()).reduce((a, e) => a + e.activeMembers, 0);
  const totalAllLogins = Array.from(engByCommittee.values()).reduce((a, e) => a + e.totalLogins, 0);
  const overallEngagement = totalMembers === 0 ? 0 : Math.round((totalActive / totalMembers) * 100);


  // ---- حصر الإيرادات والمصروفات ----
  const subs = (subsRaw ?? []) as Array<{ amount: number | null; status: string | null }>;
  const fams = (famRaw ?? []) as Array<{ amount: number | null }>;
  const grooms = (groomsRaw ?? []) as Array<{ groom_contribution: number | null; contribution_paid: boolean | null }>;
  const paidPays = (paidPayRaw ?? []) as Array<{ amount: number | null; status: string | null; committee_id: string }>;
  const revSubs = subs.filter((s) => s.status === "paid" || s.status === "confirmed").reduce((a, s) => a + Number(s.amount ?? 0), 0);
  const revFam = fams.reduce((a, f) => a + Number(f.amount ?? 0), 0);
  const revGrooms = grooms.filter((g) => g.contribution_paid).reduce((a, g) => a + Number(g.groom_contribution ?? 0), 0);
  const totalRevenue = revSubs + revFam + revGrooms;
  const totalBudgetAlloc = all.reduce((a, c) => a + c.budgetAllocated, 0);
  const totalBudgetSpent = all.reduce((a, c) => a + c.budgetSpent, 0);
  const paidExpenses = paidPays.filter((p) => p.status === "paid").reduce((a, p) => a + Number(p.amount ?? 0), 0);
  const pendingExpenses = paidPays.filter((p) => p.status === "pending").reduce((a, p) => a + Number(p.amount ?? 0), 0);
  const balance = totalRevenue - Math.max(totalBudgetSpent, paidExpenses);
  const arNum = (n: number) => new Intl.NumberFormat("ar-SA").format(Math.round(n));

  // ---- مصفوفة شاملة لجميع المهام (مكتمل / غير مكتمل) لكل اللجان ----
  const now = new Date(); now.setHours(0,0,0,0);


  // ---- مصفوفة شاملة لجميع المهام (مكتمل / غير مكتمل) لكل اللجان ----
  const { data: allTasksRaw } = await supabase
    .from("committee_tasks")
    .select("id, committee_id, title, status, due_date")
    .order("committee_id", { ascending: true });
  const allTasks = (allTasksRaw ?? []) as Array<{ id: string; committee_id: string; title: string; status: string; due_date: string | null }>;
  const CHECK = `<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#D1FAE5;color:#047857;font-weight:900;font-size:13px">✓</span>`;
  const CROSS = `<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#FEE2E2;color:#B91C1C;font-weight:900;font-size:13px">✗</span>`;
  const DASH = `<span style="color:${SLATE_500}">—</span>`;
  const READY = `<span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;background:#FEF3C7;color:#92400E;font-weight:700;font-size:10px;border:1px solid #FDE68A;white-space:nowrap">على أتمّ الاستعداد</span>`;
  const allTasksRows = all.map((c) => {
    const items = allTasks.filter((t) => t.committee_id === c.id);
    if (items.length === 0) {
      return `<tr><td colspan="3" style="background:#F8FAFC;color:${SLATE_700};font-weight:700">${c.name}</td></tr>
              <tr><td colspan="3" style="text-align:center;color:${SLATE_500};padding:10px">لا توجد مهام مسجّلة لهذه اللجنة</td></tr>`;
    }
    const header = `<tr><td colspan="3" style="background:#F8FAFC;color:${SLATE_700};font-weight:700">${c.name} <span style="color:${SLATE_500};font-weight:500;font-size:10.5px">(${items.filter(i => i.status === "completed").length}/${items.length})</span></td></tr>`;
    const rows = items.map((t) => {
      const isDone = t.status === "completed";
      const dueDate = t.due_date ? new Date(t.due_date) : null;
      const isTrulyOverdue = !isDone && !!dueDate && dueDate < now;
      // مهام يوم الحفل أو المهام التي لم يحن موعدها بعد → تُعتبر جاهزة وليست متأخرة
      const isReady = !isDone && !isTrulyOverdue;
      return `<tr>
        <td>${t.title}</td>
        <td style="text-align:center">${isDone ? CHECK : DASH}</td>
        <td style="text-align:center">${isDone ? DASH : isTrulyOverdue ? CROSS : READY}</td>
      </tr>`;
    }).join("");
    return header + rows;
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
    `على صعيد التفاعل الرقمي مع المنصة، بلغ مجموع الأعضاء <b>${totalMembers}</b> عضواً، منهم <b>${totalActive}</b> فقط نشطون خلال آخر 30 يوماً بنسبة تفاعل عامة <b>${overallEngagement}%</b> وإجمالي <b>${totalAllLogins}</b> مرة دخول؛ ${overallEngagement >= 60 ? "وهو مؤشر إيجابي يعكس انغماس اللجان في العمل المؤسسي اليومي." : "وهي نسبة دون المستهدف تستدعي حثّ بقية الأعضاء على الحضور الرقمي وتسجيل أعمالهم في المنصة لضمان شفافية القياس وحفظ الجهود."}`,
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

      <div class="countdown">
        <span class="cd-lbl">العدّ التنازلي للحفل</span>
        <span class="cd-val">٤ أيام فقط</span>
        <span class="cd-note">جاهزية تامة · تنسيق متكامل بين اللجان · صفر تأخير</span>
      </div>

      <section class="section">
        <div class="section-head"><span class="bar"></span><h2>الموجز التنفيذي</h2><span class="desc">قراءة مؤسسية لمسار الأداء العام</span></div>
        <div class="exec">
          ${execLines.map((p) => `<p>${p}</p>`).join("")}
        </div>
      </section>



      <section class="section">
        <div class="section-head"><span class="bar"></span><h2>مصفوفة المهام لجميع اللجان</h2><span class="desc">عرضٌ تفصيليٌّ لكل مهمة مع حالة الإنجاز (مكتملة / غير مكتملة)</span></div>
        <div class="ranking">
          <table>
            <thead><tr><th style="width:58%">المهمة</th><th style="width:17%;text-align:center">المكتملة</th><th style="width:25%;text-align:center">الحالة</th></tr></thead>
            <tbody>${allTasksRows}</tbody>
          </table>
        </div>
        <p style="margin:8px 2px 0;font-size:10px;color:${SLATE_500};line-height:1.7">
          ملاحظة: المهام المقرّر تنفيذها يوم الحفل أو التي لم يحن موعد استحقاقها بعد تُصنَّف <b>«على أتمّ الاستعداد»</b> ولا تُحتسب ضمن المتأخّرة، إذ تُحتسب المتأخّرة فقط للمهام التي تجاوز تاريخ استحقاقها ولم تكتمل.
        </p>
      </section>

      <section class="section">
        <div class="section-head"><span class="bar"></span><h2>إدارة التوثيق والمحتوى المرئي</h2><span class="desc">حفظ الإرث الإعلامي للحفل في المنصة</span></div>
        <div class="exec">
          <p>تُعدّ مسألة <b>التوثيق</b> ركيزةً مؤسسيةً لا يجوز التهاون فيها، وتستوجب تعيين <b>مسؤول مباشر لإدارة فريق التوثيق</b> ضمن لجنة الإعلام، تُسند إليه المهام التالية بصلاحيةٍ واضحة:</p>
          <ul style="margin:4px 0 0;padding-inline-start:20px;font-size:11.5px;color:${SLATE_700};line-height:1.95">
            <li>قيادة فريق التصوير والمونتاج خلال الحفل وما قبله وما بعده.</li>
            <li>الاحتفاظ بالمواد الخام (Raw Footage) وحفظها بنسخٍ احتياطيةٍ متعددة.</li>
            <li>إدارة دورة المونتاج والإخراج النهائي وفق هويةٍ بصريةٍ موحّدة.</li>
            <li>رفع جميع المخرجات النهائية والمواد الخام إلى المنصة وأرشفتها ضمن أرشيف الحفل الثاني عشر.</li>
            <li>تسليم نسخةٍ من الأرشيف للجنة الجودة لاعتمادها مرجعاً للأجيال القادمة.</li>
          </ul>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><span class="bar"></span><h2>حصر الإيرادات والمصروفات</h2><span class="desc">قراءة مالية مؤسسية للدورة الحالية</span></div>
        <div class="summary">
          <div class="sum"><span class="l">إجمالي الإيرادات (ر.س)</span><span class="v" style="color:#047857">${arNum(totalRevenue)}</span></div>
          <div class="sum"><span class="l">إجمالي المصروفات (ر.س)</span><span class="v" style="color:#B45309">${arNum(Math.max(totalBudgetSpent, paidExpenses))}</span></div>
          <div class="sum"><span class="l">المتبقّي (ر.س)</span><span class="v" style="color:${balance >= 0 ? TEAL_DARK : "#B91C1C"}">${arNum(balance)}</span></div>
          <div class="sum"><span class="l">طلبات بانتظار الصرف</span><span class="v">${arNum(pendingExpenses)}</span></div>
        </div>
        <div class="ranking" style="margin-top:10px">
          <table>
            <thead><tr><th>البند</th><th>المصدر</th><th>القيمة (ر.س)</th></tr></thead>
            <tbody>
              <tr><td><b>اشتراكات الأعضاء</b></td><td>سجل الاشتراكات المعتمدة</td><td>${arNum(revSubs)}</td></tr>
              <tr><td><b>مساهمات الأسرة</b></td><td>تبرعات أبناء العائلة</td><td>${arNum(revFam)}</td></tr>
              <tr><td><b>مساهمات العرسان</b></td><td>المسدّد فعلياً من العرسان</td><td>${arNum(revGrooms)}</td></tr>
              <tr><td colspan="2" style="text-align:end"><b>إجمالي الإيرادات</b></td><td style="color:#047857;font-weight:800">${arNum(totalRevenue)}</td></tr>
              <tr><td><b>الميزانيات المعتمدة للجان</b></td><td>إجمالي ما رُصد</td><td>${arNum(totalBudgetAlloc)}</td></tr>
              <tr><td><b>المنصرف الفعلي</b></td><td>طلبات الصرف المعتمدة</td><td>${arNum(Math.max(totalBudgetSpent, paidExpenses))}</td></tr>
            </tbody>
          </table>
        </div>
      </section>


      <section class="section">
        <div class="section-head"><span class="bar"></span><h2>المهام المشتركة بين أكثر من لجنة</h2><span class="desc">تنسيق متكامل لضمان نجاح الحفل</span></div>
        <div class="ranking">
          <table>
            <thead><tr><th>المهمة</th><th>اللجنة القائدة</th><th>اللجان الشريكة</th><th>ملاحظة تنسيقية</th></tr></thead>
            <tbody>${sharedRows}</tbody>
          </table>
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
        <div class="section-head"><span class="bar"></span><h2>تفاعل أعضاء اللجان مع المنصة</h2><span class="desc">مستوى الحضور الرقمي والمساهمة الفعلية لكل لجنة</span></div>
        <div class="summary">
          <div class="sum"><span class="l">إجمالي الأعضاء</span><span class="v">${totalMembers}</span></div>
          <div class="sum"><span class="l">نشطون خلال 30 يوم</span><span class="v">${totalActive}</span></div>
          <div class="sum"><span class="l">نسبة التفاعل العامة</span><span class="v" style="color:${overallEngagement >= 60 ? TEAL_DARK : "#B45309"}">${overallEngagement}%</span></div>
          <div class="sum"><span class="l">إجمالي مرات الدخول</span><span class="v">${totalAllLogins}</span></div>
        </div>
        <div class="ranking" style="margin-top:10px">
          <table>
            <thead><tr><th>اللجنة</th><th>الأعضاء</th><th>النشطون (30 يوم)</th><th>مرات الدخول</th><th>التفاعلات</th><th>آخر نشاط</th></tr></thead>
            <tbody>${engRows}</tbody>
          </table>
        </div>
        <p style="margin:8px 2px 0;font-size:10.5px;color:${SLATE_500};line-height:1.8">
          <b>منهجية القياس:</b> يُحتسب التفاعل من مصادر متعددة في المنصة: تسجيل الدخول، إنشاء وتعديل ومتابعة المهام (سجل الأنشطة)، الردود والتعليقات، المنشورات، وطلبات الصرف. يُعتبر العضو "نشطاً" إذا سجّل أي نشاط (دخول أو تفاعل) خلال آخر 30 يوماً.
        </p>
      </section>

      <section class="section">
        <div class="section-head"><span class="bar"></span><h2>التشخيص التفصيلي لكل لجنة</h2><span class="desc">القوة · الضعف · التوصيات</span></div>
        <div class="cards">${sorted.map(cardHtml).join("")}</div>
      </section>

      <div class="legacy">
        <div class="lbl">رسالة للأجيال القادمة</div>
        <div class="msg">
          إنّ ما يُسجَّل اليوم في هذه المنصة من خططٍ وأعمالٍ وقراراتٍ ووثائق، إنما هو حفظٌ لجهودكم المباركة، ومسارٌ مضيءٌ يسير عليه من يخلفكم من أبناء العائلة الكرام؛ فلكم سَبْقُ الأجر وثوابُ التأسيس، ولمن بعدكم البناءُ على ما أرسيتم، ﴿وَقُلِ اعْمَلُوا فَسَيَرَى اللَّهُ عَمَلَكُمْ وَرَسُولُهُ وَالْمُؤْمِنُونَ﴾.
        </div>
      </div>

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