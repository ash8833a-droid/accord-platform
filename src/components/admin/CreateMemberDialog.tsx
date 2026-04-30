import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { adminCreateMember } from "@/server/admin-create-member";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Role = "admin" | "committee" | "committee_head" | "delegate" | "quality";

interface Committee {
  id: string;
  name: string;
}

const ROLE_OPTIONS: { value: Role; label: string; hint: string }[] = [
  { value: "committee", label: "عضو/منسق لجنة", hint: "يرى لجنته فقط — الخيار الافتراضي للأعضاء" },
  { value: "committee_head", label: "رئيس اللجنة", hint: "رئيس لجنة محدد — يدير اللجنة وأعضاءها" },
  { value: "delegate", label: "مندوب أسرة", hint: "خاص بمندوبي الأسرة لتحصيل الاشتراكات" },
  { value: "quality", label: "الجودة (رقابي شامل)", hint: "⚠️ يرى جميع اللجان — استخدمه فقط لأعضاء لجنة الجودة" },
  { value: "admin", label: "مدير نظام (صلاحيات كاملة)", hint: "⚠️ صلاحيات إدارة كاملة على المنصة" },
];

export function CreateMemberDialog({ onCreated }: { onCreated?: () => void }) {
  const createMember = useServerFn(adminCreateMember);
  const [open, setOpen] = useState(false);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [familyBranch, setFamilyBranch] = useState("");
  const [role, setRole] = useState<Role>("committee");
  const [committeeId, setCommitteeId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    supabase
      .from("committees")
      .select("id,name")
      .order("name")
      .then(({ data }) => setCommittees(data ?? []));
  }, [open]);

  const reset = () => {
    setFullName("");
    setPhone("");
    setPassword("");
    setFamilyBranch("");
    setRole("committee");
    setCommitteeId("");
  };

  const submit = async () => {
    if (!fullName.trim() || !phone.trim() || !password.trim()) {
      toast.error("يرجى تعبئة الاسم والجوال وكلمة المرور");
      return;
    }
    if (password.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    if ((role === "committee" || role === "quality") && !committeeId) {
      toast.error("يرجى اختيار اللجنة");
      return;
    }

    setSubmitting(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        toast.error("انتهت الجلسة، يرجى إعادة تسجيل الدخول");
        return;
      }
      await createMember({
        data: {
          full_name: fullName.trim(),
          phone: phone.trim(),
          password,
          family_branch: familyBranch.trim() || null,
          role,
          committee_id: committeeId || null,
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("تم إنشاء الحساب بنجاح", {
        description: `الجوال: ${phone} — يمكنه تسجيل الدخول الآن`,
      });
      reset();
      setOpen(false);
      onCreated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ غير متوقع");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          إنشاء حساب لعضو جديد
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>إنشاء حساب عضو</DialogTitle>
          <DialogDescription>
            ينشئ المدير الحساب نيابةً عن العضو ويعتمد صلاحياته فوراً.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>الاسم الكامل</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="مثال: محمد بن عبدالله" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>رقم الجوال</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xxxxxxxx" inputMode="numeric" />
            </div>
            <div className="grid gap-1.5">
              <Label>كلمة المرور</Label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 أحرف على الأقل" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>الفخذ / الفرع العائلي (اختياري)</Label>
            <Input value={familyBranch} onChange={(e) => setFamilyBranch(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>الصلاحية</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <div className="flex flex-col items-start text-right">
                        <span>{o.label}</span>
                        <span className="text-[11px] text-muted-foreground">{o.hint}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(role === "quality" || role === "admin") && (
                <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 p-2 text-[11px] text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    {role === "quality"
                      ? "صلاحية «الجودة» تمنح المستخدم اطّلاعاً على بيانات جميع اللجان. تأكّد أن العضو فعلاً من فريق الجودة."
                      : "صلاحية «مدير نظام» تمنح إدارة كاملة للمنصة (إنشاء/حذف/اعتماد). امنحها بحذر شديد."}
                  </span>
                </div>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label>اللجنة {role === "admin" || role === "delegate" ? "(اختياري)" : ""}</Label>
              <Select value={committeeId} onValueChange={setCommitteeId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر اللجنة" />
                </SelectTrigger>
                <SelectContent>
                  {committees.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>إلغاء</Button>
          <Button onClick={submit} disabled={submitting} className="gap-2">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            إنشاء الحساب
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
