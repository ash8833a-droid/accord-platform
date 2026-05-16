import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, Save, MessageSquare, Paperclip, History as HistoryIcon,
  CalendarClock, User2, Building2, Info, ListTodo, PlayCircle, CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TaskComments } from "@/components/TaskComments";
import { TaskAttachments } from "@/components/TaskAttachments";
import { TaskActivityLog } from "@/components/TaskActivityLog";
import { cn } from "@/lib/utils";

interface CommitteeRow { id: string; name: string; type: string }
interface Task {
  id: string;
  title: string;
  description: string | null;
  execution_brief?: string | null;
  committee_id: string;
  status: "todo" | "in_progress" | "completed";
  assigned_to: string | null;
  due_date: string | null;
}
interface MemberRow { id: string; full_name: string; is_head: boolean }

const STATUS_OPTIONS = [
  { value: "todo",        label: "قائمة الانتظار", icon: ListTodo,     dot: "bg-slate-400",   ring: "ring-slate-200",   text: "text-slate-700",   bg: "bg-slate-50" },
  { value: "in_progress", label: "قيد التنفيذ",   icon: PlayCircle,   dot: "bg-amber-500",   ring: "ring-amber-200",   text: "text-amber-700",   bg: "bg-amber-50" },
  { value: "completed",   label: "مكتملة",        icon: CheckCircle2, dot: "bg-emerald-500", ring: "ring-emerald-200", text: "text-emerald-700", bg: "bg-emerald-50" },
] as const;

function formatArabicDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
  } catch { return iso; }
}

export function TaskDetailsDialog({
  task, committee, canEdit, onClose, onChanged,
}: {
  task: Task;
  committee: CommitteeRow | null;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [executionBrief, setExecutionBrief] = useState(task.execution_brief ?? "");
  const [status, setStatus] = useState(task.status);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [assignedTo, setAssignedTo] = useState(task.assigned_to ?? "none");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("team_members").select("id, full_name, is_head")
      .eq("committee_id", task.committee_id)
      .order("is_head", { ascending: false })
      .order("full_name")
      .then(({ data }) => setMembers((data ?? []) as MemberRow[]));
  }, [task.committee_id]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("committee_tasks").update({
      title: title.trim(),
      description: description.trim() || null,
      execution_brief: executionBrief.trim() || null,
      status,
      due_date: dueDate || null,
      assigned_to: assignedTo === "none" ? null : assignedTo,
    }).eq("id", task.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحفظ");
    onChanged();
    onClose();
  };

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === status)!;
  const assigneeName = members.find((m) => m.id === assignedTo)?.full_name ?? "غير محدد";

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        dir="rtl"
        className="max-w-3xl max-h-[92vh] overflow-hidden p-0 rounded-[2rem] border-0 bg-white shadow-2xl
                   data-[state=open]:backdrop-blur-sm"
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-slate-100">
          <DialogHeader className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0 space-y-2">
                {committee && (
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full">
                    <Building2 className="h-3 w-3" />
                    {committee.name}
                  </div>
                )}
                <DialogTitle className="text-2xl font-bold text-slate-900 leading-tight text-right">
                  {title || "تفاصيل المهمة"}
                </DialogTitle>
              </div>
              {/* Status pill */}
              <div className={cn(
                "shrink-0 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 ring-1",
                currentStatus.bg, currentStatus.ring,
              )}>
                <span className={cn("h-1.5 w-1.5 rounded-full", currentStatus.dot)} />
                <span className={cn("text-xs font-semibold", currentStatus.text)}>{currentStatus.label}</span>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto max-h-[calc(92vh-220px)]">
          <Tabs defaultValue="info" className="w-full">
            {/* Segmented control */}
            <div className="px-8 pt-5">
              <TabsList className="grid w-full grid-cols-4 bg-slate-100 p-1 rounded-xl h-auto gap-1">
                {[
                  { v: "info",     label: "التفاصيل", icon: Info },
                  { v: "comments", label: "تعليقات",  icon: MessageSquare },
                  { v: "files",    label: "مرفقات",   icon: Paperclip },
                  { v: "log",      label: "النشاط",   icon: HistoryIcon },
                ].map(({ v, label, icon: Icon }) => (
                  <TabsTrigger
                    key={v}
                    value={v}
                    className="rounded-lg gap-1.5 text-xs font-semibold text-slate-500
                               data-[state=active]:bg-white data-[state=active]:text-slate-900
                               data-[state=active]:shadow-sm transition-all py-2"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="info" className="mt-6 px-8 pb-6 space-y-6">
              {/* Metadata grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MetaCard
                  icon={CalendarClock}
                  label="تاريخ الاستحقاق"
                  value={formatArabicDate(dueDate || null)}
                />
                <MetaCard
                  icon={User2}
                  label="المسؤول"
                  value={assigneeName}
                />
                <MetaCard
                  icon={Building2}
                  label="اللجنة"
                  value={committee?.name ?? "—"}
                />
              </div>

              <fieldset disabled={!canEdit} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-600">العنوان</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-slate-50 border-slate-100 rounded-xl h-11 focus-visible:bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-600">الوصف</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    className="bg-slate-50 border-slate-100 rounded-xl resize-none focus-visible:bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-600">الحالة</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as Task["status"])}>
                      <SelectTrigger className="bg-slate-50 border-slate-100 rounded-xl h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            <span className="inline-flex items-center gap-2">
                              <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
                              {s.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-600">تاريخ الاستحقاق</Label>
                    <Input
                      dir="ltr"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="bg-slate-50 border-slate-100 rounded-xl h-11 text-right focus-visible:bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-600">المسؤول</Label>
                    <Select value={assignedTo} onValueChange={setAssignedTo}>
                      <SelectTrigger className="bg-slate-50 border-slate-100 rounded-xl h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">بدون</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </fieldset>
            </TabsContent>

            <TabsContent value="comments" className="mt-6 px-8 pb-8">
              <TaskComments taskId={task.id} />
            </TabsContent>
            <TabsContent value="files" className="mt-6 px-8 pb-8">
              <TaskAttachments taskId={task.id} committeeId={task.committee_id} />
            </TabsContent>
            <TabsContent value="log" className="mt-6 px-8 pb-8">
              <TaskActivityLog taskId={task.id} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer — anchored */}
        {canEdit && (
          <div className="px-8 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              إلغاء
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="gap-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl px-6 h-11
                         shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ التغييرات
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MetaCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-start gap-3">
      <div className="h-9 w-9 rounded-lg bg-white border border-slate-100 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-teal-700" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium text-slate-500 mb-0.5">{label}</div>
        <div className="text-sm font-semibold text-slate-800 truncate">{value}</div>
      </div>
    </div>
  );
}
