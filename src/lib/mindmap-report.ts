import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { printHtmlDocument } from "@/lib/print-frame";
import { COMMITTEES, type CommitteeType } from "@/lib/committees";
import { buildReferenceNumber, fmtArDate } from "@/lib/report-shared";

const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(Math.round(n));

// Committee color tags (used in legends + per-committee donuts)
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

interface CommitteeAgg {
  id: string;
  name: string;
  type: CommitteeType;
  tasksTotal: number;
  tasksDone: number;
  budgetItems: number;
  allocated: number;
  spent: number;
}

interface MindMapData {
  committees: CommitteeAgg[];
  totalRevenue: number;
  revenueBreakdown: { label: string; amount: number; color: string }[];
  totalExpense: number;
  expenseBreakdown: { label: string; amount: number; count: number; color: string }[];
  paidExpense: number;
  approvedExpense: number;
  pendingExpense: number;
  totalAllocated: number;
  hijriYear: number;
}

async function gatherData(): Promise<MindMapData> {
  const [{ data: coms }, { data: tasks }, { data: items }, { data: contribs }, { data: prs }, { data: hist }] = await Promise.all([
    supabase.from("committees").select("id, name, type, budget_allocated, budget_spent"),
    supabase.from("committee_tasks").select("committee_id, status"),
    supabase.from("budget_items").select("committee_id, total_cost"),
    supabase.from("family_contributions").select("amount"),
    supabase.from("payment_requests").select("amount, status, committee_id"),
    supabase.from("historical_shareholders").select("amount, hijri_year"),
  ]);

  const tasksByCom = new Map<string, { total: number; done: number }>();
  (tasks ?? []).forEach((t: any) => {
    const r = tasksByCom.get(t.committee_id) ?? { total: 0, done: 0 };
    r.total += 1;
    if (t.status === "completed") r.done += 1;
    tasksByCom.set(t.committee_id, r);
  });

  const itemsByCom = new Map<string, { count: number; sum: number }>();
  (items ?? []).forEach((it: any) => {
    const r = itemsByCom.get(it.committee_id) ?? { count: 0, sum: 0 };
    r.count += 1;
    r.sum += Number(it.total_cost ?? 0);
    itemsByCom.set(it.committee_id, r);
  });

  const committees: CommitteeAgg[] = (coms ?? []).map((c: any) => {
    const t = tasksByCom.get(c.id) ?? { total: 0, done: 0 };
    const it = itemsByCom.get(c.id) ?? { count: 0, sum: 0 };
    return {
      id: c.id,
      name: c.name,
      type: c.type as CommitteeType,
      tasksTotal: t.total,
      tasksDone: t.done,
      budgetItems: it.count,
      allocated: Math.max(Number(c.budget_allocated ?? 0), it.sum),
      spent: Number(c.budget_spent ?? 0),
    };
  });

  const totalRevenue = (contribs ?? []).reduce((a, c: any) => a + Number(c.amount ?? 0), 0);
  // Latest hijri year present in historical_shareholders, else current Hijri year (~1448)
  const hijriYear = (hist ?? []).reduce<number>((m, r: any) => Math.max(m, Number(r.hijri_year ?? 0)), 1448);
  const currentYearHist = (hist ?? []).filter((r: any) => Number(r.hijri_year ?? 0) === hijriYear)
    .reduce((a, r: any) => a + Number(r.amount ?? 0), 0);
  const otherHist = (hist ?? []).reduce((a, r: any) => a + Number(r.amount ?? 0), 0) - currentYearHist;
  const revenueBreakdown = [
    { label: "مساهمات الأفراد (مباشرة)", amount: totalRevenue, color: "#0D7C66" },
    { label: `مساهمات تاريخية ${hijriYear}هـ`, amount: currentYearHist, color: "#D4A95E" },
    { label: "مساهمات سنوات سابقة", amount: otherHist, color: "#94A3B8" },
  ].filter((r) => r.amount > 0 || r.label.startsWith("مساهمات الأفراد"));
  const grandRevenue = revenueBreakdown.reduce((a, r) => a + r.amount, 0);

  // Expenses: split by status
  const byStatus: Record<string, { count: number; sum: number }> = {};
  (prs ?? []).forEach((p: any) => {
    const s = p.status ?? "pending";
    byStatus[s] = byStatus[s] ?? { count: 0, sum: 0 };
    byStatus[s].count += 1;
    byStatus[s].sum += Number(p.amount ?? 0);
  });
  const statusMeta: Record<string, { label: string; color: string }> = {
    paid:     { label: "مصروفة فعلياً", color: "#0D7C66" },
    approved: { label: "معتمدة (لم تُصرف)", color: "#0EA5E9" },
    pending:  { label: "قيد المراجعة", color: "#D4A95E" },
    rejected: { label: "مرفوضة", color: "#94A3B8" },
  };
  const expenseBreakdown = (["paid", "approved", "pending"] as const)
    .map((s) => ({
      label: statusMeta[s].label,
      color: statusMeta[s].color,
      amount: byStatus[s]?.sum ?? 0,
      count: byStatus[s]?.count ?? 0,
    }))
    .filter((e) => e.amount > 0 || e.count > 0);
  const totalExpense = expenseBreakdown.reduce((a, b) => a + b.amount, 0);
  const paidExpense = byStatus.paid?.sum ?? 0;
  const approvedExpense = byStatus.approved?.sum ?? 0;
  const pendingExpense = byStatus.pending?.sum ?? 0;
  const totalAllocated = committees.reduce((a, c) => a + c.allocated, 0);

  return {
    committees,
    totalRevenue: grandRevenue,
    revenueBreakdown,
    totalExpense,
    expenseBreakdown,
    paidExpense,
    approvedExpense,
    pendingExpense,
    totalAllocated,
    hijriYear,
  };
}

