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
import { Users as UsersIcon, ShieldCheck, KeyRound, Ban, CheckCircle2, Trash2, Search, Settings2, History, Crown, Mail, Pencil } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { CreateMemberDialog } from "@/components/admin/CreateMemberDialog";
import { UserPermissionsPanel } from "@/components/admin/UserPermissionsPanel";

function StatBox({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "primary" | "gold" | "muted" }) {
  const toneClass =
    tone === "gold" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
    tone === "primary" ? "bg-primary/10 text-primary" :
    "bg-muted text-muted-foreground";
  return (
    <Card className="p-5 flex items-center justify-between gap-4">
      <div className="text-right">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
      </div>
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${toneClass}`}>{icon}</div>
    </Card>
  );
}

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
  admin: "مدير النظام", committee: "عضو لجنة", committee_head: "رئيس لجنة", delegate: "مندوب", quality: "جودة",
};

const ROLE_BADGE_STYLES: Record<string, string> = {
  admin: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  committee_head: "bg-primary/10 text-primary border-primary/30",
  committee: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  delegate: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  quality: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
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
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [committeeFilter, setCommitteeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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

  const filtered = users.filter((u) => {
    if (q && !(u.full_name?.includes(q) || u.phone?.includes(q) || u.family_branch?.includes(q))) return false;
    const role = u.roles[0];
    if (roleFilter !== "all" && role?.role !== roleFilter) return false;
    if (committeeFilter !== "all") {
      if (committeeFilter === "none" ? !!role?.committee_id : role?.committee_id !== committeeFilter) return false;
    }
    if (statusFilter === "active" && u.status.is_disabled) return false;
    if (statusFilter === "disabled" && !u.status.is_disabled) return false;
    return true;
  });

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
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="text-right">
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">لوحة تحكم الإدارة</h1>
          <p className="text-muted-foreground mt-1 text-sm">إدارة المستخدمين والصلاحيات ومراقبة النظام</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="default" className="gap-2">
            <UsersIcon className="h-4 w-4" /> المستخدمون
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/communications"><Mail className="h-4 w-4" /> سجل المراسلات</Link>
          </Button>
          <CreateMemberDialog />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatBox icon={<UsersIcon className="h-5 w-5" />} label="إجمالي الموظفين" value={users.length} tone="primary" />
        <StatBox icon={<Crown className="h-5 w-5" />} label="مدراء النظام" value={users.filter((u) => u.roles.some((r) => r.role === "admin")).length} tone="gold" />
        <StatBox icon={<ShieldCheck className="h-5 w-5" />} label="مدراء" value={users.filter((u) => u.roles.some((r) => r.role === "admin" || r.role === "committee_head")).length} tone="muted" />
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-6 border-b">
          <CardTitle className="text-lg">الموظفون والصلاحيات</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-wrap">
            <div className="relative w-full sm:w-60">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="بحث بالاسم أو الجوال..." value={q} onChange={(e) => setQ(e.target.value)} className="ps-9 w-full" />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="الصلاحية" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الصلاحيات</SelectItem>
                <SelectItem value="admin">مدير نظام</SelectItem>
                <SelectItem value="committee_head">رئيس لجنة</SelectItem>
                <SelectItem value="committee">عضو لجنة</SelectItem>
                <SelectItem value="delegate">مندوب</SelectItem>
                <SelectItem value="quality">جودة</SelectItem>
              </SelectContent>
            </Select>
            <Select value={committeeFilter} onValueChange={setCommitteeFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="القسم" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأقسام</SelectItem>
                <SelectItem value="none">— بدون قسم —</SelectItem>
                {committees.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="active">مفعّل</SelectItem>
                <SelectItem value="disabled">معطّل</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-center py-12 text-muted-foreground">جاري التحميل...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">لا يوجد مستخدمون</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">الجوال</TableHead>
                  <TableHead className="text-right">المنصب</TableHead>
                  <TableHead className="text-right">الصلاحية</TableHead>
                  <TableHead className="text-right">القسم</TableHead>
                  <TableHead className="text-right">تغيير الصلاحية</TableHead>
                  <TableHead className="text-right">تغيير القسم</TableHead>
                  <TableHead className="text-center">تعديل</TableHead>
                  <TableHead className="text-center text-destructive">حذف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => {
                  const role = u.roles[0];
                  const roleKey = role?.role ?? "";
                  const committee = committees.find((c) => c.id === role?.committee_id);
                  return (
                    <TableRow key={u.user_id} className={u.status.is_disabled ? "bg-destructive/5" : ""}>
                      <TableCell className="font-semibold whitespace-nowrap">{u.full_name}</TableCell>
                      <TableCell className="text-muted-foreground" dir="ltr">{u.phone}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{ROLE_LABELS[roleKey] ?? "—"}</TableCell>
                      <TableCell>
                        {role ? (
                          <Badge variant="outline" className={`gap-1 ${ROLE_BADGE_STYLES[roleKey] ?? ""}`}>
                            {roleKey === "admin" && <Crown className="h-3 w-3" />}
                            {(roleKey === "committee_head" || roleKey === "quality") && <ShieldCheck className="h-3 w-3" />}
                            {ROLE_LABELS[roleKey] ?? roleKey}
                          </Badge>
                        ) : <span className="text-muted-foreground">—</span>}
                        {u.status.is_disabled && <Badge variant="destructive" className="ms-1 text-[10px]">معطّل</Badge>}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{committee?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Select
                          value={roleKey || undefined}
                          onValueChange={async (v) => {
                            setBusy(true);
                            try {
                              await updRole({ data: { user_id: u.user_id, role: v as any, committee_id: role?.committee_id ?? null } });
                              toast.success("تم تحديث الصلاحية");
                              await reload();
                            } catch (e: any) { toast.error(e.message); }
                            setBusy(false);
                          }}
                        >
                          <SelectTrigger className="h-8 w-32"><SelectValue placeholder="الصلاحية" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="committee">عضو لجنة</SelectItem>
                            <SelectItem value="committee_head">رئيس لجنة</SelectItem>
                            <SelectItem value="delegate">مندوب</SelectItem>
                            <SelectItem value="quality">جودة</SelectItem>
                            <SelectItem value="admin">مدير نظام</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={role?.committee_id ?? "none"}
                          onValueChange={async (v) => {
                            if (!roleKey) return toast.error("حدّد الصلاحية أولاً");
                            setBusy(true);
                            try {
                              await updRole({ data: { user_id: u.user_id, role: roleKey as any, committee_id: v === "none" ? null : v } });
                              toast.success("تم تحديث القسم");
                              await reload();
                            } catch (e: any) { toast.error(e.message); }
                            setBusy(false);
                          }}
                        >
                          <SelectTrigger className="h-8 w-36"><SelectValue placeholder="القسم" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— بدون —</SelectItem>
                            {committees.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="inline-flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setPermsUser(u)} title="الصلاحيات التفصيلية">
                            <ShieldCheck className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setResetUser(u)} title="إعادة كلمة المرور">
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setActivityUser(u)} title="سجل النشاط">
                            <History className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleToggle(u)} disabled={busy} title={u.status.is_disabled ? "تفعيل" : "تعطيل"}>
                            {u.status.is_disabled ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Ban className="h-4 w-4" />}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => { setRoleEdit(u); setNewRole(roleKey || "committee"); setNewCommittee(role?.committee_id ?? ""); }} title="تعديل">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button size="icon" variant="ghost" onClick={() => setDelUser(u)} title="حذف" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
