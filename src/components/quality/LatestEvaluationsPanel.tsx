import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { COMMITTEES, committeeByType, type CommitteeType } from "@/lib/committees";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Star, RefreshCw, User2, Calendar, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EvalRow {
  id: string;
  committee_type: CommitteeType;
  evaluator_name: string;
  final_score: number;
  percentage: number;
  grade: string;
  answered_count: number;
  total_count: number;
  is_complete: boolean;
  general_note: string | null;
  created_at: string;
}

function gradeTone(pct: number) {
  if (pct >= 95) return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  if (pct >= 80) return "bg-sky-500/15 text-sky-700 border-sky-500/30";
  if (pct >= 65) return "bg-amber-500/15 text-amber-700 border-amber-500/30";
  if (pct >= 50) return "bg-orange-500/15 text-orange-700 border-orange-500/30";
  return "bg-rose-500/15 text-rose-700 border-rose-500/30";
}

export function LatestEvaluationsPanel() {
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("committee_evaluations")
      .select("id, committee_type, evaluator_name, final_score, percentage, grade, answered_count, total_count, is_complete, general_note, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data ?? []) as EvalRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("committee_evaluations_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "committee_evaluations" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // أحدث تقييم لكل لجنة
  const latestByCommittee = useMemo(() => {
    const map = new Map<CommitteeType, EvalRow>();
    for (const r of rows) {
      if (!map.has(r.committee_type)) map.set(r.committee_type, r);
    }
    return map;
  }, [rows]);

  return (
    <Card className="border-primary/20 shadow-soft">
      <CardHeader className="border-b bg-gradient-to-l from-primary/5 to-transparent">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Star className="size-5" />
            </div>
            <div>
              <CardTitle className="text-lg">أحدث تقييمات اللجان</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                مرتبط تلقائياً بنموذج تقييم اللجان — يعرض آخر تقييم لكل لجنة مع التاريخ والمصدر.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`ml-1 size-4 ${loading ? "animate-spin" : ""}`} /> تحديث
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 md:p-5">
        {loading && rows.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">جارٍ التحميل…</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            لا توجد تقييمات محفوظة بعد. ابدأ من تبويب "تقييم اللجان" واضغط "حفظ في التقارير".
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {COMMITTEES.map((c) => {
              const r = latestByCommittee.get(c.type);
              const Icon = c.icon;
              const history = rows.filter((x) => x.committee_type === c.type);
              return (
                <div key={c.type} className="rounded-xl border p-3 bg-card">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`rounded-lg p-2 ${c.tone}`}>
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{c.label}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {history.length > 0 ? `${history.length} تقييم محفوظ` : "لا توجد تقييمات"}
                        </div>
                      </div>
                    </div>
                    {r && (
                      <Badge variant="outline" className={`text-[10px] ${gradeTone(r.percentage)}`}>
                        <Trophy className="size-3 ml-1" /> {r.grade}
                      </Badge>
                    )}
                  </div>

                  {r ? (
                    <>
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">النسبة</span>
                        <b className="text-foreground">
                          {Number(r.percentage).toFixed(1)}% · {Number(r.final_score).toFixed(1)} / 100
                        </b>
                      </div>
                      <Progress value={Number(r.percentage)} className="h-2 mt-1" />
                      <div className="mt-3 flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <User2 className="size-3" /> {r.evaluator_name}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="size-3" />
                          {new Date(r.created_at).toLocaleString("ar-SA-u-ca-gregory")}
                        </span>
                        {!r.is_complete && (
                          <Badge variant="secondary" className="text-[10px]">
                            تقييم جزئي ({r.answered_count}/{r.total_count})
                          </Badge>
                        )}
                      </div>
                      {r.general_note && (
                        <p className="mt-2 text-[11px] text-muted-foreground bg-muted/40 rounded px-2 py-1">
                          📝 {r.general_note}
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="mt-3 text-[11px] text-muted-foreground">
                      لم يُسجَّل أي تقييم لهذه اللجنة بعد.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
