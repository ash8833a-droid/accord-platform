import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Database,
  Download,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  FileSpreadsheet,
  FileText,
  FileJson,
  Printer,
  Crown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { COMMITTEE_HEAD_LABEL, COMMITTEE_MEMBER_LABEL, committeeMemberLabel } from "@/lib/committee-member-labels";

export interface TeamDbRow {
  id: string;
  committee_id: string;
  committee_name: string;
  full_name: string;
  role_title: string | null;
  role_key: string;
  phone: string | null;
  email: string | null;
  specialty: string | null;
  is_head: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  admin: COMMITTEE_MEMBER_LABEL,
  committee: COMMITTEE_MEMBER_LABEL,
  quality: COMMITTEE_MEMBER_LABEL,
  delegate: COMMITTEE_MEMBER_LABEL,
  team: COMMITTEE_MEMBER_LABEL,
};

type SortKey =
  | "full_name"
  | "committee_name"
  | "role_title"
  | "role_key"
  | "phone"
  | "specialty"
  | "is_head";

interface ColumnDef {
  key: SortKey;
  label: string;
  width?: string;
}

const COLUMNS: ColumnDef[] = [
  { key: "full_name", label: "الاسم الكامل", width: "min-w-[180px]" },
  { key: "committee_name", label: "اللجنة", width: "min-w-[160px]" },
  { key: "role_title", label: "المسمى الوظيفي", width: "min-w-[140px]" },
  { key: "role_key", label: "نوع الدور", width: "min-w-[110px]" },
  { key: "phone", label: "الجوال", width: "min-w-[120px]" },
  { key: "specialty", label: "التخصص", width: "min-w-[140px]" },
  { key: "is_head", label: "رئيس؟", width: "min-w-[80px]" },
];

