import { useMemo } from "react";
import { BRAND_LOGO_DATA_URI } from "@/assets/brand-logo";
import { DotsPattern } from "@/components/decor/DotsPattern";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { printHtmlDocument } from "@/lib/print-frame";

interface Props {
  title: string;
  committeeName: string;
  content: string;
  analysisText?: string | null;
  /** Hide print button (e.g. when embedded inside a dialog with its own actions). */
  hidePrint?: boolean;
}

type Block =
  | { kind: "h1" | "h2" | "h3"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "p"; text: string }
  | { kind: "hr" };

function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) {
      i++;
      continue;
    }
    if (/^-{3,}$|^_{3,}$|^\*{3,}$/.test(line)) {
      blocks.push({ kind: "hr" });
      i++;
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length as 1 | 2 | 3;
      blocks.push({ kind: (`h${level}` as "h1" | "h2" | "h3"), text: h[2].trim() });
      i++;
      continue;
    }
    if (/^[-•*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-•*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-•*]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }
    // paragraph: join consecutive non-empty, non-special lines
    const buf: string[] = [line];
    i++;
    while (i < lines.length) {
      const nxt = lines[i].trim();
      if (!nxt) break;
      if (/^(#{1,3})\s+/.test(nxt)) break;
      if (/^[-•*]\s+/.test(nxt)) break;
      if (/^\d+[.)]\s+/.test(nxt)) break;
      if (/^-{3,}$|^_{3,}$|^\*{3,}$/.test(nxt)) break;
      buf.push(nxt);
      i++;
    }
    blocks.push({ kind: "p", text: buf.join(" ") });
  }
  return blocks;
}

function renderBlocks(blocks: Block[]) {
  return blocks.map((b, idx) => {
    if (b.kind === "hr") return <hr key={idx} className="my-5 border-slate-200" />;
    if (b.kind === "h1")
      return (
        <h1 key={idx} className="text-[20px] font-extrabold text-primary mt-6 mb-2 leading-snug">
          {b.text}
        </h1>
      );
    if (b.kind === "h2")
      return (
        <h2 key={idx} className="text-[16px] font-bold text-slate-800 mt-5 mb-2 border-r-4 border-primary/70 pe-3 leading-snug">
          {b.text}
        </h2>
      );
    if (b.kind === "h3")
      return (
        <h3 key={idx} className="text-[14px] font-bold text-slate-700 mt-4 mb-1.5 leading-snug">
          {b.text}
        </h3>
      );
    if (b.kind === "ul")
      return (
        <ul key={idx} className="list-disc pe-6 space-y-1.5 text-[13px] leading-7 text-slate-700">
          {b.items.map((it, j) => <li key={j}>{it}</li>)}
        </ul>
      );
    if (b.kind === "ol")
      return (
        <ol key={idx} className="list-decimal pe-6 space-y-1.5 text-[13px] leading-7 text-slate-700">
          {b.items.map((it, j) => <li key={j}>{it}</li>)}
        </ol>
      );
    if (b.kind === "p") {
      return (
        <p key={idx} className="text-[13px] leading-7 text-slate-700 my-2">
          {b.text}
        </p>
      );
    }
    return null;
  });
}

