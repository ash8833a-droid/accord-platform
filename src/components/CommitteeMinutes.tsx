import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  ClipboardList, Upload, Loader2, Calendar, Eye, Trash2, Printer, Plus, X,
  Sparkles, FileText, Users, ListChecks, MessageSquareQuote, MapPin, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ACCEPT_ANY_FILE, MAX_UPLOAD_SIZE, MAX_UPLOAD_SIZE_LABEL } from "@/lib/uploads";
import { useBrand, brandLogoSrc } from "@/lib/brand";
import { printHtmlDocument } from "@/lib/print-frame";

interface Minute {
  id: string;
  title: string;
  notes: string | null;
  meeting_date: string | null;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  recorder_name: string | null;
  attendees: string[];
  agenda_items: string[];
  recommendations: string[];
  file_url: string | null;
  file_type: string | null;
  created_at: string;
}

interface Props {
  committeeId: string;
  committeeName: string;
  canManage: boolean;
}

const emptyForm = (committeeName: string) => ({
  id: null as string | null,
  title: "",
  meeting_date: new Date().toISOString().slice(0, 10),
  location: "",
  start_time: "",
  end_time: "",
  recorder_name: "",
  notes: "",
  attendees: [] as string[],
  agenda_items: [] as string[],
  recommendations: [] as string[],
});

