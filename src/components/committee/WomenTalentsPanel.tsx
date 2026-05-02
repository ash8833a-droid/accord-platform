import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Copy,
  Share2,
  ExternalLink,
  Search,
  Loader2,
  Phone,
  MapPin,
  Sparkles,
  Trash2,
  Save,
  Users,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { BRAND_LOGO_DATA_URI } from "@/assets/brand-logo";
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  Table as DocxTable,
  TableRow as DocxTableRow,
  TableCell as DocxTableCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
} from "docx";
import { saveAs } from "file-saver";

type Status = "new" | "contacted" | "accepted" | "rejected" | "on_hold";

interface Response {
  id: string;
  full_name: string;
  age: number | null;
  phone: string;
  city: string | null;
  marital_status: string | null;
  education_level: string | null;
  specialization: string | null;
  skills: string[];
  tools: string | null;
  experience_years: number | null;
  previous_work: string | null;
  certifications: string | null;
  interest_areas: string[];
  weekly_hours: string | null;
  preferred_times: string[];
  motivation: string | null;
  notes: string | null;
  status: Status;
  reviewer_notes: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<Status, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  accepted: "مقبولة",
  rejected: "غير مناسبة",
  on_hold: "معلّقة",
};

const STATUS_TONE: Record<Status, string> = {
  new: "bg-rose-100 text-rose-700 border-rose-200",
  contacted: "bg-sky-100 text-sky-700 border-sky-200",
  accepted: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected: "bg-slate-100 text-slate-600 border-slate-200",
  on_hold: "bg-amber-100 text-amber-700 border-amber-200",
};

