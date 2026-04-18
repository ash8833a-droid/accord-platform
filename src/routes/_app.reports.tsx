import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileBarChart, Download, Star, TrendingUp, Archive, Calendar, FileText, Image as ImageIcon, Pin, PinOff, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
});

interface Committee { id: string; name: string }
interface Report {
  id: string;
  title: string;
  description: string | null;
  file_url: string | null;
  file_type: string | null;
  file_size: number | null;
  report_year: number;
  archive_year: number | null;
  is_archived: boolean;
  committee_id: string | null;
  created_at: string;
}

const CURRENT_YEAR = new Date().getFullYear();

function ReportsPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [reports, setReports] = useState<Report[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [stats, setStats] = useState({ committees: 0, totalBudget: 0, totalSpent: 0, satisfaction: 92 });
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [committeeFilter, setCommitteeFilter] = useState<string>("all");

  const load = async () => {
    const [{ data: r }, { data: c }] = await Promise.all([
      supabase.from("reports").select("*").order("created_at", { ascending: false }),
      supabase.from("committees").select("id, name, budget_allocated, budget_spent"),
    ]);
    setReports((r ?? []) as Report[]);
    setCommittees((c ?? []) as Committee[]);
    const totalBudget = (c ?? []).reduce((a, x: any) => a + Number(x.budget_allocated), 0);
    const totalSpent = (c ?? []).reduce((a, x: any) => a + Number(x.budget_spent), 0);
    setStats((s) => ({ ...s, committees: c?.length ?? 0, totalBudget, totalSpent }));
  };

  useEffect(() => { load(); }, []);

  const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(n);
  const committeeName = (id: string | null) => committees.find((c) => c.id === id)?.name ?? "—";

  const open = async (r: Report) => {
    if (!r.file_url) return;
    const { data } = await supabase.storage.from("reports").createSignedUrl(r.file_url, 60 * 30);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const setArchiveYear = async (id: string, year: number | null) => {
    const { error } = await supabase.from("reports")
      .update({ archive_year: year, is_archived: year !== null })
      .eq("id", id);
    if (error) return toast.error("تعذر التحديث", { description: error.message });
    toast.success(year ? `تم تسكين الملف في أرشيف ${year}` : "تم إلغاء التسكين");
    load();
  };

  const years = useMemo(() => {
    const set = new Set<number>();
    reports.forEach((r) => { if (r.archive_year) set.add(r.archive_year); });
    Array.from({ length: 11 }, (_, i) => CURRENT_YEAR - i).forEach((y) => set.add(y));
    return Array.from(set).sort((a, b) => b - a);
  }, [reports]);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (yearFilter === "unfiled") {
        if (r.archive_year) return false;
      } else if (yearFilter !== "all" && String(r.archive_year ?? "") !== yearFilter) {
        return false;
      }
      if (committeeFilter !== "all" && r.committee_id !== committeeFilter) return false;
      return true;
    });
  }, [reports, yearFilter, committeeFilter]);

  const unfiledCount = reports.filter((r) => !r.archive_year).length;

  const isImg = (t: string | null) => !!t && t.startsWith("image/");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">التقارير والجودة</h1>
        <p className="text-muted-foreground mt-1">مركز التقارير الدورية ومؤشرات الرضا والأرشيف الموحد للجان</p>
      </div>

      {/* Archive section */}
      <div className="rounded-2xl border bg-card shadow-soft overflow-hidden">
        <div className="px-6 py-4 border-b bg-gradient-to-l from-primary/5 to-transparent flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-primary" />
            <h2 className="font-bold">الأرشيف</h2>
            <Badge variant="outline" className="text-[10px]">{filtered.length} ملف</Badge>
            {isAdmin && unfiledCount > 0 && (
              <Badge variant="secondary" className="text-[10px] bg-amber-500/15 text-amber-700 border-amber-500/30">
                {unfiledCount} بانتظار التسكين
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={committeeFilter} onValueChange={setCommitteeFilter}>
              <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="كل اللجان" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل اللجان</SelectItem>
                {committees.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="h-8 w-[120px]"><SelectValue placeholder="كل السنوات" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل السنوات</SelectItem>
                <SelectItem value="unfiled">غير مُسكَّن</SelectItem>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="divide-y max-h-[600px] overflow-y-auto">
          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm">
              لا توجد ملفات في هذا التصنيف. ستظهر التقارير التي ترفعها اللجان هنا تلقائياً.
            </div>
          )}
          {filtered.map((r) => (
            <div key={r.id} className="px-6 py-4 flex items-center gap-4 hover:bg-muted/20 transition flex-wrap">
              <span className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                {isImg(r.file_type) ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{r.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>{committeeName(r.committee_id)}</span>
                  <span>·</span>
                  <span>{new Date(r.created_at).toLocaleDateString("ar-SA")}</span>
                  {r.description && <><span>·</span><span className="truncate max-w-[280px]">{r.description}</span></>}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {r.archive_year ? (
                  <Badge variant="outline" className="gap-1 border-gold/40 bg-gold/10 text-gold-foreground">
                    <Calendar className="h-3 w-3" /> {r.archive_year}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 border-amber-500/30">بانتظار التسكين</Badge>
                )}

                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={2000}
                      max={2100}
                      defaultValue={r.archive_year ?? CURRENT_YEAR}
                      className="h-8 w-20 text-xs"
                      onBlur={(e) => {
                        const y = Number(e.currentTarget.value);
                        if (y && y !== r.archive_year) setArchiveYear(r.id, y);
                      }}
                    />
                    {r.is_archived ? (
                      <Button size="sm" variant="ghost" onClick={() => setArchiveYear(r.id, null)} title="إلغاء التسكين">
                        <PinOff className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setArchiveYear(r.id, CURRENT_YEAR)} title="تسكين في السنة الحالية">
                        <Pin className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}

                {r.file_url && (
                  <Button size="sm" variant="outline" onClick={() => open(r)}>
                    <Download className="h-3.5 w-3.5 ms-1" /> فتح
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Years archive (quick year jump) */}
      <div className="rounded-2xl border bg-gradient-to-br from-gold/5 to-transparent p-6">
        <h3 className="font-bold mb-4">الأرشيف التاريخي</h3>
        <p className="text-sm text-muted-foreground mb-4">
          أرشيف حي يحفظ إنجازات وميزانيات السنوات الماضية للبرنامج. اختر سنة لعرض ملفاتها.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setYearFilter("all")}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition ${
              yearFilter === "all" ? "bg-gradient-gold text-gold-foreground shadow-gold border-transparent" : "bg-card hover:border-gold"
            }`}
          >
            الكل
          </button>
          {years.map((y) => {
            const count = reports.filter((r) => r.archive_year === y).length;
            const active = yearFilter === String(y);
            return (
              <button
                key={y}
                onClick={() => setYearFilter(String(y))}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition flex items-center gap-1.5 ${
                  active ? "bg-gradient-gold text-gold-foreground shadow-gold border-transparent" : "bg-card hover:border-gold hover:shadow-gold"
                }`}
              >
                {y}
                {count > 0 && <span className={`text-[10px] rounded-full px-1.5 ${active ? "bg-gold-foreground/20" : "bg-muted"}`}>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
