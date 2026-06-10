import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { printHtmlDocument } from "@/lib/print-frame";
import { COMMITTEES, type CommitteeType } from "@/lib/committees";
import { buildReferenceNumber, fmtArDate } from "@/lib/report-shared";

const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(Math.round(Number(n) || 0));
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const COMMITTEE_COLOR: Record<CommitteeType, string> = {
  supreme: "#8A6A12",
  finance: "#0B6A47",
  women: "#DB2777",
  media: "#E11D48",
  reception: "#EC4899",
  programs: "#7C3AED",
  quality: "#0284C7",
  dinner: "#D97706",
  procurement: "#EA580C",
};

const TASK_STATUS_LABEL: Record<string, string> = {
  todo: "لم تبدأ",
  in_progress: "قيد التنفيذ",
  review: "قيد المراجعة",
  completed: "مكتملة",
  blocked: "متوقفة",
};
const TASK_STATUS_COLOR: Record<string, string> = {
  todo: "#94A3B8",
  in_progress: "#0EA5E9",
  review: "#D4A95E",
  completed: "#0D7C66",
  blocked: "#B91C1C",
};

const PR_STATUS_LABEL: Record<string, string> = {
  paid: "مصروفة",
  approved: "معتمدة",
  pending: "قيد المراجعة",
  rejected: "مرفوضة",
};
const PR_STATUS_COLOR: Record<string, string> = {
  paid: "#0D7C66",
  approved: "#0EA5E9",
  pending: "#D4A95E",
  rejected: "#94A3B8",
};

interface TaskRow { id: string; committee_id: string; title: string; status: string; due_date: string | null; }
interface ItemRow { id: string; committee_id: string; item_name: string; quantity: number; unit_cost: number; total_cost: number; }
interface PRRow { id: string; committee_id: string; title: string; amount: number; status: string; created_at: string; }
interface ContribRow { id: string; amount: number; created_at: string; family_branch?: string | null; contributor_name?: string | null; }

interface CommitteeAgg {
  id: string;
  name: string;
  type: CommitteeType;
  description?: string;
  goals: string[];
  allocated: number;
  spent: number;
  tasks: TaskRow[];
  items: ItemRow[];
  paymentRequests: PRRow[];
}

interface Data {
  committees: CommitteeAgg[];
  contributions: ContribRow[];
  historical: { hijri_year: number; amount: number; contributor_name?: string | null }[];
  hijriYear: number;
  totalRevenue: number;
  revenueDirect: number;
  revenueHistoricalCurrent: number;
  revenueHistoricalOther: number;
  totalAllocated: number;
  totalSpentPaid: number;
  totalApproved: number;
  totalPending: number;
}

