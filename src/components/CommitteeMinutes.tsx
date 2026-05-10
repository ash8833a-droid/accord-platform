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
    // ADVANCED BRANDED PDF — محضر اجتماع رسمي
    // الهوية البصرية الكاملة + باترن مائي خفيف + شبكة احترافية
    // ألوان: Dark Emerald Teal #0D7C66 — ذهبي #B89150 — رمادي #475569
    // طباعة A4 بهوامش 20mm وعدم كسر صفوف الجداول
    // ============================================================
    const TEAL        = "#0D7C66";   // primary — Dark Emerald Teal
    const TEAL_DEEP   = "#0a604f";   // hover/border deep
    const TEAL_SOFT   = "#E8F3F0";   // section header tint
    const GOLD        = "#B89150";   // secondary accent
    const GOLD_SOFT   = "#FBF4E2";   // gold tint
    const INK_900     = "#0F172A";   // body
    const INK_700     = "#334155";
    const INK_500     = "#64748B";
    const INK_300     = "#CBD5E1";
    const HAIRLINE    = "#CBD5E1";
    const ROW_ALT     = "#F8FAF9";

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

    // Reference number + meeting number (derived from ref tail digits)
    const yearPart = (m.meeting_date ?? new Date().toISOString().slice(0, 10)).slice(0, 10).replace(/-/g, "");
    const cmtInitials = (committeeName || "LJN").split(/\s+/).map((w) => w.charAt(0)).join("").slice(0, 3).toUpperCase() || "LJN";
    const refNumber = m.ref_number || `MOM-${cmtInitials}-${yearPart}`;
    const meetingNoNumeric = (() => {
      const tail = refNumber.match(/(\d{1,4})$/);
      const n = tail ? parseInt(tail[1], 10) % 1000 : (parseInt(yearPart.slice(-3), 10) || 1);
      return n || 1;
    })();

    const dash = "—";
    const cellOrDash = (v: string | null | undefined) => (v && v.trim()) ? escapeHtml(v) : `<span class="dash">${dash}</span>`;
    const arDigits = (n: number): string => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);

    // Decisions: parse "text | المكلف | الموعد" if author used the convention,
    // otherwise show the full text in the first column and leave the others blank.
    const parseDecision = (raw: string): { text: string; owner: string; due: string } => {
      const parts = raw.split(/\s*[|｜‖]\s*/).map((s) => s.trim()).filter(Boolean);
      return {
        text: parts[0] ?? raw.trim(),
        owner: parts[1] ?? "",
        due: parts[2] ?? "",
      };
    };
    const decisionRows = (() => {
      const list = m.recommendations.length ? m.recommendations : [];
      const padded = list.length < 3 ? [...list, ...Array(3 - list.length).fill("")] : list;
      return padded.map((raw, i) => {
        const d = raw ? parseDecision(raw) : { text: "", owner: "", due: "" };
        return `
        <tr>
          <td class="n">${arDigits(i + 1)}</td>
          <td class="dec-text">${d.text ? `<b>${escapeHtml(d.text)}</b>` : ""}</td>
          <td class="dec-owner">${d.owner ? escapeHtml(d.owner) : ""}</td>
          <td class="dec-due">${d.due ? escapeHtml(d.due) : ""}</td>
        </tr>`;
      }).join("");
    })();

    // Attendees grid (cards) with status indicator. Convention:
    //   "Name"            -> حاضر (default)
    //   "Name | غائب"     -> غائب
    //   "Name | معتذر"    -> معتذر
    const parseAttendee = (raw: string): { name: string; status: "present" | "absent" | "excused" } => {
      const [n, sRaw = ""] = raw.split(/\s*[|｜]\s*/);
      const s = sRaw.trim();
      if (/غائب/.test(s)) return { name: n.trim(), status: "absent" };
      if (/معتذر|اعتذر/.test(s)) return { name: n.trim(), status: "excused" };
      return { name: n.trim(), status: "present" };
    };
    const STATUS_LABEL = { present: "حاضر", absent: "غائب", excused: "معتذر" } as const;
    const attendeeCards = (() => {
      if (m.attendees.length === 0) {
        return `<div class="grid-empty">— لا توجد بيانات حضور مسجَّلة —</div>`;
      }
      return `<div class="att-grid">${m.attendees.map((raw, i) => {
        const a = parseAttendee(raw);
        return `
        <div class="att-card status-${a.status}">
          <span class="att-num">${arDigits(i + 1)}</span>
          <span class="att-name">${escapeHtml(a.name)}</span>
          <span class="att-pill">${STATUS_LABEL[a.status]}</span>
        </div>`;
      }).join("")}</div>`;
    })();

    // QR placeholder — encodes the verification URL (ref number)
    const qrPayload = encodeURIComponent(`MINUTES://${refNumber}`);
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=0&data=${qrPayload}`;

    // Subtle decorative pattern (Najiz-style dots) used as repeating watermark.
    const patternSvg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'>` +
        `<g fill='%230D7C66'>` +
          `<circle cx='10' cy='10' r='1.6'/><circle cx='40' cy='10' r='1.6'/><circle cx='70' cy='10' r='1.6'/><circle cx='100' cy='10' r='1.6'/>` +
          `<circle cx='25' cy='40' r='1.6'/><circle cx='55' cy='40' r='1.6'/><circle cx='85' cy='40' r='1.6'/><circle cx='115' cy='40' r='1.6'/>` +
          `<circle cx='10' cy='70' r='1.6'/><circle cx='40' cy='70' r='1.6'/><circle cx='70' cy='70' r='1.6'/><circle cx='100' cy='70' r='1.6'/>` +
          `<circle cx='25' cy='100' r='1.6'/><circle cx='55' cy='100' r='1.6'/><circle cx='85' cy='100' r='1.6'/><circle cx='115' cy='100' r='1.6'/>` +
          `<path d='M0 55 L120 55' stroke='%230D7C66' stroke-width='0.4' fill='none' opacity='0.4'/>` +
        `</g>` +
      `</svg>`;
    const patternUri = `url("data:image/svg+xml;utf8,${patternSvg}")`;

    return `
<style>
  @page { size: A4; margin: 20mm 20mm 20mm 20mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Amiri', 'Tajawal', 'Cairo', 'Segoe UI', Tahoma, sans-serif;
    color: ${INK_900};
    direction: rtl;
    font-size: 11pt;
    line-height: 1.6;
    background: #fff;
    -webkit-font-smoothing: antialiased;
  }
  .doc { position: relative; max-width: 820px; margin: 0 auto; }

  /* ===== Approved Pattern watermark — ultra subtle ===== */
  .pattern {
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background-image: ${patternUri};
    background-repeat: repeat;
    opacity: 0.03;
  }
  .doc > * { position: relative; z-index: 1; }

  /* ===== Triple-section official header ===== */
  .official-header {
    display: grid; grid-template-columns: 1fr 1.1fr 1fr;
    gap: 16px; align-items: stretch;
    padding: 14px 0 14px;
    border-top: 3px solid ${TEAL};
    border-bottom: 1.5px solid ${TEAL};
    background: linear-gradient(180deg, ${TEAL_SOFT}55 0%, #fff 100%);
    page-break-inside: avoid;
  }
  .oh-right { display: flex; align-items: center; gap: 12px; padding: 0 14px; }
  .oh-right img { width: 60px; height: 60px; object-fit: contain; flex-shrink: 0; }
  .oh-right .org-name { font-size: 12pt; color: ${TEAL}; font-weight: 800; line-height: 1.35; }
  .oh-right .org-sub { font-size: 9pt; color: ${INK_500}; margin-top: 3px; font-weight: 600; }
  .oh-center { text-align: center; padding: 4px 8px; border-inline: 1px dashed ${INK_300}; }
  .oh-center .kicker {
    font-size: 7.5pt; letter-spacing: 4px; color: ${GOLD};
    font-weight: 800; text-transform: uppercase;
  }
  .oh-center h1 {
    margin: 4px 0 6px; font-size: 19pt; color: ${TEAL_DEEP}; font-weight: 900;
    letter-spacing: .5px;
  }
  .oh-center .meet-no {
    display: inline-block; padding: 3px 14px; border-radius: 999px;
    background: ${TEAL}; color: #fff;
    font-weight: 800; font-size: 10.5pt; letter-spacing: .3px;
  }
  .oh-left { padding: 0 14px; font-size: 9.5pt; color: ${INK_700}; line-height: 1.85; }
  .oh-left .row { display: flex; gap: 8px; align-items: baseline; }
  .oh-left .row b { color: ${TEAL}; font-weight: 800; min-width: 56px; }
  .oh-left .row span { color: ${INK_900}; font-weight: 600; }

  .ref-strip {
    display: flex; justify-content: space-between; align-items: center;
    margin: 10px 0 16px; padding: 6px 12px;
    background: ${GOLD_SOFT}; border-right: 3px solid ${GOLD};
    font-size: 9pt; color: ${INK_700};
  }
  .ref-strip b { color: ${TEAL_DEEP}; font-weight: 800; }

  /* ===== Subject block ===== */
  .subject-block {
    border: 1px solid ${INK_300}; border-right: 4px solid ${TEAL};
    background: #fff; padding: 10px 14px; margin-bottom: 14px;
    page-break-inside: avoid;
  }
  .subject-block .lbl { font-size: 8.5pt; color: ${TEAL}; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
  .subject-block .val { font-size: 13pt; color: ${INK_900}; font-weight: 800; margin-top: 3px; }

  .dash { color: ${INK_300}; font-weight: 500; }

  /* ===== Section heading ===== */
  .sec {
    margin: 14px 0 10px;
    page-break-after: avoid;
    page-break-inside: avoid;
    display: flex; align-items: center; gap: 10px;
  }
  .sec .icon {
    width: 28px; height: 28px; border-radius: 6px;
    background: ${TEAL}; color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-weight: 900; font-size: 12pt;
  }
  .sec h2 {
    margin: 0; font-size: 13pt; color: ${TEAL_DEEP}; font-weight: 800;
    flex: 1;
    border-bottom: 1.5px solid ${TEAL};
    padding-bottom: 4px;
  }

  /* ===== Agenda — numbered list with teal side border ===== */
  .agenda { list-style: none; padding: 0; margin: 0; }
  .agenda li {
    background: #fff;
    border: 1px solid ${INK_300};
    border-right: 4px solid ${TEAL};
    padding: 9px 14px 9px 14px;
    margin-bottom: 6px;
    font-size: 11.5pt; color: ${INK_900}; line-height: 1.7;
    display: flex; align-items: baseline; gap: 12px;
    page-break-inside: avoid;
  }
  .agenda li .num {
    color: ${TEAL}; font-weight: 900; font-size: 13pt; min-width: 26px;
    font-feature-settings: "tnum";
  }
  .agenda-empty {
    padding: 16px; color: ${INK_500}; text-align: center; font-size: 11pt;
    border: 1px dashed ${INK_300}; border-radius: 4px;
  }

  /* ===== Decisions — high-contrast table ===== */
  table.decisions {
    width: 100%; border-collapse: collapse; table-layout: fixed;
    border: 1px solid ${TEAL};
  }
  table.decisions thead th {
    background: ${TEAL}; color: #fff;
    padding: 9px 10px; font-size: 10.5pt; font-weight: 800;
    border: 1px solid ${TEAL}; text-align: center; letter-spacing: .3px;
  }
  table.decisions tbody td {
    padding: 10px 12px; border: 1px solid ${INK_300};
    font-size: 11pt; vertical-align: top;
    page-break-inside: avoid;
  }
  table.decisions tbody tr { page-break-inside: avoid; }
  table.decisions tbody tr:nth-child(even) td { background: ${ROW_ALT}; }
  table.decisions td.n {
    width: 38px; text-align: center;
    background: ${TEAL_SOFT}; color: ${TEAL_DEEP}; font-weight: 800;
    font-feature-settings: "tnum";
  }
  table.decisions td.dec-text { color: ${INK_900}; line-height: 1.65; }
  table.decisions td.dec-text b { color: ${INK_900}; font-weight: 800; }
  table.decisions td.dec-owner { width: 22%; color: ${INK_700}; font-weight: 700; text-align: center; }
  table.decisions td.dec-due { width: 18%; color: ${GOLD}; font-weight: 800; text-align: center; }

  /* ===== Attendees professional grid with status indicators ===== */
  .att-grid {
    display: grid; grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }
  .att-card {
    display: grid; grid-template-columns: 28px 1fr auto;
    align-items: center; gap: 10px;
    background: #fff; border: 1px solid ${INK_300};
    border-right: 4px solid ${INK_300};
    padding: 7px 10px; font-size: 11pt;
    page-break-inside: avoid;
  }
  .att-card.status-present { border-right-color: ${TEAL}; }
  .att-card.status-absent  { border-right-color: #B91C1C; }
  .att-card.status-excused { border-right-color: ${GOLD}; }
  .att-card .att-num {
    width: 26px; height: 26px; border-radius: 50%;
    background: ${TEAL_SOFT}; color: ${TEAL_DEEP};
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 10pt;
  }
  .att-card .att-name { color: ${INK_900}; font-weight: 700; }
  .att-card .att-pill {
    font-size: 8.5pt; font-weight: 800; padding: 3px 10px;
    border-radius: 999px; letter-spacing: .3px;
  }
  .att-card.status-present .att-pill { background: ${TEAL_SOFT}; color: ${TEAL_DEEP}; }
  .att-card.status-absent .att-pill  { background: #FEE2E2; color: #991B1B; }
  .att-card.status-excused .att-pill { background: ${GOLD_SOFT}; color: ${GOLD}; }
  .grid-empty {
    padding: 16px; color: ${INK_500}; text-align: center; font-size: 11pt;
    border: 1px dashed ${INK_300}; border-radius: 4px;
  }

  /* ===== Notes ===== */
  .notes-body {
    padding: 12px 14px; color: ${INK_900};
    font-size: 11pt; line-height: 1.85; white-space: pre-wrap;
    background: #fff; border: 1px solid ${INK_300}; border-right: 4px solid ${GOLD};
    page-break-inside: avoid;
  }

  /* ===== Approval / signatures + QR ===== */
  .approval {
    margin-top: 22px;
    display: grid; grid-template-columns: repeat(3, 1fr) 130px;
    gap: 12px;
    page-break-inside: avoid;
  }
  .sig {
    border: 1px solid ${INK_300}; background: #fff;
    page-break-inside: avoid;
  }
  .sig .role {
    background: ${TEAL}; color: #fff;
    text-align: center; font-weight: 800; font-size: 10pt;
    padding: 8px 10px; letter-spacing: .4px;
  }
  .sig .body { padding: 14px 14px 16px; }
  .sig .field { display: flex; align-items: baseline; gap: 8px; margin: 10px 0 0; font-size: 9pt; color: ${INK_500}; }
  .sig .field .l { font-weight: 700; min-width: 50px; color: ${INK_700}; }
  .sig .field .line { flex: 1; border-bottom: 1px dotted ${INK_300}; height: 14px; }
  .sig .field .preset { flex: 1; border-bottom: 1px dotted ${INK_300}; padding: 0 4px 2px; color: ${INK_900}; font-weight: 700; }

  .qr-block {
    border: 1px solid ${INK_300}; background: #fff;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 8px; gap: 6px;
    page-break-inside: avoid;
  }
  .qr-block img { width: 100px; height: 100px; display: block; }
  .qr-block .qr-cap { font-size: 7.5pt; color: ${INK_500}; text-align: center; line-height: 1.3; }
  .qr-block .qr-cap b { color: ${TEAL_DEEP}; display: block; font-size: 8pt; font-weight: 800; }

  /* ===== Footer ===== */
  .foot {
    margin-top: 18px; padding-top: 8px;
    border-top: 1px solid ${INK_300};
    display: flex; justify-content: space-between; align-items: center;
    font-size: 8.5pt; color: ${INK_500};
  }
  .foot b { color: ${TEAL_DEEP}; font-weight: 800; }

  /* ===== Print ===== */
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .official-header, .approval, .sig, .qr-block,
    .agenda li, .att-card, table.decisions tr,
    .subject-block, .notes-body { page-break-inside: avoid; }
    .sec { break-after: avoid-page; }
  }
</style>

<div class="doc">
  <div class="pattern" aria-hidden="true"></div>

  <!-- ===== Triple-section institutional header ===== -->
  <header class="official-header">
    <div class="oh-right">
      <img src="${logo}" alt="logo" />
      <div>
        <div class="org-name">${escapeHtml(brand.name || "لجنة الزواج الجماعي")}</div>
        <div class="org-sub">${escapeHtml(brand.subtitle || "لقبيلة الهملة من قريش")}</div>
      </div>
    </div>
    <div class="oh-center">
      <div class="kicker">OFFICIAL MEETING MINUTES</div>
      <h1>محضر اجتماع رسمي</h1>
      <div class="meet-no">محضر رقم ${arDigits(meetingNoNumeric)}</div>
    </div>
    <div class="oh-left">
      <div class="row"><b>التاريخ:</b><span>${dateLong || dash}</span></div>
      <div class="row"><b>المكان:</b><span>${m.location ? escapeHtml(m.location) : dash}</span></div>
      <div class="row"><b>البداية:</b><span>${m.start_time ? escapeHtml(m.start_time) : dash}</span></div>
      <div class="row"><b>النهاية:</b><span>${m.end_time ? escapeHtml(m.end_time) : dash}</span></div>
    </div>
  </header>

  <div class="ref-strip">
    <span><b>المرجع:</b> ${escapeHtml(refNumber)}</span>
    <span><b>اليوم:</b> ${weekday || dash} &nbsp;·&nbsp; <b>الموافق:</b> ${hijri || dash}</span>
    <span><b>صدر في:</b> ${escapeHtml(issueDate)}</span>
  </div>

  <!-- ===== Subject ===== -->
  ${m.title ? `
  <div class="subject-block">
    <div class="lbl">موضوع الاجتماع</div>
    <div class="val">${escapeHtml(m.title)}</div>
  </div>` : ""}

  <!-- ===== Attendees professional grid ===== -->
  <div class="sec"><span class="icon">👥</span><h2>الحضور والغياب</h2></div>
  ${attendeeCards}

  <!-- ===== Agenda numbered list ===== -->
  <div class="sec"><span class="icon">📋</span><h2>محاور الاجتماع</h2></div>
  ${m.agenda_items.length === 0
    ? `<div class="agenda-empty">— لا توجد محاور مسجَّلة —</div>`
    : `<ol class="agenda">${m.agenda_items.map((x, i) => `
        <li><span class="num">${arDigits(i + 1)}.</span><span>${escapeHtml(x)}</span></li>`).join("")}</ol>`}

  <!-- ===== Decisions table ===== -->
  <div class="sec"><span class="icon">✓</span><h2>التوصيات والقرارات</h2></div>
  <table class="decisions">
    <colgroup>
      <col style="width:38px"/><col/><col style="width:22%"/><col style="width:18%"/>
    </colgroup>
    <thead>
      <tr>
        <th>م</th>
        <th>القرار / التوصية</th>
        <th>المكلف</th>
        <th>موعد التنفيذ</th>
      </tr>
    </thead>
    <tbody>${decisionRows}</tbody>
  </table>

  ${m.notes ? `
  <div class="sec"><span class="icon">✎</span><h2>ملاحظات إضافية</h2></div>
  <div class="notes-body">${escapeHtml(m.notes)}</div>` : ""}

  <!-- ===== Signatures + QR ===== -->
  <div class="approval">
    <div class="sig">
      <div class="role">أمين السر / كاتب المحضر</div>
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
      <div class="role">الاعتماد النهائي</div>
      <div class="body">
        <div class="field"><span class="l">الاسم</span><span class="line"></span></div>
        <div class="field"><span class="l">التوقيع</span><span class="line"></span></div>
        <div class="field"><span class="l">التاريخ</span><span class="line"></span></div>
      </div>
    </div>
    <div class="qr-block">
      <img src="${qrSrc}" alt="QR" />
      <div class="qr-cap"><b>التحقق الرقمي</b>${escapeHtml(refNumber)}</div>
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