import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Pencil, Save, CheckCircle2, Search, Info } from "lucide-react";
import { toast } from "sonner";
import { PAGES, type AccessLevel, ACCESS_LABELS } from "@/lib/pages";

type Matrix = Record<string, AccessLevel>;

const LEVEL_STYLES: Record<AccessLevel, string> = {
  hidden: "bg-destructive/10 text-destructive border-destructive/30",
  read:   "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  edit:   "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
};
const LEVEL_ICON: Record<AccessLevel, any> = { hidden: EyeOff, read: Eye, edit: Pencil };

const LEVEL_DESC: Record<AccessLevel, string> = {
  hidden: "لا تظهر الصفحة في القائمة ولا يمكن فتحها",
  read: "يمكن فتح الصفحة وعرض محتواها فقط دون أي تعديل",
  edit: "صلاحية كاملة: عرض وإضافة وتعديل وحذف",
};

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
  const [search, setSearch] = useState("");

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

  const setCategory = (category: string, level: AccessLevel) => {
    setMatrix((prev) => {
      const next = { ...prev };
      PAGES.filter((p) => p.category === category).forEach((p) => { next[p.key] = level; });
      return next;
    });
  };

  const counts = useMemo(() => {
    const c = { hidden: 0, read: 0, edit: 0 };
    Object.values(matrix).forEach((l) => { c[l] = (c[l] ?? 0) + 1; });
    return c;
  }, [matrix]);

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
    if (search && !p.label.toLowerCase().includes(search.toLowerCase()) && !p.path.includes(search)) return acc;
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
      {/* Sticky toolbar with legend, counts, search, bulk actions */}
      <div className="sticky top-0 bg-background/95 backdrop-blur z-10 -mx-1 px-1 py-3 border-b space-y-3">
        {/* Legend */}
        <div className="rounded-xl border bg-muted/30 p-3 flex items-start gap-2 text-xs">
          <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="grid sm:grid-cols-3 gap-2 flex-1">
            {(["hidden","read","edit"] as AccessLevel[]).map((lv) => {
              const Icon = LEVEL_ICON[lv];
              return (
                <div key={lv} className="flex items-start gap-2">
                  <Badge variant="outline" className={`${LEVEL_STYLES[lv]} shrink-0`}>
                    <Icon className="h-3 w-3 me-1" />{ACCESS_LABELS[lv]}
                  </Badge>
                  <span className="text-muted-foreground leading-tight">{LEVEL_DESC[lv]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Counts + Search + Save */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs">
            <Badge variant="outline" className={LEVEL_STYLES.edit}>تعديل: {counts.edit}</Badge>
            <Badge variant="outline" className={LEVEL_STYLES.read}>قراءة: {counts.read}</Badge>
            <Badge variant="outline" className={LEVEL_STYLES.hidden}>مخفي: {counts.hidden}</Badge>
          </div>
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن صفحة..." className="h-8 ps-2 pe-7 text-xs" />
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setAll("hidden")}>إخفاء الكل</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setAll("read")}>قراءة الكل</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setAll("edit")}>تعديل الكل</Button>
          </div>
          <Button size="sm" onClick={handleSave} disabled={!dirty || saving} className="gap-1 h-8">
            <Save className="h-4 w-4" />{dirty ? "حفظ التغييرات" : "محفوظ"}
          </Button>
        </div>
      </div>

      {Object.entries(grouped).map(([cat, pages]) => (
        <div key={cat} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{cat}</h3>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">تطبيق على القسم:</span>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setCategory(cat, "hidden")}>إخفاء</Button>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setCategory(cat, "read")}>قراءة</Button>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setCategory(cat, "edit")}>تعديل</Button>
            </div>
          </div>
          <div className="space-y-2">
            {pages.map((p) => {
              const lvl = matrix[p.key] ?? "read";
              const Icon = p.icon;
              const changed = original[p.key] !== undefined && original[p.key] !== lvl;
              return (
                <div key={p.key} className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 hover:bg-accent/30 transition-colors ${changed ? "ring-1 ring-primary/40 bg-primary/5" : ""}`}>
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm flex items-center gap-2">
                      {p.label}
                      {changed && <span className="text-[10px] text-primary">• غير محفوظ</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{p.path}</p>
                  </div>
                  {/* Segmented control — clearer than dropdown */}
                  <div className="inline-flex rounded-lg border bg-muted/30 p-0.5" role="group">
                    {(["hidden","read","edit"] as AccessLevel[]).map((lv) => {
                      const LvIcon = LEVEL_ICON[lv];
                      const active = lvl === lv;
                      return (
                        <button
                          key={lv}
                          type="button"
                          onClick={() => setMatrix({ ...matrix, [p.key]: lv })}
                          title={LEVEL_DESC[lv]}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                            active
                              ? `${LEVEL_STYLES[lv]} border shadow-sm`
                              : "text-muted-foreground hover:bg-background"
                          }`}
                        >
                          <LvIcon className="h-3 w-3" />
                          {ACCESS_LABELS[lv]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {Object.keys(grouped).length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">لا توجد صفحات مطابقة للبحث.</p>
      )}
    </div>
  );
}