async function gather(): Promise<Data> {
  const [{ data: coms }, { data: tasks }, { data: items }, { data: prs }, { data: contribs }, { data: hist }] = await Promise.all([
    supabase.from("committees").select("id, name, type, description, budget_allocated, budget_spent"),
    supabase.from("committee_tasks").select("id, committee_id, title, status, due_date").order("sort_order"),
    supabase.from("budget_items").select("id, committee_id, item_name, quantity, unit_cost, total_cost").order("created_at"),
    supabase.from("payment_requests").select("id, committee_id, title, amount, status, created_at").order("created_at", { ascending: false }),
    supabase.from("family_contributions").select("id, amount, created_at, family_branch, contributor_name").order("created_at", { ascending: false }),
    supabase.from("historical_shareholders").select("hijri_year, amount, contributor_name"),
  ]);

  const tasksByCom = new Map<string, TaskRow[]>();
  (tasks ?? []).forEach((t: any) => {
    const arr = tasksByCom.get(t.committee_id) ?? [];
    arr.push(t);
    tasksByCom.set(t.committee_id, arr);
  });
  const itemsByCom = new Map<string, ItemRow[]>();
  (items ?? []).forEach((it: any) => {
    const arr = itemsByCom.get(it.committee_id) ?? [];
    arr.push({ ...it, quantity: Number(it.quantity), unit_cost: Number(it.unit_cost), total_cost: Number(it.total_cost) });
    itemsByCom.set(it.committee_id, arr);
  });
  const prsByCom = new Map<string, PRRow[]>();
  (prs ?? []).forEach((p: any) => {
    const arr = prsByCom.get(p.committee_id) ?? [];
    arr.push({ ...p, amount: Number(p.amount) });
    prsByCom.set(p.committee_id, arr);
  });

  const committees: CommitteeAgg[] = (coms ?? []).map((c: any) => {
    const meta = COMMITTEES.find((m) => m.type === c.type);
    const items = itemsByCom.get(c.id) ?? [];
    const itemsSum = items.reduce((a, x) => a + x.total_cost, 0);
    return {
      id: c.id,
      name: c.name,
      type: c.type as CommitteeType,
      description: c.description || meta?.description,
      goals: meta?.goals ?? [],
      allocated: Math.max(Number(c.budget_allocated ?? 0), itemsSum),
      spent: Number(c.budget_spent ?? 0),
      tasks: tasksByCom.get(c.id) ?? [],
      items,
      paymentRequests: prsByCom.get(c.id) ?? [],
    };
  });

  const revenueDirect = (contribs ?? []).reduce((a, c: any) => a + Number(c.amount ?? 0), 0);
  const hijriYear = (hist ?? []).reduce<number>((m, r: any) => Math.max(m, Number(r.hijri_year ?? 0)), 1448) || 1448;
  const revenueHistoricalCurrent = (hist ?? []).filter((r: any) => Number(r.hijri_year) === hijriYear).reduce((a, r: any) => a + Number(r.amount ?? 0), 0);
  const revenueHistoricalOther = (hist ?? []).reduce((a, r: any) => a + Number(r.amount ?? 0), 0) - revenueHistoricalCurrent;
  const totalRevenue = revenueDirect + revenueHistoricalCurrent + revenueHistoricalOther;

  const totalAllocated = committees.reduce((a, c) => a + c.allocated, 0);
  const totalSpentPaid = (prs ?? []).filter((p: any) => p.status === "paid").reduce((a, p: any) => a + Number(p.amount ?? 0), 0);
  const totalApproved = (prs ?? []).filter((p: any) => p.status === "approved").reduce((a, p: any) => a + Number(p.amount ?? 0), 0);
  const totalPending = (prs ?? []).filter((p: any) => p.status === "pending").reduce((a, p: any) => a + Number(p.amount ?? 0), 0);

  return {
    committees,
    contributions: (contribs ?? []) as ContribRow[],
    historical: (hist ?? []) as any[],
    hijriYear,
    totalRevenue,
    revenueDirect,
    revenueHistoricalCurrent,
    revenueHistoricalOther,
    totalAllocated,
    totalSpentPaid,
    totalApproved,
    totalPending,
  };
}

function donutSvg(segments: { value: number; color: string }[], size: number, thickness: number, big: string, small: string, tone: string): string {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  const cx = size / 2;
  let offset = 0;
  const rings = total > 0
    ? segments.filter((s) => s.value > 0).map((s) => {
        const len = (s.value / total) * C;
        const node = `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${thickness}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cx})" />`;
        offset += len;
        return node;
      }).join("")
    : `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="#E2E8F0" stroke-width="${thickness}" />`;
  return `
    <div class="donut" style="width:${size}px;height:${size}px;">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="#F1F5F9" stroke-width="${thickness}" />
        ${rings}
      </svg>
      <div class="donut-center">
        <div class="donut-big" style="color:${tone}">${big}</div>
        <div class="donut-small">${small}</div>
      </div>
    </div>`;
}

function legend(items: { label: string; value: number; color: string }[], total: number): string {
  return `<ul class="lg">` + items.map((i) => {
    const pct = total > 0 ? Math.round((i.value / total) * 100) : 0;
    return `<li><span class="lg-dot" style="background:${i.color}"></span><span class="lg-label">${esc(i.label)}</span><span class="lg-val">${fmt(i.value)}</span><span class="lg-pct" style="color:${i.color}">${pct}%</span></li>`;
  }).join("") + `</ul>`;
}

