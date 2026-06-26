import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { COMMITTEES, type CommitteeType } from "@/lib/committees";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Check, ChevronsUpDown, Crown, Loader2, Pencil, Plus, Save, Trash2, UserPlus, UserX, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Committee {
  id: string;
  name: string;
  type: CommitteeType;
  head_user_id: string | null;
}

interface Member {
  user_id: string;
  full_name: string;
  committee_id: string | null;
}

interface TeamMember {
  id: string;
  committee_id: string;
  full_name: string;
  role_title: string | null;
  is_head: boolean;
}

export function CommitteeHeads({ isAdmin }: { isAdmin: boolean }) {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [newName, setNewName] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const load = async () => {
    setLoading(true);
    const [cRes, rRes, tRes] = await Promise.all([
      supabase.from("committees").select("id,name,type,head_user_id").order("name"),
      supabase.from("profiles").select("user_id, full_name").order("full_name"),
      supabase.from("team_members").select("id,committee_id,full_name,role_title,is_head").order("display_order", { ascending: true }),
    ]);
    const cs = (cRes.data ?? []) as Committee[];
    const ms: Member[] = (rRes.data ?? []).map((p: any) => ({
      user_id: p.user_id,
      full_name: p.full_name ?? "—",
      committee_id: null,
    }));
    setCommittees(cs);
    setMembers(ms);
    setTeam((tRes.data ?? []) as TeamMember[]);
    setDrafts(Object.fromEntries(cs.map((c) => [c.id, c.head_user_id ?? ""])));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const candidatesFor = (_committeeId: string) => members;

  const save = async (c: Committee) => {
    if (!isAdmin) return;
    const newHead = drafts[c.id] || null;
    if (newHead === (c.head_user_id ?? "")) return;
    setSaving(c.id);
    const { error } = await supabase
      .from("committees")
      .update({ head_user_id: newHead })
      .eq("id", c.id);
    setSaving(null);
    if (error) {
      toast.error("تعذّر حفظ التغيير", { description: error.message });
      return;
    }
    toast.success("تم تحديث رئيس اللجنة");
    load();
  };

  const clearHead = async (c: Committee) => {
    if (!isAdmin) return;
    setSaving(c.id);
    const { error } = await supabase
      .from("committees")
      .update({ head_user_id: null })
      .eq("id", c.id);
    setSaving(null);
    if (error) {
      toast.error("تعذّر إزالة الرئيس", { description: error.message });
      return;
    }
    toast.success("تمت إزالة رئيس اللجنة");
    load();
  };

  const addMember = async (c: Committee) => {
    const name = (newName[c.id] ?? "").trim();
    if (!name) return;
    setSaving(c.id);
    const { error } = await supabase.from("team_members").insert({
      committee_id: c.id,
      full_name: name,
      is_head: false,
    });
    setSaving(null);
    if (error) {
      toast.error("تعذّر إضافة العضو", { description: error.message });
      return;
    }
    toast.success("تمت إضافة العضو");
    setNewName((n) => ({ ...n, [c.id]: "" }));
    load();
  };

  const renameMember = async (tm: TeamMember) => {
    const name = editValue.trim();
    if (!name || name === tm.full_name) {
      setEditingId(null);
      return;
    }
    const { error } = await supabase.from("team_members").update({ full_name: name }).eq("id", tm.id);
    if (error) {
      toast.error("تعذّر تعديل الاسم", { description: error.message });
      return;
    }
    toast.success("تم تعديل الاسم");
    setEditingId(null);
    load();
  };

  const removeMember = async (tm: TeamMember) => {
    const { error } = await supabase.from("team_members").delete().eq("id", tm.id);
    if (error) {
      toast.error("تعذّر حذف العضو", { description: error.message });
      return;
    }
    toast.success("تم حذف العضو");
    load();
  };

  if (!isAdmin) {
    return (
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        هذه الصفحة متاحة لمدير النظام فقط.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const memberName = (uid: string | null) =>
    uid ? members.find((m) => m.user_id === uid)?.full_name ?? "—" : "بدون رئيس";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {committees.map((c) => {
        const meta = COMMITTEES.find((m) => m.type === c.type);
        const Icon = meta?.icon ?? Crown;
        const candidates = candidatesFor(c.id);
        const draft = drafts[c.id] ?? "";
        const dirty = draft !== (c.head_user_id ?? "");
        const cMembers = team.filter((t) => t.committee_id === c.id);
        const isOpen = !!expanded[c.id];
        return (
          <Card key={c.id} className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-tight">{meta?.label ?? c.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  الرئيس الحالي: <span className="font-medium text-foreground">{memberName(c.head_user_id)}</span>
                </p>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30">
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 p-3 text-sm font-medium"
                onClick={() => setExpanded((e) => ({ ...e, [c.id]: !e[c.id] }))}
              >
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  أعضاء اللجنة ({cMembers.length})
                </span>
                <ChevronsUpDown className="h-4 w-4 opacity-60" />
              </button>
              {isOpen && (
                <div className="border-t p-3 space-y-2">
                  {cMembers.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">لا يوجد أعضاء بعد</p>
                  )}
                  {cMembers.map((tm) => (
                    <div key={tm.id} className="flex items-center gap-2">
                      {editingId === tm.id ? (
                        <>
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="h-8 text-sm flex-1"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") renameMember(tm);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                          />
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => renameMember(tm)}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm truncate">{tm.full_name}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingId(tm.id);
                              setEditValue(tm.full_name);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removeMember(tm)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Input
                      placeholder="اسم العضو الجديد"
                      value={newName[c.id] ?? ""}
                      onChange={(e) => setNewName((n) => ({ ...n, [c.id]: e.target.value }))}
                      className="h-8 text-sm flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addMember(c);
                      }}
                    />
                    <Button size="sm" className="h-8 gap-1" onClick={() => addMember(c)} disabled={saving === c.id}>
                      <UserPlus className="h-3.5 w-3.5" />
                      إضافة
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Popover open={openId === c.id} onOpenChange={(o) => setOpenId(o ? c.id : null)}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">
                      {draft ? memberName(draft) : "اختر رئيس اللجنة"}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                  <Command dir="rtl" filter={(value, search) => (value.includes(search) ? 1 : 0)}>
                    <CommandInput placeholder="ابحث بالاسم..." />
                    <CommandList>
                      <CommandEmpty>لا توجد نتائج</CommandEmpty>
                      <CommandGroup>
                        {candidates.map((m) => (
                          <CommandItem
                            key={m.user_id}
                            value={m.full_name}
                            onSelect={() => {
                              setDrafts((d) => ({ ...d, [c.id]: m.user_id }));
                              setOpenId(null);
                            }}
                          >
                            <Check
                              className={cn(
                                "h-4 w-4 ms-1",
                                draft === m.user_id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {m.full_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={() => save(c)}
                  disabled={!dirty || saving === c.id}
                >
                  {saving === c.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  حفظ
                </Button>
                {c.head_user_id && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => clearHead(c)}
                    disabled={saving === c.id}
                  >
                    <UserX className="h-4 w-4" />
                    إزالة
                  </Button>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
