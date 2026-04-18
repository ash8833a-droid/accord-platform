import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/team")({
  component: TeamPage,
});

interface CommitteeRow {
  id: string;
  name: string;
  type: CommitteeType;
  max_members: number;
}
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
}

// Display order for the org chart (top → bottom)
const ORG_ORDER: CommitteeType[] = [
  "finance",
  "procurement",
  "quality",
  "media",
  "reception",
  "programs",
  "dinner",
  "women",
];

function TeamPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const [committees, setCommittees] = useState<CommitteeRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
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
    const [cm, mb] = await Promise.all([
      supabase.from("committees").select("id, name, type, max_members"),
      supabase
        .from("team_members")
        .select(
          "id, committee_id, full_name, role_title, phone, email, specialty, is_head, display_order",
        )
        .order("is_head", { ascending: false })
        .order("display_order"),
    ]);
    setCommittees((cm.data as CommitteeRow[]) ?? []);
    setMembers((mb.data as MemberRow[]) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const sortedCommittees = useMemo(() => {
    return [...committees].sort(
      (a, b) => ORG_ORDER.indexOf(a.type) - ORG_ORDER.indexOf(b.type),
    );
  }, [committees]);

  const create = async () => {
    if (!form.full_name || !form.committee_id) {
      toast.error("الاسم واللجنة مطلوبان");
      return;
    }
    const { error } = await supabase.from("team_members").insert({
      committee_id: form.committee_id,
      full_name: form.full_name,
      role_title: form.role_title || null,
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
                  <div className="grid grid-cols-2 gap-3">
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
                    <div>
                      <Label>المسمى الوظيفي</Label>
                      <Input
                        value={form.role_title}
                        onChange={(e) =>
                          setForm({ ...form, role_title: e.target.value })
                        }
                        placeholder="مثال: محاسب"
                      />
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

      {/* Org Chart */}
      <OrgChart committees={sortedCommittees} members={members} />

      {/* Detailed committees */}
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <div className="h-1 w-10 bg-gradient-gold rounded-full" />
          <h2 className="text-lg font-bold">أعضاء اللجان بالتفصيل</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {sortedCommittees.map((c) => {
            const meta = COMMITTEES.find((m) => m.type === c.type);
            const Icon = meta?.icon ?? Users;
            const list = members.filter((m) => m.committee_id === c.id);
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
                                <Crown className="h-3 w-3" /> رئيس اللجنة
                              </Badge>
                            )}
                          </div>
                          {m.role_title && (
                            <p className="text-[11px] text-muted-foreground">
                              {m.role_title}
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

                  {Array.from({
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
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ───────── Org Chart ───────── */

function OrgChart({
  committees,
  members,
}: {
  committees: CommitteeRow[];
  members: MemberRow[];
}) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-2 mb-6">
        <div className="h-1 w-10 bg-gradient-hero rounded-full" />
        <h2 className="text-lg font-bold">الهيكل التنظيمي</h2>
      </div>

      {/* Top: Supreme Committee */}
      <div className="flex flex-col items-center">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-gold blur-xl opacity-30 rounded-2xl" />
          <div className="relative rounded-2xl bg-gradient-hero text-primary-foreground px-8 py-5 shadow-elegant text-center min-w-[260px]">
            <Crown className="h-6 w-6 text-gold mx-auto mb-1" />
            <p className="text-[11px] text-primary-foreground/70">
              قمة الهيكل التنظيمي
            </p>
            <p className="font-bold text-lg text-shimmer-gold">اللجنة العليا</p>
            <p className="text-[11px] text-primary-foreground/80 mt-1">
              الإشراف العام والقرارات الاستراتيجية
            </p>
          </div>
        </div>

        {/* Connector */}
        <div className="w-px h-8 bg-border" />
        <div className="h-px w-full max-w-5xl bg-border relative">
          <div className="absolute left-1/2 -top-1 h-2 w-2 rounded-full bg-gold -translate-x-1/2" />
        </div>

        {/* Committees row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 w-full mt-4">
          {committees.map((c) => {
            const meta = COMMITTEES.find((m) => m.type === c.type);
            const Icon = meta?.icon ?? Users;
            const list = members.filter((m) => m.committee_id === c.id);
            const head = list.find((m) => m.is_head);
            const isFull = list.length >= c.max_members && c.max_members > 0;
            return (
              <div
                key={c.id}
                className="relative flex flex-col items-center"
              >
                {/* Vertical connector */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-px h-4 bg-border" />
                <div className="w-full rounded-xl border bg-gradient-to-br from-background to-muted/40 p-3 hover:shadow-elegant hover:-translate-y-0.5 transition-all">
                  <div
                    className={`h-10 w-10 rounded-lg flex items-center justify-center mx-auto mb-2 ${meta?.tone ?? "bg-muted"}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="font-bold text-xs text-center leading-tight mb-1.5 min-h-8">
                    {c.name}
                  </p>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Badge
                      variant="secondary"
                      className={`text-[10px] h-4 px-1.5 ${
                        isFull
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                      }`}
                    >
                      {list.length}/{c.max_members}
                    </Badge>
                  </div>
                  {head ? (
                    <p className="text-[10px] text-center text-muted-foreground truncate flex items-center justify-center gap-1">
                      <Crown className="h-2.5 w-2.5 text-gold" />
                      {head.full_name}
                    </p>
                  ) : (
                    <p className="text-[10px] text-center text-muted-foreground/60">
                      بلا رئيس
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
