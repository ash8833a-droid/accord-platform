import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { COMMITTEES } from "@/lib/committees";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Check, X, UserCheck, Phone, Building2, Inbox } from "lucide-react";
import { toast } from "sonner";

interface MR {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  family_branch: string | null;
  requested_committee_id: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}
interface Committee { id: string; name: string; type: string }
type AppRole = "admin" | "committee" | "delegate" | "quality";

const ROLES: { value: AppRole; label: string }[] = [
  { value: "committee", label: "عضو لجنة" },
  { value: "quality", label: "ضابط جودة" },
  { value: "delegate", label: "مندوب" },
  { value: "admin", label: "مدير نظام" },
];

export function MembersApproval({ isAdmin }: { isAdmin: boolean }) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<MR[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [loading, setLoading] = useState(true);

  // Approval dialog state
  const [openId, setOpenId] = useState<string | null>(null);
  const [committeeId, setCommitteeId] = useState<string>("");
  const [role, setRole] = useState<AppRole>("committee");
  const [reviewNotes, setReviewNotes] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: mrs }, { data: cs }] = await Promise.all([
      supabase.from("membership_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("committees").select("id,name,type").order("name"),
    ]);
    setRequests((mrs ?? []) as MR[]);
    setCommittees(cs ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openApprove = (mr: MR) => {
    setOpenId(mr.id);
    setCommitteeId(mr.requested_committee_id ?? "");
    setRole("committee");
    setReviewNotes("");
  };

  const approve = async () => {
    const mr = requests.find((r) => r.id === openId);
    if (!mr) return;
    if (role !== "admin" && !committeeId) {
      toast.error("اختر اللجنة لتسكين العضو");
      return;
    }
    // Insert role row → makes user "approved"
    const { error: roleErr } = await supabase.from("user_roles").insert({
      user_id: mr.user_id,
      role,
      committee_id: role === "admin" ? null : committeeId,
    });
    if (roleErr) {
      toast.error("تعذّر التسكين", { description: roleErr.message });
      return;
    }
    const { error: upErr } = await supabase.from("membership_requests").update({
      status: "approved",
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes || null,
      assigned_committee_id: role === "admin" ? null : committeeId,
      assigned_role: role,
    }).eq("id", mr.id);
    if (upErr) {
      toast.error("تم التسكين لكن تعذّر تحديث الطلب", { description: upErr.message });
    } else {
      toast.success("تم اعتماد العضو وتسكينه");
    }
    setOpenId(null);
    load();
  };

  const reject = async (mr: MR) => {
    const { error } = await supabase.from("membership_requests").update({
      status: "rejected",
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", mr.id);
    if (error) toast.error("تعذّر الرفض", { description: error.message });
    else { toast.success("تم رفض الطلب"); load(); }
  };

  const filtered = requests.filter((r) => filter === "all" || r.status === filter);
  const counts = {
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };
  const committeeLabel = (id?: string | null) => {
    if (!id) return "—";
    const c = committees.find((x) => x.id === id);
    if (!c) return "—";
    return COMMITTEES.find((m) => m.type === c.type)?.label ?? c.name;
  };

  if (!isAdmin) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        هذه اللوحة متاحة لمدير النظام فقط.
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {(["pending","approved","rejected"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-2xl border p-4 text-right transition-all ${
              filter === k ? "border-primary bg-primary/5 shadow-sm" : "hover:border-primary/40"
            }`}
          >
            <div className="text-xs text-muted-foreground">
              {k === "pending" ? "قيد المراجعة" : k === "approved" ? "معتمد" : "مرفوض"}
            </div>
            <div className="text-2xl font-bold mt-1">{counts[k]}</div>
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="p-8 text-center text-muted-foreground">جارِ التحميل…</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <Inbox className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">لا توجد طلبات في هذه القائمة</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((mr) => (
            <Card key={mr.id} className="p-5">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="h-12 w-12 rounded-full bg-gradient-gold flex items-center justify-center text-gold-foreground font-bold shrink-0">
                    {mr.full_name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{mr.full_name}</p>
                      <Badge variant={mr.status === "pending" ? "secondary" : mr.status === "approved" ? "default" : "destructive"}>
                        {mr.status === "pending" ? "قيد المراجعة" : mr.status === "approved" ? "معتمد" : "مرفوض"}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{mr.phone}</span>
                      {mr.family_branch && <span>الفرع: {mr.family_branch}</span>}
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />طلب: {committeeLabel(mr.requested_committee_id)}
                      </span>
                    </div>
                    {mr.notes && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{mr.notes}</p>}
                  </div>
                </div>
                {mr.status === "pending" && (
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="destructive" onClick={() => reject(mr)} className="gap-1">
                      <X className="h-4 w-4" /> رفض
                    </Button>
                    <Button size="sm" onClick={() => openApprove(mr)} className="gap-1">
                      <Check className="h-4 w-4" /> اعتماد وتسكين
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!openId} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" /> اعتماد وتسكين العضو
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الدور</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {role !== "admin" && (
              <div className="space-y-2">
                <Label>اللجنة *</Label>
                <Select value={committeeId} onValueChange={setCommitteeId}>
                  <SelectTrigger><SelectValue placeholder="اختر اللجنة" /></SelectTrigger>
                  <SelectContent>
                    {committees.map((c) => {
                      const meta = COMMITTEES.find((m) => m.type === c.type);
                      return <SelectItem key={c.id} value={c.id}>{meta?.label ?? c.name}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">سيتمكن العضو من الوصول لصفحة هذه اللجنة فقط.</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>ملاحظات (اختياري)</Label>
              <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenId(null)}>إلغاء</Button>
            <Button onClick={approve}>اعتماد</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
