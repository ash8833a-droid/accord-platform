function waitForFrameAssets(doc: Document): Promise<void> {
  const imagePromises = Array.from(doc.images).map(
    (img) =>
      new Promise<void>((resolve) => {
        if (img.complete) return resolve();
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      }),
  );

  const fontsReady = "fonts" in doc ? (doc as any).fonts.ready.catch(() => undefined) : Promise.resolve();
  return Promise.race([
    Promise.all([...imagePromises, fontsReady]).then(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, 2500)),
  ]);
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function printHtmlDocument(html: string, title: string): Promise<void> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;";

  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;

  if (!doc || !win) {
    iframe.remove();
    throw new Error("تعذر تجهيز نافذة الطباعة");
  }

  // Keep the print document title ASCII-only and remove browser print margins.
  // This prevents the browser from adding URL-encoded Arabic headers like
  // %D8%... above the official report content.
  const asciiTitle = "Report";
  doc.open();
  doc.write(
    `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">` +
    `<title>${asciiTitle}</title>` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<link rel="preconnect" href="https://fonts.googleapis.com">` +
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
    `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Tajawal:wght@300;400;500;700;800&display=swap">` +
    `<style>
      /* Unified print setup: A4 portrait, RTL, Arabic fonts, fixed margins */
      @page { size: A4 portrait; margin: 0; }
      html, body {
        margin: 0;
        background: #fff;
        direction: rtl;
        font-family: 'Tajawal', 'Noto Naskh Arabic', 'Segoe UI', Tahoma, Arial, sans-serif;
        font-feature-settings: "kern" 1, "liga" 1, "calt" 1;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
        color: #1f2937;
      }
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        color-adjust: exact;
      }
      img { max-width: 100%; }
      .lovable-print-safe-area {
        padding: 14mm 12mm 16mm;
        box-sizing: border-box;
        direction: rtl;
      }
      @media print {
        html, body { margin: 0 !important; background: #fff !important; }
        .lovable-print-safe-area { padding: 14mm 12mm 16mm !important; }
      }
    </style>` +
    `</head><body data-doc-title="${escapeAttr(title)}"><main class="lovable-print-safe-area">${html}</main></body></html>`,
  );
  doc.close();
  doc.title = asciiTitle;

  const finalPrintOverride = doc.createElement("style");
  finalPrintOverride.textContent = `
    @page { size: A4 portrait; margin: 0; }
    @media print {
      html, body { margin: 0 !important; background: #fff !important; }
      .lovable-print-safe-area { padding: 14mm 12mm 16mm !important; }
    }
  `;
  doc.head.appendChild(finalPrintOverride);

  await waitForFrameAssets(doc);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  win.focus();
  win.print();

  window.setTimeout(() => iframe.remove(), 1500);
}