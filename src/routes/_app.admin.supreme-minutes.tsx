import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageGate } from "@/components/PageGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowRight, Calendar, ClipboardList, ListChecks, Loader2, MapPin,
  MessageSquareQuote, Users, FileText, Search, Sparkles, Plus, Upload, Paperclip, Download,
} from "lucide-react";
import { CommitteeMinutes } from "@/components/CommitteeMinutes";
import { useAuth } from "@/lib/auth";

interface Minute {
  id: string;
  title: string;
  notes: string | null;
  meeting_date: string | null;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  recorder_name: string | null;
  attendees: string[] | null;
  agenda_items: string[] | null;
  recommendations: string[] | null;
  file_url: string | null;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

export const Route = createFileRoute("/_app/admin/supreme-minutes")({
  component: () => <PageGate pageKey="admin">{() => <SupremeMinutesPage />}</PageGate>,
});

function SupremeMinutesPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole("admin");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Minute[]>([]);
  const [selected, setSelected] = useState<Minute | null>(null);
  const [committeeId, setCommitteeId] = useState<string | null>(null);
  const [committeeName, setCommitteeName] = useState<string>("اللجنة العليا");
  const [query, setQuery] = useState("");

  const loadMinutes = async (cid: string) => {
    const { data } = await supabase
      .from("committee_minutes" as any)
      .select("*")
      .eq("committee_id", cid)
      .order("meeting_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    setItems(((data ?? []) as unknown) as Minute[]);
  };

  useEffect(() => {
    (async () => {
      const { data: com } = await supabase
        .from("committees")
        .select("id, name")
        .eq("type", "supreme")
        .maybeSingle();
      if (!com) { setLoading(false); return; }
      setCommitteeId(com.id);
      setCommitteeName(com.name || "اللجنة العليا");
      await loadMinutes(com.id);
      setLoading(false);
    })();
  }, []);

  // Realtime: refresh icons grid whenever a minute is added/updated/deleted.
  useEffect(() => {
    if (!committeeId) return;
    const channel = supabase
      .channel(`supreme-minutes-${committeeId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "committee_minutes", filter: `committee_id=eq.${committeeId}` },
        () => { void loadMinutes(committeeId); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [committeeId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((m) =>
      (m.title || "").toLowerCase().includes(q) ||
      (m.location || "").toLowerCase().includes(q) ||
      (m.recorder_name || "").toLowerCase().includes(q) ||
      (m.notes || "").toLowerCase().includes(q) ||
      (m.attendees || []).some((a) => a.toLowerCase().includes(q)) ||
      (m.agenda_items || []).some((a) => a.toLowerCase().includes(q)),
    );
  }, [items, query]);

  const stats = useMemo(() => {
    const totalRecs = items.reduce((s, m) => s + (m.recommendations?.length ?? 0), 0);
    const totalAgenda = items.reduce((s, m) => s + (m.agenda_items?.length ?? 0), 0);
    const lastDate = items.find((m) => m.meeting_date)?.meeting_date ?? null;
    return { total: items.length, totalRecs, totalAgenda, lastDate };
  }, [items]);

  const openCreate = (mode: "manual" | "extract" = "manual") => {
    if (!committeeId) return;
    window.dispatchEvent(new CustomEvent("lovable:open-minutes", { detail: { committeeId, tab: "create", mode } }));
  };

  return (
    <div className="bg-[#F8FAFC] min-h-screen -m-4 sm:-m-6 lg:-m-8 p-6 sm:p-8 lg:p-10 space-y-8" dir="rtl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <ClipboardList className="h-7 w-7 text-amber-600" />
            محاضر اللجنة العليا
          </h1>
          <p className="text-sm text-slate-500 mt-1">جميع محاضر اجتماعات اللجنة العليا — اضغط على أي محضر لعرض تفاصيله</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canManage && committeeId && (
            <>
              <Button onClick={() => openCreate("manual")} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white shadow-sm">
                <Plus className="h-4 w-4" /> كتابة محضر يدوياً
              </Button>
              <Button onClick={() => openCreate("extract")} variant="outline" className="gap-2 bg-white shadow-sm">
                <Upload className="h-4 w-4" /> رفع واستخراج تلقائي
              </Button>
            </>
          )}
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm text-slate-700 hover:bg-slate-50 transition text-sm font-semibold"
          >
            <ArrowRight className="h-4 w-4" />
            العودة
          </Link>
        </div>
      </div>

      {/* Hidden mount so the create/upload dialog (and its event listener) is available */}
      {committeeId && (
        <div className="hidden">
          <CommitteeMinutes committeeId={committeeId} committeeName={committeeName} canManage={canManage} />
        </div>
      )}

      {/* Stats + search */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile icon={ClipboardList} label="إجمالي المحاضر" value={stats.total} tone="amber" />
        <StatTile icon={ListChecks} label="مجموع المحاور" value={stats.totalAgenda} tone="teal" />
        <StatTile icon={MessageSquareQuote} label="مجموع التوصيات" value={stats.totalRecs} tone="violet" />
        <StatTile icon={Calendar} label="آخر اجتماع" value={stats.lastDate ? new Date(stats.lastDate).toLocaleDateString("ar-SA") : "—"} tone="slate" />
      </div>

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث في العنوان، المكان، الحضور، البنود..."
          className="pr-9 bg-white shadow-sm"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-gradient-to-br from-amber-50/50 to-white p-12 text-center shadow-sm">
          <ClipboardList className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-600 font-semibold">لا توجد محاضر بعد للجنة العليا</p>
          <p className="text-sm text-slate-400 mt-1 mb-5">ابدأ بإنشاء محضر جديد أو ارفع ملف محضر سابق ليُستخرج تلقائياً</p>
          {canManage && committeeId && (
            <div className="flex items-center justify-center gap-2">
              <Button onClick={() => openCreate("manual")} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
                <Plus className="h-4 w-4" /> كتابة محضر يدوياً
              </Button>
              <Button onClick={() => openCreate("extract")} variant="outline" className="gap-2">
                <Sparkles className="h-4 w-4" /> رفع واستخراج تلقائي
              </Button>
            </div>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center shadow-sm">
          <Search className="h-10 w-10 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-600 font-semibold">لا توجد نتائج مطابقة لبحثك</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelected(m)}
              className="group relative flex flex-col items-center gap-3 rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-amber-300 transition-all text-center overflow-hidden"
            >
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-amber-400 to-teal-400 opacity-0 group-hover:opacity-100 transition" />
              <span className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-100 to-teal-50 text-amber-700 flex items-center justify-center group-hover:from-amber-200 group-hover:to-teal-100 group-hover:scale-110 transition-transform">
                <FileText className="h-8 w-8" />
              </span>
              <div className="space-y-1 w-full">
                <p className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug">{m.title}</p>
                {m.meeting_date && (
                  <p className="text-[11px] text-slate-500 inline-flex items-center gap-1 justify-center">
                    <Calendar className="h-3 w-3" />
                    {new Date(m.meeting_date).toLocaleDateString("ar-SA")}
                  </p>
                )}
                <div className="flex items-center justify-center gap-2 pt-1 text-[10px] text-slate-400">
                  <span className="inline-flex items-center gap-0.5"><Users className="h-3 w-3" />{m.attendees?.length ?? 0}</span>
                  <span className="inline-flex items-center gap-0.5"><ListChecks className="h-3 w-3" />{m.agenda_items?.length ?? 0}</span>
                  <span className="inline-flex items-center gap-0.5"><MessageSquareQuote className="h-3 w-3" />{m.recommendations?.length ?? 0}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl w-[96vw] max-h-[92vh] overflow-y-auto" dir="rtl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="h-5 w-5 text-amber-600" />
                  {selected.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-2">
                <div className="flex flex-wrap gap-2 text-xs">
                  {selected.meeting_date && (
                    <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-800">
                      <Calendar className="h-3 w-3" />
                      {new Date(selected.meeting_date).toLocaleDateString("ar-SA")}
                    </Badge>
                  )}
                  {selected.location && (
                    <Badge variant="outline" className="gap-1">
                      <MapPin className="h-3 w-3" /> {selected.location}
                    </Badge>
                  )}
                  {selected.recorder_name && (
                    <Badge variant="outline" className="gap-1">
                      كاتب المحضر: {selected.recorder_name}
                    </Badge>
                  )}
                </div>

                <Section icon={Users} title={`الحضور (${selected.attendees?.length ?? 0})`}>
                  {selected.attendees?.length ? (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm">
                      {selected.attendees.map((a, i) => (
                        <li key={i} className="rounded-md bg-slate-50 px-3 py-1.5">{a}</li>
                      ))}
                    </ul>
                  ) : <Empty />}
                </Section>

                <Section icon={ListChecks} title={`المحاور (${selected.agenda_items?.length ?? 0})`}>
                  {selected.agenda_items?.length ? (
                    <ol className="space-y-1.5 text-sm list-decimal pr-5">
                      {selected.agenda_items.map((a, i) => <li key={i}>{a}</li>)}
                    </ol>
                  ) : <Empty />}
                </Section>

                <Section icon={MessageSquareQuote} title={`التوصيات (${selected.recommendations?.length ?? 0})`}>
                  {selected.recommendations?.length ? (
                    <ol className="space-y-1.5 text-sm list-decimal pr-5">
                      {selected.recommendations.map((a, i) => <li key={i}>{a}</li>)}
                    </ol>
                  ) : <Empty />}
                </Section>

                {selected.notes && (
                  <Section icon={FileText} title="ملاحظات">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed text-slate-700">{selected.notes}</p>
                  </Section>
                )}

                {selected.file_url && (
                  <Section icon={Paperclip} title="المرفق">
                    <a
                      href={selected.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 transition"
                    >
                      <Download className="h-4 w-4" />
                      فتح ملف المحضر
                      {selected.file_size != null && (
                        <span className="text-[11px] text-slate-400">({(selected.file_size / 1024).toFixed(1)} KB)</span>
                      )}
                    </a>
                  </Section>
                )}
              </div>
              <div className="flex justify-end pt-4 border-t mt-4">
                <Button variant="outline" onClick={() => setSelected(null)}>إغلاق</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string | number; tone: "amber" | "teal" | "violet" | "slate" }) {
  const tones: Record<string, string> = {
    amber: "from-amber-100 to-amber-50 text-amber-700",
    teal: "from-teal-100 to-teal-50 text-teal-700",
    violet: "from-violet-100 to-violet-50 text-violet-700",
    slate: "from-slate-100 to-slate-50 text-slate-700",
  };
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition">
      <span className={`h-12 w-12 rounded-xl bg-gradient-to-br ${tones[tone]} flex items-center justify-center shrink-0`}>
        <Icon className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500 font-semibold">{label}</p>
        <p className="text-lg font-bold text-slate-900 truncate">{value}</p>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-amber-600" />
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="text-xs text-slate-400">— لا توجد بيانات —</p>;
}