export function WomenTalentsPanel() {
  const [rows, setRows] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Response | null>(null);

  const surveyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/survey/women-talents`
      : "https://lajnat-zawaj.org/survey/women-talents";

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("women_talent_responses")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("تعذر تحميل الردود");
    } else {
      setRows((data ?? []) as Response[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("women_talent_responses_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "women_talent_responses" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const blob = `${r.full_name} ${r.phone} ${r.city ?? ""} ${
          r.skills.join(" ")
        } ${r.specialization ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const accepted = rows.filter((r) => r.status === "accepted").length;
    const newCount = rows.filter((r) => r.status === "new").length;
    return { total, accepted, newCount };
  }, [rows]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(surveyUrl);
      toast.success("تم نسخ رابط الاستبيان");
    } catch {
      toast.error("تعذر النسخ");
    }
  };

  const shareWhatsApp = () => {
    const msg = `🌸 دعوة خاصة لبنات العائلة\n\nنبحث عن المبدعات للمشاركة معنا في صناعة فرحة العائلة (تصميم، توثيق، تقنية، إعلام).\n\nأكملي الاستبيان من هنا:\n${surveyUrl}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(msg)}`,
      "_blank",
      "noopener",
    );
  };

  const exportExcel = () => {
    if (rows.length === 0) {
      toast.error("لا توجد بيانات للتصدير");
      return;
    }
    const data = rows.map((r) => ({
      "الاسم": r.full_name,
      "العمر": r.age ?? "",
      "الجوال": r.phone,
      "المدينة": r.city ?? "",
      "المؤهل": r.education_level ?? "",
      "التخصص": r.specialization ?? "",
      "المهارات": r.skills.join("، "),
      "الأدوات": r.tools ?? "",
      "سنوات الخبرة": r.experience_years ?? "",
      "أعمال سابقة": r.previous_work ?? "",
      "شهادات": r.certifications ?? "",
      "مجالات الاهتمام": r.interest_areas.join("، "),
      "ساعات أسبوعياً": r.weekly_hours ?? "",
      "أوقات التواجد": r.preferred_times.join("، "),
      "الدوافع": r.motivation ?? "",
      "ملاحظات": r.notes ?? "",
      "الحالة": STATUS_LABEL[r.status],
      "ملاحظات اللجنة": r.reviewer_notes ?? "",
      "تاريخ الإرسال": new Date(r.created_at).toLocaleString("ar-SA"),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ردود الاستبيان");
    XLSX.writeFile(wb, `women-talents-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportPDF = () => {
    if (rows.length === 0) {
      toast.error("لا توجد بيانات للتصدير");
      return;
    }
    const esc = (s: unknown) =>
      String(s ?? "—").replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
      );
    const date = new Date().toLocaleString("ar-SA-u-ca-gregory");
    const w = window.open("", "_blank", "width=1200,height=850");
    if (!w) {
      toast.error("يرجى السماح بفتح النوافذ المنبثقة");
      return;
    }
    const bodyRows = rows
      .map(
        (r, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td><b>${esc(r.full_name)}</b></td>
          <td class="ltr">${esc(r.phone)}</td>
          <td>${esc(r.city)}</td>
          <td>${esc(r.education_level)}</td>
          <td>${esc(r.specialization)}</td>
          <td class="skills">${esc(r.skills?.join("، "))}</td>
          <td class="num">${esc(r.experience_years)}</td>
          <td><span class="status status-${r.status}">${esc(STATUS_LABEL[r.status])}</span></td>
          <td class="ltr">${new Date(r.created_at).toLocaleDateString("en-GB")}</td>
        </tr>`,
      )
      .join("");

    w.document.write(`<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
<title>ردود استبيان مواهب بنات العائلة</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap" rel="stylesheet"/>
<style>
  *{box-sizing:border-box}
  body{font-family:'Tajawal','Segoe UI',Tahoma,sans-serif;margin:0;color:#1a1a1a;background:#fff}
  .page{padding:28px 32px}
  header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #C4A25C;padding-bottom:14px;margin-bottom:18px;gap:16px}
  .brand{display:flex;align-items:center;gap:14px}
  .brand img{width:64px;height:64px;filter:drop-shadow(0 2px 6px rgba(196,162,92,.35))}
  .brand h1{margin:0;color:#0E3A42;font-size:20px;font-weight:900;letter-spacing:.2px}
  .brand .sub{font-size:11px;color:#6b6b6b;margin-top:2px}
  .meta{text-align:left;font-size:11px;color:#555;line-height:1.7}
  .meta b{color:#0E3A42}
  h2{margin:0 0 4px;color:#0E3A42;font-size:18px;font-weight:800}
  .lead{color:#6b6b6b;font-size:12px;margin:0 0 14px}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
  .kpi{border:1px solid #E8DAB6;background:linear-gradient(180deg,#FBF7EE,#fff);border-radius:10px;padding:10px 12px}
  .kpi .l{font-size:11px;color:#6b6b6b}
  .kpi .v{font-size:20px;font-weight:900;color:#0E3A42;margin-top:2px}
  table{width:100%;border-collapse:collapse;font-size:11.5px;border:1px solid #E5E5E5;border-radius:8px;overflow:hidden}
  thead th{background:linear-gradient(90deg,#0E3A42,#1B5560);color:#fff;padding:9px 6px;text-align:right;font-weight:700;font-size:11px;border:1px solid #0E3A42}
  tbody td{padding:8px 6px;border:1px solid #EAEAEA;vertical-align:top;background:#fff}
  tbody tr:nth-child(even) td{background:#FAF6EE}
  td.num{text-align:center;color:#555;font-variant-numeric:tabular-nums}
  td.ltr{direction:ltr;text-align:center;font-variant-numeric:tabular-nums}
  td.skills{color:#444;font-size:11px;line-height:1.6}
  .status{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:700;border:1px solid transparent;white-space:nowrap}
  .status-new{background:#FEE2E2;color:#9F1239;border-color:#FBCFE8}
  .status-contacted{background:#E0F2FE;color:#075985;border-color:#BAE6FD}
  .status-accepted{background:#DCFCE7;color:#166534;border-color:#BBF7D0}
  .status-rejected{background:#F1F5F9;color:#475569;border-color:#E2E8F0}
  .status-on_hold{background:#FEF3C7;color:#92400E;border-color:#FDE68A}
  footer{margin-top:22px;border-top:2px solid #C4A25C;padding-top:12px;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#555}
  .stamp{border:2px dashed #0E3A42;color:#0E3A42;padding:8px 18px;border-radius:50%;font-weight:800;text-align:center;line-height:1.3;font-size:11px}
  @media print{
    @page{size:A4 landscape;margin:12mm}
    .page{padding:0}
    thead{display:table-header-group}
    tr{page-break-inside:avoid}
  }
</style></head>
<body><div class="page">
  <header>
    <div class="brand">
      <img src="${BRAND_LOGO_DATA_URI}" alt="logo"/>
      <div>
        <h1>لجان الزواج الجماعي الثاني عشر</h1>
        <div class="sub">استبيان مواهب بنات العائلة — تقرير الردود</div>
      </div>
    </div>
    <div class="meta">
      <div><b>تاريخ التقرير:</b> ${esc(date)}</div>
      <div><b>إجمالي الردود:</b> ${rows.length}</div>
      <div><b>المرجع:</b> WT-${new Date().toISOString().slice(0, 10)}</div>
    </div>
  </header>

  <h2>ردود استبيان المواهب</h2>
  <p class="lead">قائمة شاملة بالردود المستلمة عبر استبيان مواهب بنات العائلة، مرتبة حسب تاريخ الإرسال.</p>

  <div class="kpis">
    <div class="kpi"><div class="l">إجمالي الردود</div><div class="v">${stats.total}</div></div>
    <div class="kpi"><div class="l">ردود جديدة</div><div class="v">${stats.newCount}</div></div>
    <div class="kpi"><div class="l">مقبولات</div><div class="v">${stats.accepted}</div></div>
    <div class="kpi"><div class="l">تاريخ الطباعة</div><div class="v" style="font-size:13px">${new Date().toLocaleDateString("ar-SA-u-ca-gregory")}</div></div>
  </div>

  <table>
    <thead><tr>
      <th style="width:32px">م</th>
      <th>الاسم</th>
      <th style="width:90px">الجوال</th>
      <th style="width:80px">المدينة</th>
      <th style="width:80px">المؤهل</th>
      <th>التخصص</th>
      <th>المهارات</th>
      <th style="width:50px">الخبرة</th>
      <th style="width:80px">الحالة</th>
      <th style="width:80px">تاريخ الإرسال</th>
    </tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>

  <footer>
    <div>
      <div><b>أُعدّ بواسطة:</b> منصة لجان الزواج الجماعي</div>
      <div style="margin-top:2px;color:#888">lajnat-zawaj.org</div>
    </div>
    <div class="stamp">ختم<br/>اللجنة العليا</div>
  </footer>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),400)</script>
</body></html>`);
    w.document.close();
  };

  const exportWord = async () => {
    if (rows.length === 0) {
      toast.error("لا توجد بيانات للتصدير");
      return;
    }
    const headers = [
      "م", "الاسم", "الجوال", "المدينة", "المؤهل", "التخصص",
      "المهارات", "سنوات الخبرة", "الحالة", "تاريخ الإرسال",
    ];
    const headerRow = new DocxTableRow({
      children: headers.map(
        (h) =>
          new DocxTableCell({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: h, bold: true, size: 18 })],
              }),
            ],
            shading: { fill: "DB2777", type: "clear", color: "auto" },
          }),
      ),
    });
    const bodyRows = rows.map(
      (r, i) =>
        new DocxTableRow({
          children: [
            String(i + 1),
            r.full_name,
            r.phone,
            r.city ?? "—",
            r.education_level ?? "—",
            r.specialization ?? "—",
            r.skills.join("، "),
            String(r.experience_years ?? "—"),
            STATUS_LABEL[r.status],
            new Date(r.created_at).toLocaleDateString("ar-SA"),
          ].map(
            (val) =>
              new DocxTableCell({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: val, size: 16 })],
                  }),
                ],
              }),
          ),
        }),
    );
    const doc = new DocxDocument({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "ردود استبيان مواهب بنات العائلة", bold: true, size: 32 })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: `إجمالي الردود: ${rows.length}  •  تاريخ التصدير: ${new Date().toLocaleDateString("ar-SA")}`,
                  size: 18,
                }),
              ],
            }),
            new Paragraph({ children: [new TextRun(" ")] }),
            new DocxTable({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [headerRow, ...bodyRows],
            }),
          ],
        },
      ],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `women-talents-${new Date().toISOString().slice(0, 10)}.docx`);
  };

  return (
    <div className="space-y-5">
      {/* Hero card with link */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 via-fuchsia-600 to-amber-500 p-5 lg:p-6 text-white shadow-lg">
        <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-white/15 blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg">
                استبيان مواهب بنات العائلة
              </h3>
              <p className="text-sm text-white/85 mt-0.5">
                شاركي الرابط في الواتساب لجمع البيانات من المهتمات
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={copyLink}
              className="bg-white/95 text-fuchsia-700 hover:bg-white"
            >
              <Copy className="h-4 w-4 ml-1.5" />
              نسخ الرابط
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={shareWhatsApp}
              className="bg-emerald-500 text-white hover:bg-emerald-600 border-0"
            >
              <Share2 className="h-4 w-4 ml-1.5" />
              مشاركة عبر واتساب
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              asChild
              className="bg-white/20 text-white hover:bg-white/30 border-0"
            >
              <a href={surveyUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 ml-1.5" />
                معاينة
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="إجمالي الردود" value={stats.total} icon={Users} tone="rose" />
        <StatBox label="جديدة" value={stats.newCount} icon={Sparkles} tone="fuchsia" />
        <StatBox label="مقبولة" value={stats.accepted} icon={CheckCircle2} tone="emerald" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحثي بالاسم أو الجوال أو المهارة..."
            className="pr-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="new">جديد</SelectItem>
            <SelectItem value="contacted">تم التواصل</SelectItem>
            <SelectItem value="accepted">مقبولة</SelectItem>
            <SelectItem value="on_hold">معلّقة</SelectItem>
            <SelectItem value="rejected">غير مناسبة</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" onClick={exportExcel}>
          تصدير Excel
        </Button>
        <Button type="button" variant="outline" onClick={exportPDF}>
          تصدير PDF
        </Button>
        <Button type="button" variant="outline" onClick={exportWord}>
          تصدير Word
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin ml-2" />
          جارٍ التحميل...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50/40 p-10 text-center">
          <Sparkles className="h-10 w-10 text-rose-400 mx-auto mb-3" />
          <p className="text-sm text-slate-600">
            لا توجد ردود حالياً. شاركي رابط الاستبيان في مجموعات العائلة لاستقبال
            البيانات.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelected(r)}
              className="text-right rounded-2xl border bg-card p-4 hover:shadow-md transition-all hover:border-rose-300"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <h4 className="font-bold text-sm truncate">{r.full_name}</h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <Phone className="h-3 w-3" />
                    <span>{r.phone}</span>
                    {r.city && (
                      <>
                        <MapPin className="h-3 w-3 mr-1" />
                        <span>{r.city}</span>
                      </>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className={`${STATUS_TONE[r.status]} text-[10px]`}>
                  {STATUS_LABEL[r.status]}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {r.skills.slice(0, 4).map((s) => (
                  <Badge
                    key={s}
                    variant="secondary"
                    className="text-[10px] bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200"
                  >
                    {s}
                  </Badge>
                ))}
                {r.skills.length > 4 && (
                  <Badge variant="secondary" className="text-[10px]">
                    +{r.skills.length - 4}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                {new Date(r.created_at).toLocaleString("ar-SA")}
              </p>
            </button>
          ))}
        </div>
      )}

      <ResponseDetailsDialog
        response={selected}
        onClose={() => setSelected(null)}
        onSaved={() => {
          setSelected(null);
          load();
        }}
      />
    </div>
  );
}