function buildCoverPage(d: Data, today: string, ref: string): string {
  const net = d.totalRevenue - d.totalSpentPaid;
  const surplus = net >= 0;
  const revDonut = donutSvg(
    [
      { value: d.revenueDirect, color: "#0D7C66" },
      { value: d.revenueHistoricalCurrent, color: "#D4A95E" },
      { value: d.revenueHistoricalOther, color: "#94A3B8" },
    ],
    160, 24,
    fmt(d.totalRevenue), "إجمالي الإيرادات (ر.س)", "#0D7C66",
  );
  const expDonut = donutSvg(
    [
      { value: d.totalSpentPaid, color: "#0D7C66" },
      { value: d.totalApproved, color: "#0EA5E9" },
      { value: d.totalPending, color: "#D4A95E" },
    ],
    160, 24,
    fmt(d.totalSpentPaid + d.totalApproved + d.totalPending), "إجمالي المصروفات (ر.س)", "#B91C1C",
  );

  return `
    <section class="page">
      <header class="hdr">
        <img src="${logo}" class="hdr-logo" alt="logo" />
        <div class="hdr-titles">
          <h1>التقرير الشامل لأداء اللجان والميزانية العامة</h1>
          <p>السنة الهجرية ${d.hijriYear}هـ · صادر بتاريخ ${today} · مرجع ${ref}</p>
        </div>
        <div class="hdr-tag"><span>السنة</span><b>${d.hijriYear}هـ</b></div>
      </header>

      <div class="kpi-row">
        <div class="kpi rev"><span class="kpi-l">الإيرادات الإجمالية</span><b>${fmt(d.totalRevenue)}</b><span class="kpi-u">ر.س</span></div>
        <div class="kpi exp"><span class="kpi-l">المنصرف الفعلي</span><b>${fmt(d.totalSpentPaid)}</b><span class="kpi-u">ر.س</span></div>
        <div class="kpi alloc"><span class="kpi-l">المخصصات المعتمدة</span><b>${fmt(d.totalAllocated)}</b><span class="kpi-u">ر.س</span></div>
        <div class="kpi ${surplus ? "net-up" : "net-down"}"><span class="kpi-l">${surplus ? "الفائض" : "العجز"}</span><b>${surplus ? "" : "−"}${fmt(Math.abs(net))}</b><span class="kpi-u">ر.س</span></div>
      </div>

      <div class="two-col">
        <div class="card">
          <div class="card-title"><span class="bar"></span>تفصيل الإيرادات</div>
          <div class="card-body">
            ${revDonut}
            ${legend([
              { label: "مساهمات الأفراد (مباشرة)", value: d.revenueDirect, color: "#0D7C66" },
              { label: `مساهمات تاريخية ${d.hijriYear}هـ`, value: d.revenueHistoricalCurrent, color: "#D4A95E" },
              { label: "مساهمات سنوات سابقة", value: d.revenueHistoricalOther, color: "#94A3B8" },
            ], d.totalRevenue)}
          </div>
        </div>
        <div class="card">
          <div class="card-title"><span class="bar red"></span>حالة المصروفات</div>
          <div class="card-body">
            ${expDonut}
            ${legend([
              { label: "مصروفة فعلياً", value: d.totalSpentPaid, color: "#0D7C66" },
              { label: "معتمدة (لم تُصرف)", value: d.totalApproved, color: "#0EA5E9" },
              { label: "قيد المراجعة", value: d.totalPending, color: "#D4A95E" },
            ], d.totalSpentPaid + d.totalApproved + d.totalPending)}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span class="bar gold"></span>ملخص أداء اللجان</div>
        <table class="tbl">
          <thead>
            <tr><th>اللجنة</th><th>المهام (مكتمل/الكل)</th><th>الإنجاز</th><th>بنود الموازنة</th><th>المخصص</th><th>المنصرف</th><th>الاستهلاك</th></tr>
          </thead>
          <tbody>
            ${COMMITTEES.map((m) => d.committees.find((c) => c.type === m.type)).filter(Boolean).map((c) => {
              const C = c!;
              const done = C.tasks.filter((t) => t.status === "completed").length;
              const taskPct = C.tasks.length > 0 ? Math.round((done / C.tasks.length) * 100) : 0;
              const usePct = C.allocated > 0 ? Math.round((C.spent / C.allocated) * 100) : 0;
              const color = COMMITTEE_COLOR[C.type];
              return `<tr>
                <td><span class="tag" style="background:${color}"></span> ${esc(C.name)}</td>
                <td>${done}/${C.tasks.length}</td>
                <td><b style="color:${color}">${taskPct}%</b></td>
                <td>${C.items.length}</td>
                <td>${fmt(C.allocated)}</td>
                <td>${fmt(C.spent)}</td>
                <td><b style="color:${usePct > 100 ? "#B91C1C" : color}">${usePct}%</b></td>
              </tr>`;
            }).join("")}
          </tbody>
          <tfoot>
            <tr>
              <th>الإجمالي</th>
              <th>${d.committees.reduce((a, c) => a + c.tasks.filter((t) => t.status === "completed").length, 0)}/${d.committees.reduce((a, c) => a + c.tasks.length, 0)}</th>
              <th>—</th>
              <th>${d.committees.reduce((a, c) => a + c.items.length, 0)}</th>
              <th>${fmt(d.totalAllocated)}</th>
              <th>${fmt(d.committees.reduce((a, c) => a + c.spent, 0))}</th>
              <th>${d.totalAllocated > 0 ? Math.round((d.committees.reduce((a, c) => a + c.spent, 0) / d.totalAllocated) * 100) : 0}%</th>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>`;
}

