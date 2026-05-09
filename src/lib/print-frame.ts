function waitForFrameAssets(doc: Document): Promise<void> {
  const imagePromises = Array.from(doc.images).map(
    (img) =>
      new Promise<void>((resolve) => {
        if (img.complete) return resolve();
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      }),
  );

  const fontsReady = "fonts" in doc ? doc.fonts.ready.catch(() => undefined) : Promise.resolve();
  return Promise.race([
    Promise.all([...imagePromises, fontsReady]).then(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, 1200)),
  ]);
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

  doc.open();
  doc.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${title}</title></head><body>${html}</body></html>`);
  doc.close();

  await waitForFrameAssets(doc);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  win.focus();
  win.print();

  window.setTimeout(() => iframe.remove(), 1500);
}