function StatBox({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "rose" | "fuchsia" | "emerald";
}) {
  const toneMap = {
    rose: "from-rose-500 to-rose-600",
    fuchsia: "from-fuchsia-500 to-fuchsia-600",
    emerald: "from-emerald-500 to-emerald-600",
  } as const;
  return (
    <div className="rounded-2xl border bg-card p-3 flex items-center gap-3">
      <div
        className={`h-10 w-10 rounded-xl bg-gradient-to-br ${toneMap[tone]} text-white flex items-center justify-center shrink-0`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-extrabold">{value}</p>
      </div>
    </div>
  );
}

function ResponseDetailsDialog({
  response,
  onClose,
  onSaved,
}: {
  response: Response | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<Status>("new");
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (response) {
      setStatus(response.status);
      setReviewerNotes(response.reviewer_notes ?? "");
    }
  }, [response]);

  if (!response) return null;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("women_talent_responses")
      .update({ status, reviewer_notes: reviewerNotes || null })
      .eq("id", response.id);
    setSaving(false);
    if (error) {
      toast.error("تعذر الحفظ");
    } else {
      toast.success("تم تحديث الحالة");
      onSaved();
    }
  };

  const remove = async () => {
    if (!confirm("هل تريدين حذف هذا الرد نهائياً؟")) return;
    const { error } = await supabase
      .from("women_talent_responses")
      .delete()
      .eq("id", response.id);
    if (error) toast.error("تعذر الحذف");
    else {
      toast.success("تم الحذف");
      onSaved();
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-lg">{response.full_name}</DialogTitle>
          <DialogDescription>
            تاريخ الإرسال: {new Date(response.created_at).toLocaleString("ar-SA")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <Section title="البيانات الشخصية">
            <Row label="الجوال" value={response.phone} />
            <Row label="العمر" value={response.age ?? "—"} />
            <Row label="المدينة" value={response.city ?? "—"} />
            <Row label="الحالة الاجتماعية" value={response.marital_status ?? "—"} />
          </Section>
          <Section title="المؤهل والتخصص">
            <Row label="المستوى التعليمي" value={response.education_level ?? "—"} />
            <Row label="التخصص" value={response.specialization ?? "—"} />
          </Section>
          <Section title="المهارات">
            <div className="flex flex-wrap gap-1.5">
              {response.skills.map((s) => (
                <Badge
                  key={s}
                  className="bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200"
                >
                  {s}
                </Badge>
              ))}
            </div>
            <Row label="الأدوات" value={response.tools ?? "—"} />
            <Row label="سنوات الخبرة" value={response.experience_years ?? "—"} />
            <Row label="أعمال سابقة" value={response.previous_work ?? "—"} multiline />
            <Row label="شهادات" value={response.certifications ?? "—"} />
          </Section>
          <Section title="الاهتمامات والتفرغ">
            <div className="flex flex-wrap gap-1.5">
              {response.interest_areas.map((s) => (
                <Badge
                  key={s}
                  variant="secondary"
                  className="bg-rose-100 text-rose-700 border-rose-200"
                >
                  {s}
                </Badge>
              ))}
            </div>
            <Row label="ساعات أسبوعياً" value={response.weekly_hours ?? "—"} />
            <Row
              label="الأوقات المفضلة"
              value={response.preferred_times.join("، ") || "—"}
            />
          </Section>
          <Section title="لمسة شخصية">
            <Row label="الدوافع" value={response.motivation ?? "—"} multiline />
            <Row label="ملاحظات" value={response.notes ?? "—"} multiline />
          </Section>

          <div className="rounded-xl border bg-muted/30 p-3 space-y-3">
            <h4 className="font-bold text-sm">إدارة المراجعة</h4>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                الحالة
              </label>
              <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">جديد</SelectItem>
                  <SelectItem value="contacted">تم التواصل</SelectItem>
                  <SelectItem value="accepted">مقبولة</SelectItem>
                  <SelectItem value="on_hold">معلّقة</SelectItem>
                  <SelectItem value="rejected">غير مناسبة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                ملاحظات اللجنة (داخلية)
              </label>
              <Textarea
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                placeholder="ملاحظاتك بعد التواصل أو المقابلة..."
                className="mt-1 min-h-[70px]"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="destructive" onClick={remove} type="button">
            <Trash2 className="h-4 w-4 ml-1.5" />
            حذف
          </Button>
          <Button
            asChild
            variant="outline"
            type="button"
            className="bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
          >
            <a
              href={`https://wa.me/${response.phone.replace(/^0/, "966")}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Phone className="h-4 w-4 ml-1.5" />
              تواصل واتساب
            </a>
          </Button>
          <Button onClick={save} disabled={saving} type="button">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin ml-1.5" />
            ) : (
              <Save className="h-4 w-4 ml-1.5" />
            )}
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-3 space-y-2">
      <h4 className="font-bold text-xs text-fuchsia-700">{title}</h4>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  multiline,
}: {
  label: string;
  value: React.ReactNode;
  multiline?: boolean;
}) {
  return (
    <div
      className={`grid ${multiline ? "grid-cols-1 gap-1" : "grid-cols-3 gap-2"} text-xs`}
    >
      <span className="text-muted-foreground font-semibold">{label}</span>
      <span className={`${multiline ? "" : "col-span-2"} text-foreground whitespace-pre-wrap break-words`}>
        {value}
      </span>
    </div>
  );
}