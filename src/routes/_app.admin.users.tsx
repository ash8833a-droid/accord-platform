import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminListUsers, adminDeleteUser, adminResetPassword, adminToggleAccount, adminUpdateUserRole } from "@/server/admin-users";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Users as UsersIcon, ShieldCheck, KeyRound, Ban, CheckCircle2, Trash2, Search, Settings2, History } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { CreateMemberDialog } from "@/components/admin/CreateMemberDialog";
import { UserPermissionsPanel } from "@/components/admin/UserPermissionsPanel";

export const Route = createFileRoute("/_app/admin/users")({
  component: UsersPage,
});

interface UserRow {
  user_id: string;
  full_name: string;
  phone: string;
  family_branch: string | null;
  created_at: string;
  roles: { role: string; committee_id: string | null }[];
  status: { is_disabled: boolean; disabled_reason?: string | null };
}

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير", committee: "عضو لجنة", delegate: "مندوب", quality: "جودة",
};

function UsersPage() {
  const { hasRole } = useAuth();
  const list = useServerFn(adminListUsers);
  const del = useServerFn(adminDeleteUser);
  const reset = useServerFn(adminResetPassword);
  const toggle = useServerFn(adminToggleAccount);
  const updRole = useServerFn(adminUpdateUserRole);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [committees, setCommittees] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [roleEdit, setRoleEdit] = useState<UserRow | null>(null);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [delUser, setDelUser] = useState<UserRow | null>(null);
  const [activityUser, setActivityUser] = useState<UserRow | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [permsUser, setPermsUser] = useState<UserRow | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [newRole, setNewRole] = useState<string>("committee");
  const [newCommittee, setNewCommittee] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await list();
      setUsers(data as UserRow[]);
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  useEffect(() => {
    if (!hasRole("admin")) return;
    reload();
    supabase.from("committees").select("id, name").then(({ data }) => setCommittees(data ?? []));
  }, [hasRole]);

  useEffect(() => {
    if (!activityUser) return;
    supabase.from("user_activity_log").select("*")
      .eq("user_id", activityUser.user_id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setActivity(data ?? []));
  }, [activityUser]);

  if (!hasRole("admin")) {
    return <div className="p-6 text-center text-muted-foreground">هذه الصفحة للمدير فقط</div>;
  }

  const filtered = users.filter((u) =>
    !q || u.full_name?.includes(q) || u.phone?.includes(q) || u.family_branch?.includes(q),
  );

  const handleToggle = async (u: UserRow) => {
    setBusy(true);
    try {
      await toggle({ data: { user_id: u.user_id, disabled: !u.status.is_disabled } });
      toast.success(u.status.is_disabled ? "تم تفعيل الحساب" : "تم تعطيل الحساب");
      await reload();
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const handleDelete = async () => {
    if (!delUser) return;
    setBusy(true);
    try {
      await del({ data: { user_id: delUser.user_id } });
      toast.success("تم حذف المستخدم نهائياً");
      setDelUser(null);
      await reload();
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const handleReset = async () => {
    if (!resetUser) return;
    if (newPwd.length < 6) return toast.error("كلمة المرور قصيرة");
    setBusy(true);
    try {
      await reset({ data: { user_id: resetUser.user_id, new_password: newPwd } });
      toast.success("تم تغيير كلمة المرور");
      setResetUser(null); setNewPwd("");
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const handleSaveRole = async () => {
    if (!roleEdit) return;
    setBusy(true);
    try {
      await updRole({ data: { user_id: roleEdit.user_id, role: newRole as any, committee_id: newCommittee || null } });
      toast.success("تم تحديث الدور");
      setRoleEdit(null);
      await reload();
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-8 text-primary-foreground shadow-elegant">
        <div className="absolute -top-10 -left-10 w-72 h-72 bg-gold/20 rounded-full blur-3xl" />
        <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gold/20 flex items-center justify-center backdrop-blur-sm">
              <UsersIcon className="h-7 w-7 text-gold" />
            </div>
            <div>
              <p className="text-sm text-primary-foreground/70">إدارة المنصة</p>
              <h1 className="text-2xl lg:text-3xl font-bold">بوابة <span className="text-shimmer-gold">المستخدمين</span></h1>
              <p className="text-primary-foreground/80 text-sm mt-1">إضافة، تعطيل، حذف، إعادة تعيين كلمة المرور، وتعديل الدور</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <CreateMemberDialog />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-6">
          <CardTitle className="text-base">قائمة المستخدمين ({filtered.length})</CardTitle>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم أو الجوال..." value={q} onChange={(e) => setQ(e.target.value)} className="ps-9 w-full sm:w-64" />
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          {loading ? <p className="text-center py-8 text-muted-foreground">جاري التحميل...</p> :
           filtered.length === 0 ? <p className="text-center py-8 text-muted-foreground">لا يوجد مستخدمون</p> : (
            <div className="space-y-2">
              {filtered.map((u) => {
                const role = u.roles[0];
                const committee = committees.find((c) => c.id === role?.committee_id);
                return (
                  <div key={u.user_id} className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border p-4 transition-colors ${u.status.is_disabled ? "bg-destructive/5 border-destructive/30" : "hover:bg-accent/40"}`}>
                    <button
                      onClick={() => setPermsUser(u)}
                      className="flex items-start gap-3 flex-1 min-w-0 w-full text-right group"
                      title="عرض/تعديل صلاحيات هذا المستخدم"
                    >
                      <div className="h-10 w-10 rounded-full bg-gradient-gold flex items-center justify-center text-gold-foreground font-bold shrink-0 group-hover:ring-2 group-hover:ring-gold/50 transition-all">
                        {u.full_name?.[0] || "?"}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="font-bold truncate group-hover:text-primary transition-colors">{u.full_name}</p>
                        <div className="flex items-center gap-1 flex-wrap">
                          {role && <Badge variant="secondary" className="text-[10px]">{ROLE_LABELS[role.role] ?? role.role}</Badge>}
                          {committee && <Badge variant="outline" className="text-[10px]">{committee.name}</Badge>}
                          {u.status.is_disabled && <Badge variant="destructive" className="text-[10px]">معطّل</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{u.phone} · {u.family_branch || "—"}</p>
                      </div>
                    </button>
                    <div className="flex gap-1 flex-wrap justify-end shrink-0">
                      <Button size="sm" variant="outline" onClick={() => setPermsUser(u)} title="الصلاحيات">
                        <ShieldCheck className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setRoleEdit(u); setNewRole(role?.role ?? "committee"); setNewCommittee(role?.committee_id ?? ""); }} title="تعديل الدور">
                        <Settings2 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setActivityUser(u)} title="سجل النشاط">
                        <History className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setResetUser(u)} title="إعادة كلمة المرور">
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant={u.status.is_disabled ? "default" : "outline"} onClick={() => handleToggle(u)} disabled={busy} title={u.status.is_disabled ? "تفعيل" : "تعطيل"}>
                        {u.status.is_disabled ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setDelUser(u)} title="حذف">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit role */}
      <Dialog open={!!roleEdit} onOpenChange={(o) => !o && setRoleEdit(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل الدور واللجنة — {roleEdit?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الدور</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="committee">عضو لجنة</SelectItem>
                  <SelectItem value="committee_head">رئيس اللجنة</SelectItem>
                  <SelectItem value="delegate">مندوب أسرة</SelectItem>
                  <SelectItem value="quality">جودة</SelectItem>
                  <SelectItem value="admin">مدير نظام</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>اللجنة (اختياري)</Label>
              <Select value={newCommittee || "none"} onValueChange={(v) => setNewCommittee(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="بدون لجنة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— بدون لجنة —</SelectItem>
                  {committees.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleEdit(null)}>إلغاء</Button>
            <Button onClick={handleSaveRole} disabled={busy}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password */}
      <Dialog open={!!resetUser} onOpenChange={(o) => !o && setResetUser(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إعادة تعيين كلمة المرور — {resetUser?.full_name}</DialogTitle>
            <DialogDescription>سيتم تحديث كلمة المرور فوراً. أبلغ المستخدم بها يدوياً.</DialogDescription>
          </DialogHeader>
          <Input type="text" placeholder="كلمة مرور جديدة (6+ أحرف)" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUser(null)}>إلغاء</Button>
            <Button onClick={handleReset} disabled={busy}>تحديث</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!delUser} onOpenChange={(o) => !o && setDelUser(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف نهائي — {delUser?.full_name}</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف الحساب وكل صلاحياته نهائياً. لا يمكن التراجع.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activity log */}
      <Dialog open={!!activityUser} onOpenChange={(o) => !o && setActivityUser(null)}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>سجل نشاط — {activityUser?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {activity.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">لا يوجد نشاط مسجّل</p> :
              activity.map((a) => (
                <div key={a.id} className="border rounded-lg p-3 text-sm">
                  <div className="flex justify-between items-start">
                    <span className="font-medium">{a.event_label || a.event_type}</span>
                    <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("ar-SA")}</span>
                  </div>
                  {a.event_type && <p className="text-xs text-muted-foreground mt-1">{a.event_type}</p>}
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Permissions panel */}
      <Dialog open={!!permsUser} onOpenChange={(o) => !o && setPermsUser(null)}>
        <DialogContent dir="rtl" className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              صلاحيات الصفحات — {permsUser?.full_name}
            </DialogTitle>
            <DialogDescription>حدد لكل صفحة: مخفي، قراءة فقط، أو تعديل كامل.</DialogDescription>
          </DialogHeader>
          {permsUser && (
            <UserPermissionsPanel userId={permsUser.user_id} fullName={permsUser.full_name} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