function buildCommitteeSection(c: CommitteeAgg): string {
  const color = COMMITTEE_COLOR[c.type];
  const done = c.tasks.filter((t) => t.status === "completed").length;
  const inProg = c.tasks.filter((t) => t.status === "in_progress").length;
  const todo = c.tasks.filter((t) => t.status === "todo").length;
  const taskPct = c.tasks.length > 0 ? Math.round((done / c.tasks.length) * 100) : 0;
  const itemsSum = c.items.reduce((a, x) => a + x.total_cost, 0);
  const paid = c.paymentRequests.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0);
  const approved = c.paymentRequests.filter((p) => p.status === "approved").reduce((a, p) => a + p.amount, 0);
  const pending = c.paymentRequests.filter((p) => p.status === "pending").reduce((a, p) => a + p.amount, 0);
  const remaining = Math.max(c.allocated - paid - approved, 0);

  const tasksTable = c.tasks.length === 0
    ? `<div class="empty">لم تُسجل مهام لهذه اللجنة بعد.</div>`
    : `<table class="tbl tasks">
        <thead><tr><th style="width:30px">#</th><th>المهمة</th><th style="width:80px">الموعد</th><th style="width:90px">الحالة</th></tr></thead>
        <tbody>
          ${c.tasks.map((t, i) => `<tr>
            <td>${i + 1}</td>
            <td>${esc(t.title)}</td>
            <td>${t.due_date ? esc(t.due_date) : "—"}</td>
            <td><span class="pill" style="background:${TASK_STATUS_COLOR[t.status] ?? "#94A3B8"}1A;color:${TASK_STATUS_COLOR[t.status] ?? "#94A3B8"}">${TASK_STATUS_LABEL[t.status] ?? t.status}</span></td>
          </tr>`).join("")}
        </tbody>
      </table>`;

  const itemsTable = c.items.length === 0
    ? `<div class="empty">لم تُدخل بنود ميزانية لهذه اللجنة بعد.</div>`
    : `<table class="tbl">
        <thead><tr><th style="width:30px">#</th><th>البند</th><th style="width:60px">الكمية</th><th style="width:90px">سعر الوحدة</th><th style="width:100px">الإجمالي</th></tr></thead>
        <tbody>
          ${c.items.map((it, i) => `<tr>
            <td>${i + 1}</td>
            <td>${esc(it.item_name)}</td>
            <td>${fmt(it.quantity)}</td>
            <td>${fmt(it.unit_cost)}</td>
            <td><b>${fmt(it.total_cost)}</b></td>
          </tr>`).join("")}
        </tbody>
        <tfoot><tr><th colspan="4">إجمالي بنود الموازنة</th><th>${fmt(itemsSum)} ر.س</th></tr></tfoot>
      </table>`;

  const prTable = c.paymentRequests.length === 0
    ? `<div class="empty">لا توجد طلبات صرف مسجلة لهذه اللجنة.</div>`
    : `<table class="tbl">
        <thead><tr><th style="width:30px">#</th><th>الطلب</th><th style="width:90px">المبلغ</th><th style="width:90px">الحالة</th><th style="width:80px">التاريخ</th></tr></thead>
        <tbody>
          ${c.paymentRequests.map((p, i) => `<tr>
            <td>${i + 1}</td>
            <td>${esc(p.title)}</td>
            <td><b>${fmt(p.amount)}</b></td>
            <td><span class="pill" style="background:${PR_STATUS_COLOR[p.status] ?? "#94A3B8"}1A;color:${PR_STATUS_COLOR[p.status] ?? "#94A3B8"}">${PR_STATUS_LABEL[p.status] ?? p.status}</span></td>
            <td>${esc((p.created_at ?? "").slice(0, 10))}</td>
          </tr>`).join("")}
        </tbody>
      </table>`;

  return `
    <section class="page committee" style="--c:${color}">
      <header class="csec-hdr">
        <div class="csec-title"><span class="csec-bar"></span><h2>${esc(c.name)}</h2></div>
        <div class="csec-stats">
          <span><b>${c.tasks.length}</b> مهمة</span>
          <span><b>${c.items.length}</b> بند موازنة</span>
          <span><b>${fmt(c.allocated)}</b> مخصص ر.س</span>
        </div>
      </header>

      ${c.description ? `<p class="csec-desc">${esc(c.description)}</p>` : ""}

      ${c.goals.length > 0 ? `
        <div class="csec-block">
          <div class="block-title">الأهداف الاستراتيجية</div>
          <ul class="goals">${c.goals.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>
        </div>` : ""}

      <div class="csec-summary">
        <div class="mini"><span>إجمالي المهام</span><b>${c.tasks.length}</b></div>
        <div class="mini ok"><span>مكتملة</span><b>${done}</b></div>
        <div class="mini wip"><span>قيد التنفيذ</span><b>${inProg}</b></div>
        <div class="mini"><span>لم تبدأ</span><b>${todo}</b></div>
        <div class="mini accent"><span>نسبة الإنجاز</span><b>${taskPct}%</b></div>
      </div>

      <div class="csec-block">
        <div class="block-title">خطة العمل والمهام</div>
        ${tasksTable}
      </div>

      <div class="csec-block">
        <div class="block-title">بنود الميزانية المعتمدة</div>
        ${itemsTable}
      </div>

      <div class="csec-block">
        <div class="block-title">طلبات الصرف</div>
        ${prTable}
      </div>

      <div class="csec-fin">
        <div class="fin-row"><span>المخصص الكلي</span><b>${fmt(c.allocated)} ر.س</b></div>
        <div class="fin-row paid"><span>المصروف فعلياً</span><b>${fmt(paid)} ر.س</b></div>
        <div class="fin-row appr"><span>معتمد بانتظار الصرف</span><b>${fmt(approved)} ر.س</b></div>
        <div class="fin-row pend"><span>قيد المراجعة</span><b>${fmt(pending)} ر.س</b></div>
        <div class="fin-row rem"><span>المتبقي المتاح</span><b>${fmt(remaining)} ر.س</b></div>
      </div>
    </section>`;
}

