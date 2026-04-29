import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Search, Eye, EyeOff, Pencil, Save, Users as UsersIcon, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PAGES, type AccessLevel, ACCESS_LABELS } from "@/lib/pages";

export const Route = createFileRoute("/_app/admin/permissions")({
  component: PermissionsPage,
});

interface Profile { user_id: string; full_name: string; phone: string | null; }
type Matrix = Record<string, AccessLevel>; // pageKey -> level

const LEVEL_STYLES: Record<AccessLevel, string> = {
  hidden: "bg-destructive/10 text-destructive border-destructive/30",
  read:   "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  edit:   "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
};
const LEVEL_ICON: Record<AccessLevel, any> = { hidden: EyeOff, read: Eye, edit: Pencil };

function PermissionsPage() {
  const { hasRole } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [matrix, setMatrix] = useState<Matrix>({});
  const [original, setOriginal] = useState<Matrix>({});
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [userIsAdmin, setUserIsAdmin] = useState(false);

  useEffect(() => {
    if (!hasRole("admin")) return;
    supabase.from("profiles").select("user_id, full_name, phone")
      .order("full_name").then(({ data }) => setUsers(data ?? []));
  }, [hasRole]);

  useEffect(() => {
    if (!selected) { setMatrix({}); setOriginal({}); return; }
    (async () => {
      const [{ data: perms }, { data: roles }] = await Promise.all([
        supabase.from("page_permissions").select("page_key, access_level").eq("user_id", selected.user_id),
        supabase.from("user_roles").select("role").eq("user_id", selected.user_id),
      ]);
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      setUserIsAdmin(isAdmin);
      const m: Matrix = {};
      PAGES.forEach((p) => { m[p.key] = "read"; }); // default
      (perms ?? []).forEach((p) => { m[p.page_key] = p.access_level as AccessLevel; });
      setMatrix(m);
      setOriginal({ ...m });
    })();
  }, [selected]);

  const filteredUsers = useMemo(
    () => users.filter((u) => !q || u.full_name?.includes(q) || u.phone?.includes(q)),
    [users, q],
  );

  const dirty = useMemo(
    () => Object.keys(matrix).some((k) => matrix[k] !== original[k]),
    [matrix, original],
  );

  const setAll = (level: AccessLevel) => {
    const m: Matrix = {};
    PAGES.forEach((p) => { m[p.key] = level; });
    setMatrix(m);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const rows = PAGES.map((p) => ({
        user_id: selected.user_id,
        page_key: p.key,
        access_level: matrix[p.key],
      }));
      const { error } = await supabase.from("page_permissions").upsert(rows, { onConflict: "user_id,page_key" });
      if (error) throw error;
      toast.success("تم حفظ الصلاحيات");
      setOriginal({ ...matrix });
    } catch (e: any) { toast.error(e.message); }
    setSaving(false);
  };

  if (!hasRole("admin")) {
    return <div className="p-6 text-center text-muted-foreground">هذه الصفحة للمدير فقط</div>;
  }

  const grouped = PAGES.reduce<Record<string, typeof PAGES>>((acc, p) => {
    (acc[p.category] ||= []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6" dir="rtl">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-8 text-primary-foreground shadow-elegant">
        <div className="absolute -bottom-10 -right-10 w-72 h-72 bg-gold/20 rounded-full blur-3xl" />
        <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gold/20 flex items-center justify-center backdrop-blur-sm">
              <ShieldCheck className="h-7 w-7 text-gold" />
            </div>
            <div>
              <p className="text-sm text-primary-foreground/70">إدارة المنصة</p>
              <h1 className="text-2xl lg:text-3xl font-bold">بوابة <span className="text-shimmer-gold">الصلاحيات</span></h1>
              <p className="text-primary-foreground/80 text-sm mt-1">حدد لكل عضو الصفحات المسموح له برؤيتها أو تعديلها</p>
            </div>
          </div>
          <Link to="/admin/users">
            <Button variant="secondary" className="gap-2"><UsersIcon className="h-4 w-4" />إدارة المستخدمين</Button>
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Users list */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">اختر مستخدماً</CardTitle>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="بحث..." value={q} onChange={(e) => setQ(e.target.value)} className="ps-9" />
            </div>
          </CardHeader>
          <CardContent className="max-h-[600px] overflow-y-auto space-y-1">
            {filteredUsers.map((u) => (
              <button key={u.user_id} onClick={() => setSelected(u)}
                className={`w-full text-right rounded-lg p-3 transition-colors flex items-center gap-3 ${selected?.user_id === u.user_id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
                <div className="h-8 w-8 rounded-full bg-gradient-gold flex items-center justify-center text-gold-foreground text-xs font-bold shrink-0">
                  {u.full_name?.[0] || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{u.full_name}</p>
                  <p className="text-[10px] opacity-70 truncate">{u.phone}</p>
                </div>
              </button>
            ))}
            {filteredUsers.length === 0 && <p className="text-center text-muted-foreground text-sm py-6">لا نتائج</p>}
          </CardContent>
        </Card>

        {/* Permissions matrix */}
        <Card className="lg:col-span-8">
          <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base">{selected ? `صلاحيات: ${selected.full_name}` : "اختر مستخدماً للبدء"}</CardTitle>
              {userIsAdmin && selected && (
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  هذا المستخدم مدير نظام — لديه صلاحيات تعديل كاملة لكل الصفحات تلقائياً.
                </p>
              )}
            </div>
            {selected && !userIsAdmin && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setAll("hidden")}>إخفاء الكل</Button>
                <Button size="sm" variant="outline" onClick={() => setAll("read")}>قراءة الكل</Button>
                <Button size="sm" variant="outline" onClick={() => setAll("edit")}>تعديل الكل</Button>
                <Button size="sm" onClick={handleSave} disabled={!dirty || saving} className="gap-1">
                  <Save className="h-4 w-4" />حفظ
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            {!selected && <p className="text-center py-12 text-muted-foreground">اختر مستخدماً من القائمة لإدارة صلاحياته</p>}
            {selected && !userIsAdmin && Object.entries(grouped).map(([cat, pages]) => (
              <div key={cat} className="space-y-2">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{cat}</h3>
                <div className="space-y-2">
                  {pages.map((p) => {
                    const lvl = matrix[p.key] ?? "read";
                    const Icon = p.icon;
                    const LvlIcon = LEVEL_ICON[lvl];
                    return (
                      <div key={p.key} className="flex items-center gap-3 rounded-xl border p-3 hover:bg-accent/30 transition-colors">
                        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{p.label}</p>
                          <p className="text-[10px] text-muted-foreground">{p.path}</p>
                        </div>
                        <Badge variant="outline" className={LEVEL_STYLES[lvl]}>
                          <LvlIcon className="h-3 w-3 me-1" />
                          {ACCESS_LABELS[lvl]}
                        </Badge>
                        <Select value={lvl} onValueChange={(v) => setMatrix({ ...matrix, [p.key]: v as AccessLevel })}>
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hidden">مخفي</SelectItem>
                            <SelectItem value="read">قراءة فقط</SelectItem>
                            <SelectItem value="edit">تعديل كامل</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
