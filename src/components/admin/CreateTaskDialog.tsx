import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

interface CommitteeRow { id: string; name: string; type: string }
interface MemberRow { id: string; full_name: string; is_head: boolean }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  committees: CommitteeRow[];
  defaultCommitteeId?: string | null;
  onCreated: () => void;
}

export function CreateTaskDialog({ open, onOpenChange, committees, defaultCommitteeId, onCreated }: Props) {
  const isMobile = useIsMobile();
  const [committeeId, setCommitteeId] = useState<string>(defaultCommitteeId ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [executionBrief, setExecutionBrief] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("none");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!committeeId) { setMembers([]); return; }
    supabase.from("team_members")
      .select("id, full_name, is_head")
      .eq("committee_id", committeeId)
      .order("is_head", { ascending: false })
      .order("full_name")
      .then(({ data }) => setMembers((data ?? []) as MemberRow[]));
  }, [committeeId]);

  const reset = () => {
    setCommitteeId(defaultCommitteeId ?? "");
    setTitle(""); setDescription(""); setExecutionBrief(""); setDueDate(""); setAssignedTo("none");
  };

  const submit = async () => {
    if (!committeeId || !title.trim()) {
      toast.error("اختر اللجنة واكتب عنوان المهمة");
      return;
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("committee_tasks").insert({
      committee_id: committeeId,
      title: title.trim(),
      description: description.trim() || null,
      execution_brief: executionBrief.trim() || null,
      status: "todo",
      due_date: dueDate || null,
      assigned_to: assignedTo === "none" ? null : assignedTo,
      created_by: u.user?.id,
    });
    setSaving(false);
    if (error) { toast.error("تعذّر الإنشاء: " + error.message); return; }
    toast.success("تم إنشاء المهمة");
    reset();
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent
        dir="rtl"
        className={
          isMobile
            ? "max-w-full w-full rounded-t-2xl rounded-b-none p-5 fixed left-0 right-0 bottom-0 top-auto translate-x-0 translate-y-0 data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom border-t-4 border-emerald-700"
            : "max-w-lg"
        }
      >
        {isMobile && (
          <div className="mx-auto -mt-2 mb-2 h-1.5 w-12 rounded-full bg-muted-foreground/30" aria-hidden />
        )}
        <DialogHeader>
          <DialogTitle>إنشاء مهمة جديدة</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {(!isMobile || !defaultCommitteeId) && (
          <div className="space-y-1.5">
            <Label>اللجنة *</Label>
            <Select value={committeeId} onValueChange={setCommitteeId}>
              <SelectTrigger><SelectValue placeholder="اختر لجنة..." /></SelectTrigger>
              <SelectContent>
                {committees.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          )}
          <div className="space-y-1.5">
            <Label>العنوان *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ما المهمة المطلوب إنجازها؟" />
          </div>
          <div className="space-y-1.5">
            <Label>المطلوب لتنفيذ المهمة</Label>
            <Textarea
              value={executionBrief}
              onChange={(e) => setExecutionBrief(e.target.value)}
              rows={2}
              placeholder="شرح مختصر للخطوات أو المتطلبات اللازمة لإنجاز المهمة..."
            />
          </div>
          {!isMobile && (
            <div className="space-y-1.5">
              <Label>الوصف</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="تفاصيل المهمة، النتائج المتوقعة..." />
            </div>
          )}
          {!isMobile && (
            <div className="space-y-1.5">
              <Label>تاريخ الاستحقاق</Label>
              <Input dir="ltr" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="text-right" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>تعيين عضو</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo} disabled={!committeeId}>
              <SelectTrigger><SelectValue placeholder={committeeId ? "بدون تعيين" : "اختر اللجنة أولاً"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون تعيين</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name}{m.is_head ? " — رئيس اللجنة" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className={isMobile ? "flex-col-reverse gap-2 sm:flex-row" : ""}>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving} className={isMobile ? "w-full h-11" : ""}>إلغاء</Button>
          <Button onClick={submit} disabled={saving} className={`gap-2 bg-gradient-gold text-gold-foreground ${isMobile ? "w-full h-12 text-base" : ""}`}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            إنشاء المهمة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
