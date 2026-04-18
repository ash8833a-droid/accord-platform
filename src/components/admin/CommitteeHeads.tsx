import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { COMMITTEES, type CommitteeType } from "@/lib/committees";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Crown, Loader2, Save, UserX } from "lucide-react";
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

  const load = async () => {
    setLoading(true);
    const [cRes, rRes] = await Promise.all([
      supabase.from("committees").select("id,name,type,head_user_id").order("name"),
      supabase.from("user_roles").select("user_id, committee_id, role"),
    ]);
    const cs = (cRes.data ?? []) as Committee[];
    const userIds = Array.from(new Set((rRes.data ?? []).map((r) => r.user_id)));
    let profiles: { user_id: string; full_name: string }[] = [];
    if (userIds.length) {
      const { data: pData } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      profiles = pData ?? [];
    }
    const profMap = new Map(profiles.map((p) => [p.user_id, p.full_name]));
    const ms: Member[] = (rRes.data ?? [])
      .filter((r) => r.role === "admin" || r.role === "committee")
      .map((r) => ({
        user_id: r.user_id,
        full_name: profMap.get(r.user_id) ?? "—",
        committee_id: r.committee_id,
      }));
    setCommittees(cs);
    setMembers(ms);
    setDrafts(Object.fromEntries(cs.map((c) => [c.id, c.head_user_id ?? ""])));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const candidatesFor = (committeeId: string) => {
    // Eligible: members assigned to this committee, OR admins (no committee filter)
    const map = new Map<string, Member>();
    members.forEach((m) => {
      if (m.committee_id === committeeId || m.committee_id === null) {
        if (!map.has(m.user_id)) map.set(m.user_id, m);
      }
    });
    return Array.from(map.values());
  };

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
              <Select
                value={draft}
                onValueChange={(v) => setDrafts((d) => ({ ...d, [c.id]: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر رئيس اللجنة" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      لا يوجد أعضاء معينون لهذه اللجنة بعد
                    </div>
                  )}
                  {candidates.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
