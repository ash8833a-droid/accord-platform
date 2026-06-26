import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { COMMITTEES, type CommitteeType } from "@/lib/committees";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Crown, Loader2, Save, UserX } from "lucide-react";
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

export function CommitteeHeads({ isAdmin }: { isAdmin: boolean }) {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [cRes, rRes] = await Promise.all([
      supabase.from("committees").select("id,name,type,head_user_id").order("name"),
      supabase.from("profiles").select("user_id, full_name").order("full_name"),
    ]);
    const cs = (cRes.data ?? []) as Committee[];
    const ms: Member[] = (rRes.data ?? []).map((p: any) => ({
      user_id: p.user_id,
      full_name: p.full_name ?? "—",
      committee_id: null,
    }));
    setCommittees(cs);
    setMembers(ms);
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
