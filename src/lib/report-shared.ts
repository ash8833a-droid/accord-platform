// Shared helpers + design tokens for institutional PDF reports.
// "Decision-Ready" executive document standard for لجنة الزواج الجماعي.

export const REPORT_TOKENS = {
  PRIMARY: "#0D7C66",      // Deep Teal
  PRIMARY_DARK: "#0a6655",
  GOLD: "#D4A95E",         // Warning / accent
  AMBER: "#D97706",
  RED: "#B91C1C",
  TEAL: "#0D7C66",
  SLATE_900: "#0F172A",
  SLATE_700: "#334155",
  SLATE_500: "#64748B",
  SLATE_300: "#CBD5E1",
  SLATE_200: "#E2E8F0",
  SLATE_100: "#F1F5F9",
};

export function buildReferenceNumber(prefix: string = "RPT"): string {
  const d = new Date();
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${prefix}-${y}-${mm}${dd}-${hh}${mi}`;
}

export function fmtArDate(d: Date = new Date()): string {
  return d.toLocaleDateString("ar-SA-u-ca-gregory", {
    year: "numeric", month: "long", day: "numeric",
  });
}

export function watermarkCss(text: string = "وثيقة رسمية · لجنة الزواج الجماعي"): string {
  // Diagonal repeating watermark — faint, anti-tamper feel, print-safe.
  const t = encodeURIComponent(text);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='560' height='560'>` +
      `<g transform='rotate(-30 280 280)' fill='%230D7C66' fill-opacity='0.05' ` +
        `font-family='Segoe UI, Tahoma, Arial, sans-serif' font-size='22' font-weight='700'>` +
        `<text x='40' y='160'>${t}</text>` +
        `<text x='40' y='320'>${t}</text>` +
        `<text x='40' y='480'>${t}</text>` +
      `</g>` +
    `</svg>`;
  return `url("data:image/svg+xml;utf8,${svg}")`;
}

