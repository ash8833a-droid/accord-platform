import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileBarChart, Download, Star, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
});

interface Report {
  id: string;
  title: string;
  description: string | null;
  file_url: string | null;
  report_year: number;
  created_at: string;
}

function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState({ committees: 0, totalBudget: 0, totalSpent: 0, satisfaction: 92 });

  useEffect(() => {
    (async () => {
      const [{ data: r }, { data: c }] = await Promise.all([
        supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("committees").select("budget_allocated, budget_spent"),
      ]);
      setReports((r ?? []) as Report[]);
      const totalBudget = (c ?? []).reduce((a, x) => a + Number(x.budget_allocated), 0);
      const totalSpent = (c ?? []).reduce((a, x) => a + Number(x.budget_spent), 0);
      setStats((s) => ({ ...s, committees: c?.length ?? 0, totalBudget, totalSpent }));
    })();
  }, []);

  const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(n);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">التقارير والجودة</h1>
        <p className="text-muted-foreground mt-1">مركز التقارير الدورية ومؤشرات الرضا والأرشيف</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-gradient-hero text-primary-foreground p-5 shadow-elegant">
          <FileBarChart className="h-7 w-7 text-gold mb-2" />
          <p className="text-3xl font-bold">{stats.committees}</p>
          <p className="text-xs text-primary-foreground/80">لجان نشطة</p>
        </div>
        <div className="rounded-2xl bg-card border p-5 shadow-soft">
          <TrendingUp className="h-7 w-7 text-primary mb-2" />
          <p className="text-3xl font-bold">{fmt(stats.totalBudget)}</p>
          <p className="text-xs text-muted-foreground">إجمالي ميزانيات (ر.س)</p>
        </div>
        <div className="rounded-2xl bg-card border p-5 shadow-soft">
          <TrendingUp className="h-7 w-7 text-gold mb-2" />
          <p className="text-3xl font-bold">{fmt(stats.totalSpent)}</p>
          <p className="text-xs text-muted-foreground">إجمالي المنصرف (ر.س)</p>
        </div>
        <div className="rounded-2xl bg-gradient-gold text-gold-foreground p-5 shadow-gold">
          <Star className="h-7 w-7 mb-2 fill-current" />
          <p className="text-3xl font-bold">{stats.satisfaction}%</p>
          <p className="text-xs">رضا العرسان والداعمين</p>
        </div>
      </div>

      {/* Archive list */}
      <div className="rounded-2xl border bg-card shadow-soft overflow-hidden">
        <div className="px-6 py-4 border-b bg-gradient-to-l from-primary/5 to-transparent flex justify-between items-center">
          <h2 className="font-bold">أرشيف التقارير</h2>
          <span className="text-xs text-muted-foreground">{reports.length} تقرير</span>
        </div>
        <div className="divide-y">
          {reports.map((r) => (
            <div key={r.id} className="px-6 py-4 flex justify-between items-center hover:bg-muted/20 transition">
              <div className="flex-1">
                <p className="font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {r.description ?? "—"} • {r.report_year}
                </p>
              </div>
              {r.file_url && (
                <Button asChild size="sm" variant="outline">
                  <a href={r.file_url} target="_blank" rel="noreferrer">
                    <Download className="h-4 w-4 ms-1" /> تحميل
                  </a>
                </Button>
              )}
            </div>
          ))}
          {reports.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              لم يتم رفع أي تقرير بعد. ستظهر تقارير اللجان والإدارة هنا تلقائياً.
            </div>
          )}
        </div>
      </div>

      {/* Years archive */}
      <div className="rounded-2xl border bg-gradient-to-br from-gold/5 to-transparent p-6">
        <h3 className="font-bold mb-4">الأرشيف التاريخي</h3>
        <p className="text-sm text-muted-foreground mb-4">
          أرشيف حي يحفظ إنجازات وميزانيات السنوات الماضية للبرنامج.
        </p>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 11 }, (_, i) => 2026 - i).map((y) => (
            <button
              key={y}
              className="px-4 py-2 rounded-lg bg-card border hover:border-gold hover:shadow-gold transition text-sm font-medium"
            >
              {y}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
