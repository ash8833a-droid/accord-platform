import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, MessageSquare, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

interface Comment {
  id: string;
  body: string;
  author_name: string;
  user_id: string;
  created_at: string;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("");
}

function formatTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function TaskComments({ taskId }: { taskId: string }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [authorName, setAuthorName] = useState<string>("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("task_comments" as any)
        .select("id, body, author_name, user_id, created_at")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (!active) return;
      setComments((data ?? []) as any as Comment[]);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`task_comments_${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_comments", filter: `task_id=eq.${taskId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setAuthorName(data?.full_name ?? user.email ?? "عضو"));
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("يجب تسجيل الدخول لإضافة تعليق");
      return;
    }
    const text = body.trim();
    if (!text) return;
    setSubmitting(true);
    const { error } = await supabase.from("task_comments" as any).insert({
      task_id: taskId,
      user_id: user.id,
      author_name: authorName || user.email || "عضو",
      body: text,
    });
    setSubmitting(false);
    if (error) {
      toast.error("تعذّر إرسال التعليق", { description: error.message });
      return;
    }
    setBody("");
  };

  const remove = async (id: string) => {
    if (!confirm("حذف التعليق؟")) return;
    const { error } = await supabase.from("task_comments" as any).delete().eq("id", id);
    if (error) {
      toast.error("تعذّر الحذف", { description: error.message });
      return;
    }
    toast.success("تم حذف التعليق");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
        <MessageSquare className="h-4 w-4 text-primary" />
        <span>تعليقات الأعضاء</span>
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {comments.length}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-lg">
          لا توجد تعليقات بعد — كن أول من يكتب
        </p>
      ) : (
        <ul className="space-y-2 max-h-72 overflow-y-auto pe-1">
          {comments.map((c) => {
            const mine = user?.id === c.user_id;
            return (
              <li
                key={c.id}
                className={`group flex gap-2 rounded-lg p-2.5 border ${
                  mine ? "bg-primary/5 border-primary/20" : "bg-muted/40 border-border/60"
                }`}
              >
                <Avatar className="h-7 w-7 shrink-0 border border-primary/20">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                    {initials(c.author_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-bold truncate">{c.author_name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatTime(c.created_at)}
                      </span>
                    </div>
                    {mine && (
                      <button
                        type="button"
                        onClick={() => remove(c.id)}
                        className="opacity-0 group-hover:opacity-100 transition h-5 w-5 rounded flex items-center justify-center hover:bg-destructive/10 hover:text-destructive"
                        aria-label="حذف التعليق"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap break-words text-foreground/90">
                    {c.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={submit} className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="اكتب تعليقاً أو ملاحظة..."
          rows={2}
          className="resize-none text-xs"
          maxLength={1000}
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={submitting || !body.trim()}
            className="bg-gradient-hero text-primary-foreground gap-1.5 h-8 text-xs"
          >
            {submitting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            إرسال
          </Button>
        </div>
      </form>
    </div>
  );
}