function buildFinancialsPage(d: Data): string {
  const allPRs = d.committees.flatMap((c) => c.paymentRequests.map((p) => ({ ...p, committeeName: c.name, color: COMMITTEE_COLOR[c.type] })))
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  const contribRows = d.contributions.slice(0, 40);
  const histByYear = new Map<number, number>();
  d.historical.forEach((h) => histByYear.set(h.hijri_year, (histByYear.get(h.hijri_year) ?? 0) + Number(h.amount || 0)));
  const histYears = [...histByYear.entries()].sort((a, b) => b[0] - a[0]);

  return `
    <section class="page">
      <h2 class="page-h">التفاصيل المالية الدقيقة</h2>

      <div class="card">
        <div class="card-title"><span class="bar"></span>مساهمات الأفراد (آخر ${contribRows.length})</div>
        ${contribRows.length === 0 ? `<div class="empty">لا توجد مساهمات مسجلة بعد.</div>` : `
        <table class="tbl">
          <thead><tr><th style="width:30px">#</th><th>المساهم</th><th>الفرع</th><th style="width:90px">المبلغ</th><th style="width:80px">التاريخ</th></tr></thead>
          <tbody>
            ${contribRows.map((c, i) => `<tr>
              <td>${i + 1}</td>
              <td>${esc(c.contributor_name ?? "—")}</td>
              <td>${esc(c.family_branch ?? "—")}</td>
              <td><b>${fmt(c.amount)}</b></td>
              <td>${esc((c.created_at ?? "").slice(0, 10))}</td>
            </tr>`).join("")}
          </tbody>
          <tfoot><tr><th colspan="3">إجمالي المساهمات المباشرة</th><th colspan="2">${fmt(d.revenueDirect)} ر.س</th></tr></tfoot>
        </table>`}
      </div>

      <div class="card">
        <div class="card-title"><span class="bar gold"></span>المساهمات التاريخية حسب السنة</div>
        ${histYears.length === 0 ? `<div class="empty">لا توجد بيانات تاريخية.</div>` : `
        <table class="tbl">
          <thead><tr><th>السنة الهجرية</th><th>عدد المساهمين</th><th>الإجمالي (ر.س)</th></tr></thead>
          <tbody>
            ${histYears.map(([y, sum]) => {
              const count = d.historical.filter((h) => h.hijri_year === y).length;
              return `<tr><td><b>${y}هـ</b></td><td>${count}</td><td><b>${fmt(sum)}</b></td></tr>`;
            }).join("")}
          </tbody>
        </table>`}
      </div>

      <div class="card">
        <div class="card-title"><span class="bar red"></span>سجل طلبات الصرف الكامل</div>
        ${allPRs.length === 0 ? `<div class="empty">لا توجد طلبات صرف.</div>` : `
        <table class="tbl">
          <thead><tr><th style="width:30px">#</th><th>اللجنة</th><th>الطلب</th><th style="width:90px">المبلغ</th><th style="width:90px">الحالة</th><th style="width:80px">التاريخ</th></tr></thead>
          <tbody>
            ${allPRs.map((p, i) => `<tr>
              <td>${i + 1}</td>
              <td><span class="tag" style="background:${p.color}"></span> ${esc(p.committeeName)}</td>
              <td>${esc(p.title)}</td>
              <td><b>${fmt(p.amount)}</b></td>
              <td><span class="pill" style="background:${PR_STATUS_COLOR[p.status] ?? "#94A3B8"}1A;color:${PR_STATUS_COLOR[p.status] ?? "#94A3B8"}">${PR_STATUS_LABEL[p.status] ?? p.status}</span></td>
              <td>${esc((p.created_at ?? "").slice(0, 10))}</td>
            </tr>`).join("")}
          </tbody>
          <tfoot>
            <tr><th colspan="3">المصروفة فعلياً</th><th colspan="3">${fmt(d.totalSpentPaid)} ر.س</th></tr>
            <tr><th colspan="3">المعتمدة بانتظار الصرف</th><th colspan="3">${fmt(d.totalApproved)} ر.س</th></tr>
            <tr><th colspan="3">قيد المراجعة</th><th colspan="3">${fmt(d.totalPending)} ر.س</th></tr>
          </tfoot>
        </table>`}
      </div>
    </section>`;
}

