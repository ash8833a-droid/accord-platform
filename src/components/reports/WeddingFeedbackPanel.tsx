import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Copy, ExternalLink, MessageSquareHeart, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Row {
  id: string;
  organization_score: number;
  hospitality_score: number;
  program_score: number;
  overall_score: number;
  suggestions: string | null;
  respondent_role: string | null;
  respondent_phone: string | null;
  created_at: string;
}

const LABELS: { key: keyof Row; label: string; tone: string }[] = [
  { key: "organization_score", label: "التنظيم والاستقبال", tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  { key: "hospitality_score", label: "الضيافة والعشاء", tone: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  { key: "program_score", label: "البرامج والفقرات", tone: "bg-violet-500/10 text-violet-700 border-violet-500/30" },
  { key: "overall_score", label: "الانطباع العام", tone: "bg-rose-500/10 text-rose-700 border-rose-500/30" },
];

export function WeddingFeedbackPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const link = typeof window !== "undefined" ? `${window.location.origin}/wedding-feedback` : "/wedding-feedback";

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("wedding_feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, []);

  const avg = (k: keyof Row) =>
    rows.length ? (rows.reduce((a, r) => a + (r[k] as number), 0) / rows.length) : 0;

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    toast.success("تم نسخ رابط الاستبيان");
  };

  return (
    <div className="rounded-2xl border bg-card shadow-soft overflow-hidden">
      <div className="px-6 py-4 border-b bg-gradient-to-l from-rose-500/5 via-amber-500/5 to-emerald-500/5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <MessageSquareHeart className="h-5 w-5 text-rose-600" />
          <h2 className="font-bold">استبيان رضا الضيوف عن الزواج الجماعي</h2>
          <Badge variant="outline" className="text-[10px]">{rows.length} تقييم</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={copy} className="gap-1.5 text-xs">
            <Copy className="h-3.5 w-3.5" /> نسخ رابط الاستبيان
          </Button>
          <Button size="sm" asChild className="gap-1.5 text-xs bg-gradient-to-l from-emerald-600 to-amber-500 text-white">
            <a href="/wedding-feedback" target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" /> فتح الاستبيان
            </a>
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {LABELS.map((l) => {
            const v = avg(l.key);
            return (
              <div key={l.key} className={`rounded-xl border p-4 ${l.tone}`}>
                <p className="text-xs font-bold">{l.label}</p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold">{v.toFixed(1)}</span>
                  <span className="text-xs opacity-70">/ 5</span>
                </div>
                <div className="flex gap-0.5 mt-1" dir="ltr">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`h-3.5 w-3.5 ${n <= Math.round(v) ? "fill-current" : "opacity-30"}`} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
            <MessageSquareHeart className="h-4 w-4 text-rose-600" /> آخر المقترحات
          </h3>
          {loading ? (
            <div className="py-6 text-center"><Loader2 className="h-5 w-5 inline animate-spin text-muted-foreground" /></div>
          ) : rows.filter((r) => r.suggestions).length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
              لا توجد مقترحات بعد. شارك رابط الاستبيان مع الحضور لجمع آراءهم.
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {rows.filter((r) => r.suggestions).slice(0, 50).map((r) => (
                <div key={r.id} className="rounded-xl border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground mb-1">
                    {r.respondent_role && <Badge variant="outline" className="text-[10px]">{r.respondent_role}</Badge>}
                    <span>{new Date(r.created_at).toLocaleDateString("ar-SA")}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-0.5">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                      {((r.organization_score + r.hospitality_score + r.program_score + r.overall_score) / 4).toFixed(1)}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{r.suggestions}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}