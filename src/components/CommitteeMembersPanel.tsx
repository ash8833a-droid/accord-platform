import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Crown, Users, Loader2, UserPlus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { COMMITTEE_MEMBER_LABEL, committeeMemberLabel } from "@/lib/committee-member-labels";

type Role = "admin" | "committee" | "delegate" | "quality";

interface MemberRow {
  user_id: string;
  full_name: string;
  phone: string | null;
  role: Role;
  is_head: boolean;
}

interface CandidateRow {
  user_id: string;
  full_name: string;
  phone: string | null;
  current_committee_id: string | null;
  current_committee_name: string | null;
  role: Role;
}

const ROLE_LABEL: Record<Role, string> = {
  admin: COMMITTEE_MEMBER_LABEL,
  committee: COMMITTEE_MEMBER_LABEL,
  quality: COMMITTEE_MEMBER_LABEL,
  delegate: COMMITTEE_MEMBER_LABEL,
};

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("");

export function CommitteeMembersPanel({ committeeId }: { committeeId: string }) {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: roles }, { data: committee }] = await Promise.all([
      supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("committee_id", committeeId),
      supabase
        .from("committees")
        .select("head_user_id")
        .eq("id", committeeId)
        .maybeSingle(),
    ]);

    const headId = committee?.head_user_id ?? null;
    const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    if (headId && !ids.includes(headId)) ids.push(headId);

    let profiles: { user_id: string; full_name: string; phone: string | null }[] = [];
    if (ids.length) {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .in("user_id", ids);
      profiles = data ?? [];
    }
    const profMap = new Map(profiles.map((p) => [p.user_id, p]));

    const merged: MemberRow[] = ids.map((uid) => {
      const role = (roles ?? []).find((r) => r.user_id === uid)?.role ?? "committee";
      const p = profMap.get(uid);
      return {
        user_id: uid,
        full_name: p?.full_name ?? "—",
        phone: p?.phone ?? null,
        role: role as Role,
        is_head: uid === headId,
      };
    });

    merged.sort((a, b) => {
      if (a.is_head !== b.is_head) return a.is_head ? -1 : 1;
      return a.full_name.localeCompare(b.full_name, "ar");
    });

    setRows(merged);
    setLoading(false);
  }, [committeeId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-2 mb-4">
        <span className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Users className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h3 className="font-bold text-base">رئيس وأعضاء اللجنة</h3>
          <p className="text-xs text-muted-foreground">
            الأعضاء المعتمدون والمسكّنون في هذه اللجنة
          </p>
        </div>
        {!loading && (
          <Badge variant="secondary" className="text-xs">
            {rows.length}
          </Badge>
        )}
        {isAdmin && (
          <Button size="sm" className="gap-1.5 h-8" onClick={() => setAssignOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" />
            تسكين عضو
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          لا يوجد أعضاء مسكّنون في هذه اللجنة بعد.
        </p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map((m) => (
            <li
              key={m.user_id}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 bg-gradient-to-br ${
                m.is_head ? "from-gold/10 to-card border-gold/40" : "from-card to-muted/30"
              }`}
            >
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {initials(m.full_name) || "؟"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-sm leading-tight truncate">{m.full_name}</p>
                  {m.is_head && <Crown className="h-3.5 w-3.5 text-gold shrink-0" />}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {committeeMemberLabel(m)}
                  {m.phone ? ` · ${m.phone}` : ""}
                </p>
              </div>
              {isAdmin && !m.is_head && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  title="إزالة من اللجنة"
                  onClick={async () => {
                    if (!confirm(`إزالة ${m.full_name} من هذه اللجنة؟`)) return;
                    const { error } = await supabase
                      .from("user_roles")
                      .delete()
                      .eq("user_id", m.user_id)
                      .eq("committee_id", committeeId);
                    if (error) {
                      toast.error(error.message);
                      return;
                    }
                    toast.success("تمت الإزالة");
                    load();
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isAdmin && (
        <AssignMemberDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          committeeId={committeeId}
          existingIds={new Set(rows.map((r) => r.user_id))}
          onAssigned={() => {
            setAssignOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AssignMemberDialog({
  open,
  onOpenChange,
  committeeId,
  existingIds,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  committeeId: string;
  existingIds: Set<string>;
  onAssigned: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [newRole, setNewRole] = useState<Role>("committee");
  const [moveMode, setMoveMode] = useState(true); // true = نقل، false = إضافة دور إضافي

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      const [{ data: roles }, { data: committees }, { data: profiles }] = await Promise.all([
        supabase.from("user_roles").select("user_id, role, committee_id"),
        supabase.from("committees").select("id, name"),
        supabase.from("profiles").select("user_id, full_name, phone"),
      ]);
      const cMap = new Map((committees ?? []).map((c) => [c.id, c.name]));
      // Pick one role row per user (prefer one with committee assigned)
      const byUser = new Map<string, { role: Role; committee_id: string | null }>();
      (roles ?? []).forEach((r) => {
        const prev = byUser.get(r.user_id);
        if (!prev || (r.committee_id && !prev.committee_id)) {
          byUser.set(r.user_id, { role: r.role as Role, committee_id: r.committee_id });
        }
      });
      const list: CandidateRow[] = (profiles ?? [])
        .filter((p) => byUser.has(p.user_id))
        .map((p) => {
          const ur = byUser.get(p.user_id)!;
          return {
            user_id: p.user_id,
            full_name: p.full_name,
            phone: p.phone,
            current_committee_id: ur.committee_id,
            current_committee_name: ur.committee_id ? cMap.get(ur.committee_id) ?? null : null,
            role: ur.role,
          };
        })
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
      setCandidates(list);
      setLoading(false);
    };
    load();
    setSelectedId("");
    setSearch("");
    setNewRole("committee");
    setMoveMode(true);
  }, [open]);

  const filtered = candidates.filter((c) => {
    if (existingIds.has(c.user_id)) return false;
    if (!search.trim()) return true;
    const q = search.trim();
    return c.full_name.includes(q) || (c.phone ?? "").includes(q);
  });

  const selected = candidates.find((c) => c.user_id === selectedId);

  const submit = async () => {
    if (!selected) {
      toast.error("اختر عضواً من القائمة");
      return;
    }
    setSubmitting(true);
    try {
      if (moveMode && selected.current_committee_id) {
        // Update existing role row to point to this committee
        const { error } = await supabase
          .from("user_roles")
          .update({ committee_id: committeeId, role: newRole })
          .eq("user_id", selected.user_id)
          .eq("committee_id", selected.current_committee_id);
        if (error) throw error;
      } else {
        // Insert a new role row for this committee
        const { error } = await supabase.from("user_roles").insert({
          user_id: selected.user_id,
          role: newRole,
          committee_id: committeeId,
        });
        if (error) throw error;
      }
      toast.success("تم التسكين بنجاح", {
        description: `${selected.full_name} → اللجنة الحالية`,
      });
      onAssigned();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر التسكين");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>تسكين عضو في اللجنة</DialogTitle>
          <DialogDescription>
            اختر عضواً من المعتمدين لنقله أو إضافته إلى هذه اللجنة.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو الجوال…"
              className="pr-9"
            />
          </div>

          <div className="rounded-lg border max-h-72 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                لا يوجد أعضاء معتمدون متاحون للتسكين.
              </p>
            ) : (
              <ul className="divide-y">
                {filtered.map((c) => (
                  <li
                    key={c.user_id}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40 ${
                      selectedId === c.user_id ? "bg-primary/10" : ""
                    }`}
                    onClick={() => {
                      setSelectedId(c.user_id);
                      setNewRole("committee");
                    }}
                  >
                    <input
                      type="radio"
                      checked={selectedId === c.user_id}
                      onChange={() => setSelectedId(c.user_id)}
                      className="accent-primary"
                    />
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                        {initials(c.full_name) || "؟"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{c.full_name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {ROLE_LABEL[c.role]}
                        {c.phone ? ` · ${c.phone}` : ""}
                        {c.current_committee_name
                          ? ` · حالياً: ${c.current_committee_name}`
                          : " · غير مسكّن"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selected && (
            <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>الصلاحية في اللجنة</Label>
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as Role)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="committee">{COMMITTEE_MEMBER_LABEL}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {selected.current_committee_id && (
                  <div className="grid gap-1.5">
                    <Label>طريقة التسكين</Label>
                    <Select
                      value={moveMode ? "move" : "add"}
                      onValueChange={(v) => setMoveMode(v === "move")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="move">
                          نقل من «{selected.current_committee_name ?? "—"}»
                        </SelectItem>
                        <SelectItem value="add">إضافة كعضو في لجنة إضافية</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            إلغاء
          </Button>
          <Button onClick={submit} disabled={submitting || !selected} className="gap-2">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            تأكيد التسكين
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
