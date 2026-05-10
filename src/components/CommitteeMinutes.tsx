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
  const [open, setOpen] = useState(false);

  // Allow external "quick upload" buttons to open this dialog directly on the create tab
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ committeeId: string; tab?: "list" | "create" }>).detail;
      if (!detail || detail.committeeId !== committeeId) return;
      setTab(detail.tab ?? "create");
      setOpen(true);
    };
    window.addEventListener("lovable:open-minutes", handler as EventListener);
    return () => window.removeEventListener("lovable:open-minutes", handler as EventListener);
  }, [committeeId]);

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
      // Build a snapshot for immediate printing (avoid stale state from setForm)
      const snapshot = {
        title: r.title || form.title,
        meeting_date: r.meeting_date || form.meeting_date,
        start_time: r.start_time || form.start_time,
        end_time: r.end_time || form.end_time,
        location: r.location || form.location,
        recorder_name: r.recorder_name || form.recorder_name,
        notes: r.notes || form.notes,
        attendees: r.attendees?.length ? r.attendees : form.attendees,
        agenda_items: r.agenda_items?.length ? r.agenda_items : form.agenda_items,
        recommendations: r.recommendations?.length ? r.recommendations : form.recommendations,
      };
      const counts: Array<[string, number | string]> = [
        ["العنوان", snapshot.title ? 1 : 0],
        ["التاريخ", snapshot.meeting_date ? 1 : 0],
        ["الحضور", snapshot.attendees.length],
        ["البنود", snapshot.agenda_items.length],
        ["التوصيات", snapshot.recommendations.length],
      ];
      const filled = counts.filter(([, v]) => Number(v) > 0).length;
      const summary = counts.map(([k, v]) => `${k}: ${v}`).join(" • ");
      toast.success(`تم استخراج ${filled} حقول من المحضر`, {
        description: summary,
        duration: 9000,
        action: {
          label: "طباعة الآن",
          onClick: async () => {
            const html = renderProfessionalHtml(snapshot);
            await printHtmlDocument(html, `محضر ${committeeName} - ${snapshot.meeting_date ?? ""}`);
          },
        },
      });
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
    ref_number?: string | null;
  }): string => {
    // ============================================================
    // Government-grade institutional Meeting Minutes document.
    // Monochrome Executive palette: Deep Teal #0D7C66 + Slate.
    // ============================================================
    const PRIMARY = "#0D7C66";       // Deep Teal — official accent
    const PRIMARY_DARK = "#0A5F4E";  // for borders / strong text
    const SLATE_900 = "#0F172A";     // headings
    const SLATE_700 = "#334155";     // body
    const SLATE_500 = "#64748B";     // labels / secondary
    const SLATE_300 = "#CBD5E1";     // borders
    const SLATE_50  = "#F8FAFC";     // cell backgrounds

    const dateStr = m.meeting_date
      ? new Date(m.meeting_date).toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
      : "—";
    const timeStr = [m.start_time, m.end_time].filter(Boolean).join(" – ") || "—";
    const issueDate = new Date().toLocaleDateString("ar-SA");
    const logo = brandLogoSrc(brand);

    // Reference number: prefer provided, else derive from date + committee initials
    const yearPart = (m.meeting_date ?? new Date().toISOString().slice(0, 10)).slice(0, 10).replace(/-/g, "");
    const cmtInitials = (committeeName || "LJN").split(/\s+/).map((w) => w.charAt(0)).join("").slice(0, 3).toUpperCase() || "LJN";
    const refNumber = m.ref_number || `MOM-${cmtInitials}-${yearPart}`;

    // Agenda / decisions as numbered table rows
    const tableRows = (arr: string[]) =>
      arr.length === 0
        ? `<tr><td class="row-empty" colspan="2">— لا يوجد —</td></tr>`
        : arr.map((x, i) => `
          <tr>
            <td class="row-num">${i + 1}</td>
            <td class="row-text">${escapeHtml(x)}</td>
          </tr>`).join("");

    // Attendees in 3-column compact grid
    const attendeesBlock = m.attendees.length === 0
      ? `<div class="empty">— لم يُسجَّل حضور —</div>`
      : `<div class="att-grid">${m.attendees.map((a, i) =>
          `<div class="att-cell"><span class="att-num">${i + 1}</span><span class="att-name">${escapeHtml(a)}</span></div>`
        ).join("")}</div>`;

    return `
<style>
  @page { size: A4; margin: 16mm 14mm 18mm 14mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Tajawal', 'Cairo', 'Segoe UI', Tahoma, sans-serif;
    color: ${SLATE_700};
    direction: rtl;
    font-size: 12pt;
    line-height: 1.55;
    background: #fff;
  }
  .doc { position: relative; max-width: 800px; margin: 0 auto; padding: 0 2mm; }

  /* Subtle institutional watermark */
  .watermark {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.05;
  }
  .watermark span {
    font-size: 110pt;
    font-weight: 900;
    color: ${PRIMARY};
    letter-spacing: 8px;
    transform: rotate(-28deg);
    white-space: nowrap;
  }
  .doc > * { position: relative; z-index: 1; }

  /* ============ Symmetrical official header ============ */
  .official-header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 16px;
    padding: 14px 6px 16px;
    border-bottom: 2.5px solid ${PRIMARY};
    margin-bottom: 4px;
  }
  .hdr-right { display: flex; align-items: center; gap: 12px; justify-content: flex-start; }
  .hdr-right img { width: 58px; height: 58px; object-fit: contain; }
  .hdr-right .org { font-size: 9pt; color: ${SLATE_500}; font-weight: 700; letter-spacing: .4px; }
  .hdr-right .cmt { font-size: 12pt; color: ${SLATE_900}; font-weight: 800; margin-top: 2px; line-height: 1.25; }

  .hdr-center { text-align: center; }
  .hdr-center .kicker {
    font-size: 8.5pt; letter-spacing: 4px; color: ${PRIMARY};
    font-weight: 800; padding-bottom: 4px;
  }
  .hdr-center h1 {
    font-size: 16pt; margin: 0; color: ${PRIMARY_DARK}; font-weight: 900;
    letter-spacing: .5px;
  }
  .hdr-center .underline {
    width: 70px; height: 2px; background: ${PRIMARY}; margin: 6px auto 0;
  }

  .hdr-left { font-size: 9pt; color: ${SLATE_700}; }
  .hdr-left .row { display: flex; justify-content: flex-end; gap: 6px; padding: 1.5px 0; }
  .hdr-left .row .lbl { color: ${SLATE_500}; font-weight: 700; }
  .hdr-left .row .val { color: ${SLATE_900}; font-weight: 700; font-feature-settings: "tnum"; }

  /* ============ Document subject ============ */
  .subject {
    margin: 14px 0 12px;
    text-align: center;
    padding: 10px 14px;
    border: 1px solid ${SLATE_300};
    background: ${SLATE_50};
    border-radius: 2px;
  }
  .subject .lbl { font-size: 9pt; color: ${SLATE_500}; font-weight: 700; letter-spacing: 1px; }
  .subject .val { font-size: 13pt; color: ${SLATE_900}; font-weight: 800; margin-top: 3px; }

  /* ============ Metadata grid ============ */
  .meta-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0;
    margin: 0 0 14px;
    border: 1px solid ${SLATE_300};
  }
  .meta-grid .cell {
    background: ${SLATE_50};
    border-bottom: 1px solid ${SLATE_300};
    border-left: 1px solid ${SLATE_300};
    padding: 7px 12px;
    display: grid;
    grid-template-columns: 110px 1fr;
    align-items: center;
    gap: 10px;
    page-break-inside: avoid;
  }
  .meta-grid .cell:nth-child(2n)   { border-left: 0; }
  .meta-grid .cell:nth-last-child(-n+2) { border-bottom: 0; }
  .meta-grid .lbl { font-size: 9pt; color: ${SLATE_500}; font-weight: 700; }
  .meta-grid .val { font-size: 11pt; color: ${SLATE_900}; font-weight: 700; }

  /* ============ Section headers ============ */
  .section { margin: 14px 0; }
  .section > h2 {
    font-size: 14pt; font-weight: 800; color: #fff;
    background: ${PRIMARY};
    margin: 0 0 0;
    padding: 7px 14px;
    display: flex; align-items: center; justify-content: space-between;
    border-radius: 2px 2px 0 0;
  }
  .section > h2 .count {
    background: rgba(255,255,255,0.18);
    padding: 2px 10px; border-radius: 999px;
    font-size: 9.5pt; font-weight: 700;
    border: 1px solid rgba(255,255,255,0.35);
  }

  /* ============ Tables ============ */
  table.formal {
    width: 100%; border-collapse: collapse; margin: 0;
    border: 1px solid ${SLATE_300};
    border-top: 0;
    background: #fff;
  }
  table.formal td { padding: 9px 12px; vertical-align: top; font-size: 12pt; line-height: 1.6; }
  table.formal tr { page-break-inside: avoid; }
  table.formal tr + tr td { border-top: 1px solid ${SLATE_300}; }
  table.formal tr:nth-child(even) td { background: ${SLATE_50}; }
  table.formal .row-num {
    width: 42px; text-align: center;
    background: ${SLATE_50};
    color: ${PRIMARY_DARK};
    font-weight: 800;
    border-left: 1px solid ${SLATE_300};
    font-feature-settings: "tnum";
  }
  table.formal .row-text { color: ${SLATE_900}; }
  table.formal .row-empty { color: ${SLATE_500}; text-align: center; font-size: 11pt; padding: 14px; }

  /* ============ Attendees ============ */
  .att-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border: 1px solid ${SLATE_300};
    border-top: 0;
    background: #fff;
  }
  .att-cell {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 10px;
    background: ${SLATE_50};
    border-bottom: 1px solid ${SLATE_300};
    border-left: 1px solid ${SLATE_300};
    font-size: 11pt;
    page-break-inside: avoid;
  }
  .att-cell:nth-child(3n) { border-left: 0; }
  .att-num {
    min-width: 22px; height: 22px;
    display: inline-flex; align-items: center; justify-content: center;
    background: ${PRIMARY}; color: #fff; font-weight: 800; font-size: 9.5pt;
    border-radius: 4px;
  }
  .att-name { color: ${SLATE_900}; font-weight: 600; }

  /* ============ Notes ============ */
  .notes-box {
    border: 1px solid ${SLATE_300}; border-top: 0;
    background: ${SLATE_50};
    padding: 12px 14px;
    color: ${SLATE_700};
    font-size: 11.5pt;
    line-height: 1.7;
  }

  .empty { color: ${SLATE_500}; font-size: 11pt; padding: 12px; text-align: center;
    border: 1px solid ${SLATE_300}; border-top: 0; background: ${SLATE_50}; }

  /* ============ Approval / signatures ============ */
  .approval-section { margin-top: 26px; page-break-inside: avoid; }
  .approval-title {
    text-align: center;
    font-size: 13pt; font-weight: 800; color: ${PRIMARY_DARK};
    border-top: 1.5px solid ${PRIMARY};
    border-bottom: 1.5px solid ${PRIMARY};
    padding: 6px 0;
    margin-bottom: 16px;
    letter-spacing: 1px;
  }
  .signatures {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;
  }
  .sig-block {
    border: 1px solid ${SLATE_300};
    background: #fff;
    padding: 12px 14px 14px;
    page-break-inside: avoid;
  }
  .sig-role {
    text-align: center;
    font-size: 11pt; font-weight: 800; color: ${PRIMARY_DARK};
    padding-bottom: 8px; margin-bottom: 12px;
    border-bottom: 1px solid ${SLATE_300};
    letter-spacing: .5px;
  }
  .sig-field { display: flex; align-items: baseline; gap: 8px; margin-top: 14px; font-size: 10pt; }
  .sig-field .lbl { color: ${SLATE_500}; font-weight: 700; min-width: 56px; }
  .sig-field .line {
    flex: 1; border-bottom: 1px dotted ${SLATE_500}; height: 18px;
  }
  .sig-field .preset { color: ${SLATE_900}; font-weight: 700; flex: 1; border-bottom: 1px dotted ${SLATE_300}; padding: 0 4px 2px; }

  /* ============ Footer ============ */
  .doc-footer {
    margin-top: 22px;
    padding-top: 8px;
    border-top: 1px solid ${SLATE_300};
    display: flex; justify-content: space-between;
    font-size: 9pt; color: ${SLATE_500};
  }
  .doc-footer strong { color: ${PRIMARY_DARK}; font-weight: 800; }

  /* ============ Print rules ============ */
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .official-header, .approval-section, .sig-block,
    .meta-grid .cell, table.formal tr, .att-cell { page-break-inside: avoid; }
    .section > h2 { break-after: avoid-page; }
    .approval-title { break-after: avoid-page; }
  }
</style>

<div class="doc">
  <div class="watermark"><span>${escapeHtml(brand.name || "محضر رسمي")}</span></div>

  <!-- ===== Symmetrical formal header ===== -->
  <div class="official-header">
    <div class="hdr-right">
      <img src="${logo}" alt="logo" />
      <div>
        <div class="org">${escapeHtml(brand.name || "")}</div>
        <div class="cmt">${escapeHtml(committeeName)}</div>
      </div>
    </div>
    <div class="hdr-center">
      <div class="kicker">OFFICIAL MINUTES</div>
      <h1>محضر اجتماع رسمي</h1>
      <div class="underline"></div>
    </div>
    <div class="hdr-left">
      <div class="row"><span class="lbl">التاريخ:</span><span class="val">${dateStr}</span></div>
      <div class="row"><span class="lbl">المرجع:</span><span class="val">${escapeHtml(refNumber)}</span></div>
      <div class="row"><span class="lbl">نوع الاجتماع:</span><span class="val">اجتماع لجنة</span></div>
    </div>
  </div>

  <!-- ===== Subject ===== -->
  <div class="subject">
    <div class="lbl">موضوع الاجتماع</div>
    <div class="val">${escapeHtml(m.title || "—")}</div>
  </div>

  <!-- ===== Metadata grid ===== -->
  <div class="meta-grid">
    <div class="cell"><span class="lbl">المكان</span><span class="val">${escapeHtml(m.location || "—")}</span></div>
    <div class="cell"><span class="lbl">التوقيت</span><span class="val">${timeStr}</span></div>
    <div class="cell"><span class="lbl">كاتب المحضر</span><span class="val">${escapeHtml(m.recorder_name || "—")}</span></div>
    <div class="cell"><span class="lbl">عدد الحضور</span><span class="val">${m.attendees.length}</span></div>
  </div>

  <!-- ===== Attendees ===== -->
  <div class="section">
    <h2>قائمة الحضور <span class="count">${m.attendees.length}</span></h2>
    ${attendeesBlock}
  </div>

  <!-- ===== Agenda ===== -->
  <div class="section">
    <h2>بنود جدول الأعمال <span class="count">${m.agenda_items.length}</span></h2>
    <table class="formal">
      <colgroup><col style="width:42px"/><col/></colgroup>
      <tbody>${tableRows(m.agenda_items)}</tbody>
    </table>
  </div>

  <!-- ===== Decisions ===== -->
  <div class="section">
    <h2>التوصيات والقرارات <span class="count">${m.recommendations.length}</span></h2>
    <table class="formal">
      <colgroup><col style="width:42px"/><col/></colgroup>
      <tbody>${tableRows(m.recommendations)}</tbody>
    </table>
  </div>

  ${m.notes ? `
  <div class="section">
    <h2>ملاحظات إضافية</h2>
    <div class="notes-box">${escapeHtml(m.notes).replace(/\n/g, "<br/>")}</div>
  </div>` : ""}

  <!-- ===== Approval block ===== -->
  <div class="approval-section">
    <div class="approval-title">قسم الاعتمادات والتوقيعات</div>
    <div class="signatures">
      <div class="sig-block">
        <div class="sig-role">كاتب المحضر</div>
        <div class="sig-field"><span class="lbl">الاسم</span><span class="preset">${escapeHtml(m.recorder_name || "")}</span></div>
        <div class="sig-field"><span class="lbl">التوقيع</span><span class="line"></span></div>
        <div class="sig-field"><span class="lbl">التاريخ</span><span class="line"></span></div>
      </div>
      <div class="sig-block">
        <div class="sig-role">رئيس اللجنة</div>
        <div class="sig-field"><span class="lbl">الاسم</span><span class="line"></span></div>
        <div class="sig-field"><span class="lbl">التوقيع</span><span class="line"></span></div>
        <div class="sig-field"><span class="lbl">التاريخ</span><span class="line"></span></div>
      </div>
      <div class="sig-block">
        <div class="sig-role">اعتماد الإدارة</div>
        <div class="sig-field"><span class="lbl">الاسم</span><span class="line"></span></div>
        <div class="sig-field"><span class="lbl">التوقيع</span><span class="line"></span></div>
        <div class="sig-field"><span class="lbl">التاريخ</span><span class="line"></span></div>
      </div>
    </div>
  </div>

  <!-- ===== Footer ===== -->
  <div class="doc-footer">
    <span><strong>${escapeHtml(brand.name || "")}</strong> ${brand.subtitle ? "— " + escapeHtml(brand.subtitle) : ""}</span>
    <span>صدر بتاريخ ${issueDate}</span>
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
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) { reset(); setTab("list"); }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="group inline-flex h-9 items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 hover:bg-gold/20 px-3 text-xs font-bold text-gold-foreground shadow-sm transition"
          aria-label="محاضر الاجتماعات"
          title="فتح محاضر الاجتماعات"
        >
          <ClipboardList className="h-3.5 w-3.5" />
          المحاضر
          {items.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-gold text-[10px] font-bold text-gold-foreground px-1">
              {items.length}
            </span>
          )}
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