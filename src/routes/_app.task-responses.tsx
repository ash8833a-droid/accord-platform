import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ClipboardCheck,
  Loader2,
  Search,
  FileSpreadsheet,
  Printer,
  Filter,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import { COMMITTEES, committeeByType } from "@/lib/committees";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/task-responses")({
  component: TaskResponsesPage,
});

interface CommitteeRow {
  id: string;
  name: string;
  type: string;
}

interface TaskRow {
  id: string;
  title: string;
  committee_id: string;
  status: string;
  priority: string;
}

interface ResponseRow {
  id: string;
  task_id: string;
  committee_id: string;
  author_name: string;
  action_taken: string;
  outcomes: string | null;
  completion_percent: number;
  challenges: string | null;
  recommendations: string | null;
  execution_date: string | null;
  attachments_note: string | null;
  created_at: string;
}

interface JoinedRow extends ResponseRow {
  taskTitle: string;
  committeeName: string;
  committeeType: string;
}

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("ar-SA", { dateStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function splitPhase(title: string): string {
  const m = title.match(/^\s*\[([^\]]+)\]\s*(.*)$/);
  return m ? m[2].trim() : title;
}

function TaskResponsesPage() {
  const { hasRole, user } = useAuth();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const isAdmin = hasRole("admin");
  const isQuality = hasRole("quality");

  const [committees, setCommittees] = useState<CommitteeRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [progressFilter, setProgressFilter] = useState<"all" | "done" | "mid" | "low">("all");

  // Authorization check: admin, quality, or supreme committee member
  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!user) {
        setAuthorized(false);
        return;
      }
      if (isAdmin || isQuality) {
        if (active) setAuthorized(true);
        return;
      }
      // Check supreme committee membership
      const { data: supremeC } = await supabase
        .from("committees")
        .select("id")
        .eq("type", "supreme")
        .maybeSingle();
      if (!supremeC) {
        if (active) setAuthorized(false);
        return;
      }
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("committee_id", supremeC.id)
        .limit(1);
      if (active) setAuthorized((rolesData ?? []).length > 0);
    };
    check();
    return () => {
      active = false;
    };
  }, [user, isAdmin, isQuality]);

  const load = async () => {
    setLoading(true);
    const [{ data: cmts }, { data: tsk }, { data: rsp }] = await Promise.all([
      supabase.from("committees").select("id, name, type"),
      supabase.from("committee_tasks").select("id, title, committee_id, status, priority"),
      supabase
        .from("task_responses" as any)
        .select(
          "id, task_id, committee_id, author_name, action_taken, outcomes, completion_percent, challenges, recommendations, execution_date, attachments_note, created_at",
        )
        .order("created_at", { ascending: false }),
    ]);
    setCommittees((cmts ?? []) as CommitteeRow[]);
    setTasks((tsk ?? []) as TaskRow[]);
    setResponses(((rsp ?? []) as any) as ResponseRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (authorized) load();
  }, [authorized]);

  useEffect(() => {
    if (!authorized) return;
    const ch = supabase
      .channel("task_responses_global")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_responses" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [authorized]);

  const joined: JoinedRow[] = useMemo(() => {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const cmMap = new Map(committees.map((c) => [c.id, c]));
    return responses.map((r) => {
      const t = taskMap.get(r.task_id);
      const c = cmMap.get(r.committee_id);
      return {
        ...r,
        taskTitle: t ? splitPhase(t.title) : "—",
        committeeName: c?.name ?? "—",
        committeeType: c?.type ?? "",
      };
    });
  }, [responses, tasks, committees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return joined.filter((r) => {
      if (activeTab !== "all" && r.committeeType !== activeTab) return false;
      if (progressFilter === "done" && r.completion_percent !== 100) return false;
      if (progressFilter === "mid" && (r.completion_percent < 50 || r.completion_percent === 100))
        return false;
      if (progressFilter === "low" && r.completion_percent >= 50) return false;
      if (!q) return true;
      return (
        r.taskTitle.toLowerCase().includes(q) ||
        r.author_name.toLowerCase().includes(q) ||
        r.committeeName.toLowerCase().includes(q) ||
        r.action_taken.toLowerCase().includes(q) ||
        (r.outcomes ?? "").toLowerCase().includes(q)
      );
    });
  }, [joined, search, activeTab, progressFilter]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const avg =
      total === 0
        ? 0
        : Math.round(filtered.reduce((s, r) => s + r.completion_percent, 0) / total);
    const completed = filtered.filter((r) => r.completion_percent === 100).length;
    const inProgress = total - completed;
    return { total, avg, completed, inProgress };
  }, [filtered]);

  const exportXLSX = () => {
    const rows = filtered.map((r) => ({
      "اللجنة": r.committeeName,
      "المهمة": r.taskTitle,
      "العضو": r.author_name,
      "الإجراء": r.action_taken,
      "المخرجات": r.outcomes ?? "",
      "الإنجاز %": r.completion_percent,
      "التحديات": r.challenges ?? "",
      "التوصيات": r.recommendations ?? "",
      "تاريخ التنفيذ": r.execution_date ?? "",
      "تاريخ الرد": fmtDate(r.created_at),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ردود اللجان");
    XLSX.writeFile(wb, `task-responses-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const printReport = () => {
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("الرجاء السماح بفتح النوافذ المنبثقة");
      return;
    }
    const tabLabel =
      activeTab === "all"
        ? "جميع اللجان"
        : COMMITTEES.find((c) => c.type === activeTab)?.label ?? "—";
    const rowsHtml = filtered
      .map(
        (r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(r.committeeName)}</td>
        <td>${escapeHtml(r.taskTitle)}</td>
        <td>${escapeHtml(r.author_name)}</td>
        <td style="max-width:280px">${escapeHtml(r.action_taken)}</td>
        <td style="max-width:200px">${escapeHtml(r.outcomes ?? "")}</td>
        <td style="text-align:center"><span class="pct ${r.completion_percent === 100 ? "ok" : r.completion_percent >= 50 ? "mid" : "low"}">${r.completion_percent}%</span></td>
        <td>${escapeHtml(r.challenges ?? "")}</td>
        <td>${escapeHtml(r.recommendations ?? "")}</td>
        <td>${r.execution_date ?? ""}</td>
        <td>${fmtDate(r.created_at)}</td>
      </tr>`,
      )
      .join("");

    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
    <title>تقرير ردود اللجان — ${tabLabel}</title>
    <style>
      body{font-family:'Tajawal','Segoe UI',sans-serif;padding:24px;color:#1a1a1a}
      h1{margin:0 0 4px;font-size:22px;color:#7a5a17}
      .sub{color:#666;font-size:12px;margin-bottom:16px}
      .meta{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px}
      .kpi{border:1px solid #e6d9b8;background:#fbf7ec;border-radius:10px;padding:8px 14px;font-size:12px}
      .kpi b{display:block;font-size:18px;color:#7a5a17}
      table{width:100%;border-collapse:collapse;font-size:11.5px}
      th{background:linear-gradient(135deg,#c9a45e,#a8842f);color:#fff;padding:8px;text-align:right;font-weight:700}
      td{border:1px solid #e5e5e5;padding:6px;vertical-align:top;text-align:right}
      tr:nth-child(even) td{background:#fafafa}
      .pct{display:inline-block;padding:2px 8px;border-radius:999px;font-weight:bold;font-size:11px}
      .pct.ok{background:#d1fae5;color:#065f46}
      .pct.mid{background:#dbeafe;color:#1e3a8a}
      .pct.low{background:#fef3c7;color:#854d0e}
      .footer{margin-top:18px;padding-top:10px;border-top:1px solid #e5e5e5;font-size:11px;color:#777;text-align:center}
      @media print{ body{padding:8mm} }
    </style></head><body>
      <h1>تقرير ردود اللجان على المهام</h1>
      <div class="sub">${tabLabel} · ${new Date().toLocaleDateString("ar-SA")}</div>
      <div class="meta">
        <div class="kpi"><b>${stats.total}</b> إجمالي الردود</div>
        <div class="kpi"><b>${stats.completed}</b> مهام مكتملة</div>
        <div class="kpi"><b>${stats.inProgress}</b> قيد العمل</div>
        <div class="kpi"><b>${stats.avg}%</b> متوسط الإنجاز</div>
      </div>
      <table>
        <thead><tr>
          <th>#</th><th>اللجنة</th><th>المهمة</th><th>العضو</th>
          <th>الإجراء المتخذ</th><th>المخرجات</th><th>الإنجاز</th>
          <th>التحديات</th><th>التوصيات</th><th>تاريخ التنفيذ</th><th>تاريخ الرد</th>
        </tr></thead>
        <tbody>${rowsHtml || `<tr><td colspan="11" style="text-align:center;padding:20px;color:#999">لا توجد ردود</td></tr>`}</tbody>
      </table>
      <div class="footer">منصة لجنة الزواج الجماعي · تقرير رقابي للجنة العليا</div>
      <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300))</script>
    </body></html>`);
    w.document.close();
  };

  if (authorized === null) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!authorized) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-hero text-primary-foreground p-6 shadow-elegant">
        <div className="flex items-center gap-3 mb-2">
          <span className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur">
            <ClipboardCheck className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">ردود اللجان على المهام</h1>
            <p className="text-xs opacity-90 mt-0.5 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              عرض رقابي مخصص للجنة العليا · مدير النظام · لجنة الجودة
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <KPI label="إجمالي الردود" value={stats.total.toString()} />
          <KPI label="مهام مكتملة" value={stats.completed.toString()} />
          <KPI label="قيد العمل" value={stats.inProgress.toString()} />
          <KPI label="متوسط الإنجاز" value={`${stats.avg}%`} />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في الردود (لجنة، مهمة، عضو، إجراء...)"
            className="pe-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border bg-card p-0.5">
          {(
            [
              { v: "all", label: "الكل" },
              { v: "done", label: "مكتمل" },
              { v: "mid", label: "متوسط" },
              { v: "low", label: "منخفض" },
            ] as const
          ).map((p) => (
            <button
              key={p.v}
              type="button"
              onClick={() => setProgressFilter(p.v)}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors ${
                progressFilter === p.v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Button onClick={exportXLSX} size="sm" variant="outline" className="gap-1.5">
          <FileSpreadsheet className="h-4 w-4" /> Excel
        </Button>
        <Button onClick={printReport} size="sm" className="bg-gradient-gold text-gold-foreground gap-1.5">
          <Printer className="h-4 w-4" /> طباعة / PDF
        </Button>
      </div>

      {/* Tabs by committee */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto justify-start gap-1 bg-muted/40 p-1">
          <TabsTrigger value="all" className="text-xs gap-1.5">
            <Filter className="h-3 w-3" /> الكل ({joined.length})
          </TabsTrigger>
          {COMMITTEES.map((cm) => {
            const count = joined.filter((r) => r.committeeType === cm.type).length;
            if (count === 0) return null;
            const Icon = cm.icon;
            return (
              <TabsTrigger key={cm.type} value={cm.type} className="text-xs gap-1.5">
                <Icon className="h-3 w-3" />
                {cm.label} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
              {/* Mobile: cards */}
              <div className="md:hidden divide-y">
                {filtered.map((r, i) => {
                  const meta = committeeByType(r.committeeType);
                  return (
                    <div key={r.id} className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] font-mono text-muted-foreground">
                            #{i + 1}
                          </span>
                          <Badge
                            variant="outline"
                            className={`${meta?.tone ?? "bg-muted"} text-[10px] font-bold border`}
                          >
                            {r.committeeName}
                          </Badge>
                        </div>
                        <Badge
                          className={`text-[10px] font-bold border ${
                            r.completion_percent === 100
                              ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/40"
                              : r.completion_percent >= 50
                                ? "bg-sky-500/15 text-sky-700 border-sky-500/40"
                                : "bg-amber-500/15 text-amber-700 border-amber-500/40"
                          }`}
                        >
                          {r.completion_percent}%
                        </Badge>
                      </div>
                      <p className="text-xs font-bold leading-snug">{r.taskTitle}</p>
                      <Progress value={r.completion_percent} className="h-1.5" />
                      <p className="text-[11px]">
                        <span className="font-bold text-foreground/70">العضو: </span>
                        {r.author_name}
                      </p>
                      <p className="text-[11px] bg-muted/40 rounded-md p-2">
                        <span className="font-bold">الإجراء: </span>
                        <span className="line-clamp-3 whitespace-pre-wrap">{r.action_taken}</span>
                      </p>
                      {r.outcomes && (
                        <p className="text-[11px] text-emerald-700">
                          <span className="font-bold">المخرجات: </span>
                          <span className="line-clamp-2 whitespace-pre-wrap">{r.outcomes}</span>
                        </p>
                      )}
                      {r.challenges && (
                        <p className="text-[11px] text-amber-700">
                          <span className="font-bold">التحديات: </span>
                          <span className="line-clamp-2 whitespace-pre-wrap">{r.challenges}</span>
                        </p>
                      )}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                        <span>تنفيذ: {r.execution_date ?? "—"}</span>
                        <span>رد: {fmtDate(r.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    لا توجد ردود مطابقة
                  </div>
                )}
              </div>

              {/* Desktop: table */}
              <div className="overflow-x-auto hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-l from-primary/10 to-primary/5 hover:bg-primary/10">
                      <TableHead className="text-right font-bold text-primary w-10">#</TableHead>
                      <TableHead className="text-right font-bold text-primary">اللجنة</TableHead>
                      <TableHead className="text-right font-bold text-primary">المهمة</TableHead>
                      <TableHead className="text-right font-bold text-primary">العضو</TableHead>
                      <TableHead className="text-right font-bold text-primary min-w-[180px]">الإجراء المتخذ</TableHead>
                      <TableHead className="text-right font-bold text-primary min-w-[140px]">المخرجات</TableHead>
                      <TableHead className="text-right font-bold text-primary">الإنجاز</TableHead>
                      <TableHead className="text-right font-bold text-primary min-w-[140px]">التحديات</TableHead>
                      <TableHead className="text-right font-bold text-primary min-w-[140px]">التوصيات</TableHead>
                      <TableHead className="text-right font-bold text-primary">تاريخ التنفيذ</TableHead>
                      <TableHead className="text-right font-bold text-primary">تاريخ الرد</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r, i) => {
                      const meta = committeeByType(r.committeeType);
                      return (
                        <TableRow key={r.id} className="hover:bg-muted/40">
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {i + 1}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className={`${meta?.tone ?? "bg-muted"} text-[10.5px] font-bold border`}
                            >
                              {r.committeeName}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs font-semibold max-w-[220px]">
                            <span className="line-clamp-2">{r.taskTitle}</span>
                          </TableCell>
                          <TableCell className="text-right text-xs">{r.author_name}</TableCell>
                          <TableCell className="text-right text-[11.5px] max-w-[260px]">
                            <span className="line-clamp-3 whitespace-pre-wrap">{r.action_taken}</span>
                          </TableCell>
                          <TableCell className="text-right text-[11.5px] text-muted-foreground max-w-[200px]">
                            <span className="line-clamp-3 whitespace-pre-wrap">{r.outcomes ?? "—"}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              className={`text-[11px] font-bold border ${
                                r.completion_percent === 100
                                  ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/40"
                                  : r.completion_percent >= 50
                                    ? "bg-sky-500/15 text-sky-700 border-sky-500/40"
                                    : "bg-amber-500/15 text-amber-700 border-amber-500/40"
                              }`}
                            >
                              {r.completion_percent}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-[11.5px] text-amber-700 max-w-[200px]">
                            <span className="line-clamp-3 whitespace-pre-wrap">{r.challenges ?? "—"}</span>
                          </TableCell>
                          <TableCell className="text-right text-[11.5px] text-sky-700 max-w-[200px]">
                            <span className="line-clamp-3 whitespace-pre-wrap">{r.recommendations ?? "—"}</span>
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {r.execution_date ?? "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {fmtDate(r.created_at)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-12 text-muted-foreground text-sm">
                          لا توجد ردود مطابقة لمعايير البحث
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/15 backdrop-blur px-4 py-3 border border-white/20">
      <p className="text-[11px] opacity-80">{label}</p>
      <p className="font-bold text-2xl mt-1">{value}</p>
    </div>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}