import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  ArrowRight,
  ArrowLeft,
  Eye,
  ListChecks,
  MessageSquareText,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { TaskResponseAttachments } from "@/components/TaskResponseAttachments";

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

type Step = 1 | 2 | 3;

const STEPS: { id: Step; label: string; icon: typeof ListChecks }[] = [
  { id: 1, label: "الإجراء", icon: ListChecks },
  { id: 2, label: "التحليل", icon: MessageSquareText },
  { id: 3, label: "المراجعة والإرسال", icon: Eye },
];

export function TaskResponseForm({ taskId, committeeId }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorName, setAuthorName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);

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
    setStep(1);
    setOpen(false);
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
    setStep(1);
    setOpen(true);
  };

  const canNext = useMemo(() => {
    if (step === 1) return action.trim().length > 0;
    return true;
  }, [step, action]);

  const next = () => {
    if (!canNext) {
      toast.error("الرجاء كتابة الإجراء المتخذ أولاً");
      return;
    }
    setStep((s) => (s === 3 ? 3 : ((s + 1) as Step)));
  };
  const prev = () => setStep((s) => (s === 1 ? 1 : ((s - 1) as Step)));

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) {
      toast.error("سجّل الدخول أولاً");
      return;
    }
    const trimmed = action.trim();
    if (!trimmed) {
      toast.error("الرجاء كتابة الإجراء المتخذ");
      setStep(1);
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

  const myLatest = items.find((r) => r.user_id === user?.id);

  return (
    <div className="space-y-3">
      {/* Existing responses — compact thread */}
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
                className="group rounded-xl border border-border/60 bg-background/70 p-3 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <Avatar className="h-8 w-8 shrink-0 border border-primary/20">
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                      {initials(r.author_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        <span className="text-xs font-bold truncate">{r.author_name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {fmtDate(r.created_at)}
                        </span>
                      </div>
                      {mine && (
                        <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition">
                          <button
                            type="button"
                            onClick={() => startEdit(r)}
                            className="h-6 w-6 rounded flex items-center justify-center hover:bg-primary/10 hover:text-primary"
                            title="تعديل"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(r.id)}
                            className="h-6 w-6 rounded flex items-center justify-center hover:bg-destructive/10 hover:text-destructive"
                            title="حذف"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <Progress value={r.completion_percent} className="h-1.5 flex-1" />
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 h-5 rounded-md font-bold ${
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
                    <div className="space-y-1.5 text-[11.5px] leading-relaxed">
                      <p className="bg-muted/40 rounded-md px-2 py-1.5">
                        <span className="font-bold text-foreground/80">الإجراء: </span>
                        <span className="text-foreground/90 whitespace-pre-wrap">
                          {r.action_taken}
                        </span>
                      </p>
                      {r.outcomes && (
                        <p>
                          <span className="font-bold text-emerald-700">المخرجات: </span>
                          <span className="text-foreground/90 whitespace-pre-wrap">
                            {r.outcomes}
                          </span>
                        </p>
                      )}
                      {r.challenges && (
                        <p>
                          <span className="font-bold text-amber-700">التحديات: </span>
                          <span className="text-foreground/90 whitespace-pre-wrap">
                            {r.challenges}
                          </span>
                        </p>
                      )}
                      {r.recommendations && (
                        <p>
                          <span className="font-bold text-sky-700">التوصيات: </span>
                          <span className="text-foreground/90 whitespace-pre-wrap">
                            {r.recommendations}
                          </span>
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
                      <TaskResponseAttachments
                        responseId={r.id}
                        taskId={taskId}
                        committeeId={committeeId}
                        ownerUserId={r.user_id}
                        currentUserId={user?.id ?? null}
                        canUpload={mine}
                      />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[11px] text-muted-foreground text-center py-3 border border-dashed rounded-lg">
          لا توجد ردود بعد — كن أول من يوثّق الإجراء
        </p>
      )}

      {/* Trigger or Stepper Form */}
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setStep(1);
          }}
          className="w-full rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 transition-colors px-3 py-2.5 flex items-center justify-center gap-2 text-xs font-bold text-primary"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {myLatest ? "أضف رداً جديداً على المهمة" : "اكتب رداً رسمياً على المهمة"}
        </button>
      ) : (
        <form
          onSubmit={submit}
          className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-3 shadow-sm"
        >
          {/* Stepper header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-primary">
              {editingId ? (
                <>
                  <Pencil className="h-3.5 w-3.5" /> تعديل الرد
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" /> رد رسمي على المهمة
                </>
              )}
            </div>
            <button
              type="button"
              onClick={reset}
              className="text-[10.5px] text-muted-foreground hover:text-foreground"
            >
              إلغاء
            </button>
          </div>

          {/* Stepper bar */}
          <div className="flex items-center gap-1 mb-4">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const active = step === s.id;
              const done = step > s.id;
              return (
                <div key={s.id} className="flex items-center flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
                        done
                          ? "bg-emerald-500 text-white"
                          : active
                            ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3 w-3" />}
                    </div>
                    <span
                      className={`text-[10.5px] font-bold truncate ${
                        active ? "text-primary" : done ? "text-emerald-700" : "text-muted-foreground"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-2 rounded-full ${
                        step > s.id ? "bg-emerald-500" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Step content */}
          <div className="space-y-3 min-h-[180px]">
            {step === 1 && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-[11px] flex items-center gap-1 font-bold">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" /> الإجراء المتخذ *
                  </Label>
                  <Textarea
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    required
                    placeholder="ماذا تم تنفيذه فعلياً؟ اكتب وصفاً واضحاً للإجراء"
                    className="text-xs resize-none"
                    autoFocus
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {action.length}/2000 — هذا الحقل مطلوب
                  </p>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-[11px] flex items-center gap-1 font-bold">
                    <Sparkles className="h-3 w-3 text-emerald-600" /> المخرجات / النتائج
                  </Label>
                  <Textarea
                    value={outcomes}
                    onChange={(e) => setOutcomes(e.target.value)}
                    rows={2}
                    maxLength={2000}
                    placeholder="ما النواتج الملموسة من هذا الإجراء؟"
                    className="text-xs resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] flex items-center gap-1 font-bold">
                    <AlertTriangle className="h-3 w-3 text-amber-600" /> التحديات
                  </Label>
                  <Textarea
                    value={challenges}
                    onChange={(e) => setChallenges(e.target.value)}
                    rows={2}
                    maxLength={2000}
                    placeholder="ما العقبات التي واجهتكم؟ (اختياري)"
                    className="text-xs resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] flex items-center gap-1 font-bold">
                    <MessageSquareText className="h-3 w-3 text-sky-600" /> التوصيات
                  </Label>
                  <Textarea
                    value={recommendations}
                    onChange={(e) => setRecommendations(e.target.value)}
                    rows={2}
                    maxLength={2000}
                    placeholder="مقترحات للتحسين أو للجولات المقبلة (اختياري)"
                    className="text-xs resize-none"
                  />
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-[11px] flex items-center gap-1 font-bold">
                    <Paperclip className="h-3 w-3" /> ملاحظة عن المرفقات (اختياري)
                  </Label>
                  <Input
                    value={attachmentsNote}
                    onChange={(e) => setAttachmentsNote(e.target.value)}
                    maxLength={500}
                    placeholder="مثل: مرفق محضر الاجتماع"
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    سيمكنك رفع الملفات الفعلية بعد إرسال الرد
                  </p>
                </div>

                {/* Preview */}
                <div className="rounded-lg border bg-background/70 p-3 space-y-2">
                  <p className="text-[10.5px] font-bold text-muted-foreground flex items-center gap-1">
                    <Eye className="h-3 w-3" /> معاينة الرد قبل الإرسال
                  </p>
                  <div className="flex items-center gap-2">
                    <Progress value={percent} className="h-2 flex-1" />
                    <span className="text-[11px] font-bold">{percent}%</span>
                  </div>
                  <PreviewRow label="الإجراء" value={action} required />
                  <PreviewRow label="المخرجات" value={outcomes} />
                  <PreviewRow label="التحديات" value={challenges} />
                  <PreviewRow label="التوصيات" value={recommendations} />
                  <PreviewRow label="تاريخ التنفيذ" value={executionDate} />
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-border/60">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={prev}
              disabled={step === 1}
              className="h-8 text-xs gap-1"
            >
              <ArrowRight className="h-3 w-3" /> السابق
            </Button>
            <span className="text-[10px] text-muted-foreground">
              خطوة {step} من {STEPS.length}
            </span>
            {step < 3 ? (
              <Button
                type="button"
                size="sm"
                onClick={next}
                className="h-8 text-xs gap-1 bg-primary text-primary-foreground"
              >
                التالي <ArrowLeft className="h-3 w-3" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className="bg-gradient-hero text-primary-foreground gap-1.5 h-8 text-xs"
              >
                {submitting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                {editingId ? "حفظ التعديلات" : "إرسال الرد"}
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function PreviewRow({
  label,
  value,
  required = false,
}: {
  label: string;
  value: string;
  required?: boolean;
}) {
  const empty = !value || !value.trim();
  return (
    <div className="flex items-start gap-2 text-[11px]">
      <span className="font-bold text-foreground/70 min-w-[80px]">{label}:</span>
      <span
        className={`flex-1 whitespace-pre-wrap ${
          empty
            ? required
              ? "text-destructive italic"
              : "text-muted-foreground italic"
            : "text-foreground"
        }`}
      >
        {empty ? (required ? "مطلوب — لم يُكتب بعد" : "—") : value}
      </span>
    </div>
  );
}