function ListEditor({
  label,
  icon: Icon,
  items,
  onChange,
  placeholder,
  accent,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  accent: "primary" | "gold";
}) {
  const [draft, setDraft] = useState("");
  const ringClass = accent === "gold" ? "from-gold/25 to-primary/10 text-gold-foreground" : "from-primary/20 to-gold/10 text-primary";
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  };
  return (
    <div className="space-y-2 rounded-xl border bg-card/60 p-3">
      <div className="flex items-center gap-2">
        <span className={`h-7 w-7 rounded-lg bg-gradient-to-br ${ringClass} flex items-center justify-center`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <Label className="text-xs font-bold">{label}</Label>
        <Badge variant="outline" className="text-[10px] ms-auto">{items.length}</Badge>
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="text-sm"
        />
        <Button type="button" size="sm" onClick={add} variant="outline" className="shrink-0">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="group flex items-start gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs">
              <span className={`mt-0.5 h-5 w-5 rounded bg-gradient-to-br ${ringClass} flex items-center justify-center font-bold text-[10px] shrink-0`}>
                {i + 1}
              </span>
              <span className="flex-1 leading-relaxed">{it}</span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="opacity-50 hover:opacity-100 hover:text-destructive transition shrink-0"
                title="حذف"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CommitteeMinutes({ committeeId, committeeName, canManage }: Props) {
  const { user } = useAuth();
  const { brand } = useBrand();
  const [items, setItems] = useState<Minute[]>([]);
  const [form, setForm] = useState(emptyForm(committeeName));
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"list" | "create">("list");

  const load = async () => {
    const { data } = await supabase
      .from("committee_minutes" as any)
      .select("*")
      .eq("committee_id", committeeId)
      .order("meeting_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    setItems(((data ?? []) as unknown) as Minute[]);
  };

  useEffect(() => { load(); }, [committeeId]);

  const reset = () => { setForm(emptyForm(committeeName)); setFile(null); };

  const editExisting = (m: Minute) => {
    setForm({
      id: m.id,
      title: m.title || "",
      meeting_date: m.meeting_date || new Date().toISOString().slice(0, 10),
      location: m.location || "",
      start_time: m.start_time || "",
      end_time: m.end_time || "",
      recorder_name: m.recorder_name || "",
      notes: m.notes || "",
      attendees: m.attendees || [],
      agenda_items: m.agenda_items || [],
      recommendations: m.recommendations || [],
    });
    setFile(null);
    setTab("create");
  };

  const extractFromFile = async () => {
    if (!file) return toast.error("اختر ملف المحضر أولاً");
    if (file.size > MAX_UPLOAD_SIZE) return toast.error(`حجم الملف أكبر من ${MAX_UPLOAD_SIZE_LABEL}`);
    setExtracting(true);
    try {
      const buf = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
      }
      const fileBase64 = btoa(binary);
      const { data, error } = await supabase.functions.invoke("extract-minutes", {
        body: { fileBase64, mimeType: file.type || "application/pdf", committeeName },
      });
      if (error) {
        toast.error("تعذّر الاستخراج", { description: error.message });
        return;
      }
      const r = data as any;
      setForm((f) => ({
        ...f,
        title: r.title || f.title,
        meeting_date: r.meeting_date || f.meeting_date,
        start_time: r.start_time || f.start_time,
        end_time: r.end_time || f.end_time,
        location: r.location || f.location,
        recorder_name: r.recorder_name || f.recorder_name,
        notes: r.notes || f.notes,
        attendees: r.attendees?.length ? r.attendees : f.attendees,
        agenda_items: r.agenda_items?.length ? r.agenda_items : f.agenda_items,
        recommendations: r.recommendations?.length ? r.recommendations : f.recommendations,
      }));
      toast.success("تم استخراج بيانات المحضر — راجعها قبل الحفظ");
    } finally {
      setExtracting(false);
    }
  };

  const save = async () => {
    if (!canManage) return toast.error("لا تملك صلاحية حفظ المحاضر");
    if (!form.title.trim() && form.agenda_items.length === 0) {
      return toast.error("أضِف عنواناً أو بنداً واحداً على الأقل");
    }
    setSaving(true);
    try {
      const payload = {
        committee_id: committeeId,
        title: form.title.trim() || `محضر اجتماع ${committeeName} - ${form.meeting_date}`,
        meeting_date: form.meeting_date || null,
        location: form.location || null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        recorder_name: form.recorder_name || null,
        notes: form.notes || null,
        attendees: form.attendees,
        agenda_items: form.agenda_items,
        recommendations: form.recommendations,
        created_by: user?.id ?? null,
      };
      if (form.id) {
        const { error } = await supabase.from("committee_minutes" as any).update(payload).eq("id", form.id);
        if (error) { toast.error("تعذّر التحديث", { description: error.message }); return; }
        toast.success("تم تحديث المحضر");
      } else {
        const { error } = await supabase.from("committee_minutes" as any).insert(payload);
        if (error) { toast.error("تعذّر الحفظ", { description: error.message }); return; }
        toast.success("تم حفظ المحضر");
      }
      reset();
      setTab("list");
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m: Minute) => {
    if (!canManage) return;
    if (!confirm(`حذف المحضر "${m.title}"؟`)) return;
    const { error } = await supabase.from("committee_minutes" as any).delete().eq("id", m.id);
    if (error) return toast.error("تعذّر الحذف", { description: error.message });
    toast.success("تم الحذف");
    load();
  };

  const renderProfessionalHtml = (m: {
    title: string; meeting_date: string | null; location: string | null;
    start_time: string | null; end_time: string | null; recorder_name: string | null;
    notes: string | null; attendees: string[]; agenda_items: string[]; recommendations: string[];
  }): string => {
    const dateStr = m.meeting_date ? new Date(m.meeting_date).toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "—";
    const timeStr = [m.start_time, m.end_time].filter(Boolean).join(" – ") || "—";
    const logo = brandLogoSrc(brand);
    const primary = brand.primary_color || "#1B4F58";
    const gold = brand.gold_color || "#C4A25C";
    const li = (arr: string[]) =>
      arr.length === 0
        ? `<li class="empty">— لا يوجد —</li>`
        : arr.map((x, i) => `<li><span class="num">${i + 1}</span><span>${escapeHtml(x)}</span></li>`).join("");
    const attendeesHtml = m.attendees.length === 0
      ? `<div class="empty">— لم يُسجَّل حضور —</div>`
      : `<div class="att-grid">${m.attendees.map((a, i) => `<div class="att"><span class="att-num">${i + 1}</span>${escapeHtml(a)}</div>`).join("")}</div>`;

    return `
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: 'Tajawal', 'Cairo', 'Segoe UI', Tahoma, sans-serif; color: #1f2937; direction: rtl; margin: 0; }
  .doc { max-width: 780px; margin: 0 auto; }
  .header { display: flex; align-items: center; gap: 16px; padding: 18px 20px; border-radius: 14px;
    background: linear-gradient(135deg, ${primary} 0%, ${primary}dd 60%, ${gold} 140%); color: #fff;
    box-shadow: 0 6px 20px ${primary}33; position: relative; overflow: hidden; }
  .header::after { content: ""; position: absolute; inset: 0; background:
    radial-gradient(circle at 90% 10%, rgba(255,255,255,.18), transparent 40%),
    radial-gradient(circle at 10% 90%, ${gold}55, transparent 45%); pointer-events: none; }
  .header img { width: 64px; height: 64px; object-fit: contain; background: #fff; border-radius: 12px; padding: 6px; box-shadow: 0 2px 8px rgba(0,0,0,.15); }
  .h-title { flex: 1; }
  .h-title .org { font-size: 12px; opacity: .85; letter-spacing: .5px; }
  .h-title .name { font-size: 20px; font-weight: 800; margin-top: 2px; }
  .h-title .sub { font-size: 12px; opacity: .9; margin-top: 2px; }
  .stamp { background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.35); padding: 6px 12px; border-radius: 999px;
    font-size: 11px; font-weight: 700; backdrop-filter: blur(4px); }

  .title-block { text-align: center; margin: 22px 0 14px; }
  .title-block .kicker { display: inline-block; font-size: 11px; letter-spacing: 3px; color: ${gold}; font-weight: 800;
    border-top: 1.5px solid ${gold}; border-bottom: 1.5px solid ${gold}; padding: 4px 14px; }
  .title-block h1 { font-size: 22px; margin: 10px 0 4px; color: ${primary}; font-weight: 800; }
  .title-block .subj { font-size: 13px; color: #4b5563; }

  .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 16px 0 18px; }
  .meta .cell { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 9px 12px; display: flex; align-items: center; gap: 10px; }
  .meta .cell .lbl { font-size: 10.5px; color: #6b7280; font-weight: 700; }
  .meta .cell .val { font-size: 13px; color: #111827; font-weight: 600; }
  .meta .ico { width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, ${primary}1a, ${gold}33);
    color: ${primary}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; }

  .section { margin: 16px 0; page-break-inside: avoid; }
  .section h2 { font-size: 14px; font-weight: 800; color: ${primary}; margin: 0 0 8px; padding: 6px 12px;
    background: linear-gradient(90deg, ${gold}22, transparent); border-right: 4px solid ${gold}; border-radius: 4px; display: flex; align-items: center; gap: 8px; }
  .section h2 .badge { background: ${primary}; color: #fff; font-size: 10px; padding: 2px 8px; border-radius: 999px; font-weight: 700; margin-right: auto; }

  ul.list { list-style: none; padding: 0; margin: 0; }
  ul.list li { display: flex; align-items: flex-start; gap: 10px; padding: 8px 12px; border-bottom: 1px dashed #e5e7eb; font-size: 13px; line-height: 1.7; }
  ul.list li:last-child { border-bottom: 0; }
  ul.list li .num { background: linear-gradient(135deg, ${primary}, ${primary}cc); color: #fff; font-size: 11px; font-weight: 700;
    width: 22px; height: 22px; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  ul.list li.empty { color: #9ca3af; font-size: 12px; padding: 8px 12px; }

  .att-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
  .att { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px 10px; font-size: 12.5px; display: flex; align-items: center; gap: 8px; }
  .att-num { background: ${gold}; color: #fff; font-size: 10px; font-weight: 800; width: 18px; height: 18px;
    border-radius: 50%; display: flex; align-items: center; justify-content: center; }
  .empty { color: #9ca3af; font-size: 12px; padding: 6px 4px; }

  .notes-box { background: #fffbeb; border: 1px solid ${gold}55; border-radius: 10px; padding: 10px 14px; font-size: 12.5px; color: #4b5563; line-height: 1.7; }

  .signatures { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .sig { text-align: center; }
  .sig .line { border-top: 1px solid #9ca3af; margin: 36px 12px 6px; }
  .sig .role { font-size: 11px; color: #6b7280; }
  .sig .who { font-size: 12.5px; color: #111827; font-weight: 700; margin-top: 2px; }

  .footer { margin-top: 22px; padding-top: 10px; border-top: 1.5px solid ${gold}; display: flex; justify-content: space-between;
    align-items: center; font-size: 10.5px; color: #6b7280; }
  .footer .brand-mini { display: flex; align-items: center; gap: 6px; font-weight: 700; color: ${primary}; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
<div class="doc">
  <div class="header">
    <img src="${logo}" alt="logo" />
    <div class="h-title">
      <div class="org">${escapeHtml(brand.name || "")}</div>
      <div class="name">${escapeHtml(committeeName)}</div>
      <div class="sub">${escapeHtml(brand.subtitle || "")}</div>
    </div>
    <div class="stamp">محضر اجتماع رسمي</div>
  </div>

  <div class="title-block">
    <div class="kicker">MEETING MINUTES · محضر اجتماع</div>
    <h1>${escapeHtml(m.title || "محضر اجتماع")}</h1>
    <div class="subj">${escapeHtml(committeeName)}</div>
  </div>

  <div class="meta">
    <div class="cell"><span class="ico">📅</span><div><div class="lbl">التاريخ</div><div class="val">${dateStr}</div></div></div>
    <div class="cell"><span class="ico">⏰</span><div><div class="lbl">التوقيت</div><div class="val">${timeStr}</div></div></div>
    <div class="cell"><span class="ico">📍</span><div><div class="lbl">المكان</div><div class="val">${escapeHtml(m.location || "—")}</div></div></div>
    <div class="cell"><span class="ico">✍️</span><div><div class="lbl">كاتب المحضر</div><div class="val">${escapeHtml(m.recorder_name || "—")}</div></div></div>
  </div>

  <div class="section">
    <h2>👥 الحضور <span class="badge">${m.attendees.length}</span></h2>
    ${attendeesHtml}
  </div>

  <div class="section">
    <h2>📋 بنود الاجتماع <span class="badge">${m.agenda_items.length}</span></h2>
    <ul class="list">${li(m.agenda_items)}</ul>
  </div>

  <div class="section">
    <h2>✅ التوصيات والقرارات <span class="badge">${m.recommendations.length}</span></h2>
    <ul class="list">${li(m.recommendations)}</ul>
  </div>

  ${m.notes ? `<div class="section"><h2>📝 ملاحظات إضافية</h2><div class="notes-box">${escapeHtml(m.notes).replace(/\n/g, "<br/>")}</div></div>` : ""}

  <div class="signatures">
    <div class="sig"><div class="line"></div><div class="role">كاتب المحضر</div><div class="who">${escapeHtml(m.recorder_name || "—")}</div></div>
    <div class="sig"><div class="line"></div><div class="role">رئيس اللجنة</div><div class="who">${escapeHtml(committeeName)}</div></div>
  </div>

  <div class="footer">
    <div class="brand-mini">${escapeHtml(brand.name || "")} — ${escapeHtml(brand.subtitle || "")}</div>
    <div>صدر بتاريخ ${new Date().toLocaleDateString("ar-SA")}</div>
  </div>
</div>`;
  };

  const printMinutes = async (m: Minute) => {
    const html = renderProfessionalHtml({
      title: m.title,
      meeting_date: m.meeting_date,
      location: m.location,
      start_time: m.start_time,
      end_time: m.end_time,
      recorder_name: m.recorder_name,
      notes: m.notes,
      attendees: m.attendees || [],
      agenda_items: m.agenda_items || [],
      recommendations: m.recommendations || [],
    });
    await printHtmlDocument(html, `محضر ${committeeName} - ${m.meeting_date ?? ""}`);
  };

  const previewCurrent = async () => {
    const html = renderProfessionalHtml(form);
    await printHtmlDocument(html, `محضر ${committeeName}`);
  };

  return (
    <Dialog onOpenChange={(o) => { if (!o) { reset(); setTab("list"); } }}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group relative inline-flex w-full sm:w-auto items-center gap-2.5 rounded-2xl border bg-card hover:bg-gold/5 hover:border-gold/40 px-4 py-3 shadow-sm hover:shadow-md transition-all"
          aria-label="محاضر الاجتماعات"
        >
          <span className="h-10 w-10 rounded-xl bg-gradient-to-br from-gold/25 to-primary/15 text-gold-foreground flex items-center justify-center group-hover:from-gold group-hover:to-gold/80 transition shadow-sm">
            <ClipboardList className="h-5 w-5" />
          </span>
          <span className="text-start">
            <span className="block text-sm font-bold leading-tight">محاضر الاجتماعات</span>
            <span className="block text-[11px] text-muted-foreground mt-0.5">
              {items.length > 0 ? `${items.length} محضر · إنشاء وطباعة احترافية` : "أنشئ محضراً احترافياً بضغطة زر"}
            </span>
          </span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl w-[96vw] p-0 overflow-hidden max-h-[92vh] flex flex-col">
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-l from-gold/10 via-primary/5 to-transparent">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-5 w-5 text-gold" />
            محاضر اجتماعات {committeeName}
            <Badge variant="outline" className="text-[10px] ms-auto border-gold/40 text-gold-foreground bg-gold/10">
              {items.length} محضر
            </Badge>
          </DialogTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            أنشئ محضراً منظماً (تاريخ، حضور، بنود، توصيات) — أو ارفع محضراً قديماً ليُستخرج تلقائياً، ثم اطبع نسخة احترافية بهوية اللجنة.
          </p>
        </DialogHeader>

        {canManage && (
          <div className="flex border-b bg-muted/20">
            <button
              type="button"
              className={`flex-1 px-4 py-2.5 text-sm font-bold transition ${tab === "list" ? "border-b-2 border-gold text-gold-foreground bg-card" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setTab("list")}
            >
              <FileText className="inline-block h-4 w-4 ms-1" /> المحاضر السابقة
            </button>
            <button
              type="button"
              className={`flex-1 px-4 py-2.5 text-sm font-bold transition ${tab === "create" ? "border-b-2 border-gold text-gold-foreground bg-card" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setTab("create")}
            >
              <Plus className="inline-block h-4 w-4 ms-1" /> {form.id ? "تعديل محضر" : "محضر جديد"}
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {tab === "list" && (
            <div className="divide-y">
              {items.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-12">لا توجد محاضر بعد — ابدأ بإنشاء محضر جديد</p>
              )}
              {items.map((m) => (
                <div key={m.id} className="px-5 py-3 flex items-start gap-3 hover:bg-muted/20 transition">
                  <span className="h-9 w-9 rounded-lg bg-gradient-to-br from-gold/20 to-primary/10 text-primary flex items-center justify-center shrink-0">
                    <ClipboardList className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{m.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                      {m.meeting_date && (
                        <Badge variant="outline" className="text-[10px] gap-1 border-gold/40 text-gold-foreground bg-gold/10">
                          <Calendar className="h-3 w-3" /> {new Date(m.meeting_date).toLocaleDateString("ar-SA")}
                        </Badge>
                      )}
                      {m.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {m.location}</span>}
                      <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {m.attendees?.length ?? 0} حاضر</span>
                      <span className="inline-flex items-center gap-1"><ListChecks className="h-3 w-3" /> {m.agenda_items?.length ?? 0} بند</span>
                      <span className="inline-flex items-center gap-1"><MessageSquareQuote className="h-3 w-3" /> {m.recommendations?.length ?? 0} توصية</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" onClick={() => printMinutes(m)} className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:opacity-90" title="محضر احترافي">
                      <Printer className="h-3.5 w-3.5 ms-1" /> طباعة
                    </Button>
                    {canManage && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => editExisting(m)} title="تعديل">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(m)} title="حذف" className="text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "create" && canManage && (
            <div className="p-5 space-y-4">
              {/* AI extract */}
              <div className="rounded-xl border-2 border-dashed border-gold/40 bg-gradient-to-br from-gold/5 to-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="h-8 w-8 rounded-lg bg-gradient-to-br from-gold to-primary text-primary-foreground flex items-center justify-center">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-bold">استخراج تلقائي من ملف محضر سابق</p>
                    <p className="text-[11px] text-muted-foreground">ارفع PDF / صورة / Word وسيقوم النظام بتعبئة الحقول تلقائياً</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex-1 min-w-[200px] flex items-center justify-center gap-2 h-9 px-3 rounded-md border border-dashed border-input cursor-pointer hover:border-gold/60 hover:bg-gold/5 transition text-xs bg-card">
                    <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground truncate">{file ? file.name : "اختر ملف المحضر"}</span>
                    <input type="file" accept={ACCEPT_ANY_FILE} className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  </label>
                  <Button type="button" onClick={extractFromFile} disabled={!file || extracting} className="bg-gradient-to-r from-gold to-primary text-primary-foreground">
                    {extracting ? <Loader2 className="h-4 w-4 ms-1 animate-spin" /> : <Sparkles className="h-4 w-4 ms-1" />}
                    {extracting ? "جاري التحليل..." : "استخراج البيانات"}
                  </Button>
                </div>
              </div>

              {/* Header fields */}
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">عنوان المحضر / موضوع الاجتماع</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={`اجتماع ${committeeName} الأسبوعي`} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> تاريخ الاجتماع</Label>
                  <Input type="date" value={form.meeting_date} onChange={(e) => setForm({ ...form, meeting_date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> المكان</Label>
                  <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="قاعة الاجتماعات / منصة Zoom..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> من الساعة</Label>
                  <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> إلى الساعة</Label>
                  <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">كاتب المحضر / أمين الاجتماع</Label>
                  <Input value={form.recorder_name} onChange={(e) => setForm({ ...form, recorder_name: e.target.value })} placeholder="اسم كاتب المحضر" />
                </div>
              </div>

              {/* Lists */}
              <ListEditor
                label="الحضور"
                icon={Users}
                items={form.attendees}
                onChange={(v) => setForm({ ...form, attendees: v })}
                placeholder="اكتب اسم العضو الحاضر ثم Enter"
                accent="gold"
              />
              <ListEditor
                label="بنود الاجتماع"
                icon={ListChecks}
                items={form.agenda_items}
                onChange={(v) => setForm({ ...form, agenda_items: v })}
                placeholder="اكتب البند ثم Enter"
                accent="primary"
              />
              <ListEditor
                label="التوصيات والقرارات"
                icon={MessageSquareQuote}
                items={form.recommendations}
                onChange={(v) => setForm({ ...form, recommendations: v })}
                placeholder="اكتب التوصية ثم Enter"
                accent="gold"
              />

              <div className="space-y-1.5">
                <Label className="text-xs">ملاحظات إضافية (اختياري)</Label>
                <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="ملاحظات حرة" />
              </div>
            </div>
          )}
        </div>

        {tab === "create" && canManage && (
          <div className="border-t p-3 flex items-center gap-2 bg-muted/20">
            <Button type="button" variant="outline" onClick={() => { reset(); setTab("list"); }} className="gap-1.5">
              إلغاء
            </Button>
            <Button type="button" variant="outline" onClick={previewCurrent} className="gap-1.5">
              <Printer className="h-4 w-4" /> معاينة احترافية
            </Button>
            <div className="flex-1" />
            <Button type="button" onClick={save} disabled={saving} className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
              {saving ? "جاري الحفظ..." : (form.id ? "حفظ التعديلات" : "حفظ المحضر")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}