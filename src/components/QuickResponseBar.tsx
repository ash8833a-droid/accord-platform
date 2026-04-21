import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Send, Paperclip, Trash2, CheckCircle2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

interface Response {
  id: string;
  user_id: string;
  author_name: string;
  action_taken: string;
  completion_percent: number;
  created_at: string;
}

interface Props {
  taskId: string;
  committeeId: string;
  /** Current task status — used to derive an initial percent if no response yet. */
  initialPercent?: number;
  /** Called when a new response is saved so parent may sync committee_tasks.status. */
  onPercentChanged?: (percent: number) => void;
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

/**
 * Compact, modern quick-response bar for a task:
 * - Single text input + slider + attach button + send
 * - Enter to submit, Shift+Enter newline (textarea-like behavior using Input is intentional: short answers)
 * - Auto-syncs task.status from percent (0 → todo, 1-99 → in_progress, 100 → completed)
 * - Shows the latest 3 responses inline for context
 */
export function QuickResponseBar({
  taskId,
  committeeId,
  initialPercent = 0,
  onPercentChanged,
}: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorName, setAuthorName] = useState("");
  const [text, setText] = useState("");
  const [percent, setPercent] = useState<number>(initialPercent);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Load responses
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("task_responses" as any)
        .select("id, user_id, author_name, action_taken, completion_percent, created_at")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!active) return;
      const list = (data ?? []) as any as Response[];
      setItems(list);
      // Use the highest reported percent across all members as the live progress
      if (list.length > 0) {
        const maxPct = Math.max(...list.map((r) => r.completion_percent ?? 0));
        setPercent(maxPct);
      }
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel(`qr_${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_responses", filter: `task_id=eq.${taskId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [taskId]);

  // Resolve author name once
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setAuthorName(data?.full_name ?? user.email ?? "عضو"));
  }, [user]);

  const syncTaskStatus = async (pct: number) => {
    const status = pct >= 100 ? "completed" : pct > 0 ? "in_progress" : "todo";
    const { error } = await supabase
      .from("committee_tasks")
      .update({ status })
      .eq("id", taskId);
    if (!error) onPercentChanged?.(pct);
  };

  const submit = async () => {
    if (!user) {
      toast.error("سجّل الدخول أولاً");
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error("اكتب رداً قصيراً قبل الإرسال");
      return;
    }
    const pct = Math.max(0, Math.min(100, Math.round(percent || 0)));
    setSubmitting(true);
    const { error } = await supabase.from("task_responses" as any).insert({
      task_id: taskId,
      committee_id: committeeId,
      user_id: user.id,
      author_name: authorName || user.email || "عضو",
      action_taken: trimmed.slice(0, 2000),
      completion_percent: pct,
    });
    if (error) {
      setSubmitting(false);
      toast.error("تعذّر إرسال الرد", { description: error.message });
      return;
    }
    await syncTaskStatus(pct);
    setSubmitting(false);
    setText("");
    toast.success("تم إرسال الرد");
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذا الرد؟")) return;
    const { error } = await supabase.from("task_responses" as any).delete().eq("id", id);
    if (error) {
      toast.error("تعذّر الحذف", { description: error.message });
      return;
    }
    toast.success("تم الحذف");
  };

  // Inline file upload to task_response_attachments via the latest user's response
  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("الحجم الأقصى 10MB");
      return;
    }
    // Find or create a response to attach to
    let target = items.find((r) => r.user_id === user.id);
    if (!target) {
      const placeholder = text.trim() || "إرفاق ملف";
      const { data, error } = await supabase
        .from("task_responses" as any)
        .insert({
          task_id: taskId,
          committee_id: committeeId,
          user_id: user.id,
          author_name: authorName || user.email || "عضو",
          action_taken: placeholder,
          completion_percent: percent,
        })
        .select("id, user_id, author_name, action_taken, completion_percent, created_at")
        .single();
      if (error || !data) {
        toast.error("تعذّر إنشاء رد للمرفق", { description: error?.message });
        return;
      }
      target = data as any;
      setText("");
    }
    if (!target) return;
    setUploading(true);
    const path = `${committeeId}/${taskId}/${target.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage
      .from("task-response-attachments")
      .upload(path, file, { upsert: false });
    if (upErr) {
      setUploading(false);
      toast.error("تعذّر رفع الملف", { description: upErr.message });
      return;
    }
    const { error: insErr } = await supabase.from("task_response_attachments" as any).insert({
      response_id: target.id,
      task_id: taskId,
      committee_id: committeeId,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      file_type: file.type,
      uploaded_by: user.id,
    });
    setUploading(false);
    if (insErr) {
      toast.error("تعذّر تسجيل المرفق", { description: insErr.message });
      return;
    }
    toast.success("تم رفع الملف");
  };

  return (
    <div className="space-y-3">
      {/* Live progress strip */}
      <div className="flex items-center gap-2">
        <Progress value={percent} className="h-2 flex-1" />
        <Badge
          variant="outline"
          className={`text-[10.5px] font-bold border h-5 ${
            percent === 100
              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/40"
              : percent >= 50
                ? "bg-sky-500/10 text-sky-700 border-sky-500/40"
                : percent > 0
                  ? "bg-amber-500/10 text-amber-700 border-amber-500/40"
                  : "bg-muted text-muted-foreground"
          }`}
        >
          {percent}%
        </Badge>
      </div>

      {/* Quick response composer */}
      <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-2.5 space-y-2">
        <div className="flex items-center gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="اكتب رداً سريعاً واضغط Enter…"
            className="h-9 text-xs flex-1"
            maxLength={2000}
          />
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={onPickFile}
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9 shrink-0"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            title="إرفاق ملف"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Paperclip className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            type="button"
            size="icon"
            onClick={submit}
            disabled={submitting || !text.trim()}
            className="h-9 w-9 shrink-0 bg-primary text-primary-foreground"
            title="إرسال الرد"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        {/* Percent slider — native, themed, accessible */}
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] text-muted-foreground shrink-0">نسبة الإنجاز</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
            className="h-1.5 flex-1 accent-primary cursor-pointer"
            aria-label="نسبة الإنجاز"
          />
          <div className="flex items-center gap-0.5">
            {[0, 25, 50, 75, 100].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setPercent(v)}
                className={`text-[10px] font-bold w-7 h-5 rounded-md transition-colors ${
                  percent === v
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recent responses (compact thread) */}
      {loading ? (
        <div className="flex justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-[10.5px] text-muted-foreground text-center py-2 border border-dashed rounded-lg flex items-center justify-center gap-1.5">
          <MessageSquare className="h-3 w-3" /> لا توجد ردود بعد
        </p>
      ) : (
        <ul className="space-y-1.5 max-h-48 overflow-y-auto pe-1">
          {items.slice(0, 5).map((r) => {
            const mine = user?.id === r.user_id;
            return (
              <li
                key={r.id}
                className="group flex items-start gap-2 rounded-lg border border-border/60 bg-background/70 p-2"
              >
                <Avatar className="h-6 w-6 shrink-0 border border-primary/20">
                  <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-bold">
                    {initials(r.author_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[11px] font-bold truncate">{r.author_name}</span>
                      <span className="text-[9.5px] text-muted-foreground shrink-0">
                        {fmtDate(r.created_at)}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 h-4 rounded-md font-bold ${
                          r.completion_percent === 100
                            ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                            : r.completion_percent >= 50
                              ? "bg-sky-500/10 text-sky-700 border-sky-500/30"
                              : "bg-amber-500/10 text-amber-700 border-amber-500/30"
                        }`}
                      >
                        {r.completion_percent === 100 && (
                          <CheckCircle2 className="h-2.5 w-2.5 me-0.5" />
                        )}
                        {r.completion_percent}%
                      </Badge>
                    </div>
                    {mine && (
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        className="opacity-0 group-hover:opacity-100 transition h-5 w-5 rounded flex items-center justify-center hover:bg-destructive/10 hover:text-destructive shrink-0"
                        title="حذف"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap line-clamp-3">
                    {r.action_taken}
                  </p>
                </div>
              </li>
            );
          })}
          {items.length > 5 && (
            <li className="text-[10px] text-center text-muted-foreground py-1">
              … و {items.length - 5} رداً سابقاً
            </li>
          )}
        </ul>
      )}
    </div>
  );
}