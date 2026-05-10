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
    // محضر اجتماع رسمي — تنسيق احترافي مستوحى من النموذج المرفوع
    // ولكن بمستوى تنفيذ أعلى: تحكّم دقيق بالبوردر، تباين راقٍ،
    // طباعة A4 ممتازة، وكسر صفحات احترافي.
    // ============================================================
    const SAGE        = "#C9DBB7";   // header pill (مثل النموذج المرفوع)
    const SAGE_DEEP   = "#7FA060";   // border accent / hairline
    const TEAL_INK    = "#0D5C4A";   // text on sage / accent strong
    const INK_900     = "#0F172A";   // primary body text
    const INK_600     = "#475569";   // secondary
    const INK_400     = "#94A3B8";   // muted lines
    const HAIRLINE    = "#94A3B8";   // table outer border
    const ROW_ALT     = "#FAFBF8";   // subtle row stripe

    const dateLong = m.meeting_date
      ? new Date(m.meeting_date).toLocaleDateString("ar-SA-u-ca-gregory", { year: "numeric", month: "long", day: "numeric" })
      : "";
    const hijri = m.meeting_date
      ? new Date(m.meeting_date).toLocaleDateString("ar-SA-u-ca-islamic-umalqura", { year: "numeric", month: "long", day: "numeric" })
      : "";
    const weekday = m.meeting_date
      ? new Date(m.meeting_date).toLocaleDateString("ar-SA-u-ca-gregory", { weekday: "long" })
      : "";
    const timeStr = [m.start_time, m.end_time].filter(Boolean).join(" – ");
    const issueDate = new Date().toLocaleDateString("ar-SA-u-ca-gregory");
    const logo = brandLogoSrc(brand);

    // Reference number
    const yearPart = (m.meeting_date ?? new Date().toISOString().slice(0, 10)).slice(0, 10).replace(/-/g, "");
    const cmtInitials = (committeeName || "LJN").split(/\s+/).map((w) => w.charAt(0)).join("").slice(0, 3).toUpperCase() || "LJN";
    const refNumber = m.ref_number || `MOM-${cmtInitials}-${yearPart}`;

    const dash = "—";
    const cellOrDash = (v: string | null | undefined) => (v && v.trim()) ? escapeHtml(v) : `<span class="dash">${dash}</span>`;
    const arDigits = (n: number): string => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);

    // Numbered rows for agenda / decisions
    const numberedRows = (arr: string[], minRows = 3) => {
      const rows = arr.length === 0 ? [] : arr;
      const padded = rows.length < minRows ? [...rows, ...Array(minRows - rows.length).fill("")] : rows;
      return padded.map((x, i) => `
        <tr>
          <td class="n">${arDigits(i + 1)}</td>
          <td class="t">${x ? escapeHtml(x) : ""}</td>
        </tr>`).join("");
    };

    // Attendees rows (الحضور: م | الاسم | الصفة | نعم | لا | التوقيع)
    const attendeeMin = 5;
    const attRows = (() => {
      const list = m.attendees.length ? m.attendees : [];
      const padded = list.length < attendeeMin ? [...list, ...Array(attendeeMin - list.length).fill("")] : list;
      return padded.map((name, i) => `
        <tr>
          <td class="n">${arDigits(i + 1)}</td>
          <td class="att-name">${name ? escapeHtml(name) : ""}</td>
          <td></td>
          <td class="ck">${name ? "✓" : ""}</td>
          <td class="ck"></td>
          <td></td>
        </tr>`).join("");
    })();

    return `
<style>
  @page { size: A4; margin: 14mm 14mm 16mm 14mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Tajawal', 'Cairo', 'Segoe UI', Tahoma, sans-serif;
    color: ${INK_900};
    direction: rtl;
    font-size: 11.5pt;
    line-height: 1.55;
    background: #fff;
    -webkit-font-smoothing: antialiased;
  }
  .doc { position: relative; max-width: 820px; margin: 0 auto; }

  /* ===== Watermark — ultra subtle ===== */
  .wm {
    position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
    z-index: 0; pointer-events: none; opacity: .045;
  }
  .wm span {
    font-size: 96pt; font-weight: 900; color: ${TEAL_INK};
    letter-spacing: 6px; transform: rotate(-26deg); white-space: nowrap;
  }
  .doc > * { position: relative; z-index: 1; }

  /* ===== Top brand strip ===== */
  .top-strip {
    display: grid; grid-template-columns: auto 1fr auto; align-items: center;
    gap: 14px; padding-bottom: 10px; margin-bottom: 12px;
    border-bottom: 1.2px solid ${SAGE_DEEP};
  }
  .top-strip .brand { display: flex; align-items: center; gap: 12px; }
  .top-strip .brand img { width: 54px; height: 54px; object-fit: contain; }
  .top-strip .brand .org { font-size: 8.5pt; color: ${INK_600}; font-weight: 700; letter-spacing: .4px; }
  .top-strip .brand .cmt { font-size: 11.5pt; color: ${INK_900}; font-weight: 800; margin-top: 2px; }
  .top-strip .ref { text-align: end; font-size: 8.5pt; color: ${INK_600}; line-height: 1.7; }
  .top-strip .ref b { color: ${TEAL_INK}; font-weight: 800; }
  .top-strip .center { text-align: center; }
  .top-strip .center .kicker {
    font-size: 7.5pt; letter-spacing: 5px; color: ${SAGE_DEEP};
    font-weight: 800;
  }
  .top-strip .center h1 {
    margin: 2px 0 0; font-size: 17pt; color: ${TEAL_INK}; font-weight: 900;
    letter-spacing: .8px;
  }

  /* ===== Centered title for the body of doc ===== */
  .title-bar {
    text-align: center;
    font-size: 13.5pt; font-weight: 800; color: ${INK_900};
    margin: 6px 0 14px;
    letter-spacing: .3px;
  }

  /* ===== Master metadata table (mimics the reference 6-col layout) ===== */
  table.meta {
    width: 100%; border-collapse: collapse;
    border: 1px solid ${HAIRLINE};
    margin: 0 0 14px;
    table-layout: fixed;
  }
  table.meta td {
    padding: 9px 12px;
    border: 1px solid ${HAIRLINE};
    font-size: 11pt;
    vertical-align: middle;
    page-break-inside: avoid;
  }
  table.meta td.lbl {
    background: ${SAGE};
    color: ${TEAL_INK};
    font-weight: 800;
    width: 14%;
    text-align: center;
    letter-spacing: .2px;
  }
  table.meta td.val {
    background: #fff;
    color: ${INK_900};
    font-weight: 600;
    width: 19.33%;
  }
  .dash { color: ${INK_400}; font-weight: 500; }

  /* ===== Section blocks ===== */
  .block {
    border: 1px solid ${HAIRLINE};
    margin: 0 0 12px;
    page-break-inside: auto;
  }
  .block > .head {
    background: ${SAGE};
    color: ${TEAL_INK};
    font-weight: 800;
    text-align: center;
    padding: 8px 12px;
    font-size: 12pt;
    letter-spacing: .3px;
    border-bottom: 1px solid ${HAIRLINE};
  }
  .block.subject .body {
    padding: 12px 16px; min-height: 36px;
    font-size: 12pt; color: ${INK_900}; font-weight: 700;
  }

  /* ===== Bullet list (محاور) ===== */
  .axes-list {
    list-style: none; padding: 10px 18px 12px; margin: 0;
  }
  .axes-list li {
    position: relative; padding: 5px 18px 5px 0;
    font-size: 11.5pt; color: ${INK_900}; line-height: 1.7;
    page-break-inside: avoid;
  }
  .axes-list li::before {
    content: ""; position: absolute; right: 2px; top: 14px;
    width: 6px; height: 6px; border-radius: 50%;
    background: ${TEAL_INK};
  }
  .axes-list li + li { border-top: 1px dashed ${INK_400}; }
  .axes-empty { padding: 14px; color: ${INK_400}; text-align: center; font-size: 11pt; }

  /* ===== Numbered tables (decisions) ===== */
  table.numbered {
    width: 100%; border-collapse: collapse; table-layout: fixed;
  }
  table.numbered td {
    padding: 9px 12px; border-top: 1px solid ${HAIRLINE};
    vertical-align: top; font-size: 11.5pt;
    page-break-inside: avoid;
  }
  table.numbered tr:first-child td { border-top: 0; }
  table.numbered tr:nth-child(even) td { background: ${ROW_ALT}; }
  table.numbered td.n {
    width: 44px; text-align: center;
    background: ${SAGE}; color: ${TEAL_INK};
    font-weight: 800; border-left: 1px solid ${HAIRLINE};
    font-feature-settings: "tnum";
  }
  table.numbered td.t { color: ${INK_900}; line-height: 1.7; }

  /* ===== Attendance table ===== */
  table.att {
    width: 100%; border-collapse: collapse; table-layout: fixed;
  }
  table.att th, table.att td {
    border: 1px solid ${HAIRLINE};
    padding: 8px 10px;
    font-size: 11pt;
    text-align: center;
    page-break-inside: avoid;
  }
  table.att thead th {
    background: ${SAGE}; color: ${TEAL_INK}; font-weight: 800;
    border-color: ${HAIRLINE};
    letter-spacing: .2px;
  }
  table.att thead .grouped { padding: 4px; }
  table.att td.n {
    background: ${SAGE}; color: ${TEAL_INK}; font-weight: 800;
    width: 38px;
  }
  table.att td.att-name { text-align: start; color: ${INK_900}; font-weight: 600; }
  table.att td.ck { font-size: 13pt; color: ${TEAL_INK}; font-weight: 800; }
  table.att tr:nth-child(even) td:not(.n) { background: ${ROW_ALT}; }
  .col-num   { width: 38px; }
  .col-role  { width: 22%; }
  .col-att   { width: 7.5%; }
  .col-sign  { width: 22%; }

  /* ===== Notes ===== */
  .notes-block .body {
    padding: 12px 14px; color: ${INK_900};
    font-size: 11pt; line-height: 1.8; white-space: pre-wrap;
  }

  /* ===== Approval / signatures ===== */
  .signatures {
    margin-top: 18px;
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
    page-break-inside: avoid;
  }
  .sig {
    border: 1px solid ${HAIRLINE}; background: #fff;
    padding: 0; page-break-inside: avoid;
  }
  .sig .role {
    background: ${SAGE}; color: ${TEAL_INK};
    text-align: center; font-weight: 800; font-size: 10.5pt;
    padding: 7px 10px; border-bottom: 1px solid ${HAIRLINE};
    letter-spacing: .4px;
  }
  .sig .body { padding: 12px 14px 14px; }
  .sig .field { display: flex; align-items: baseline; gap: 8px; margin: 10px 0 0; font-size: 9.5pt; color: ${INK_600}; }
  .sig .field .l { font-weight: 700; min-width: 52px; }
  .sig .field .line { flex: 1; border-bottom: 1px dotted ${INK_400}; height: 14px; }
  .sig .field .preset { flex: 1; border-bottom: 1px dotted ${INK_400}; padding: 0 4px 2px; color: ${INK_900}; font-weight: 700; }

  /* ===== Footer ===== */
  .foot {
    margin-top: 16px; padding-top: 8px;
    border-top: 1px solid ${HAIRLINE};
    display: flex; justify-content: space-between; align-items: center;
    font-size: 8.5pt; color: ${INK_600};
  }
  .foot b { color: ${TEAL_INK}; font-weight: 800; }

  /* ===== Print ===== */
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .signatures, .sig, .block > .head, table.meta tr,
    table.numbered tr, table.att tr { page-break-inside: avoid; }
    .block > .head { break-after: avoid-page; }
  }
</style>

<div class="doc">
  <div class="wm"><span>${escapeHtml(brand.name || committeeName || "محضر رسمي")}</span></div>

  <!-- ===== Top strip (logo · title · ref) ===== -->
  <div class="top-strip">
    <div class="brand">
      <img src="${logo}" alt="logo" />
      <div>
        <div class="org">${escapeHtml(brand.name || "")}</div>
        <div class="cmt">${escapeHtml(committeeName)}</div>
      </div>
    </div>
    <div class="center">
      <div class="kicker">OFFICIAL MINUTES</div>
      <h1>محضر اجتماع</h1>
    </div>
    <div class="ref">
      <div><b>المرجع:</b> ${escapeHtml(refNumber)}</div>
      <div><b>صدر في:</b> ${escapeHtml(issueDate)}</div>
      <div><b>النوع:</b> اجتماع لجنة</div>
    </div>
  </div>

  <!-- ===== Body title ===== -->
  <div class="title-bar">${escapeHtml(m.title || "محضر اجتماع")}</div>

  <!-- ===== Meta grid (6-column, mirrors the reference) ===== -->
  <table class="meta">
    <tr>
      <td class="lbl">رقم الاجتماع</td>
      <td class="val">${cellOrDash(refNumber)}</td>
      <td class="lbl">مكان الاجتماع</td>
      <td class="val">${cellOrDash(m.location)}</td>
      <td class="lbl">الساعة</td>
      <td class="val">${cellOrDash(timeStr)}</td>
    </tr>
    <tr>
      <td class="lbl">اليوم</td>
      <td class="val">${cellOrDash(weekday)}</td>
      <td class="lbl">التاريخ</td>
      <td class="val">${cellOrDash(dateLong)}</td>
      <td class="lbl">الموافق</td>
      <td class="val">${cellOrDash(hijri)}</td>
    </tr>
  </table>

  <!-- ===== Subject ===== -->
  ${m.title ? `
  <div class="block subject">
    <div class="head">موضوع الاجتماع</div>
    <div class="body">${escapeHtml(m.title)}</div>
  </div>` : ""}

  <!-- ===== Agenda (محاور الاجتماع) ===== -->
  <div class="block">
    <div class="head">محاور الاجتماع</div>
    ${m.agenda_items.length === 0
      ? `<div class="axes-empty">— لا توجد محاور مسجَّلة —</div>`
      : `<ul class="axes-list">${m.agenda_items.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`}
  </div>

  <!-- ===== Decisions ===== -->
  <div class="block">
    <div class="head">التوصيات والقرارات</div>
    <table class="numbered">
      <colgroup><col style="width:44px"/><col/></colgroup>
      <tbody>${numberedRows(m.recommendations, 3)}</tbody>
    </table>
  </div>

  <!-- ===== Attendance ===== -->
  <div class="block">
    <div class="head">الحضور</div>
    <table class="att">
      <colgroup>
        <col class="col-num"/>
        <col/>
        <col class="col-role"/>
        <col class="col-att"/>
        <col class="col-att"/>
        <col class="col-sign"/>
      </colgroup>
      <thead>
        <tr>
          <th rowspan="2">م</th>
          <th rowspan="2">الاسم</th>
          <th rowspan="2">الصفة</th>
          <th colspan="2" class="grouped">الحضور</th>
          <th rowspan="2">التوقيع</th>
        </tr>
        <tr>
          <th>نعم</th>
          <th>لا</th>
        </tr>
      </thead>
      <tbody>${attRows}</tbody>
    </table>
  </div>

  ${m.notes ? `
  <div class="block notes-block">
    <div class="head">ملاحظات إضافية</div>
    <div class="body">${escapeHtml(m.notes)}</div>
  </div>` : ""}

  <!-- ===== Signatures ===== -->
  <div class="signatures">
    <div class="sig">
      <div class="role">كاتب المحضر</div>
      <div class="body">
        <div class="field"><span class="l">الاسم</span><span class="preset">${escapeHtml(m.recorder_name || "")}</span></div>
        <div class="field"><span class="l">التوقيع</span><span class="line"></span></div>
        <div class="field"><span class="l">التاريخ</span><span class="line"></span></div>
      </div>
    </div>
    <div class="sig">
      <div class="role">رئيس اللجنة</div>
      <div class="body">
        <div class="field"><span class="l">الاسم</span><span class="line"></span></div>
        <div class="field"><span class="l">التوقيع</span><span class="line"></span></div>
        <div class="field"><span class="l">التاريخ</span><span class="line"></span></div>
      </div>
    </div>
    <div class="sig">
      <div class="role">اعتماد الإدارة</div>
      <div class="body">
        <div class="field"><span class="l">الاسم</span><span class="line"></span></div>
        <div class="field"><span class="l">التوقيع</span><span class="line"></span></div>
        <div class="field"><span class="l">التاريخ</span><span class="line"></span></div>
      </div>
    </div>
  </div>

  <!-- ===== Footer ===== -->
  <div class="foot">
    <span><b>${escapeHtml(brand.name || "")}</b>${brand.subtitle ? " — " + escapeHtml(brand.subtitle) : ""}</span>
    <span>وثيقة رسمية · ${escapeHtml(refNumber)}</span>
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