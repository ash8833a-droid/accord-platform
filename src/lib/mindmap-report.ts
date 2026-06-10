import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { printHtmlDocument } from "@/lib/print-frame";
import { COMMITTEES, type CommitteeType } from "@/lib/committees";
import { buildReferenceNumber, fmtArDate } from "@/lib/report-shared";

const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(Math.round(n));

// Vibrant pastel palette per committee (background, border, accent)
const PALETTE: Record<CommitteeType, { bg: string; bd: string; ic: string; emoji: string }> = {
  supreme:     { bg: "#FFF8E1", bd: "#E0B84A", ic: "#8A6A12", emoji: "👑" },
  finance:     { bg: "#E6F6EF", bd: "#1F9D6B", ic: "#0B6A47", emoji: "💰" },
  women:       { bg: "#FCE7F3", bd: "#DB2777", ic: "#9D174D", emoji: "🌸" },
  media:       { bg: "#FFE4E6", bd: "#E11D48", ic: "#9F1239", emoji: "📣" },
  reception:   { bg: "#FFE7F0", bd: "#EC4899", ic: "#9D174D", emoji: "🤝" },
  programs:    { bg: "#EDE9FE", bd: "#7C3AED", ic: "#4C1D95", emoji: "📅" },
  quality:     { bg: "#E0F2FE", bd: "#0284C7", ic: "#075985", emoji: "🛡️" },
  dinner:      { bg: "#FEF3C7", bd: "#D97706", ic: "#92400E", emoji: "🍽️" },
  procurement: { bg: "#FFEDD5", bd: "#EA580C", ic: "#9A3412", emoji: "🛒" },
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
  revenueBreakdown: { label: string; amount: number }[];
  totalExpense: number;
  expenseBreakdown: { label: string; amount: number; count: number }[];
  paidExpense: number;
}