function buildHtml(d: MindMapData): string {
  const ref = buildReferenceNumber("DASH");
  const today = fmtArDate(new Date());

  // Order committees to match COMMITTEES catalog order so layout is stable
  const ordered = COMMITTEES
    .map((m) => d.committees.find((c) => c.type === m.type))
    .filter((x): x is CommitteeAgg => !!x);

  const net = d.totalRevenue - d.paidExpense;
  const surplus = net >= 0;

  // ---- Donut SVG helper (multi-segment ring) ------------------------------
  function donut(
    segments: { value: number; color: string }[],
    size: number,
    thickness: number,
    center: { big: string; small?: string; tone?: string },
  ): string {
    const total = segments.reduce((a, s) => a + s.value, 0);
    const r = (size - thickness) / 2;
    const C = 2 * Math.PI * r;
    const cxv = size / 2;
    let offset = 0;
    const rings = total > 0
      ? segments.map((s) => {
          const frac = s.value / total;
          const len = frac * C;
          const node = `<circle cx="${cxv}" cy="${cxv}" r="${r}"
            fill="none" stroke="${s.color}" stroke-width="${thickness}"
            stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}"
            stroke-dashoffset="${(-offset).toFixed(2)}"
            transform="rotate(-90 ${cxv} ${cxv})" />`;
          offset += len;
          return node;
        }).join("")
      : `<circle cx="${cxv}" cy="${cxv}" r="${r}" fill="none" stroke="#E2E8F0" stroke-width="${thickness}" />`;
    const tone = center.tone ?? "#0D7C66";
    return `
      <div class="donut" style="width:${size}px; height:${size}px;">
        <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
          <circle cx="${cxv}" cy="${cxv}" r="${r}" fill="none" stroke="#F1F5F9" stroke-width="${thickness}" />
          ${rings}
        </svg>
        <div class="donut-center">
          <div class="donut-big" style="color:${tone}">${center.big}</div>
          ${center.small ? `<div class="donut-small">${center.small}</div>` : ""}
        </div>
      </div>`;
  }

  function legend(items: { label: string; value: number; color: string; pct?: number }[], total: number): string {
    return `<ul class="lg">` + items.map((i) => {
      const pct = i.pct ?? (total > 0 ? Math.round((i.value / total) * 100) : 0);
      return `<li>
        <span class="lg-dot" style="background:${i.color}"></span>
        <span class="lg-label">${i.label}</span>
        <span class="lg-val">${fmt(i.value)}</span>
        <span class="lg-pct" style="color:${i.color}">${pct}%</span>
      </li>`;
    }).join("") + `</ul>`;
  }

  // ---- Sections -----------------------------------------------------------
  const revDonut = donut(
    d.revenueBreakdown.map((r) => ({ value: r.amount, color: r.color })),
    150, 22,
    { big: fmt(d.totalRevenue), small: "إجمالي ر.س", tone: "#0D7C66" },
  );
  const expDonut = donut(
    d.expenseBreakdown.map((e) => ({ value: e.amount, color: e.color })),
    150, 22,
    { big: fmt(d.totalExpense), small: "إجمالي ر.س", tone: "#B91C1C" },
  );

  // Top 3 committees by allocated budget for the bottom row
  const topCommittees = [...ordered]
    .filter((c) => c.allocated > 0 || c.tasksTotal > 0)
    .sort((a, b) => (b.allocated || 0) - (a.allocated || 0))
    .slice(0, 3);

  // If we have fewer than 3 with budgets, pad with most-tasks committees
  while (topCommittees.length < 3) {
    const next = ordered.find((c) => !topCommittees.includes(c));
    if (!next) break;
    topCommittees.push(next);
  }

  const committeeMiniDonuts = topCommittees.map((c) => {
    const color = COMMITTEE_COLOR[c.type];
    const allocated = c.allocated;
    const spent = Math.min(c.spent, allocated || c.spent);
    const remaining = Math.max(allocated - spent, 0);
    const pct = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
    const segs = allocated > 0
      ? [{ value: spent, color }, { value: remaining, color: "#E2E8F0" }]
      : [{ value: 1, color: "#E2E8F0" }];
    const ring = donut(segs, 110, 16, { big: `${pct}%`, small: "صرف", tone: color });
    const taskPct = c.tasksTotal > 0 ? Math.round((c.tasksDone / c.tasksTotal) * 100) : 0;
    return `
      <div class="mini-card">
        <div class="mini-title" style="color:${color}">${c.name}</div>
        ${ring}
        <div class="mini-stats">
          <div><span>المخصص</span><b>${fmt(allocated)}</b></div>
          <div><span>المنصرف</span><b>${fmt(c.spent)}</b></div>
          <div><span>المهام</span><b>${c.tasksDone}/${c.tasksTotal} (${taskPct}%)</b></div>
          <div><span>بنود الموازنة</span><b>${c.budgetItems}</b></div>
        </div>
      </div>`;
  }).join("");

  // KPI rail
  const kpiNet = surplus ? "الفائض" : "العجز (−)";
  const netDisplay = surplus ? `+ ${fmt(net)}` : `(${fmt(Math.abs(net))})`;

  // Committee performance table — compact, full breakdown
  const tableRows = ordered.map((c) => {
    const color = COMMITTEE_COLOR[c.type];
    const pct = c.allocated > 0 ? Math.round((c.spent / c.allocated) * 100) : 0;
    const taskPct = c.tasksTotal > 0 ? Math.round((c.tasksDone / c.tasksTotal) * 100) : 0;
    return `<tr>
      <td><span class="row-tag" style="background:${color}"></span> ${c.name}</td>
      <td>${c.tasksDone}/${c.tasksTotal}</td>
      <td><b style="color:${color}">${taskPct}%</b></td>
      <td>${c.budgetItems}</td>
      <td>${fmt(c.allocated)}</td>
      <td>${fmt(c.spent)}</td>
      <td><b style="color:${pct > 100 ? "#B91C1C" : color}">${pct}%</b></td>
    </tr>`;
  }).join("");

  return `
    <div dir="rtl" class="db">
      <!-- Header ribbon -->
      <header class="db-hdr">
        <img src="${logo}" class="db-logo" alt="logo" />
        <div class="db-titles">
          <h1>ملخص التقرير الشامل لأداء الميزانية العامة</h1>
          <p class="db-meta">السنة الهجرية ${d.hijriYear}هـ · صادر بتاريخ ${today}</p>
        </div>
        <div class="db-period">
          <span>الفترة</span><b>${d.hijriYear}هـ</b>
        </div>
      </header>

      <!-- Main 2-col grid: left (donuts) + right (executive summary rail) -->
      <section class="grid-main">

        <!-- Revenues card -->
        <div class="chart-card rev-card">
          <div class="chart-title"><span class="bar"></span>الإيرادات الفعلية</div>
          <div class="chart-body">
            ${revDonut}
            ${legend(
              d.revenueBreakdown.map((r) => ({ label: r.label, value: r.amount, color: r.color })),
              d.totalRevenue,
            )}
          </div>
        </div>

        <!-- Expenses card -->
        <div class="chart-card exp-card">
          <div class="chart-title"><span class="bar" style="background:#B91C1C"></span>المنصرف الفعلي</div>
          <div class="chart-body">
            ${expDonut}
            ${legend(
              d.expenseBreakdown.map((e) => ({ label: `${e.label} (${e.count})`, value: e.amount, color: e.color })),
              d.totalExpense,
            )}
          </div>
        </div>

        <!-- Executive summary rail -->
        <aside class="exec-rail">
          <div class="exec-title">الملخص التنفيذي</div>
          <div class="exec-kpi rev">
            <span class="exec-label">الإيرادات</span>
            <span class="exec-val">${fmt(d.totalRevenue)}</span>
          </div>
          <div class="exec-kpi exp">
            <span class="exec-label">المصروفات</span>
            <span class="exec-val">${fmt(d.paidExpense)}</span>
          </div>
          <div class="exec-kpi net" data-surplus="${surplus ? "1" : "0"}">
            <span class="exec-label">${kpiNet}</span>
            <span class="exec-val">${netDisplay}</span>
          </div>
          <div class="exec-sub">
            <div><span>معتمدة بانتظار الصرف</span><b>${fmt(d.approvedExpense)}</b></div>
            <div><span>قيد المراجعة</span><b>${fmt(d.pendingExpense)}</b></div>
            <div><span>إجمالي المخصصات</span><b>${fmt(d.totalAllocated)}</b></div>
          </div>
        </aside>
      </section>

      <!-- Mini donuts: top committees -->
      <section class="mini-section">
        <div class="section-title"><span class="bar gold"></span>أبرز اللجان من حيث الميزانية والأداء</div>
        <div class="mini-grid">${committeeMiniDonuts}</div>
      </section>

      <!-- Full committee performance table -->
      <section class="table-section">
        <div class="section-title"><span class="bar teal"></span>مهام اللجان وميزانياتها — تفصيل كامل</div>
        <table class="ptbl">
          <thead>
            <tr>
              <th>اللجنة</th><th>المهام</th><th>الإنجاز</th><th>بنود الموازنة</th>
              <th>المخصص (ر.س)</th><th>المنصرف (ر.س)</th><th>الاستهلاك</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
          <tfoot>
            <tr>
              <th>الإجمالي</th>
              <th>${ordered.reduce((a, c) => a + c.tasksDone, 0)}/${ordered.reduce((a, c) => a + c.tasksTotal, 0)}</th>
              <th>—</th>
              <th>${ordered.reduce((a, c) => a + c.budgetItems, 0)}</th>
              <th>${fmt(d.totalAllocated)}</th>
              <th>${fmt(ordered.reduce((a, c) => a + c.spent, 0))}</th>
              <th>${d.totalAllocated > 0 ? Math.round((ordered.reduce((a, c) => a + c.spent, 0) / d.totalAllocated) * 100) : 0}%</th>
            </tr>
          </tfoot>
        </table>
      </section>

      <p class="db-foot">منظومة لجنة الزواج الجماعي · ${ref} · لوحة معلومات تنفيذية في صفحة واحدة</p>
    </div>

    <style>
      @page { size: A4 portrait; margin: 9mm 8mm; }
      @media print { html, body { margin:0; background:#fff; } }
      .db {
        font-family: 'Noto Naskh Arabic','Segoe UI','Tahoma',sans-serif;
        color:#0F172A; direction:rtl; background:#fff; width:100%;
      }
      .db * { box-sizing:border-box; }

      /* Header */
      .db-hdr { display:flex; align-items:center; gap:12px;
        background: linear-gradient(90deg,#0D7C66 0%,#0a6655 60%,#064F40 100%);
        color:#fff; border-radius:10px; padding:8px 14px; margin-bottom:8px;
        box-shadow:0 4px 12px -6px rgba(13,124,102,0.4); }
      .db-logo { width:42px; height:42px; object-fit:contain;
        background:#fff; border-radius:8px; padding:4px; }
      .db-titles { flex:1; }
      .db-titles h1 { margin:0; font-size:17px; font-weight:800; }
      .db-meta { margin:2px 0 0; font-size:10.5px; color:#FFEDD5; }
      .db-period { background:#D4A95E; color:#0F172A; border-radius:8px;
        padding:6px 12px; text-align:center; min-width:90px; }
      .db-period span { font-size:9.5px; display:block; opacity:0.9; }
      .db-period b { font-size:13px; }

      /* Main grid */
      .grid-main { display:grid; grid-template-columns: 1fr 1fr 230px; gap:8px; }

      .chart-card { border:1px solid #E2E8F0; border-radius:12px; padding:10px 12px;
        background:#fff; page-break-inside:avoid; }
      .chart-title { font-size:12.5px; font-weight:800; color:#0F172A;
        margin-bottom:6px; display:flex; align-items:center; gap:8px; }
      .bar { display:inline-block; width:5px; height:16px; border-radius:3px; background:#0D7C66; }
      .bar.gold { background:#D4A95E; }
      .bar.teal { background:#0D7C66; }
      .chart-body { display:flex; align-items:center; gap:10px; }

      .donut { position:relative; flex-shrink:0; }
      .donut-center { position:absolute; inset:0; display:flex; flex-direction:column;
        align-items:center; justify-content:center; pointer-events:none; }
      .donut-big { font-size:18px; font-weight:800; line-height:1; }
      .donut-small { font-size:9.5px; color:#64748B; margin-top:2px; }

      .lg { list-style:none; padding:0; margin:0; flex:1; }
      .lg li { display:grid; grid-template-columns: 10px 1fr auto auto; gap:6px;
        align-items:center; padding:3px 0; font-size:10px;
        border-bottom:1px dashed #E2E8F0; }
      .lg li:last-child { border-bottom:none; }
      .lg-dot { width:8px; height:8px; border-radius:50%; }
      .lg-label { color:#334155; }
      .lg-val { color:#0F172A; font-weight:700; }
      .lg-pct { font-weight:800; font-size:10.5px; min-width:30px; text-align:left; }

      /* Executive rail */
      .exec-rail { background:linear-gradient(180deg,#0D7C66,#064F40); color:#fff;
        border-radius:12px; padding:10px 12px; display:flex; flex-direction:column;
        gap:6px; page-break-inside:avoid; }
      .exec-title { font-size:12px; font-weight:800; letter-spacing:0.5px;
        border-bottom:1px solid rgba(255,255,255,0.25); padding-bottom:5px; margin-bottom:2px;
        text-align:center; color:#FFEDD5; }
      .exec-kpi { display:flex; justify-content:space-between; align-items:baseline;
        padding:5px 8px; border-radius:8px; background:rgba(255,255,255,0.08); }
      .exec-kpi.rev { background:rgba(212,169,94,0.18); }
      .exec-kpi.exp { background:rgba(220,38,38,0.18); }
      .exec-kpi.net[data-surplus="1"] { background:rgba(34,197,94,0.22); }
      .exec-kpi.net[data-surplus="0"] { background:rgba(220,38,38,0.28); }
      .exec-label { font-size:10.5px; color:#FFEDD5; font-weight:700; }
      .exec-val { font-size:15px; font-weight:800; color:#fff; }
      .exec-sub { background:#fff; color:#0F172A; border-radius:8px; padding:6px 8px;
        margin-top:4px; font-size:9.5px; display:flex; flex-direction:column; gap:3px; }
      .exec-sub > div { display:flex; justify-content:space-between;
        border-bottom:1px dashed #E2E8F0; padding-bottom:2px; }
      .exec-sub > div:last-child { border-bottom:none; }
      .exec-sub b { color:#0D7C66; }

      /* Mini section */
      .section-title { font-size:12px; font-weight:800; display:flex; align-items:center; gap:8px;
        margin:10px 0 6px; color:#0F172A; }
      .mini-grid { display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; }
      .mini-card { border:1px solid #E2E8F0; border-radius:12px; padding:8px 10px;
        background:linear-gradient(180deg,#FAFAFA,#fff); page-break-inside:avoid;
        display:flex; flex-direction:column; align-items:center; gap:4px; }
      .mini-title { font-size:11.5px; font-weight:800; text-align:center; }
      .mini-stats { width:100%; display:grid; grid-template-columns: 1fr 1fr; gap:2px 8px;
        font-size:9.5px; color:#334155; }
      .mini-stats > div { display:flex; justify-content:space-between;
        border-bottom:1px dashed #E2E8F0; padding:2px 0; }
      .mini-stats b { font-weight:800; color:#0F172A; }

      /* Performance table */
      .table-section { page-break-inside:avoid; }
      .ptbl { width:100%; border-collapse:collapse; font-size:10px;
        border-radius:8px; overflow:hidden; border:1px solid #E2E8F0; }
      .ptbl thead th { background:#0D7C66; color:#fff; padding:5px 6px;
        font-weight:700; text-align:right; font-size:10px; }
      .ptbl tbody td { padding:4px 6px; border-bottom:1px solid #F1F5F9; text-align:right;
        color:#334155; }
      .ptbl tbody tr:nth-child(even) td { background:#F8FAFC; }
      .ptbl tfoot th { background:#FFF8E1; color:#8A6A12; padding:5px 6px;
        text-align:right; font-size:10.5px; border-top:2px solid #D4A95E; }
      .row-tag { display:inline-block; width:8px; height:8px; border-radius:2px;
        vertical-align:middle; margin-inline-start:4px; }

      .db-foot { margin-top:6px; text-align:center; font-size:9px; color:#94A3B8; }
    </style>
  `;
}
      .kpi-title { font-size:12px; font-weight:800; margin-bottom:4px; color:#8A6A12; }
      .kpi-row { display:flex; justify-content:space-between; padding:3px 0;
        border-bottom:1px dashed #E2E8F0; font-size:10.5px; }
      .kpi-row:last-child { border-bottom:none; padding-top:5px; }
      .kpi-row.net { font-weight:800; }

      .mm-foot { margin-top:6px; text-align:center; font-size:9px; color:#94A3B8; }
    </style>
  `;
}

export async function exportMindMapReport(): Promise<void> {
  const data = await gatherData();
  const html = buildHtml(data);
  await printHtmlDocument(html, "الخريطة-الذهنية-الشاملة");
}