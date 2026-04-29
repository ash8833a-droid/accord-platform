import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, Pencil, Save, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PAGES, type AccessLevel, ACCESS_LABELS } from "@/lib/pages";

type Matrix = Record<string, AccessLevel>;

const LEVEL_STYLES: Record<AccessLevel, string> = {
  hidden: "bg-destructive/10 text-destructive border-destructive/30",
  read:   "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  edit:   "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
};
const LEVEL_ICON: Record<AccessLevel, any> = { hidden: EyeOff, read: Eye, edit: Pencil };

interface Props {
  userId: string;
  fullName: string;
}

export function UserPermissionsPanel({ userId, fullName }: Props) {
  const [matrix, setMatrix] = useState<Matrix>({});
  const [original, setOriginal] = useState<Matrix>({});
  const [userIsAdmin, setUserIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [{ data: perms }, { data: roles }] = await Promise.all([
        supabase.from("page_permissions").select("page_key, access_level").eq("user_id", userId),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      if (cancelled) return;
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      setUserIsAdmin(isAdmin);
      const m: Matrix = {};
      PAGES.forEach((p) => { m[p.key] = "read"; });
      (perms ?? []).forEach((p) => { m[p.page_key] = p.access_level as AccessLevel; });
      setMatrix(m);
      setOriginal({ ...m });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

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
    setSaving(true);
    try {
      const rows = PAGES.map((p) => ({
        user_id: userId,
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

  const grouped = PAGES.reduce<Record<string, typeof PAGES>>((acc, p) => {
    (acc[p.category] ||= []).push(p);
    return acc;
  }, {});

  if (loading) {
    return <p className="text-center text-sm text-muted-foreground py-8">جاري التحميل...</p>;
  }

  if (userIsAdmin) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
        <p>{fullName} مدير نظام — لديه صلاحيات تعديل كاملة لكل الصفحات تلقائياً ولا يحتاج تخصيص يدوي.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-end sticky top-0 bg-background/95 backdrop-blur z-10 py-2 border-b">
        <Button size="sm" variant="outline" onClick={() => setAll("hidden")}>إخفاء الكل</Button>
        <Button size="sm" variant="outline" onClick={() => setAll("read")}>قراءة الكل</Button>
        <Button size="sm" variant="outline" onClick={() => setAll("edit")}>تعديل الكل</Button>
        <Button size="sm" onClick={handleSave} disabled={!dirty || saving} className="gap-1">
          <Save className="h-4 w-4" />حفظ
        </Button>
      </div>
      {Object.entries(grouped).map(([cat, pages]) => (
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
    </div>
  );
}