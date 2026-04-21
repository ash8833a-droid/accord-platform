import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  Loader2,
  Pencil,
  Send,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

interface Response {
  id: string;
  user_id: string;
  author_name: string;
  action_taken: string;
  outcomes: string | null;
  completion_percent: number;
  challenges: string | null;
  recommendations: string | null;
  execution_date: string | null;
  attachments_note: string | null;
  created_at: string;
  updated_at: string;
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0] ?? "")
      .join("")
      .toUpperCase() || "؟"
  );
}

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("ar-SA", { dateStyle: "short", timeStyle: "short" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

interface Props {
  taskId: string;
  committeeId: string;
}

export function TaskResponseForm({ taskId, committeeId }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorName, setAuthorName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [action, setAction] = useState("");
  const [outcomes, setOutcomes] = useState("");
  const [percent, setPercent] = useState<number>(0);
  const [challenges, setChallenges] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [executionDate, setExecutionDate] = useState("");
  const [attachmentsNote, setAttachmentsNote] = useState("");

  const reset = () => {
    setAction("");
    setOutcomes("");
    setPercent(0);
    setChallenges("");
    setRecommendations("");
    setExecutionDate("");
    setAttachmentsNote("");
    setEditingId(null);
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("task_responses" as any)
      .select(
        "id, user_id, author_name, action_taken, outcomes, completion_percent, challenges, recommendations, execution_date, attachments_note, created_at, updated_at",
      )
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as any as Response[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`task_responses_${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_responses", filter: `task_id=eq.${taskId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setAuthorName(data?.full_name ?? user.email ?? "عضو"));
  }, [user]);

  const startEdit = (r: Response) => {
    setEditingId(r.id);
    setAction(r.action_taken);
    setOutcomes(r.outcomes ?? "");
    setPercent(r.completion_percent);
    setChallenges(r.challenges ?? "");
    setRecommendations(r.recommendations ?? "");
    setExecutionDate(r.execution_date ?? "");
    setAttachmentsNote(r.attachments_note ?? "");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("سجّل الدخول أولاً");
      return;
    }
    const trimmed = action.trim();
    if (!trimmed) {
      toast.error("الرجاء كتابة الإجراء المتخذ");
      return;
    }
    const pct = Math.max(0, Math.min(100, Math.round(percent || 0)));
    setSubmitting(true);
    const payload = {
      action_taken: trimmed.slice(0, 2000),
      outcomes: outcomes.trim().slice(0, 2000) || null,
      completion_percent: pct,
      challenges: challenges.trim().slice(0, 2000) || null,
      recommendations: recommendations.trim().slice(0, 2000) || null,
      execution_date: executionDate || null,
      attachments_note: attachmentsNote.trim().slice(0, 500) || null,
    };
    let error;
    if (editingId) {
      ({ error } = await supabase
        .from("task_responses" as any)
        .update(payload)
        .eq("id", editingId));
    } else {
      ({ error } = await supabase.from("task_responses" as any).insert({
        ...payload,
        task_id: taskId,
        committee_id: committeeId,
        user_id: user.id,
        author_name: authorName || user.email || "عضو",
      }));
    }
    setSubmitting(false);
    if (error) {
      toast.error("تعذّر حفظ الرد", { description: error.message });
      return;
    }
    toast.success(editingId ? "تم تحديث الرد" : "تم إرسال الرد");
    reset();
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذا الرد؟")) return;
    const { error } = await supabase.from("task_responses" as any).delete().eq("id", id);
    if (error) {
      toast.error("تعذّر الحذف", { description: error.message });
      return;
    }
    toast.success("تم الحذف");
    if (editingId === id) reset();
  };

  return (
    <div className="space-y-3">
      {/* Existing responses */}
      {loading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : items.length > 0 ? (
        <ul className="space-y-2 max-h-72 overflow-y-auto pe-1">
          {items.map((r) => {
            const mine = user?.id === r.user_id;
            return (
              <li
                key={r.id}
                className="group rounded-lg border border-border/60 bg-background/70 p-2.5"
              >
                <div className="flex items-start gap-2">
                  <Avatar className="h-7 w-7 shrink-0 border border-primary/20">
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                      {initials(r.author_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-bold truncate">{r.author_name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {fmtDate(r.created_at)}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 h-4 rounded-md ${
                            r.completion_percent === 100
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                              : r.completion_percent >= 50
                                ? "bg-sky-500/10 text-sky-700 border-sky-500/30"
                                : "bg-amber-500/10 text-amber-700 border-amber-500/30"
                          }`}
                        >
                          {r.completion_percent}%
                        </Badge>
                      </div>
                      {mine && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                          <button
                            type="button"
                            onClick={() => startEdit(r)}
                            className="h-5 w-5 rounded flex items-center justify-center hover:bg-primary/10 hover:text-primary"
                            title="تعديل"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(r.id)}
                            className="h-5 w-5 rounded flex items-center justify-center hover:bg-destructive/10 hover:text-destructive"
                            title="حذف"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 text-[11.5px] leading-relaxed">
                      <p>
                        <span className="font-bold text-foreground/80">الإجراء: </span>
                        <span className="text-foreground/90 whitespace-pre-wrap">{r.action_taken}</span>
                      </p>
                      {r.outcomes && (
                        <p>
                          <span className="font-bold text-foreground/80">المخرجات: </span>
                          <span className="text-foreground/90 whitespace-pre-wrap">{r.outcomes}</span>
                        </p>
                      )}
                      {r.challenges && (
                        <p>
                          <span className="font-bold text-amber-700">التحديات: </span>
                          <span className="text-foreground/90 whitespace-pre-wrap">{r.challenges}</span>
                        </p>
                      )}
                      {r.recommendations && (
                        <p>
                          <span className="font-bold text-sky-700">التوصيات: </span>
                          <span className="text-foreground/90 whitespace-pre-wrap">{r.recommendations}</span>
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1 text-[10.5px] text-muted-foreground">
                        {r.execution_date && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {r.execution_date}
                          </span>
                        )}
                        {r.attachments_note && (
                          <span className="inline-flex items-center gap-1">
                            <ClipboardList className="h-3 w-3" /> {r.attachments_note}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[11px] text-muted-foreground text-center py-2 border border-dashed rounded-lg">
          لا توجد ردود بعد — كن أول من يوثّق الإجراء
        </p>
      )}

      {/* Form */}
      <form
        onSubmit={submit}
        className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5"
      >
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary">
          {editingId ? (
            <>
              <Pencil className="h-3 w-3" /> تعديل الرد
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3" /> رد رسمي على المهمة
            </>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10.5px] flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> الإجراء المتخذ *
          </Label>
          <Textarea
            value={action}
            onChange={(e) => setAction(e.target.value)}
            rows={2}
            maxLength={2000}
            required
            placeholder="ماذا تم تنفيذه؟"
            className="text-xs resize-none"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10.5px]">المخرجات / النتائج</Label>
          <Textarea
            value={outcomes}
            onChange={(e) => setOutcomes(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="ما النواتج الملموسة؟"
            className="text-xs resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-[10.5px]">نسبة الإنجاز (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={percent}
              onChange={(e) => setPercent(Number(e.target.value))}
              className="h-8 text-xs"
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10.5px]">تاريخ التنفيذ</Label>
            <Input
              type="date"
              value={executionDate}
              onChange={(e) => setExecutionDate(e.target.value)}
              className="h-8 text-xs"
              dir="ltr"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10.5px] flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-600" /> التحديات
          </Label>
          <Textarea
            value={challenges}
            onChange={(e) => setChallenges(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="ما العقبات التي واجهتكم؟"
            className="text-xs resize-none"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10.5px]">التوصيات</Label>
          <Textarea
            value={recommendations}
            onChange={(e) => setRecommendations(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="مقترحات للمستقبل"
            className="text-xs resize-none"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10.5px]">ملاحظة عن المرفقات (اختياري)</Label>
          <Input
            value={attachmentsNote}
            onChange={(e) => setAttachmentsNote(e.target.value)}
            maxLength={500}
            placeholder="مثل: مرفق محضر الاجتماع"
            className="h-8 text-xs"
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          {editingId && (
            <Button type="button" size="sm" variant="ghost" onClick={reset} className="h-8 text-xs">
              إلغاء
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={submitting}
            className="bg-gradient-hero text-primary-foreground gap-1.5 h-8 text-xs"
          >
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            {editingId ? "حفظ" : "إرسال الرد"}
          </Button>
        </div>
      </form>
    </div>
  );
}