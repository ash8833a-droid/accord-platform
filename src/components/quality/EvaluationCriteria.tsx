import { useMemo, useState } from "react";
import { COMMITTEES, committeeByType, type CommitteeType } from "@/lib/committees";
import {
  EVALUATION_CRITERIA,
  PRIORITY_LABELS,
  PRIORITY_TONE,
  SCORE_SCALE,
  type EvaluationCriterion,
} from "@/lib/evaluation-criteria";
import { PHASE_LABELS } from "@/lib/pmp-tasks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClipboardList, Printer, FileSpreadsheet, ShieldCheck, Star, Layers, Target } from "lucide-react";
import * as XLSX from "xlsx";

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}

export function EvaluationCriteria() {
  const [active, setActive] = useState<CommitteeType>("supreme");

  const totals = useMemo(() => {
    let totalCriteria = 0;
    let totalCritical = 0;
    Object.values(EVALUATION_CRITERIA).forEach((arr) => {
      totalCriteria += arr.length;
      totalCritical += arr.filter((c) => c.priority === "critical").length;
    });
    return { totalCriteria, totalCritical, totalCommittees: Object.keys(EVALUATION_CRITERIA).length };
  }, []);

  const sorted = (rows: EvaluationCriterion[]) =>
    [...rows].sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2 } as const;
      if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority];
      return b.weight - a.weight;
    });

  const exportXLSX = () => {
    const wb = XLSX.utils.book_new();
    (Object.keys(EVALUATION_CRITERIA) as CommitteeType[]).forEach((t) => {
      const c = committeeByType(t);
      const rows = sorted(EVALUATION_CRITERIA[t]).map((r, i) => ({
        "#": i + 1,
        "الرمز": r.code,
        "البند": r.title,
        "الوصف": r.description,
        "الوزن (%)": r.weight,
        "الأولوية": PRIORITY_LABELS[r.priority],
        "المرحلة": PHASE_LABELS[r.phase],
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{ wch: 4 }, { wch: 8 }, { wch: 38 }, { wch: 60 }, { wch: 10 }, { wch: 10 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws, (c?.label ?? t).slice(0, 28));
    });
    XLSX.writeFile(wb, "معايير-تقييم-اللجان.xlsx");
  };

  const printAll = () => {
    const w = window.open("", "_blank", "width=1100,height=800");
    if (!w) return;
    const blocks = (Object.keys(EVALUATION_CRITERIA) as CommitteeType[])
      .map((t) => {
        const c = committeeByType(t)!;
        const rows = sorted(EVALUATION_CRITERIA[t]);
        return `
          <section class="cmt">
            <h2>${escapeHtml(c.label)}</h2>
            <p class="desc">${escapeHtml(c.description ?? "")}</p>
            <table>
              <thead>
                <tr>
                  <th style="width:36px">#</th>
                  <th style="width:60px">الرمز</th>
                  <th>البند</th>
                  <th>الوصف</th>
                  <th style="width:70px">الوزن</th>
                  <th style="width:80px">الأولوية</th>
                  <th style="width:100px">المرحلة</th>
                  <th style="width:80px">التقييم<br/><span style="font-weight:400">(0-5)</span></th>
                </tr>
              </thead>
              <tbody>
                ${rows
                  .map(
                    (r, i) => `
                    <tr class="${r.priority}">
                      <td>${i + 1}</td>
                      <td><b>${r.code}</b></td>
                      <td>${escapeHtml(r.title)}</td>
                      <td class="desc-cell">${escapeHtml(r.description)}</td>
                      <td style="text-align:center"><b>${r.weight}%</b></td>
                      <td style="text-align:center">${PRIORITY_LABELS[r.priority]}</td>
                      <td style="text-align:center">${PHASE_LABELS[r.phase]}</td>
                      <td></td>
                    </tr>`,
                  )
                  .join("")}
              </tbody>
            </table>
          </section>`;
      })
      .join("");

    const date = new Date().toLocaleString("ar-SA-u-ca-gregory");
    w.document.write(`<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
<title>معايير وبنود تقييم لجان الزواج الجماعي الثاني عشر</title>
<style>
  *{box-sizing:border-box} body{font-family:'Segoe UI',Tahoma,sans-serif;margin:24px;color:#1a1a1a}
  header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #B8860B;padding-bottom:12px;margin-bottom:20px}
  h1{margin:0;color:#0E3A42;font-size:22px}
  .meta{font-size:12px;color:#555}
  .scale{background:#FAF6EE;border:1px solid #E8DAB6;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px}
  .scale b{color:#0E3A42}
  .cmt{margin-bottom:28px;page-break-inside:avoid}
  .cmt h2{background:linear-gradient(90deg,#0E3A42,#1B5560);color:#fff;padding:8px 14px;margin:0 0 4px;border-radius:6px;font-size:16px}
  .desc{color:#555;font-size:12px;margin:4px 0 8px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#F4F0E6;color:#0E3A42;padding:8px 6px;border:1px solid #DDD;text-align:right}
  td{padding:8px 6px;border:1px solid #DDD;vertical-align:top}
  .desc-cell{color:#444;font-size:11.5px}
  tr.critical{background:#FEF1F1}
  tr.high{background:#FFF8EC}
  footer{margin-top:30px;border-top:2px solid #B8860B;padding-top:14px;display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#555}
  .stamp{border:2px dashed #0E3A42;color:#0E3A42;padding:10px 22px;border-radius:50%;font-weight:700;text-align:center;line-height:1.3}
  @media print{ .cmt{page-break-after:auto} }
</style></head>
<body>
  <header>
    <div>
      <h1>معايير وبنود تقييم اللجان</h1>
      <div class="meta">لجان الزواج الجماعي الثاني عشر</div>
    </div>
    <div class="meta">${escapeHtml(date)}</div>
  </header>
  <div class="scale">
    <b>سُلَّم التقييم:</b>
    ${SCORE_SCALE.map((s) => `${s.value} = ${s.label} (${s.desc})`).join(" &nbsp;•&nbsp; ")}
  </div>
  ${blocks}
  <footer>
    <div>التقييم النهائي للجنة = Σ (التقييم × الوزن) ÷ 5</div>
    <div class="stamp">ختم<br/>لجنة الجودة</div>
  </footer>
  <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body></html>`);
    w.document.close();
  };

  const meta = committeeByType(active);
  const rows = sorted(EVALUATION_CRITERIA[active]);
  const Icon = meta?.icon;
  const totalWeight = rows.reduce((s, r) => s + r.weight, 0);

  return (
    <Card className="border-primary/20 shadow-elegant">
      <CardHeader className="border-b bg-gradient-to-l from-primary/5 to-transparent">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <CardTitle className="text-lg">معايير وبنود تقييم اللجان</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                لجان الزواج الجماعي الثاني عشر — مرتبة حسب الأهمية والأولوية
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportXLSX}>
              <FileSpreadsheet className="ml-1 size-4" /> تصدير Excel
            </Button>
            <Button size="sm" onClick={printAll} className="bg-gradient-hero text-primary-foreground">
              <Printer className="ml-1 size-4" /> طباعة شاملة
            </Button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
          <KPI icon={<Layers className="size-4" />} label="عدد اللجان" value={`${totals.totalCommittees}`} />
          <KPI icon={<ClipboardList className="size-4" />} label="إجمالي البنود" value={`${totals.totalCriteria}`} />
          <KPI icon={<Target className="size-4" />} label="بنود حرجة" value={`${totals.totalCritical}`} tone="rose" />
          <KPI icon={<Star className="size-4" />} label="سُلَّم التقييم" value="0 — 5" tone="amber" />
        </div>

        {/* Score scale legend */}
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          {SCORE_SCALE.map((s) => (
            <span
              key={s.value}
              className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-muted-foreground"
            >
              <b className="text-foreground">{s.value}</b> · {s.label}
            </span>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-3 md:p-5">
        <Tabs value={active} onValueChange={(v) => setActive(v as CommitteeType)}>
          <div className="overflow-x-auto -mx-1 px-1">
            <TabsList className="flex w-max gap-1 bg-muted/50 p-1">
              {COMMITTEES.map((c) => {
                const TIcon = c.icon;
                return (
                  <TabsTrigger
                    key={c.type}
                    value={c.type}
                    className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1.5"
                  >
                    <TIcon className="size-3.5" />
                    <span className="text-xs">{c.label}</span>
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                      {EVALUATION_CRITERIA[c.type].length}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {COMMITTEES.map((c) => (
            <TabsContent key={c.type} value={c.type} className="mt-4">
              {/* Committee header card */}
              <div className="mb-4 rounded-xl border bg-gradient-to-l from-primary/5 to-transparent p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3">
                    {Icon && active === c.type && (
                      <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        <Icon className="size-5" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-base">{c.label}</h3>
                      {c.description && (
                        <p className="text-xs text-muted-foreground mt-1 max-w-2xl">{c.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    إجمالي الأوزان:{" "}
                    <b className={totalWeight === 100 ? "text-emerald-600" : "text-amber-600"}>{totalWeight}%</b>
                  </div>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {rows.map((r, i) => (
                  <div key={r.code} className="rounded-lg border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-primary/10 px-1.5 text-xs font-bold text-primary">
                          {i + 1}
                        </span>
                        <b className="text-sm">{r.title}</b>
                      </div>
                      <span className="text-xs font-bold text-shimmer-gold">{r.weight}%</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{r.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className={`text-[10px] ${PRIORITY_TONE[r.priority]}`}>
                        {PRIORITY_LABELS[r.priority]}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {PHASE_LABELS[r.phase]}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {r.code}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs">
                    <tr>
                      <th className="p-2 text-right w-10">#</th>
                      <th className="p-2 text-right w-16">الرمز</th>
                      <th className="p-2 text-right">البند</th>
                      <th className="p-2 text-right">الوصف</th>
                      <th className="p-2 text-center w-20">الوزن</th>
                      <th className="p-2 text-center w-24">الأولوية</th>
                      <th className="p-2 text-center w-28">المرحلة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.code} className="border-t hover:bg-muted/20">
                        <td className="p-2 text-center text-muted-foreground">{i + 1}</td>
                        <td className="p-2">
                          <span className="font-mono text-xs font-bold text-primary">{r.code}</span>
                        </td>
                        <td className="p-2 font-medium">{r.title}</td>
                        <td className="p-2 text-xs text-muted-foreground leading-relaxed">{r.description}</td>
                        <td className="p-2 text-center">
                          <span className="inline-flex h-7 min-w-12 items-center justify-center rounded-md bg-shimmer-gold/15 px-2 text-xs font-bold text-shimmer-gold">
                            {r.weight}%
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          <Badge variant="outline" className={`text-[10px] ${PRIORITY_TONE[r.priority]}`}>
                            {PRIORITY_LABELS[r.priority]}
                          </Badge>
                        </td>
                        <td className="p-2 text-center">
                          <Badge variant="secondary" className="text-[10px]">
                            {PHASE_LABELS[r.phase]}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="mt-5 rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground leading-relaxed">
          <b className="text-foreground">طريقة الاحتساب:</b> لكل بند يُمنح تقييم من 0 إلى 5 حسب السُّلَّم أعلاه، ثم
          يُحسب التقييم النهائي للّجنة بمعادلة:{" "}
          <span className="font-mono text-foreground">Σ (التقييم × الوزن) ÷ 5</span>. البنود ذات الأولوية الحرجة لها
          الأثر الأكبر على نتيجة اللجنة.
        </div>
      </CardContent>
    </Card>
  );
}

function KPI({
  icon,
  label,
  value,
  tone = "primary",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "primary" | "rose" | "amber";
}) {
  const tones = {
    primary: "bg-primary/10 text-primary border-primary/20",
    rose: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    amber: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  } as const;
  return (
    <div className={`rounded-lg border p-2.5 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-[11px] opacity-80">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}
