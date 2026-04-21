import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users2, Search, TreePine, Coins } from "lucide-react";
import { HistoricalShares } from "./HistoricalShares";

interface Subscriber {
  id: string;
  full_name: string;
  delegate_id: string;
  branch: string;
  shares: number;
  total_amount: number;
}

interface BranchAgg {
  branch: string;
  members: number;
  shares: number;
  total: number;
}

const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(n);

export function SharesByBranch() {
  const [rows, setRows] = useState<Subscriber[]>([]);
  const [branches, setBranches] = useState<BranchAgg[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: subs }, { data: dels }, { data: subscriptions }] = await Promise.all([
        supabase.from("subscribers").select("id, full_name, delegate_id"),
        supabase.from("delegates").select("id, family_branch"),
        supabase.from("subscriptions").select("subscriber_id, amount, status"),
      ]);
      const delMap = new Map((dels ?? []).map((d) => [d.id, d.family_branch]));
      const subAgg = new Map<string, { shares: number; total: number }>();
      (subscriptions ?? []).forEach((s) => {
        if (s.status !== "confirmed") return;
        const a = subAgg.get(s.subscriber_id) ?? { shares: 0, total: 0 };
        a.shares += 1;
        a.total += Number(s.amount);
        subAgg.set(s.subscriber_id, a);
      });
      const list: Subscriber[] = (subs ?? []).map((s) => {
        const agg = subAgg.get(s.id) ?? { shares: 0, total: 0 };
        return {
          id: s.id,
          full_name: s.full_name,
          delegate_id: s.delegate_id,
          branch: delMap.get(s.delegate_id) ?? "غير محدد",
          shares: agg.shares,
          total_amount: agg.total,
        };
      });
      setRows(list);

      const bAgg = new Map<string, BranchAgg>();
      list.forEach((r) => {
        const b = bAgg.get(r.branch) ?? { branch: r.branch, members: 0, shares: 0, total: 0 };
        b.members += 1;
        b.shares += r.shares;
        b.total += r.total_amount;
        bAgg.set(r.branch, b);
      });
      setBranches(Array.from(bAgg.values()).sort((a, b) => b.shares - a.shares));
    })();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter !== "all" && r.branch !== filter) return false;
      if (q && !r.full_name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [rows, filter, q]);

  const totals = filtered.reduce(
    (a, r) => ({ shares: a.shares + r.shares, total: a.total + r.total_amount, count: a.count + 1 }),
    { shares: 0, total: 0, count: 0 },
  );

  return (
    <div className="space-y-5">
      {/* Branch summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {branches.map((b) => (
          <button
            key={b.branch}
            onClick={() => setFilter(b.branch === filter ? "all" : b.branch)}
            className={`text-right rounded-2xl border p-4 transition-all hover:shadow-soft ${
              filter === b.branch
                ? "bg-gradient-to-br from-primary/15 to-primary/5 border-primary/40 shadow-elegant"
                : "bg-card hover:border-primary/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <TreePine className="h-4 w-4 text-primary" />
              <Badge variant="outline" className="text-[10px]">{b.members} مساهم</Badge>
            </div>
            <p className="font-bold mt-2 text-sm">{b.branch}</p>
            <div className="flex items-end justify-between mt-2">
              <div>
                <p className="text-[10px] text-muted-foreground">الأسهم</p>
                <p className="font-bold text-lg leading-tight">{b.shares}</p>
              </div>
              <div className="text-left">
                <p className="text-[10px] text-muted-foreground">الإجمالي</p>
                <p className="font-semibold text-sm">{fmt(b.total)} ر.س</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-soft">
        <div className="px-5 py-4 border-b bg-gradient-to-l from-primary/5 to-transparent flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن مساهم بالاسم..." className="pe-9" />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الفروع</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.branch} value={b.branch}>{b.branch}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="text-right">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">المساهم</th>
                <th className="px-4 py-3 font-medium">الفرع</th>
                <th className="px-4 py-3 font-medium">عدد الأسهم</th>
                <th className="px-4 py-3 font-medium">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} className="border-t hover:bg-muted/20">
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{r.full_name}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="bg-primary/5">{r.branch}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 font-bold">
                      <Coins className="h-3.5 w-3.5 text-gold" /> {r.shares}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold">{fmt(r.total_amount)} ر.س</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">
                  <Users2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  لا يوجد مساهمون مطابقون للبحث
                </td></tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-gradient-to-l from-primary/10 to-gold/10 font-bold">
                <tr>
                  <td className="px-4 py-3" colSpan={2}>الإجمالي ({totals.count} مساهم)</td>
                  <td className="px-4 py-3">—</td>
                  <td className="px-4 py-3">{totals.shares} سهم</td>
                  <td className="px-4 py-3">{fmt(totals.total)} ر.س</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Historical shareholders by Hijri year */}
      <div className="pt-4 border-t-2 border-dashed">
        <HistoricalShares />
      </div>
    </div>
  );
}