async function gatherData(): Promise<MindMapData> {
  const [{ data: coms }, { data: tasks }, { data: items }, { data: contribs }, { data: prs }] = await Promise.all([
    supabase.from("committees").select("id, name, type, budget_allocated, budget_spent"),
    supabase.from("committee_tasks").select("committee_id, status"),
    supabase.from("budget_items").select("committee_id, total_cost"),
    supabase.from("family_contributions").select("amount"),
    supabase.from("payment_requests").select("amount, status, committee_id"),
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
  const revenueBreakdown = [
    { label: "مساهمات أفراد القبيلة", amount: totalRevenue },
  ];

  // Expenses: split by status
  const byStatus: Record<string, { count: number; sum: number }> = {};
  (prs ?? []).forEach((p: any) => {
    const s = p.status ?? "pending";
    byStatus[s] = byStatus[s] ?? { count: 0, sum: 0 };
    byStatus[s].count += 1;
    byStatus[s].sum += Number(p.amount ?? 0);
  });
  const statusLabel: Record<string, string> = {
    pending: "قيد المراجعة", approved: "معتمدة", paid: "مصروفة", rejected: "مرفوضة",
  };
  const expenseBreakdown = Object.entries(byStatus)
    .filter(([s]) => s !== "rejected")
    .map(([s, v]) => ({ label: statusLabel[s] ?? s, amount: v.sum, count: v.count }));
  const totalExpense = expenseBreakdown.reduce((a, b) => a + b.amount, 0);
  const paidExpense = byStatus.paid?.sum ?? 0;

  return { committees, totalRevenue, revenueBreakdown, totalExpense, expenseBreakdown, paidExpense };
}

function buildHtml(d: MindMapData): string {
  const ref = buildReferenceNumber("MIND");
  const today = fmtArDate(new Date());

  // Order committees to match COMMITTEES catalog order so layout is stable
  const ordered = COMMITTEES
    .map((m) => d.committees.find((c) => c.type === m.type))
    .filter((x): x is CommitteeAgg => !!x);
  const n = ordered.length || 1;

  // Canvas geometry — fits inside A4 portrait content (~688 x 1017)
  const W = 680, H = 660;          // mind-map canvas
  const cx = W / 2, cy = H / 2 + 6;
  const rX = 260, rY = 230;        // elliptical radial spread
  const cardW = 160, cardH = 78;

  const nodes = ordered.map((c, i) => {
    // Start at the top (angle = -90deg) and go clockwise
    const ang = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
    const nx = cx + rX * Math.cos(ang);
    const ny = cy + rY * Math.sin(ang);
    return { c, ang, nx, ny };
  });

  const curves = nodes.map(({ nx, ny }) => {
    // Build a soft S-curve from center to each node
    const mx = (cx + nx) / 2;
    const my = (cy + ny) / 2;
    const dx = nx - cx, dy = ny - cy;
    // Perpendicular offset for the bend
    const off = 22;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len * off;
    const py = dx / len * off;
    return `<path d="M ${cx} ${cy} Q ${mx + px} ${my + py} ${nx} ${ny}" fill="none" stroke="url(#branch)" stroke-width="2.2" stroke-linecap="round" opacity="0.85" />`;
  }).join("");

  const leafCards = nodes.map(({ c, nx, ny }) => {
    const p = PALETTE[c.type];
    const x = nx - cardW / 2;
    const y = ny - cardH / 2;
    const pct = c.tasksTotal > 0 ? Math.round((c.tasksDone / c.tasksTotal) * 100) : 0;
    return `
      <div class="leaf" style="left:${x}px; top:${y}px; width:${cardW}px; height:${cardH}px; background:${p.bg}; border-color:${p.bd}; color:${p.ic};">
        <div class="leaf-head">
          <span class="leaf-emoji">${p.emoji}</span>
          <span class="leaf-name">${c.name}</span>
        </div>
        <div class="leaf-stats">
          <span>المهام <b>${c.tasksDone}/${c.tasksTotal}</b></span>
          <span>الإنجاز <b>${pct}%</b></span>
        </div>
        <div class="leaf-stats">
          <span>بنود <b>${c.budgetItems}</b></span>
          <span>مخصص <b>${fmt(c.allocated)}</b></span>
        </div>
      </div>`;
  }).join("");

  const revRows = d.revenueBreakdown.map((r) => `
    <tr><td>${r.label}</td><td style="text-align:left"><b>${fmt(r.amount)} ر.س</b></td></tr>`).join("");
  const expRows = d.expenseBreakdown.map((e) => `
    <tr><td>${e.label} <span class="muted">(${e.count})</span></td><td style="text-align:left"><b>${fmt(e.amount)} ر.س</b></td></tr>`).join("");
  const net = d.totalRevenue - d.paidExpense;

  const totalAlloc = ordered.reduce((a, c) => a + c.allocated, 0);
  const totalTasks = ordered.reduce((a, c) => a + c.tasksTotal, 0);
  const totalDone = ordered.reduce((a, c) => a + c.tasksDone, 0);
  const totalItems = ordered.reduce((a, c) => a + c.budgetItems, 0);

  return `
    <div dir="rtl" class="mm">
      <!-- Header -->
      <header class="mm-hdr">
        <img src="${logo}" class="mm-logo" alt="logo" />
        <div class="mm-titles">
          <p class="mm-kicker">كشاف ذهني تنفيذي · صفحة واحدة</p>
          <h1>الخريطة الذهنية الشاملة للجان</h1>
          <p class="mm-meta">المهام · خطة العمل · الميزانيات · الإيرادات · المصروفات — ${today}</p>
        </div>
        <div class="mm-ref">
          <span class="mm-ref-label">مرجع</span>
          <b>${ref}</b>
        </div>
      </header>

      <!-- Mind map canvas -->
      <div class="canvas" style="width:${W}px; height:${H}px;">
        <svg class="svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
          <defs>
            <radialGradient id="bg" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stop-color="#FFFDF7" />
              <stop offset="100%" stop-color="#F5F1E6" stop-opacity="0" />
            </radialGradient>
            <linearGradient id="branch" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#D4A95E" />
              <stop offset="100%" stop-color="#0D7C66" />
            </linearGradient>
            <radialGradient id="hub" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stop-color="#0D7C66" />
              <stop offset="100%" stop-color="#064F40" />
            </radialGradient>
            <pattern id="dots" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
              <circle cx="1.2" cy="1.2" r="1.2" fill="#0D7C66" fill-opacity="0.05"/>
            </pattern>
          </defs>
          <rect width="${W}" height="${H}" fill="url(#dots)" />
          <ellipse cx="${cx}" cy="${cy}" rx="${rX + 30}" ry="${rY + 30}" fill="url(#bg)" />
          ${curves}
          <!-- Hub -->
          <circle cx="${cx}" cy="${cy}" r="74" fill="url(#hub)" />
          <circle cx="${cx}" cy="${cy}" r="84" fill="none" stroke="#D4A95E" stroke-width="1.5" stroke-dasharray="3 4" opacity="0.7" />
        </svg>
        <!-- Hub label -->
        <div class="hub-label" style="left:${cx - 80}px; top:${cy - 40}px;">
          <div class="hub-crown">✦</div>
          <div class="hub-title">لجنة الزواج الجماعي</div>
          <div class="hub-sub">${ordered.length} لجان · ${totalTasks} مهمة</div>
        </div>
        ${leafCards}
      </div>

      <!-- Bottom finance + KPI strip -->
      <section class="bottom">
        <div class="fin-card rev">
          <div class="fin-head">
            <span class="fin-emoji">💵</span>
            <div>
              <div class="fin-title">الإيرادات</div>
              <div class="fin-sub">جميع مصادر الدخل</div>
            </div>
            <div class="fin-total">${fmt(d.totalRevenue)} ر.س</div>
          </div>
          <table class="fin-tbl">${revRows || `<tr><td colspan="2" class="muted">لا توجد إيرادات مسجلة</td></tr>`}</table>
        </div>

        <div class="fin-card exp">
          <div class="fin-head">
            <span class="fin-emoji">💸</span>
            <div>
              <div class="fin-title">المصروفات</div>
              <div class="fin-sub">طلبات الصرف بحسب الحالة</div>
            </div>
            <div class="fin-total">${fmt(d.totalExpense)} ر.س</div>
          </div>
          <table class="fin-tbl">${expRows || `<tr><td colspan="2" class="muted">لا توجد طلبات صرف</td></tr>`}</table>
        </div>

        <div class="kpi-card">
          <div class="kpi-title">المؤشرات التنفيذية</div>
          <div class="kpi-row"><span>إجمالي بنود الموازنة</span><b>${fmt(totalItems)}</b></div>
          <div class="kpi-row"><span>إجمالي المخصص</span><b>${fmt(totalAlloc)} ر.س</b></div>
          <div class="kpi-row"><span>المهام المنجزة</span><b>${totalDone}/${totalTasks}</b></div>
          <div class="kpi-row net" style="color:${net >= 0 ? "#0B6A47" : "#9F1239"}">
            <span>الرصيد الصافي (مصروف − إيراد)</span><b>${fmt(net)} ر.س</b>
          </div>
        </div>
      </section>

      <p class="mm-foot">منظومة لجنة الزواج الجماعي · ${ref} · كشاف ذهني لصفحة واحدة</p>
    </div>

    <style>
      @page { size: A4 portrait; margin: 10mm 9mm 10mm; }
      @media print { html, body { margin:0; background:#fff; } }
      .mm {
        font-family: 'Noto Naskh Arabic','Segoe UI','Tahoma',sans-serif;
        color:#0F172A; direction: rtl; background:#fff;
        width: 100%;
      }
      .mm * { box-sizing: border-box; }

      .mm-hdr { display:flex; align-items:center; gap:12px;
        border-bottom:2px solid #0D7C66; padding-bottom:8px; margin-bottom:8px; }
      .mm-logo { width:48px; height:48px; object-fit:contain; }
      .mm-titles { flex:1; }
      .mm-kicker { margin:0; font-size:9.5px; letter-spacing:1.4px; font-weight:700; color:#0D7C66; }
      .mm-titles h1 { margin:2px 0; font-size:18px; font-weight:800; }
      .mm-meta { margin:0; font-size:10.5px; color:#64748B; }
      .mm-ref { font-size:10px; color:#334155; border:1px solid #E2E8F0; border-radius:8px;
        padding:6px 10px; text-align:left; min-width:140px; }
      .mm-ref-label { font-size:9px; color:#64748B; display:block; }
      .mm-ref b { color:#0D7C66; font-size:11px; }

      .canvas { position:relative; margin:0 auto; }
      .svg { position:absolute; inset:0; width:100%; height:100%; }

      .hub-label { position:absolute; width:160px; text-align:center; color:#fff;
        display:flex; flex-direction:column; align-items:center; justify-content:center; }
      .hub-crown { font-size:18px; color:#D4A95E; line-height:1; margin-bottom:2px; }
      .hub-title { font-size:14px; font-weight:800; line-height:1.2; }
      .hub-sub { font-size:10.5px; color:#FFEDD5; margin-top:4px; opacity:0.95; }

      .leaf { position:absolute; border:2px solid; border-radius:14px;
        padding:6px 10px; box-shadow:0 4px 10px -4px rgba(15,23,42,0.18);
        display:flex; flex-direction:column; justify-content:space-between; }
      .leaf-head { display:flex; align-items:center; gap:6px; }
      .leaf-emoji { font-size:14px; line-height:1; }
      .leaf-name { font-size:11.5px; font-weight:800; line-height:1.15; }
      .leaf-stats { display:flex; justify-content:space-between; font-size:9.5px; opacity:0.92; }
      .leaf-stats b { font-weight:800; }

      .bottom { display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px; margin-top:8px; }
      .fin-card { border:1px solid #E2E8F0; border-radius:12px; padding:8px 10px;
        background:#fff; page-break-inside: avoid; }
      .fin-card.rev { border-top:4px solid #1F9D6B; background: linear-gradient(180deg,#E6F6EF22,#fff); }
      .fin-card.exp { border-top:4px solid #E11D48; background: linear-gradient(180deg,#FEE2E222,#fff); }
      .fin-head { display:flex; align-items:center; gap:8px; margin-bottom:4px; }
      .fin-emoji { font-size:18px; }
      .fin-title { font-size:12px; font-weight:800; }
      .fin-sub { font-size:9.5px; color:#64748B; }
      .fin-total { margin-inline-start:auto; font-size:12.5px; font-weight:800; color:#0D7C66; }
      .fin-tbl { width:100%; border-collapse:collapse; font-size:10px; }
      .fin-tbl td { padding:3px 4px; border-bottom:1px dashed #E2E8F0; }
      .fin-tbl td:last-child { text-align:left; color:#334155; }
      .muted { color:#94A3B8; font-size:10px; }

      .kpi-card { border:1px solid #E2E8F0; border-radius:12px; padding:8px 10px;
        background: linear-gradient(180deg,#FFF8E1,#fff); border-top:4px solid #D4A95E; }
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