function buildPrintHtml(props: { title: string; committeeName: string; bodyHtml: string }): string {
  const { title, committeeName, bodyHtml } = props;
  return `
    <style>
      .plan-doc { max-width: 186mm; margin: 0 auto; color: #1f2937; }
      .plan-doc .header {
        display: flex; align-items: center; gap: 14px;
        padding: 14px 16px; border: 1px solid #e5e7eb; border-radius: 16px;
        background: linear-gradient(180deg, #f8fafc, #ffffff);
      }
      .plan-doc .header img { width: 64px; height: 64px; object-fit: contain; }
      .plan-doc .header .meta { font-size: 11px; color: #64748b; letter-spacing: .02em; }
      .plan-doc .header h1 { margin: 2px 0 0; font-size: 20px; color: #0f172a; }
      .plan-doc .header h2 { margin: 2px 0 0; font-size: 13px; color: #475569; font-weight: 600; }
      .plan-doc .content { padding: 6mm 0; font-size: 12.5px; line-height: 1.85; }
      .plan-doc .content h1 { font-size: 17px; color: #166534; margin: 14px 0 6px; }
      .plan-doc .content h2 { font-size: 14px; color: #1f2937; margin: 12px 0 4px; border-right: 3px solid #166534; padding-right: 8px; }
      .plan-doc .content h3 { font-size: 13px; color: #334155; margin: 10px 0 4px; }
      .plan-doc .content ul, .plan-doc .content ol { padding-right: 22px; margin: 4px 0; }
      .plan-doc .content li { margin: 2px 0; }
      .plan-doc .content hr { border: 0; border-top: 1px solid #e5e7eb; margin: 10px 0; }
      .plan-doc .footer {
        margin-top: 8mm; padding-top: 6px; border-top: 1px dashed #cbd5e1;
        font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between;
      }
      .plan-doc .analysis {
        margin-top: 6mm; padding: 10px 12px;
        border: 1px solid #fde68a; background: #fffbeb; border-radius: 12px;
        font-size: 11.5px; line-height: 1.8; color: #78350f; white-space: pre-wrap;
      }
      .plan-doc .analysis h3 { margin: 0 0 6px; color: #92400e; font-size: 12.5px; }
    </style>
    <div class="plan-doc">
      <div class="header">
        <img src="${BRAND_LOGO_DATA_URI}" alt="شعار اللجنة" />
        <div style="flex:1; min-width:0;">
          <div class="meta">لجنة الزواج الجماعي للعائلة</div>
          <h1>${escapeHtml(title)}</h1>
          <h2>${escapeHtml(committeeName)}</h2>
        </div>
      </div>
      <div class="content">${bodyHtml}</div>
      <div class="footer">
        <span>وثيقة موحّدة للخطط التشغيلية</span>
        <span>${new Date().toLocaleDateString("ar-SA")}</span>
      </div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

function blocksToHtml(blocks: Block[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.kind === "hr") parts.push("<hr/>");
    else if (b.kind === "h1") parts.push(`<h1>${escapeHtml(b.text)}</h1>`);
    else if (b.kind === "h2") parts.push(`<h2>${escapeHtml(b.text)}</h2>`);
    else if (b.kind === "h3") parts.push(`<h3>${escapeHtml(b.text)}</h3>`);
    else if (b.kind === "ul")
      parts.push(`<ul>${b.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`);
    else if (b.kind === "ol")
      parts.push(`<ol>${b.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ol>`);
    else if (b.kind === "p") parts.push(`<p>${escapeHtml(b.text)}</p>`);
  }
  return parts.join("\n");
}

export function UnifiedPlanView({ title, committeeName, content, analysisText, hidePrint }: Props) {
  const blocks = useMemo(() => parseMarkdown(content), [content]);

  const handlePrint = async () => {
    let body = blocksToHtml(blocks);
    if (analysisText && analysisText.trim()) {
      body += `<div class="analysis"><h3>التحليل الذكي</h3>${escapeHtml(analysisText.trim())}</div>`;
    }
    await printHtmlDocument(buildPrintHtml({ title, committeeName, bodyHtml: body }), title);
  };

  return (
    <div className="space-y-4">
      {!hidePrint && (
        <div className="flex justify-end">
          <Button onClick={handlePrint} variant="outline" className="gap-2 rounded-xl">
            <Printer className="h-4 w-4" /> طباعة / PDF
          </Button>
        </div>
      )}
      <article className="relative mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Branded header */}
        <header className="relative px-6 pt-6 pb-5 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white overflow-hidden">
          <DotsPattern className="absolute inset-0 text-primary/15" fade="bl" cols={16} rows={5} radius={4} />
          <div className="relative flex items-center gap-4">
            <img src={BRAND_LOGO_DATA_URI} alt="شعار اللجنة" className="h-16 w-16 object-contain drop-shadow-sm shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-slate-500 tracking-wide">
                لجنة الزواج الجماعي للعائلة
              </p>
              <h1 className="text-xl font-extrabold text-slate-900 mt-0.5 leading-tight">{title}</h1>
              <p className="text-[12px] text-primary font-semibold mt-1">{committeeName}</p>
            </div>
          </div>
        </header>

        <div className="px-6 sm:px-8 py-6 bg-white">
          {renderBlocks(blocks)}

          {analysisText && analysisText.trim() && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
              <p className="text-[12px] font-bold text-amber-900 mb-2">التحليل الذكي</p>
              <pre className="whitespace-pre-wrap text-[12px] leading-7 text-amber-900 font-sans">
                {analysisText.trim()}
              </pre>
            </div>
          )}
        </div>

        <footer className="px-6 py-3 border-t border-dashed border-slate-200 bg-slate-50/50 flex items-center justify-between text-[10px] text-slate-400">
          <span>وثيقة موحّدة للخطط التشغيلية</span>
          <span>{new Date().toLocaleDateString("ar-SA")}</span>
        </footer>
      </article>
    </div>
  );
}

/** Helper: split a stored plan description back into raw content + analysis. */
export function splitPlanDescription(description: string | null | undefined): {
  content: string;
  analysis: string | null;
} {
  if (!description) return { content: "", analysis: null };
  const text = description.replace(/^\ufeff/, "");
  const contentMatch = /—\s*محتوى الخطة\s*—\s*([\s\S]*?)(?:\n\s*—\s*التحليل الذكي\s*—|$)/.exec(text);
  const analysisMatch = /—\s*التحليل الذكي\s*—\s*([\s\S]*)$/.exec(text);
  const content = (contentMatch?.[1] ?? text).trim();
  const analysis = analysisMatch ? analysisMatch[1].trim() : null;
  return { content, analysis };
}