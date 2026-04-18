import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Crown, Users, Loader2 } from "lucide-react";

interface MemberRow {
  user_id: string;
  full_name: string;
  phone: string | null;
  role: "admin" | "committee" | "delegate" | "quality";
  is_head: boolean;
}

const ROLE_LABEL: Record<MemberRow["role"], string> = {
  admin: "مدير نظام",
  committee: "عضو لجنة",
  quality: "الجودة",
  delegate: "مندوب",
};

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("");

export function CommitteeMembersPanel({ committeeId }: { committeeId: string }) {
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
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
      // Make sure head is included even if their role row points elsewhere
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
        const role =
          (roles ?? []).find((r) => r.user_id === uid)?.role ?? "committee";
        const p = profMap.get(uid);
        return {
          user_id: uid,
          full_name: p?.full_name ?? "—",
          phone: p?.phone ?? null,
          role: role as MemberRow["role"],
          is_head: uid === headId,
        };
      });

      // Head first, then by name
      merged.sort((a, b) => {
        if (a.is_head !== b.is_head) return a.is_head ? -1 : 1;
        return a.full_name.localeCompare(b.full_name, "ar");
      });

      if (!cancelled) {
        setRows(merged);
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [committeeId]);

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
                m.is_head
                  ? "from-gold/10 to-card border-gold/40"
                  : "from-card to-muted/30"
              }`}
            >
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {initials(m.full_name) || "؟"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-sm leading-tight truncate">
                    {m.full_name}
                  </p>
                  {m.is_head && (
                    <Crown className="h-3.5 w-3.5 text-gold shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {m.is_head ? "رئيس اللجنة" : ROLE_LABEL[m.role]}
                  {m.phone ? ` · ${m.phone}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
