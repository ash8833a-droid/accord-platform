import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageGate } from "@/components/PageGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowRight, Calendar, ClipboardList, ListChecks, Loader2, MapPin,
  MessageSquareQuote, Users, FileText,
} from "lucide-react";

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
  created_at: string;
}

export const Route = createFileRoute("/_app/admin/supreme-minutes")({
  component: () => <PageGate pageKey="admin">{() => <SupremeMinutesPage />}</PageGate>,
});

function SupremeMinutesPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Minute[]>([]);
  const [selected, setSelected] = useState<Minute | null>(null);

  useEffect(() => {
    (async () => {
      const { data: com } = await supabase
        .from("committees")
        .select("id")
        .eq("type", "supreme")
        .maybeSingle();
      if (!com) { setLoading(false); return; }
      const { data } = await supabase
        .from("committee_minutes" as any)
        .select("*")
        .eq("committee_id", com.id)
        .order("meeting_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      setItems(((data ?? []) as unknown) as Minute[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="bg-[#F8FAFC] min-h-screen -m-4 sm:-m-6 lg:-m-8 p-6 sm:p-8 lg:p-10 space-y-8" dir="rtl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <ClipboardList className="h-7 w-7 text-amber-600" />
            محاضر اللجنة العليا
          </h1>
          <p className="text-sm text-slate-500 mt-1">جميع محاضر اجتماعات اللجنة العليا — اضغط على أي محضر لعرض تفاصيله</p>
        </div>
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm text-slate-700 hover:bg-slate-50 transition text-sm font-semibold"
        >
          <ArrowRight className="h-4 w-4" />
          العودة للوحة الأداء
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border bg-white p-12 text-center shadow-sm">
          <ClipboardList className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-600 font-semibold">لا توجد محاضر بعد للجنة العليا</p>
          <p className="text-sm text-slate-400 mt-1">يمكنك إضافة محاضر من صفحة اللجنة العليا</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {items.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelected(m)}
              className="group flex flex-col items-center gap-3 rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-amber-300 transition-all text-center"
            >
              <span className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-100 to-teal-50 text-amber-700 flex items-center justify-center group-hover:from-amber-200 group-hover:to-teal-100 transition">
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