function buildHtml(d: Data): string {
  const today = fmtArDate(new Date());
  const ref = buildReferenceNumber("FULL");
  const ordered = COMMITTEES.map((m) => d.committees.find((c) => c.type === m.type)).filter((x): x is CommitteeAgg => !!x);

  return `
    <div dir="rtl" class="rep">
      ${buildCoverPage(d, today, ref)}
      ${ordered.map(buildCommitteeSection).join("")}
      ${buildFinancialsPage(d)}
      <p class="foot">منظومة لجنة الزواج الجماعي · ${ref} · ${today}</p>
    </div>
    <style>
      @page { size: A4 portrait; margin: 12mm 10mm; }
      @media print { html, body { margin:0; background:#fff; } .page { page-break-after: always; } .page:last-of-type { page-break-after: auto; } }
      .rep { font-family: 'Noto Naskh Arabic','Segoe UI','Tahoma',sans-serif; color:#0F172A; direction:rtl; }
      .rep *, .rep *::before, .rep *::after { box-sizing:border-box; }
      .page { page-break-after: always; }
      .page:last-of-type { page-break-after: auto; }

      .hdr { display:flex; align-items:center; gap:12px; background:linear-gradient(90deg,#0D7C66,#064F40); color:#fff; border-radius:10px; padding:10px 14px; margin-bottom:10px; }
      .hdr-logo { width:46px; height:46px; background:#fff; border-radius:8px; padding:4px; object-fit:contain; }
      .hdr-titles { flex:1; }
      .hdr-titles h1 { margin:0; font-size:18px; font-weight:800; }
      .hdr-titles p { margin:3px 0 0; font-size:11px; color:#FFEDD5; }
      .hdr-tag { background:#D4A95E; color:#0F172A; border-radius:8px; padding:6px 12px; text-align:center; min-width:90px; }
      .hdr-tag span { font-size:10px; display:block; opacity:0.85; }
      .hdr-tag b { font-size:14px; }

      .kpi-row { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:10px; }
      .kpi { border-radius:10px; padding:10px 12px; background:#F8FAFC; border:1px solid #E2E8F0; display:flex; flex-direction:column; gap:2px; }
      .kpi-l { font-size:10px; color:#64748B; font-weight:700; }
      .kpi b { font-size:18px; font-weight:800; color:#0F172A; }
      .kpi-u { font-size:9px; color:#94A3B8; }
      .kpi.rev { background:#ECFDF5; border-color:#A7F3D0; }
      .kpi.exp { background:#FEF2F2; border-color:#FECACA; }
      .kpi.alloc { background:#FFF8E1; border-color:#FDE68A; }
      .kpi.net-up { background:#ECFDF5; border-color:#A7F3D0; }
      .kpi.net-up b { color:#0D7C66; }
      .kpi.net-down { background:#FEF2F2; border-color:#FECACA; }
      .kpi.net-down b { color:#B91C1C; }

      .two-col { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px; }
      .card { border:1px solid #E2E8F0; border-radius:10px; padding:10px 12px; background:#fff; margin-bottom:10px; page-break-inside:avoid; }
      .card-title { font-size:13px; font-weight:800; display:flex; align-items:center; gap:8px; margin-bottom:8px; }
      .bar { display:inline-block; width:5px; height:16px; border-radius:3px; background:#0D7C66; }
      .bar.red { background:#B91C1C; }
      .bar.gold { background:#D4A95E; }
      .card-body { display:flex; align-items:center; gap:14px; }

      .donut { position:relative; flex-shrink:0; }
      .donut-center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
      .donut-big { font-size:18px; font-weight:800; line-height:1; }
      .donut-small { font-size:9.5px; color:#64748B; margin-top:3px; text-align:center; }

      .lg { list-style:none; padding:0; margin:0; flex:1; }
      .lg li { display:grid; grid-template-columns:10px 1fr auto auto; gap:6px; align-items:center; padding:4px 0; font-size:10.5px; border-bottom:1px dashed #E2E8F0; }
      .lg li:last-child { border-bottom:none; }
      .lg-dot { width:9px; height:9px; border-radius:50%; }
      .lg-label { color:#334155; }
      .lg-val { font-weight:700; }
      .lg-pct { font-weight:800; min-width:30px; text-align:left; }

      .tbl { width:100%; border-collapse:collapse; font-size:10.5px; border:1px solid #E2E8F0; border-radius:8px; overflow:hidden; }
      .tbl thead th { background:#0D7C66; color:#fff; padding:5px 6px; text-align:right; font-size:10.5px; font-weight:700; }
      .tbl tbody td { padding:5px 6px; border-bottom:1px solid #F1F5F9; text-align:right; color:#334155; }
      .tbl tbody tr:nth-child(even) td { background:#F8FAFC; }
      .tbl tfoot th { background:#FFF8E1; color:#8A6A12; padding:5px 6px; text-align:right; border-top:2px solid #D4A95E; }
      .tag { display:inline-block; width:9px; height:9px; border-radius:2px; vertical-align:middle; margin-inline-start:4px; }
      .pill { display:inline-block; padding:2px 8px; border-radius:999px; font-size:10px; font-weight:700; }

      /* Committee section */
      .committee { padding-top:4px; }
      .csec-hdr { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid var(--c); padding-bottom:6px; margin-bottom:8px; }
      .csec-title { display:flex; align-items:center; gap:8px; }
      .csec-bar { width:6px; height:24px; border-radius:3px; background:var(--c); }
      .csec-title h2 { margin:0; font-size:18px; font-weight:800; color:var(--c); }
      .csec-stats { display:flex; gap:14px; font-size:11px; color:#64748B; }
      .csec-stats b { color:#0F172A; font-weight:800; margin-inline-end:3px; }
      .csec-desc { font-size:11px; color:#475569; margin:0 0 10px; line-height:1.6; }
      .csec-block { margin-bottom:10px; page-break-inside:avoid; }
      .block-title { font-size:12px; font-weight:800; color:var(--c); border-right:4px solid var(--c); padding-right:8px; margin-bottom:6px; background:linear-gradient(270deg,transparent,#F8FAFC); padding-block:4px; }
      .goals { margin:0; padding-inline-start:18px; font-size:11px; color:#334155; line-height:1.7; }
      .goals li { margin-bottom:2px; }
      .csec-summary { display:grid; grid-template-columns:repeat(5,1fr); gap:6px; margin-bottom:10px; }
      .mini { background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:6px 8px; display:flex; flex-direction:column; gap:2px; }
      .mini span { font-size:9.5px; color:#64748B; }
      .mini b { font-size:14px; font-weight:800; }
      .mini.ok { background:#ECFDF5; border-color:#A7F3D0; } .mini.ok b { color:#0D7C66; }
      .mini.wip { background:#EFF6FF; border-color:#BFDBFE; } .mini.wip b { color:#0284C7; }
      .mini.accent { background:#FFF8E1; border-color:#FDE68A; } .mini.accent b { color:#8A6A12; }
      .csec-fin { display:grid; grid-template-columns:repeat(5,1fr); gap:6px; margin-top:6px; }
      .fin-row { background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:6px 8px; display:flex; flex-direction:column; gap:2px; }
      .fin-row span { font-size:9.5px; color:#64748B; }
      .fin-row b { font-size:12px; font-weight:800; }
      .fin-row.paid { background:#ECFDF5; border-color:#A7F3D0; } .fin-row.paid b { color:#0D7C66; }
      .fin-row.appr { background:#EFF6FF; border-color:#BFDBFE; } .fin-row.appr b { color:#0284C7; }
      .fin-row.pend { background:#FFFBEB; border-color:#FDE68A; } .fin-row.pend b { color:#8A6A12; }
      .fin-row.rem { background:#F0FDF4; border-color:#BBF7D0; } .fin-row.rem b { color:#15803D; }

      .empty { padding:10px; text-align:center; font-size:11px; color:#94A3B8; border:1px dashed #E2E8F0; border-radius:8px; background:#F8FAFC; }

      .page-h { font-size:18px; font-weight:800; color:#0D7C66; border-bottom:3px solid #0D7C66; padding-bottom:6px; margin:0 0 10px; }
      .foot { margin-top:10px; text-align:center; font-size:9.5px; color:#94A3B8; }
    </style>`;
}

export async function exportMindMapReport(): Promise<void> {
  const data = await gather();
  const html = buildHtml(data);
  await printHtmlDocument(html, "التقرير-الشامل-للجان-والميزانية");
}
