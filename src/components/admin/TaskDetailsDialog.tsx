import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, MessageSquare, Paperclip, History as HistoryIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TaskComments } from "@/components/TaskComments";
import { TaskAttachments } from "@/components/TaskAttachments";
import { TaskActivityLog } from "@/components/TaskActivityLog";

interface CommitteeRow { id: string; name: string; type: string }
interface Task {
  id: string;
  title: string;
  description: string | null;
  committee_id: string;
  status: "todo" | "in_progress" | "completed";
  priority: "low" | "medium" | "high" | "urgent";
  assigned_to: string | null;
  due_date: string | null;
}
interface MemberRow { id: string; full_name: string; is_head: boolean }

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
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
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
      status, priority,
      due_date: dueDate || null,
      assigned_to: assignedTo === "none" ? null : assignedTo,
    }).eq("id", task.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحفظ");
    onChanged();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>تفاصيل المهمة</span>
            {committee && <Badge variant="outline">{committee.name}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="info">المعلومات</TabsTrigger>
            <TabsTrigger value="comments"><MessageSquare className="h-3.5 w-3.5 ml-1" />تعليقات</TabsTrigger>
            <TabsTrigger value="files"><Paperclip className="h-3.5 w-3.5 ml-1" />مرفقات</TabsTrigger>
            <TabsTrigger value="log"><HistoryIcon className="h-3.5 w-3.5 ml-1" />السجل</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-4 space-y-3">
            <fieldset disabled={!canEdit} className="space-y-3">
              <div className="space-y-1.5">
                <Label>العنوان</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>الوصف</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label>الحالة</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as Task["status"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">قائمة الانتظار</SelectItem>
                      <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                      <SelectItem value="completed">مكتملة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>الأولوية</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as Task["priority"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">منخفضة</SelectItem>
                      <SelectItem value="medium">متوسطة</SelectItem>
                      <SelectItem value="high">عالية</SelectItem>
                      <SelectItem value="urgent">عاجلة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>تاريخ الاستحقاق</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>المسؤول</Label>
                  <Select value={assignedTo} onValueChange={setAssignedTo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون</SelectItem>
                      {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </fieldset>
            {canEdit && (
              <div className="flex justify-end pt-2">
                <Button onClick={save} disabled={saving} className="gap-2 bg-gradient-gold text-gold-foreground">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  حفظ التغييرات
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="comments" className="mt-4">
            <TaskComments taskId={task.id} />
          </TabsContent>
          <TabsContent value="files" className="mt-4">
            <TaskAttachments taskId={task.id} committeeId={task.committee_id} />
          </TabsContent>
          <TabsContent value="log" className="mt-4">
            <TaskActivityLog taskId={task.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