export const SHARED_PRINT_CSS = `
  @page { size: A4 portrait; margin: 14mm 12mm 16mm; }
  @media print { html, body { margin:0; background:#fff; } }
  .doc {
    font-family: 'Tajawal','Noto Naskh Arabic','Segoe UI','Tahoma',sans-serif;
    color:${REPORT_TOKENS.SLATE_900};
    background:#fff;
    direction: rtl;
    position: relative;
    padding: 8px 4px;
    line-height: 1.6;
  }
  .doc * { box-sizing: border-box; }
  .wm {
    position: fixed;
    inset: 0;
    background-repeat: repeat;
    pointer-events: none;
    z-index: 0;
  }
  .doc > * { position: relative; z-index: 1; }

  .hdr {
    display:flex; align-items:center; gap:16px;
    background: linear-gradient(135deg, ${REPORT_TOKENS.PRIMARY}08, transparent 70%);
    border-bottom: 2px solid ${REPORT_TOKENS.PRIMARY};
    border-radius: 10px 10px 0 0;
    padding: 14px 14px 14px; margin-bottom: 18px;
  }
  .hdr .logo { width: 72px; height: 72px; object-fit: contain;
    background: transparent; border: 0; padding: 0; box-shadow: none; }
  .hdr .titles { flex:1; }
  .hdr .kicker {
    margin:0; font-size:10px; font-weight:700; letter-spacing:1px;
    color:${REPORT_TOKENS.PRIMARY};
  }
  .hdr h1 { margin:6px 0 4px; font-size:21px; font-weight:800; color:${REPORT_TOKENS.PRIMARY_DARK}; letter-spacing:-0.2px; }
  .hdr .meta { margin:0; font-size:11px; color:${REPORT_TOKENS.SLATE_500}; }
  .hdr .ref {
    text-align:center; font-size:10px; color:${REPORT_TOKENS.SLATE_700};
    border:1px solid ${REPORT_TOKENS.PRIMARY}33; border-radius:10px; padding:9px 12px;
    background:#fff; min-width:160px;
    box-shadow: 0 1px 3px rgba(15,23,42,0.04);
  }
  .hdr .ref b { color:${REPORT_TOKENS.PRIMARY}; display:block; font-size:11px; margin-top:2px; }

  .pillar {
    background:#fff;
    border:1px solid ${REPORT_TOKENS.SLATE_200};
    border-right: 4px solid ${REPORT_TOKENS.PRIMARY};
    border-radius: 10px;
    padding: 16px 18px;
    margin: 0 0 14px;
    box-shadow: 0 1px 2px rgba(15,23,42,0.03);
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .pillar.warn { border-right-color: ${REPORT_TOKENS.GOLD}; }
  .pillar.crit { border-right-color: ${REPORT_TOKENS.RED}; }

  .pillar-head { display:flex; align-items:flex-start; gap:10px; margin-bottom:10px;
    padding-bottom:8px; border-bottom:1px solid ${REPORT_TOKENS.SLATE_100}; }
  .pillar-num { font-size:20px; font-weight:800; color:${REPORT_TOKENS.PRIMARY}; min-width:30px; }
  .pillar.warn .pillar-num { color:${REPORT_TOKENS.GOLD}; }
  .pillar.crit .pillar-num { color:${REPORT_TOKENS.RED}; }
  .pillar-title { flex:1; }
  .pillar-title h3 { margin:0; font-size:15px; font-weight:800; color:${REPORT_TOKENS.SLATE_900}; }
  .pillar-title p { margin:2px 0 0; font-size:11px; color:${REPORT_TOKENS.SLATE_500}; }
  .badge { font-size:11px; font-weight:700; padding:3px 10px; border-radius:999px;
    background:${REPORT_TOKENS.PRIMARY}14; color:${REPORT_TOKENS.PRIMARY};
    border:1px solid ${REPORT_TOKENS.PRIMARY}33; }

  .progress { width:100%; height:10px; background:${REPORT_TOKENS.SLATE_100};
    border-radius:999px; overflow:hidden; }
  .progress > span { display:block; height:100%; background:${REPORT_TOKENS.PRIMARY}; border-radius:999px; }

  table { width:100%; border-collapse: collapse; font-size:11px; border-radius:8px; overflow:hidden; }
  thead th { background:${REPORT_TOKENS.PRIMARY}; color:#fff; padding:9px 10px;
    border:1px solid ${REPORT_TOKENS.PRIMARY}; font-weight:700; text-align:right; font-size:11.5px; }
  tbody td { padding:8px 10px; border:1px solid ${REPORT_TOKENS.SLATE_200}; text-align:right;
    color:${REPORT_TOKENS.SLATE_700}; }
  tbody tr:nth-child(even) td { background:#F8FAFB; }
  tbody tr:hover td { background:${REPORT_TOKENS.PRIMARY}08; }
  tbody tr { page-break-inside: avoid; }

  .item-list { list-style:none; padding:0; margin:0; }
  .item-list li { display:flex; gap:10px; padding:7px 0;
    border-bottom: 1px solid ${REPORT_TOKENS.SLATE_100}; page-break-inside: avoid; }
  .item-list li:last-child { border-bottom:none; }
  .dot { width:7px; height:7px; border-radius:50%; margin-top:6px; flex-shrink:0;
    background:${REPORT_TOKENS.PRIMARY}; }
  .pillar.warn .dot { background:${REPORT_TOKENS.GOLD}; }
  .pillar.crit .dot { background:${REPORT_TOKENS.RED}; }
  .item-name { font-size:12px; font-weight:700; color:${REPORT_TOKENS.SLATE_900}; }
  .item-detail { font-size:10.5px; color:${REPORT_TOKENS.SLATE_700}; margin-top:2px; line-height:1.55; }
  .empty { color:${REPORT_TOKENS.SLATE_500}; font-size:11px; padding:6px 0; margin:0; }

  .signature { display:flex; gap:32px; margin-top:18px; padding-top:12px;
    border-top:1px dashed ${REPORT_TOKENS.SLATE_300}; page-break-inside: avoid; }
  .sig-block { flex:1; }
  .sig-label { font-size:11px; color:${REPORT_TOKENS.SLATE_500}; margin-bottom:30px; }
  .sig-line { font-size:11px; color:${REPORT_TOKENS.SLATE_700};
    border-top:1px solid ${REPORT_TOKENS.SLATE_300}; padding-top:6px; }

  .doc-footer { margin-top:14px; text-align:center; color:#94A3B8; font-size:10px; }
`;