const todayStamp = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export function TeamDatabaseDialog({ rows }: { rows: TeamDbRow[] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [committeeFilter, setCommitteeFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("committee_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const committees = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => map.set(r.committee_id, r.committee_name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (committeeFilter !== "all" && r.committee_id !== committeeFilter) return false;
      if (roleFilter === "head" && !r.is_head) return false;
      if (roleFilter === "member" && r.is_head) return false;
      if (!q) return true;
      return (
        r.full_name.toLowerCase().includes(q) ||
        (r.role_title ?? "").toLowerCase().includes(q) ||
        (r.phone ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.specialty ?? "").toLowerCase().includes(q) ||
        r.committee_name.toLowerCase().includes(q)
      );
    });
  }, [rows, search, committeeFilter, roleFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      // boolean
      if (typeof va === "boolean" || typeof vb === "boolean") {
        const na = va ? 1 : 0;
        const nb = vb ? 1 : 0;
        return sortDir === "asc" ? na - nb : nb - na;
      }
      const sa = (va ?? "").toString();
      const sb = (vb ?? "").toString();
      const cmp = sa.localeCompare(sb, "ar");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  };

  const exportRows = sorted.map((r, i) => ({
    "#": i + 1,
    "الاسم الكامل": r.full_name,
    اللجنة: r.committee_name,
    "المسمى الوظيفي": committeeMemberLabel(r),
    "نوع الدور": committeeMemberLabel(r),
    الجوال: r.phone ?? "",
    "البريد الإلكتروني": r.email ?? "",
    التخصص: r.specialty ?? "",
    "رئيس اللجنة": r.is_head ? "نعم" : "لا",
  }));

  const baseName = `قاعدة-بيانات-فريق-العمل-${todayStamp()}`;

  const exportCSV = () => {
    if (exportRows.length === 0) return toast.error("لا توجد بيانات للتصدير");
    const headers = Object.keys(exportRows[0]);
    const escape = (v: unknown) =>
      `"${(v ?? "").toString().replace(/"/g, '""')}"`;
    const lines = [
      headers.map(escape).join(","),
      ...exportRows.map((r) =>
        headers.map((h) => escape((r as Record<string, unknown>)[h])).join(","),
      ),
    ];
    const blob = new Blob(["\ufeff" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    downloadBlob(blob, `${baseName}.csv`);
    toast.success("تم تصدير CSV");
  };

  const exportXLSX = () => {
    if (exportRows.length === 0) return toast.error("لا توجد بيانات للتصدير");
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws["!cols"] = [
      { wch: 5 },
      { wch: 24 },
      { wch: 22 },
      { wch: 18 },
      { wch: 14 },
      { wch: 16 },
      { wch: 24 },
      { wch: 22 },
      { wch: 10 },
    ];
    ws["!views"] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, "فريق العمل");
    XLSX.writeFile(wb, `${baseName}.xlsx`);
    toast.success("تم تصدير Excel");
  };

  const exportJSON = () => {
    if (exportRows.length === 0) return toast.error("لا توجد بيانات للتصدير");
    const blob = new Blob([JSON.stringify(exportRows, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    downloadBlob(blob, `${baseName}.json`);
    toast.success("تم تصدير JSON");
  };

  const escapeHtml = (s: string) =>
    (s ?? "")
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const exportPDF = () => {
    if (exportRows.length === 0) return toast.error("لا توجد بيانات للتصدير");
    const headers = Object.keys(exportRows[0]);
    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>${baseName}</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Tajawal', Arial, sans-serif; color: #1f2937; margin: 0; }
  .header {
    background: linear-gradient(135deg, #1B4F58, #2A6B75);
    color: #fff; padding: 16px 20px; border-radius: 12px; margin-bottom: 14px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .header h1 { margin: 0; font-size: 16pt; font-weight: 800; }
  .header p { margin: 4px 0 0; font-size: 9pt; opacity: 0.9; }
  .meta { font-size: 9pt; text-align: left; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  thead th {
    background: #1B4F58; color: #fff; padding: 8px 6px;
    text-align: center; font-weight: 700; border: 1px solid #133940;
  }
  tbody td {
    padding: 6px; text-align: center; border: 1px solid #E5E7EB;
    vertical-align: middle;
  }
  tbody tr:nth-child(even) td { background: #FBF7EE; }
  .head-badge { background: #C4A25C; color: #1B4F58; padding: 2px 8px; border-radius: 999px; font-weight: 700; font-size: 8pt; }
  .toolbar { position: fixed; top: 10px; left: 10px; display: flex; gap: 6px; }
  .toolbar button {
    background: #1B4F58; color: #fff; border: 0; padding: 8px 14px;
    border-radius: 8px; font-family: inherit; font-weight: 700; cursor: pointer;
  }
  @media print { .toolbar { display: none; } }
</style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">🖨️ طباعة / PDF</button>
    <button onclick="window.close()" style="background:#C4A25C;color:#1B4F58">إغلاق</button>
  </div>
  <div class="header">
    <div>
      <h1>قاعدة بيانات فريق العمل</h1>
      <p>منصة الزواج الجماعي العائلي</p>
    </div>
    <div class="meta">
      <div>إجمالي السجلات: <b>${exportRows.length}</b></div>
      <div>تاريخ التصدير: ${todayStamp()}</div>
    </div>
  </div>
  <table>
    <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
    <tbody>
      ${exportRows
        .map(
          (r) =>
            `<tr>${headers
              .map((h) => {
                const v = (r as Record<string, unknown>)[h];
                if (h === "رئيس اللجنة" && v === "نعم") {
                  return `<td><span class="head-badge">رئيس</span></td>`;
                }
                return `<td>${escapeHtml(String(v ?? ""))}</td>`;
              })
              .join("")}</tr>`,
        )
        .join("")}
    </tbody>
  </table>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 500));</script>
</body>
</html>`;
    const win = window.open("", "_blank", "width=1200,height=800");
    if (!win) return toast.error("يرجى السماح بالنوافذ المنبثقة");
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const headsCount = sorted.filter((r) => r.is_head).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 bg-card/15 hover:bg-card/25 text-primary-foreground border-primary-foreground/30 backdrop-blur-sm"
        >
          <Database className="h-4 w-4" />
          قاعدة البيانات
        </Button>
      </DialogTrigger>
      <DialogContent
        dir="rtl"
        className="max-w-[95vw] lg:max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Database className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <div>قاعدة بيانات فريق العمل</div>
              <p className="text-xs text-muted-foreground font-normal mt-0.5">
                جدول شامل بكل أعضاء اللجان مع فرز وبحث وتصدير بصيغ متعددة
              </p>
            </div>
          </DialogTitle>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم، الجوال، البريد، التخصص…"
                className="pr-9"
              />
            </div>
            <Select value={committeeFilter} onValueChange={setCommitteeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="اللجنة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل اللجان</SelectItem>
                {committees.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="الدور" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأعضاء</SelectItem>
                <SelectItem value="head">{COMMITTEE_HEAD_LABEL}</SelectItem>
                <SelectItem value="member">{COMMITTEE_MEMBER_LABEL}</SelectItem>
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2 bg-primary hover:bg-primary/90">
                  <Download className="h-4 w-4" /> تصدير
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>اختر صيغة التصدير</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={exportXLSX} className="gap-2 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportCSV} className="gap-2 cursor-pointer">
                  <FileText className="h-4 w-4 text-blue-600" />
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportJSON} className="gap-2 cursor-pointer">
                  <FileJson className="h-4 w-4 text-amber-600" />
                  JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportPDF} className="gap-2 cursor-pointer">
                  <Printer className="h-4 w-4 text-rose-600" />
                  PDF / طباعة
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary" className="gap-1">
              <Database className="h-3 w-3" /> {sorted.length} سجل
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Crown className="h-3 w-3 text-gold" /> {headsCount} رئيس
            </Badge>
            <Badge variant="secondary">
              {committees.length} لجنة
            </Badge>
          </div>
        </DialogHeader>

        {/* Table */}
        <div className="flex-1 overflow-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
              <tr>
                <th className="px-3 py-2.5 text-center text-xs font-bold text-muted-foreground w-12">
                  #
                </th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`px-3 py-2.5 text-right text-xs font-bold text-muted-foreground cursor-pointer hover:bg-muted ${col.width ?? ""}`}
                    onClick={() => toggleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortIcon(col.key)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={COLUMNS.length + 1}
                    className="text-center py-12 text-muted-foreground text-sm"
                  >
                    لا توجد سجلات مطابقة للبحث
                  </td>
                </tr>
              ) : (
                sorted.map((r, i) => (
                  <tr
                    key={r.id}
                    className="border-t hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-3 py-2 text-center text-muted-foreground tabular-nums">
                      {i + 1}
                    </td>
                    <td className="px-3 py-2 font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        {r.is_head && <Crown className="h-3.5 w-3.5 text-gold" />}
                        {r.full_name}
                      </span>
                    </td>
                    <td className="px-3 py-2">{r.committee_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.role_title ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[10px]">
                        {ROLE_LABEL[r.role_key] ?? r.role_key}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 tabular-nums" dir="ltr">
                      {r.phone ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">
                      {r.specialty ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.is_head ? (
                        <Badge className="bg-gold text-gold-foreground text-[10px]">
                          رئيس
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
