import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Search, UserX, Save, Users } from "lucide-react";

type Role = "admin" | "committee" | "delegate" | "quality";

interface Committee {
  id: string;
  name: string;
}

interface Member {
  user_id: string;
  full_name: string;
  phone: string;
  family_branch: string | null;
  role: Role;
  committee_id: string | null;
  committee_name: string | null;
  role_row_id: string;
}

const ROLE_LABELS: Record<Role, string> = {
  admin: "مدير النظام",
  committee: "رئيس اللجنة",
  delegate: "عضو اللجنة",
  quality: "عضو اللجنة",
};

const ROLE_TONES: Record<Role, string> = {
  admin: "bg-destructive/15 text-destructive",
  committee: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  delegate: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  quality: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

// Roles selectable from the dropdown (admin is hidden to prevent accidental privilege escalation)
// "quality" / "متعاون" is intentionally excluded — replaced by رئيس / عضو اللجنة based on tasking.
const SELECTABLE_ROLES: Role[] = ["committee", "delegate"];

interface Props {
  isAdmin: boolean;
}

export function ApprovedMembers({ isAdmin }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, { role: Role; committee_id: string | null }>>({});

  const load = async () => {
    setLoading(true);
    const [rolesRes, profilesRes, comRes] = await Promise.all([
      supabase
        .from("user_roles")
        .select("id, user_id, role, committee_id, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name, phone, family_branch"),
      supabase.from("committees").select("id, name").order("name"),
    ]);

    const profMap = new Map(
      (profilesRes.data ?? []).map((p) => [p.user_id, p]),
    );
    const comList = (comRes.data ?? []) as Committee[];
    const comMap = new Map(comList.map((c) => [c.id, c.name]));

    const rows: Member[] = (rolesRes.data ?? []).map((r) => {
      const prof = profMap.get(r.user_id);
      return {
        user_id: r.user_id,
        full_name: prof?.full_name ?? "—",
        phone: prof?.phone ?? "—",
        family_branch: prof?.family_branch ?? null,
        role: r.role as Role,
        committee_id: r.committee_id,
        committee_name: r.committee_id ? comMap.get(r.committee_id) ?? null : null,
        role_row_id: r.id,
      };
    });

    setCommittees(comList);
    setMembers(rows);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = members.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.full_name.toLowerCase().includes(q) ||
      m.phone.toLowerCase().includes(q) ||
      (m.family_branch ?? "").toLowerCase().includes(q) ||
      (m.committee_name ?? "").toLowerCase().includes(q)
    );
  });

  const setEdit = (id: string, patch: Partial<{ role: Role; committee_id: string | null }>) => {
    setEditing((prev) => {
      const cur = prev[id] ?? { role: members.find((m) => m.role_row_id === id)!.role, committee_id: members.find((m) => m.role_row_id === id)!.committee_id };
      return { ...prev, [id]: { ...cur, ...patch } };
    });
  };

  const save = async (m: Member) => {
    const change = editing[m.role_row_id];
    if (!change) return;
    const newRole = change.role;
    const newCommittee = newRole === "admin" || newRole === "quality" ? null : change.committee_id;

    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole, committee_id: newCommittee })
      .eq("id", m.role_row_id);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم تحديث صلاحيات العضو");
    setEditing((p) => {
      const c = { ...p };
      delete c[m.role_row_id];
      return c;
    });
    load();
  };

  const revoke = async (m: Member) => {
    // Remove all their role rows -> they lose access (account stays in auth.users)
    const { error } = await supabase.from("user_roles").delete().eq("user_id", m.user_id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`تم إيقاف العضو ${m.full_name} (الحساب لم يُحذف)`);
    load();
  };

  if (!isAdmin) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">هذه الصفحة متاحة لمدير النظام فقط.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          إجمالي الأعضاء المعتمدين: <span className="font-bold text-foreground">{members.length}</span>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو الجوال أو اللجنة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">العضو</TableHead>
              <TableHead className="text-right">الجوال</TableHead>
              <TableHead className="text-right">الفرع</TableHead>
              <TableHead className="text-right">الدور</TableHead>
              <TableHead className="text-right">اللجنة</TableHead>
              <TableHead className="text-center">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                  جاري التحميل...
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                  لا يوجد أعضاء مطابقون
                </TableCell>
              </TableRow>
            )}
            {filtered.map((m) => {
              const edit = editing[m.role_row_id];
              const curRole = edit?.role ?? m.role;
              const curCommittee = edit?.committee_id ?? m.committee_id;
              const dirty = !!edit && (edit.role !== m.role || edit.committee_id !== m.committee_id);
              const needsCommittee = curRole === "committee" || curRole === "delegate";

              return (
                <TableRow key={m.role_row_id}>
                  <TableCell className="font-medium">{m.full_name}</TableCell>
                  <TableCell className="text-xs font-mono">{m.phone}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{m.family_branch ?? "—"}</TableCell>
                  <TableCell>
                    <Select
                      value={curRole}
                      onValueChange={(v) => setEdit(m.role_row_id, { role: v as Role })}
                    >
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue>
                          <Badge variant="secondary" className={ROLE_TONES[curRole]}>
                            {ROLE_LABELS[curRole]}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {SELECTABLE_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                        ))}
                        {curRole === "admin" && (
                          <SelectItem value="admin" disabled>{ROLE_LABELS.admin}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {needsCommittee ? (
                      <Select
                        value={curCommittee ?? ""}
                        onValueChange={(v) => setEdit(m.role_row_id, { committee_id: v })}
                      >
                        <SelectTrigger className="h-8 w-44">
                          <SelectValue placeholder="اختر لجنة" />
                        </SelectTrigger>
                        <SelectContent>
                          {committees.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant={dirty ? "default" : "outline"}
                        disabled={!dirty || (needsCommittee && !curCommittee)}
                        onClick={() => save(m)}
                        className="h-8 gap-1"
                      >
                        <Save className="h-3.5 w-3.5" /> حفظ
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-8 gap-1 text-destructive hover:bg-destructive/10">
                            <UserX className="h-3.5 w-3.5" /> إيقاف
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent dir="rtl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>إيقاف العضو</AlertDialogTitle>
                            <AlertDialogDescription>
                              سيتم إلغاء جميع صلاحيات <strong>{m.full_name}</strong> ولن يتمكن من الوصول للمنصة، لكن حسابه لن يُحذف ويمكن إعادة تفعيله لاحقاً من شاشة طلبات الانضمام أو بإسناد دور جديد له.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => revoke(m)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              تأكيد الإيقاف
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
