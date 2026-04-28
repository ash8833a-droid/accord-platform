import { createFileRoute, Link } from "@tanstack/react-router";
import { toPng } from "html-to-image";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { COMMITTEES, type CommitteeType } from "@/lib/committees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Users,
  Plus,
  Crown,
  Phone,
  Mail,
  Trash2,
  Star,
  UserCircle2,
  Download,
  ArrowLeft,
  
} from "lucide-react";
import { toast } from "sonner";
import { TeamDatabaseDialog, type TeamDbRow } from "@/components/TeamDatabaseDialog";
import { COMMITTEE_HEAD_LABEL, COMMITTEE_MEMBER_LABEL, committeeMemberLabel } from "@/lib/committee-member-labels";

export const Route = createFileRoute("/_app/team")({
  component: TeamPage,
});

interface CommitteeRow {
  id: string;
  name: string;
  type: CommitteeType;
  max_members: number;
}
type RoleFilter = "all" | "admin" | "committee" | "quality" | "delegate" | "team";
interface MemberRow {
  id: string;
  committee_id: string;
  full_name: string;
  role_title: string | null;
  phone: string | null;
  email: string | null;
  specialty: string | null;
  is_head: boolean;
  display_order: number;
  role_key: Exclude<RoleFilter, "all">;
}

// Display order for the org chart (top → bottom)
const ORG_ORDER: CommitteeType[] = [
  "finance",
  "procurement",
  "quality",
  "women",
  "media",
  "reception",
  "programs",
  "dinner",
];

function TeamPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const [committees, setCommittees] = useState<CommitteeRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    committee_id: "",
    full_name: "",
    role_title: "",
    phone: "",
    email: "",
    specialty: "",
    is_head: false,
  });

  const load = async () => {
    const [cm, mb, ur] = await Promise.all([
      supabase.from("committees").select("id, name, type, max_members, head_user_id"),
      supabase
        .from("team_members")
        .select(
          "id, committee_id, full_name, role_title, phone, email, specialty, is_head, display_order",
        )
        .order("is_head", { ascending: false })
        .order("display_order"),
      supabase.from("user_roles").select("user_id, role, committee_id").not("committee_id", "is", null),
    ]);

    const committeesData = (cm.data as (CommitteeRow & { head_user_id: string | null })[]) ?? [];
    const teamMembersRaw = (mb.data ?? []) as Omit<MemberRow, "role_key">[];
    const teamMembers: MemberRow[] = teamMembersRaw.map((m) => ({ ...m, role_key: "team" }));
    const roleRows = (ur.data ?? []) as { user_id: string; role: string; committee_id: string }[];

    const userIds = Array.from(
      new Set([
        ...roleRows.map((r) => r.user_id),
        ...committeesData.map((c) => c.head_user_id).filter((x): x is string => !!x),
      ]),
    );
    let profiles: { user_id: string; full_name: string; phone: string | null }[] = [];
    if (userIds.length) {
      const { data: pr } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .in("user_id", userIds);
      profiles = pr ?? [];
    }
    const profMap = new Map(profiles.map((p) => [p.user_id, p]));

    const ROLE_LABEL: Record<string, string> = {
      admin: COMMITTEE_MEMBER_LABEL,
      committee: COMMITTEE_MEMBER_LABEL,
      quality: COMMITTEE_MEMBER_LABEL,
      delegate: COMMITTEE_MEMBER_LABEL,
    };

    const teamKeySet = new Set(
      teamMembers.map((m) => `${m.committee_id}::${m.full_name.trim()}`),
    );

    const headByCommittee = new Map(
      committeesData.map((c) => [c.id, c.head_user_id] as const),
    );

    const assignedMembers: MemberRow[] = [];
    roleRows.forEach((r, idx) => {
      const p = profMap.get(r.user_id);
      const fullName = p?.full_name ?? "—";
      const key = `${r.committee_id}::${fullName.trim()}`;
      if (teamKeySet.has(key)) return;
      teamKeySet.add(key);
      const roleKey = (["admin", "committee", "quality", "delegate"].includes(r.role)
        ? r.role
        : "committee") as Exclude<RoleFilter, "all" | "team">;
      assignedMembers.push({
        id: `role-${r.user_id}-${r.committee_id}`,
        committee_id: r.committee_id,
        full_name: fullName,
      role_title: ROLE_LABEL[r.role] ?? COMMITTEE_MEMBER_LABEL,
        phone: p?.phone ?? null,
        email: null,
        specialty: null,
        is_head: headByCommittee.get(r.committee_id) === r.user_id,
        display_order: 1000 + idx,
        role_key: roleKey,
      });
    });

    const merged = [...teamMembers, ...assignedMembers].sort((a, b) => {
      if (a.is_head !== b.is_head) return a.is_head ? -1 : 1;
      return a.display_order - b.display_order;
    });

    setCommittees(committeesData.map(({ head_user_id: _h, ...c }) => c));
    setMembers(merged);
  };

  useEffect(() => {
    load();
  }, []);

  const sortedCommittees = useMemo(() => {
    return [...committees].sort(
      (a, b) => ORG_ORDER.indexOf(a.type) - ORG_ORDER.indexOf(b.type),
    );
  }, [committees]);

  const dbRows: TeamDbRow[] = useMemo(() => {
    const cMap = new Map(committees.map((c) => [c.id, c.name]));
    return members.map((m) => ({
      id: m.id,
      committee_id: m.committee_id,
      committee_name: cMap.get(m.committee_id) ?? "—",
      full_name: m.full_name,
      role_title: committeeMemberLabel(m),
      role_key: m.role_key,
      phone: m.phone,
      email: m.email,
      specialty: m.specialty,
      is_head: m.is_head,
    }));
  }, [members, committees]);

  const create = async () => {
    if (!form.full_name || !form.committee_id) {
      toast.error("الاسم واللجنة مطلوبان");
      return;
    }
    const { error } = await supabase.from("team_members").insert({
      committee_id: form.committee_id,
      full_name: form.full_name,
      role_title: committeeMemberLabel({ is_head: form.is_head }),
      phone: form.phone || null,
      email: form.email || null,
      specialty: form.specialty || null,
      is_head: form.is_head,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تمت الإضافة");
    setOpen(false);
    setForm({
      committee_id: "",
      full_name: "",
      role_title: "",
      phone: "",
      email: "",
      specialty: "",
      is_head: false,
    });
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("تم الحذف");
      load();
    }
  };

  const toggleHead = async (m: MemberRow) => {
    const { error } = await supabase
      .from("team_members")
      .update({ is_head: !m.is_head })
      .eq("id", m.id);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-8 text-primary-foreground shadow-elegant">
        <div className="absolute -top-10 -left-10 w-72 h-72 bg-gold/20 rounded-full blur-3xl" />
        <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gold/20 flex items-center justify-center backdrop-blur-sm">
              <Users className="h-7 w-7 text-gold" />
            </div>
            <div>
              <p className="text-sm text-primary-foreground/70">
                الموارد البشرية للبرنامج
              </p>
              <h1 className="text-2xl lg:text-3xl font-bold">
                <span className="text-shimmer-gold">فريق العمل</span> والهيكل التنظيمي
              </h1>
              <p className="text-primary-foreground/80 text-sm mt-1">
                توزيع الكفاءات على اللجان وإدارة أعضاء كل لجنة وفق السعة المعتمدة
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <TeamDatabaseDialog rows={dbRows} />
            {isAdmin && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-gold text-gold-foreground hover:opacity-90">
                    <Plus className="h-4 w-4" /> إضافة عضو
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg" dir="rtl">
                <DialogHeader>
                  <DialogTitle>إسناد عضو جديد للجنة</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>الاسم الكامل *</Label>
                    <Input
                      value={form.full_name}
                      onChange={(e) =>
                        setForm({ ...form, full_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <Label>اللجنة *</Label>
                      <Select
                        value={form.committee_id}
                        onValueChange={(v) =>
                          setForm({ ...form, committee_id: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر اللجنة" />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedCommittees.map((c) => {
                            const cnt = members.filter(
                              (m) => m.committee_id === c.id,
                            ).length;
                            const full = cnt >= c.max_members;
                            return (
                              <SelectItem
                                key={c.id}
                                value={c.id}
                                disabled={full}
                              >
                                {c.name} ({cnt}/{c.max_members})
                                {full ? " — مكتمل" : ""}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>التخصص / المهارة</Label>
                    <Input
                      value={form.specialty}
                      onChange={(e) =>
                        setForm({ ...form, specialty: e.target.value })
                      }
                      placeholder="مثال: محاسبة مالية، تصوير، تنسيق فعاليات..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>الجوال</Label>
                      <Input
                        value={form.phone}
                        onChange={(e) =>
                          setForm({ ...form, phone: e.target.value })
                        }
                        placeholder="05xxxxxxxx"
                      />
                    </div>
                    <div>
                      <Label>البريد</Label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) =>
                          setForm({ ...form, email: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_head}
                      onChange={(e) =>
                        setForm({ ...form, is_head: e.target.checked })
                      }
                    />
                    تعيينه رئيساً للجنة
                  </label>
                </div>
                <DialogFooter>
                  <Button onClick={create}>إسناد للجنة</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            )}
          </div>
        </div>
      </div>

      {/* Org Chart */}
      <OrgChart committees={sortedCommittees} members={members} />

      {/* Detailed committees */}
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="h-1 w-10 bg-gradient-gold rounded-full" />
            <h2 className="text-lg font-bold">أعضاء اللجان بالتفصيل</h2>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {([
              { v: "all", label: "الكل" },
            ] as { v: RoleFilter; label: string }[]).map((opt) => {
              const count =
                opt.v === "all"
                  ? members.length
                  : members.filter((m) => m.role_key === opt.v).length;
              const active = roleFilter === opt.v;
              return (
                <Button
                  key={opt.v}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  onClick={() => setRoleFilter(opt.v)}
                  className="h-8 gap-1.5"
                >
                  {opt.label}
                  <Badge
                    variant="secondary"
                    className={`text-[10px] h-4 px-1.5 ${active ? "bg-primary-foreground/20 text-primary-foreground" : ""}`}
                  >
                    {count}
                  </Badge>
                </Button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {sortedCommittees.map((c) => {
            const meta = COMMITTEES.find((m) => m.type === c.type);
            const Icon = meta?.icon ?? Users;
            const allList = members.filter((m) => m.committee_id === c.id);
            const list = roleFilter === "all"
              ? allList
              : allList.filter((m) => m.role_key === roleFilter);
            const filledPct = c.max_members
              ? (list.length / c.max_members) * 100
              : 0;
            return (
              <div
                key={c.id}
                className="rounded-2xl border bg-card shadow-soft hover:shadow-elegant transition-all overflow-hidden"
              >
                <div className="flex items-center justify-between gap-3 p-5 border-b bg-gradient-to-l from-muted/40 to-transparent">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${meta?.tone ?? "bg-muted"}`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-bold truncate">{c.name}</h3>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {meta?.description}
                      </p>
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <p className="text-xs text-muted-foreground">السعة</p>
                    <p className="font-bold text-sm">
                      <span
                        className={
                          list.length >= c.max_members ? "text-emerald-600" : ""
                        }
                      >
                        {list.length}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        / {c.max_members}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="px-5 pt-3">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-gold transition-all duration-700"
                      style={{ width: `${Math.min(100, filledPct)}%` }}
                    />
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  {list.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-start justify-between gap-3 rounded-xl border bg-background/60 p-3"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div
                          className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                            m.is_head
                              ? "bg-gradient-gold text-gold-foreground"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          {m.full_name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm truncate">
                              {m.full_name}
                            </p>
                            {m.is_head && (
                              <Badge
                                variant="secondary"
                                className="bg-gold/15 text-gold-foreground gap-1 h-5 text-[10px]"
                              >
                                <Crown className="h-3 w-3" /> {COMMITTEE_HEAD_LABEL}
                              </Badge>
                            )}
                          </div>
                          {m.role_title && (
                            <p className="text-[11px] text-muted-foreground">
                              {committeeMemberLabel(m)}
                            </p>
                          )}
                          {m.specialty && (
                            <p className="text-[11px] text-primary mt-0.5 flex items-center gap-1">
                              <Star className="h-3 w-3" /> {m.specialty}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                            {m.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {m.phone}
                              </span>
                            )}
                            {m.email && (
                              <span className="flex items-center gap-1 truncate">
                                <Mail className="h-3 w-3" /> {m.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => toggleHead(m)}
                            title={m.is_head ? "إزالة الرئاسة" : "تعيين رئيساً"}
                          >
                            <Crown
                              className={`h-3.5 w-3.5 ${m.is_head ? "text-gold" : ""}`}
                            />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => remove(m.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}

                  {roleFilter === "all" &&
                    Array.from({
                      length: Math.max(0, c.max_members - list.length),
                    }).map((_, i) => (
                      <div
                        key={`empty-${i}`}
                        className="flex items-center gap-3 rounded-xl border border-dashed bg-muted/20 p-3 text-muted-foreground"
                      >
                        <div className="h-10 w-10 rounded-full bg-muted/40 flex items-center justify-center">
                          <UserCircle2 className="h-5 w-5" />
                        </div>
                        <p className="text-xs">مقعد شاغر — بانتظار الإسناد</p>
                      </div>
                    ))}

                  {roleFilter !== "all" && list.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      لا يوجد أعضاء بهذا الدور في هذه اللجنة.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ───────── Org Chart (Square frames · Left vertical spine + Pyramid base) ───────── */

// Tier 2 — supervisory committees displayed in a horizontal row directly under Supreme
const SPINE: CommitteeType[] = ["quality", "finance", "procurement", "women"];
// Tier 3 — operational committees displayed in a horizontal row at the bottom
const BASE: CommitteeType[] = ["media", "dinner", "programs", "reception"];

function OrgChart({
  committees,
  members,
}: {
  committees: CommitteeRow[];
  members: MemberRow[];
}) {
  const byType = (t: CommitteeType) => committees.find((c) => c.type === t);
  const spine = SPINE.map(byType).filter(Boolean) as CommitteeRow[];
  const base = BASE.map(byType).filter(Boolean) as CommitteeRow[];

  const exportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: "#ffffff",
        filter: (node) => {
          if (!(node instanceof HTMLElement)) return true;
          return !node.dataset?.exportHide;
        },
      });
      const link = document.createElement("a");
      link.download = `الهيكل-التنظيمي-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("تم تصدير الهيكل بنجاح");
    } catch (e) {
      toast.error("تعذّر التصدير");
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      ref={exportRef}
      className="relative rounded-3xl border bg-card shadow-soft overflow-hidden"
    >
      {/* Subtle calligraphy-style background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 80% 30%, currentColor 0px, transparent 1.5px), radial-gradient(circle at 20% 70%, currentColor 0px, transparent 1.5px)",
          backgroundSize: "60px 60px, 80px 80px",
        }}
      />
      <div className="absolute -top-32 -left-20 w-96 h-96 rounded-full bg-gold/5 blur-3xl pointer-events-none" />

      {/* Header bar */}
      <div className="relative flex items-center justify-between gap-4 px-6 lg:px-10 pt-7 pb-4 flex-wrap">
        <div className="flex items-stretch gap-3">
          <div className="w-1.5 rounded-full bg-gradient-to-b from-gold to-primary" />
          <div>
            <p className="text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
              Organization
            </p>
            <h2 className="text-2xl lg:text-3xl font-bold leading-tight">
              الهيكل التنظيمي
            </h2>
          </div>
        </div>
        <Button
          data-export-hide="true"
          onClick={handleExport}
          disabled={exporting}
          size="sm"
          className="gap-2 bg-gradient-gold text-gold-foreground hover:opacity-90 shadow-gold"
        >
          <Download className="h-4 w-4" />
          {exporting ? "جارِ التصدير..." : "تصدير PNG"}
        </Button>
      </div>

      <div className="h-px bg-gradient-to-l from-transparent via-gold/30 to-transparent" />

      <HierarchyChart spine={spine} base={base} members={members} />

      <div className="relative px-6 lg:px-10 pb-6 flex items-center justify-center gap-2 text-[10px] text-muted-foreground tracking-wider">
        <span className="h-px w-12 bg-border" />
        منصة لجنة الزواج الجماعي · قبيلة الهملة من قريش
        <span className="h-px w-12 bg-border" />
      </div>
    </div>
  );
}

interface ConnectorLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function HierarchyChart({
  spine,
  base,
  members,
}: {
  spine: CommitteeRow[];
  base: CommitteeRow[];
  members: MemberRow[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const supremeRef = useRef<HTMLDivElement>(null);
  const spineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const baseRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [lines, setLines] = useState<ConnectorLine[]>([]);

  const measure = () => {
    const root = containerRef.current;
    if (!root) return;
    const rb = root.getBoundingClientRect();
    setSize({ w: rb.width, h: rb.height });

    const center = (el: HTMLElement | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        cx: r.left - rb.left + r.width / 2,
        top: r.top - rb.top,
        bottom: r.bottom - rb.top,
        left: r.left - rb.left,
        right: r.right - rb.left,
      };
    };

    const ls: ConnectorLine[] = [];
    const supreme = center(supremeRef.current);
    const spineCenters = spineRefs.current.map((el) => center(el)).filter(Boolean) as NonNullable<ReturnType<typeof center>>[];
    const baseCenters = baseRefs.current.map((el) => center(el)).filter(Boolean) as NonNullable<ReturnType<typeof center>>[];

    if (!supreme) return setLines(ls);

    // Tier 2 (spine row): two horizontal arms emerging from Supreme's left & right edges,
    // each connecting to the 2 committees on that side. RTL → spine[0,1] right, spine[2,3] left.
    if (spineCenters.length >= 4) {
      const busY = (supreme.top + supreme.bottom) / 2;
      const rightSide = [spineCenters[0], spineCenters[1]];
      const leftSide = [spineCenters[2], spineCenters[3]];
      // Right arm (RTL: visually on the right of Supreme)
      const rightXs = rightSide.map((c) => c.cx);
      ls.push({
        x1: supreme.right,
        y1: busY,
        x2: Math.max(...rightXs),
        y2: busY,
      });
      // Left arm
      const leftXs = leftSide.map((c) => c.cx);
      ls.push({
        x1: supreme.left,
        y1: busY,
        x2: Math.min(...leftXs),
        y2: busY,
      });
    }

    // Tier 3 (base row): single vertical drop from Supreme + one horizontal bus across base nodes.
    if (baseCenters.length) {
      const busY = Math.min(...baseCenters.map((c) => c.top));
      ls.push({ x1: supreme.cx, y1: supreme.bottom, x2: supreme.cx, y2: busY });
      const baseXs = baseCenters.map((c) => c.cx);
      ls.push({
        x1: Math.min(...baseXs),
        y1: busY,
        x2: Math.max(...baseXs),
        y2: busY,
      });
    }

    setLines(ls);
  };

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(() => measure());
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spine.length, base.length]);

  return (
    <div ref={containerRef} className="relative px-6 lg:px-10 py-12 lg:py-16">
      {/* Connectors */}
      {size.w > 0 && (
        <svg
          width={size.w}
          height={size.h}
          className="absolute inset-0 pointer-events-none"
        >
          {lines.map((l, i) => (
            <line
              key={i}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke="oklch(0.38 0.05 110)"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          ))}
        </svg>
      )}

      {/* Two rows: Tier 2 (Supreme centered with 2 committees on each side) → Tier 3 */}
      <div className="relative flex flex-col items-center">
        {/* Tier 2 row — left 2 + Supreme + right 2 */}
        <div className="flex items-center justify-center gap-5 lg:gap-8 flex-wrap">
          {/* Right side (RTL ⇒ visually on the right): first 2 committees */}
          {spine.slice(0, 2).map((c, i) => (
            <div
              key={c.id}
              ref={(el) => {
                spineRefs.current[i] = el;
              }}
            >
              <SquareNode committee={c} members={members} />
            </div>
          ))}

          {/* Supreme in the middle */}
          <div ref={supremeRef} className="mx-2">
            <SupremeNode />
          </div>

          {/* Left side: last 2 committees */}
          {spine.slice(2, 4).map((c, i) => (
            <div
              key={c.id}
              ref={(el) => {
                spineRefs.current[i + 2] = el;
              }}
            >
              <SquareNode committee={c} members={members} />
            </div>
          ))}
        </div>

        {/* Tier 3 — operational committees */}
        <div className="mt-16 lg:mt-20 grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-6 w-full justify-items-center">
          {base.map((c, i) => (
            <div
              key={c.id}
              ref={(el) => {
                baseRefs.current[i] = el;
              }}
            >
              <SquareNode committee={c} members={members} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────── Supreme (top — compact gold rectangle) ───────── */
function SupremeNode() {
  return (
    <Link
      to="/admin"
      className="group relative block"
      title="اللجنة العليا"
    >
      <div className="relative h-20 w-44 lg:h-[88px] lg:w-52 rounded-2xl bg-gradient-to-br from-gold/95 via-gold to-amber-500 shadow-gold flex items-center justify-center ring-[3px] ring-gold/25 group-hover:scale-[1.02] transition-transform duration-300">
        <div className="absolute inset-1 rounded-xl border border-white/40" />
        <div className="relative flex items-center gap-2.5 text-gold-foreground px-3">
          <Crown className="h-5 w-5 shrink-0 opacity-95" />
          <div className="text-right leading-tight">
            <p className="font-bold text-[15px] lg:text-base">اللجنة العليا</p>
            <p className="text-[10px] opacity-85 tracking-wider mt-0.5">
              الإشراف العام
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ───────── Committee Node (elegant rectangular pill with gold accent strip) ───────── */
function SquareNode({
  committee,
  members,
}: {
  committee: CommitteeRow;
  members: MemberRow[];
}) {
  const meta = COMMITTEES.find((m) => m.type === committee.type);
  const Icon = meta?.icon ?? Users;
  const list = members.filter((m) => m.committee_id === committee.id);
  const head = list.find((m) => m.is_head);
  const isFull = list.length >= committee.max_members && committee.max_members > 0;

  return (
    <Link
      to="/committee/$type"
      params={{ type: committee.type }}
      className="group relative flex flex-col items-center w-[160px] lg:w-[180px]"
      title={`فتح صفحة ${committee.name}`}
    >
      {/* Rectangular pill card — gold right-accent strip + soft border */}
      <div className="relative min-h-[72px] w-full overflow-hidden rounded-xl bg-card border border-gold/30 shadow-soft group-hover:shadow-elegant group-hover:border-gold/60 group-hover:-translate-y-0.5 transition-all duration-300">
        {/* Right gold accent strip (RTL — visually on the right) */}
        <div className="absolute inset-y-0 right-0 w-1 bg-gradient-to-b from-gold to-amber-500" />
        {/* Subtle gold tint */}
        <div className="absolute inset-0 bg-gradient-to-l from-gold/5 to-transparent pointer-events-none" />

        <div className="relative flex items-center gap-2.5 pr-3 pl-2.5 py-2">
          <div className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center bg-gold/10 text-gold ring-1 ring-gold/20">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 text-right">
            <p className="font-bold text-[12.5px] leading-snug text-foreground group-hover:text-primary transition-colors break-words">
              {committee.name}
            </p>
            <Badge
              variant="secondary"
              className={`mt-1 text-[9.5px] h-4 px-1.5 font-semibold ${
                isFull
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                  : "bg-gold/10 text-gold border-gold/20"
              }`}
            >
              {list.length}/{committee.max_members}
            </Badge>
          </div>
        </div>
      </div>

      {/* Head label below */}
      {head && (
        <div className="text-center mt-2">
          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
            <Crown className="h-2.5 w-2.5 text-gold" /> رئيس اللجنة
          </p>
          <p className="text-[12px] font-semibold truncate max-w-[160px]">
            {head.full_name}
          </p>
        </div>
      )}
    </Link>
  );
}

