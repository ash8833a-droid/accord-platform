import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, Beef, ClipboardList, Calendar, Phone, PackagePlus, Ticket } from "lucide-react";

interface GroomRow {
  id: string;
  full_name: string;
  family_branch: string;
  phone: string;
  wedding_date: string | null;
  extra_sheep: number;
  extra_cards_men: number;
  extra_cards_women: number;
  special_requests: string | null;
}

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" }) : "—";

export function GroomExtraRequests() {
  const [rows, setRows] = useState<GroomRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("grooms")
        .select("id,full_name,family_branch,phone,wedding_date,extra_sheep,extra_cards_men,extra_cards_women,special_requests")
        .in("status", ["approved", "completed"])
        .order("wedding_date", { ascending: true, nullsFirst: false });
      if (!cancelled) {
        setRows((data ?? []) as GroomRow[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = rows.filter(
    (g) => (g.extra_sheep ?? 0) > 0 || (g.extra_cards_men ?? 0) > 0 || (g.extra_cards_women ?? 0) > 0,
  );

  const totals = filtered.reduce(
    (acc, g) => ({
      sheep: acc.sheep + (g.extra_sheep ?? 0),
      men: acc.men + (g.extra_cards_men ?? 0),
      women: acc.women + (g.extra_cards_women ?? 0),
    }),
    { sheep: 0, men: 0, women: 0 },
  );

  return (
    <div className="rounded-2xl border-2 bg-gradient-to-br from-orange-500/10 to-amber-500/5 border-orange-500/30 p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-11 w-11 rounded-xl bg-background/80 flex items-center justify-center shrink-0">
            <PackagePlus className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-base flex items-center gap-2 flex-wrap">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              طلبات الزيادة من العرسان
              <Badge variant="outline" className="bg-background/60">{filtered.length}</Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              العرسان المعتمدون الذين طلبوا ذبائح أو كروت إضافية زيادة على المخصص
            </p>
          </div>
        </div>
        {filtered.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            {totals.sheep > 0 && (
              <span className="inline-flex items-center gap-1 bg-orange-600 text-white rounded-lg px-3 py-1.5">
                <Beef className="h-3 w-3" /> إجمالي الذبائح: {totals.sheep}
              </span>
            )}
            {totals.men > 0 && (
              <span className="inline-flex items-center gap-1 bg-sky-600 text-white rounded-lg px-3 py-1.5">
                <Ticket className="h-3 w-3" /> كروت رجال: {totals.men}
              </span>
            )}
            {totals.women > 0 && (
              <span className="inline-flex items-center gap-1 bg-fuchsia-600 text-white rounded-lg px-3 py-1.5">
                <Ticket className="h-3 w-3" /> كروت نساء: {totals.women}
              </span>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground bg-background/40 rounded-xl border border-dashed">
          لا توجد طلبات زيادة من العرسان حالياً
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((g) => (
            <div key={g.id} className="rounded-xl border bg-background/70 backdrop-blur p-3 hover:bg-background transition-colors space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span className="font-bold truncate">{g.full_name}</span>
                  <span className="text-xs text-muted-foreground">· {g.family_branch}</span>
                  {(g.extra_sheep ?? 0) > 0 && (
                    <Badge className="bg-orange-600 text-white hover:bg-orange-700">
                      <Beef className="h-3 w-3 ms-1" /> +{g.extra_sheep} ذبيحة
                    </Badge>
                  )}
                  {(g.extra_cards_men ?? 0) > 0 && (
                    <Badge className="bg-sky-600 text-white hover:bg-sky-700">
                      <Ticket className="h-3 w-3 ms-1" /> +{g.extra_cards_men} كرت رجال
                    </Badge>
                  )}
                  {(g.extra_cards_women ?? 0) > 0 && (
                    <Badge className="bg-fuchsia-600 text-white hover:bg-fuchsia-700">
                      <Ticket className="h-3 w-3 ms-1" /> +{g.extra_cards_women} كرت نساء
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(g.wedding_date)}</span>
                  <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{g.phone}</span>
                </div>
              </div>
              {g.special_requests && (
                <div className="rounded-lg bg-muted/40 border p-2 text-xs whitespace-pre-line leading-relaxed">
                  <span className="font-bold">طلبات خاصة: </span>{g.special_requests}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}