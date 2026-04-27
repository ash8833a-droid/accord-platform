import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Inbox, CheckCircle2, AlertCircle, User, Phone, Users as UsersIcon, Heart,
  ClipboardList, Globe2, Crown, ImageIcon, IdCard, Loader2, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { GroomTimeline } from "@/components/grooms/GroomTimeline";

interface GroomRow {
  id: string;
  full_name: string;
  phone: string;
  family_branch: string;
  bride_name: string | null;
  wedding_date: string | null;
  status: "new" | "under_review" | "approved" | "rejected" | "completed";
  request_type: string | null;
  request_details: string | null;
  external_participation: boolean;
  external_participation_details: string | null;
  vip_guests: string | null;
  notes: string | null;
  photo_url: string | null;
  national_id_url: string | null;
  created_at: string;
}

const REQ_LABEL: Record<string, { label: string; cls: string; icon: string }> = {
  extra_sheep:   { label: "زيادة ذبائح", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30", icon: "🐑" },
  transfer:      { label: "تنازل لعريس آخر", cls: "bg-violet-500/15 text-violet-700 border-violet-500/30", icon: "🤝" },
  decline_extra: { label: "اعتذار عن الزيادة", cls: "bg-rose-500/15 text-rose-700 border-rose-500/30", icon: "🙏" },
};

export function MediaInbox() {
  const [rows, setRows] = useState<GroomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GroomRow | null>(null);
  const [reviseFor, setReviseFor] = useState<GroomRow | null>(null);
  const [reviseNote, setReviseNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("grooms")
      .select("*")
      .in("status", ["new", "under_review"])
      .order("created_at", { ascending: false });
    setRows((data ?? []) as GroomRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const signedUrl = async (path: string | null) => {
    if (!path) return null;
    const { data } = await supabase.storage.from("groom-docs").createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  };

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [idUrl, setIdUrl] = useState<string | null>(null);
  useEffect(() => {
    setPhotoUrl(null); setIdUrl(null);
    if (!selected) return;
    signedUrl(selected.photo_url).then(setPhotoUrl);
    signedUrl(selected.national_id_url).then(setIdUrl);
  }, [selected?.id]);

  const approve = async (g: GroomRow) => {
    setBusyId(g.id);
    const { error } = await supabase.from("grooms")
      .update({ status: "approved" }).eq("id", g.id);
    setBusyId(null);
    if (error) return toast.error("تعذر الاعتماد", { description: error.message });
    toast.success(`تم اعتماد العريس: ${g.full_name}`);
    setSelected(null);
    load();
  };

  const requestRevision = async () => {
    if (!reviseFor) return;
    if (!reviseNote.trim()) return toast.error("اكتب تفاصيل التعديل المطلوب");
    setBusyId(reviseFor.id);
    const note = `[طلب تعديل من لجنة الإعلام · ${new Date().toLocaleDateString("ar-SA")}]\n${reviseNote.trim()}\n${reviseFor.notes ? "\n" + reviseFor.notes : ""}`;
    const { error } = await supabase.from("grooms")
      .update({ status: "under_review", notes: note })
      .eq("id", reviseFor.id);
    setBusyId(null);
    if (error) return toast.error("تعذر الإرسال", { description: error.message });
    toast.success("تم إرسال طلب التعديل");
    setReviseFor(null); setReviseNote(""); setSelected(null);
    load();
  };

  const newCount = rows.filter((r) => r.status === "new").length;
  const reviewCount = rows.filter((r) => r.status === "under_review").length;

  return (
    <div className="rounded-2xl border bg-card shadow-soft overflow-hidden">
      <div className="px-5 py-4 border-b bg-gradient-to-l from-sky-500/10 via-primary/5 to-transparent flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="h-10 w-10 rounded-xl bg-sky-500/15 text-sky-700 dark:text-sky-300 flex items-center justify-center">
            <Inbox className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-bold text-base flex items-center gap-2">
              صندوق وارد لجنة الإعلام
              {rows.length > 0 && (
                <span className="h-5 min-w-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {rows.length}
                </span>
              )}
            </h3>
            <p className="text-[11px] text-muted-foreground">العرسان الجدد بانتظار التدقيق والتنسيق</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-[10px]">
            جديد: {newCount}
          </Badge>
          <Badge variant="outline" className="bg-sky-500/10 text-sky-700 border-sky-500/30 text-[10px]">
            قيد المراجعة: {reviewCount}
          </Badge>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="py-10 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">لا توجد طلبات تحتاج تدقيق حالياً</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rows.map((g) => {
              const req = g.request_type && g.request_type !== "none" ? REQ_LABEL[g.request_type] : null;
              return (
                <div key={g.id} className="rounded-xl border bg-gradient-to-br from-card to-muted/20 p-4 hover:border-primary/40 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                        {g.full_name.trim().split(/\s+/).slice(0,2).map(s=>s[0]).join("")}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{g.full_name}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <UsersIcon className="h-3 w-3" /> {g.family_branch}
                          <span className="mx-1">·</span>
                          <Phone className="h-3 w-3" /> <span dir="ltr">{g.phone}</span>
                        </p>
                        {g.bride_name && (
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Heart className="h-3 w-3 text-rose-500" /> {g.bride_name}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className={
                      g.status === "new"
                        ? "bg-amber-500/15 text-amber-700 border-amber-500/30 text-[10px]"
                        : "bg-sky-500/15 text-sky-700 border-sky-500/30 text-[10px]"
                    }>
                      {g.status === "new" ? "جديد" : "قيد المراجعة"}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {req && (
                      <Badge variant="outline" className={`${req.cls} text-[10px]`}>
                        <span className="ms-0.5">{req.icon}</span> {req.label}
                      </Badge>
                    )}
                    {g.external_participation && (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[10px]">
                        <Globe2 className="h-3 w-3 ms-0.5" /> مشاركات خارجية
                      </Badge>
                    )}
                    {g.vip_guests && (
                      <Badge variant="outline" className="bg-gold/15 text-gold-foreground border-gold/40 text-[10px]">
                        <Crown className="h-3 w-3 ms-0.5" /> ضيوف اعتباريون
                      </Badge>
                    )}
                    {g.photo_url && (
                      <Badge variant="outline" className="text-[10px]"><ImageIcon className="h-3 w-3 ms-0.5" /> صورة</Badge>
                    )}
                    {g.national_id_url && (
                      <Badge variant="outline" className="text-[10px]"><IdCard className="h-3 w-3 ms-0.5" /> هوية</Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setSelected(g)}>
                      <Eye className="h-3.5 w-3.5 ms-1" /> عرض التفاصيل
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => approve(g)}
                      disabled={busyId === g.id}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 ms-1" /> قبول
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10"
                      onClick={() => { setReviseFor(g); setReviseNote(""); }}
                      disabled={busyId === g.id}
                    >
                      <AlertCircle className="h-3.5 w-3.5 ms-1" /> طلب تعديل
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Details Dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              تفاصيل العريس — {selected?.full_name}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <Info icon={Phone} label="الجوال" value={selected.phone} dir="ltr" />
                <Info icon={UsersIcon} label="الفرع العائلي" value={selected.family_branch} />
              </div>

              {(photoUrl || idUrl) && (
                <div className="grid grid-cols-2 gap-3">
                  {photoUrl && (
                    <a href={photoUrl} target="_blank" rel="noopener" className="block rounded-lg border overflow-hidden hover:ring-2 ring-primary transition">
                      <div className="px-3 py-2 text-[11px] font-bold bg-muted/40 flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" /> الصورة الشخصية</div>
                      <img src={photoUrl} alt="صورة العريس" className="w-full h-44 object-cover" />
                    </a>
                  )}
                  {idUrl && (
                    <a href={idUrl} target="_blank" rel="noopener" className="block rounded-lg border overflow-hidden hover:ring-2 ring-primary transition">
                      <div className="px-3 py-2 text-[11px] font-bold bg-muted/40 flex items-center gap-1"><IdCard className="h-3.5 w-3.5" /> الهوية الوطنية</div>
                      <img src={idUrl} alt="الهوية الوطنية" className="w-full h-44 object-cover" />
                    </a>
                  )}
                </div>
              )}

              {selected.request_type && selected.request_type !== "none" && (
                <Block title="طلبات العريس" icon={ClipboardList} tone="amber">
                  <Badge variant="outline" className={`${REQ_LABEL[selected.request_type]?.cls ?? ""} text-xs mb-2`}>
                    {REQ_LABEL[selected.request_type]?.icon} {REQ_LABEL[selected.request_type]?.label}
                  </Badge>
                  {selected.request_details && <p className="text-sm leading-relaxed">{selected.request_details}</p>}
                </Block>
              )}

              {selected.external_participation && (
                <Block title="مشاركات خارجية" icon={Globe2} tone="emerald">
                  <p className="text-sm leading-relaxed">{selected.external_participation_details ?? "—"}</p>
                </Block>
              )}

              {selected.vip_guests && (
                <Block title="ضيوف الشخصيات الاعتبارية" icon={Crown} tone="gold">
                  <p className="text-sm leading-relaxed">{selected.vip_guests}</p>
                </Block>
              )}

              {selected.notes && (
                <Block title="ملاحظات" icon={ClipboardList} tone="muted">
                  <p className="text-sm leading-relaxed whitespace-pre-line">{selected.notes}</p>
                </Block>
              )}

              <GroomTimeline groomId={selected.id} />
            </div>
          )}
          <DialogFooter className="gap-2 pt-3 border-t">
            <Button
              variant="outline"
              className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10"
              onClick={() => selected && (setReviseFor(selected), setReviseNote(""))}
            >
              <AlertCircle className="h-4 w-4 ms-1" /> طلب تعديل
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={!selected || busyId === selected?.id}
              onClick={() => selected && approve(selected)}
            >
              <CheckCircle2 className="h-4 w-4 ms-1" /> قبول واعتماد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revision dialog */}
      <Dialog open={!!reviseFor} onOpenChange={(o) => !o && (setReviseFor(null), setReviseNote(""))}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              طلب تعديل — {reviseFor?.full_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            <p className="text-xs text-muted-foreground">اكتب التعديلات المطلوبة بوضوح ليتم تعديلها قبل الاعتماد.</p>
            <Textarea
              value={reviseNote}
              onChange={(e) => setReviseNote(e.target.value)}
              rows={5}
              placeholder="مثال: يرجى رفع صورة هوية أوضح، تأكيد رقم الجوال، توضيح تفاصيل التنازل..."
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setReviseFor(null); setReviseNote(""); }}>إلغاء</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={requestRevision}
              disabled={busyId === reviseFor?.id}
            >
              <AlertCircle className="h-4 w-4 ms-1" /> إرسال طلب التعديل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ icon: Icon, label, value, dir }: { icon?: any; label: string; value: string; dir?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </p>
      <p className="text-sm font-medium" dir={dir}>{value}</p>
    </div>
  );
}

function Block({ title, icon: Icon, tone, children }: { title: string; icon: any; tone: "amber" | "emerald" | "gold" | "muted"; children: React.ReactNode }) {
  const cls = {
    amber: "from-amber-500/10 border-amber-500/30 text-amber-700",
    emerald: "from-emerald-500/10 border-emerald-500/30 text-emerald-700",
    gold: "from-gold/15 border-gold/40 text-gold-foreground",
    muted: "from-muted/30 border-muted text-foreground",
  }[tone];
  return (
    <div className={`rounded-xl border bg-gradient-to-br ${cls} to-transparent p-3`}>
      <p className="text-xs font-bold flex items-center gap-1 mb-2"><Icon className="h-3.5 w-3.5" /> {title}</p>
      <div className="text-foreground">{children}</div>
    </div>
  );
}
