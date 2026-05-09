import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Loader2, Save, ListTodo, PlayCircle, CheckCircle2,
  MessageSquare, Paperclip, CalendarClock, Flag, Type as TypeIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TaskComments } from "@/components/TaskComments";
import { TaskAttachments } from "@/components/TaskAttachments";

export type EditorTask = {
  id: string;
  title: string;
  description?: string | null;
  status: "todo" | "in_progress" | "completed";
  due_date?: string | null;
  committee_id: string;
};

const STATUS_META = {
  todo:        { label: "قائمة الانتظار", icon: ListTodo,     btn: "bg-slate-500/10 text-slate-700 border-slate-500/30 hover:bg-slate-500/20",   active: "bg-slate-600 text-white border-slate-700" },
  in_progress: { label: "قيد التنفيذ",   icon: PlayCircle,   btn: "bg-amber-500/10 text-amber-700 border-amber-500/30 hover:bg-amber-500/20", active: "bg-amber-600 text-white border-amber-700" },
  completed:   { label: "مكتملة",        icon: CheckCircle2, btn: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/20", active: "bg-emerald-600 text-white border-emerald-700" },
} as const;

interface Props {
  task: EditorTask | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
  /** Heads/admins can edit assignee + delete; passed through to show extra controls if true. */
  canManage?: boolean;
}

/**
 * Unified inline editor — any committee member can open it from a task card,
 * change status/details, and manage comments + attachments in one place.
 */
export function TaskEditorDialog({ task, open, onOpenChange, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<EditorTask["status"]>("todo");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStatus(task.status);
    setDueDate(task.due_date ?? "");
    setDirty(false);
  }, [task?.id]);

  if (!task) return null;

  const markDirty = () => setDirty(true);

  // Quick status change (instant + toast). Saves immediately even without "Save".
  const quickStatus = async (next: EditorTask["status"]) => {
    if (next === status) return;
    const prev = status;
    setStatus(next);
    const { error } = await supabase
      .from("committee_tasks")
      .update({ status: next })
      .eq("id", task.id);
    if (error) {
      setStatus(prev);
      toast.error("تعذّر نقل الحالة", { description: error.message });
      return;
    }
    toast.success(`تم النقل إلى «${STATUS_META[next].label}»`);
    onSaved?.();
  };

  const saveDetails = async () => {
    if (!title.trim()) {
      toast.error("العنوان مطلوب");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("committee_tasks")
      .update({
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
      })
      .eq("id", task.id);
    setSaving(false);
    if (error) {
      toast.error("تعذّر الحفظ", { description: error.message });
      return;
    }
    toast.success("تم حفظ التعديلات");
    setDirty(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="text-muted-foreground text-xs font-normal">تحرير المهمة:</span>
            <span className="line-clamp-1">{task.title}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Quick status pills — saves instantly */}
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
            <Flag className="h-3 w-3" /> الحالة (تُحفظ فور النقر)
          </Label>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(STATUS_META) as Array<EditorTask["status"]>).map((s) => {
              const m = STATUS_META[s];
              const Icon = m.icon;
              const isActive = status === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => quickStatus(s)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-bold transition ${
                    isActive ? m.active : m.btn
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <Tabs defaultValue="details" className="w-full mt-2">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="details" className="gap-1.5">
              <TypeIcon className="h-3.5 w-3.5" /> التفاصيل
            </TabsTrigger>
            <TabsTrigger value="comments" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> التعليقات
            </TabsTrigger>
            <TabsTrigger value="attachments" className="gap-1.5">
              <Paperclip className="h-3.5 w-3.5" /> المرفقات
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">عنوان المهمة *</Label>
              <Input
                value={title}
                onChange={(e) => { setTitle(e.target.value); markDirty(); }}
                placeholder="ما المهمة المطلوب إنجازها؟"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">الوصف والتفاصيل</Label>
              <Textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); markDirty(); }}
                rows={5}
                placeholder="اكتب تفاصيل التنفيذ، النتائج المتوقعة، أو أي ملاحظات..."
                className="resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs inline-flex items-center gap-1.5">
                <CalendarClock className="h-3 w-3" /> تاريخ الاستحقاق
              </Label>
              <Input
                dir="ltr"
                type="date"
                value={dueDate}
                onChange={(e) => { setDueDate(e.target.value); markDirty(); }}
                className="text-right"
              />
            </div>
            <div className="flex items-center justify-between gap-2 pt-2 border-t">
              {dirty ? (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-[10px]">
                  لديك تعديلات غير محفوظة
                </Badge>
              ) : <span />}
              <Button
                onClick={saveDetails}
                disabled={saving || !dirty}
                className="gap-2 bg-gradient-gold text-gold-foreground"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ التفاصيل
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="comments" className="mt-3">
            <TaskComments taskId={task.id} />
          </TabsContent>

          <TabsContent value="attachments" className="mt-3">
            <TaskAttachments taskId={task.id} committeeId={task.committee_id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
