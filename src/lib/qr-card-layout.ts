// نموذج تخطيط بطاقة الباركود (مستقل عن المتصفح) — يُستخدم في الرسم على Canvas
// وفي اختبارات عدم تداخل النصوص. يعتمد متوسط عرض حرف لتقدير عرض النصوص.

export type Rect = { x: number; y: number; w: number; h: number; id: string };

export type QrCardTexts = {
  title: string;
  subtitle: string;
  caption: string;
  subcaption: string;
  footer: string;
};

export const DEFAULT_TEXTS: QrCardTexts = {
  title: "لجنة الزواج الجماعي",
  subtitle: "الحفل الثاني عشر — 1448هـ",
  caption: "رأيك يهمّنا",
  subcaption: "امسح الباركود للمشاركة في الاستبيان",
  footer: "lajnat-zawaj.org",
};

export type LayoutSpec = {
  W: number;
  H: number;
  scale: number; // مضاعِف عام لأحجام الخطوط (لاختبار حالات متعددة)
};

// متوسط نسبة عرض الحرف للارتفاع (محافظ — يبالغ في تقدير العرض لضمان عدم التداخل).
const AVG_CHAR_W_RATIO = 0.62;
// ارتفاع السطر (Line-height) كعامل ضرب للحجم.
const LINE_H_RATIO = 1.35;

const measure = (text: string, fontPx: number) => {
  const w = Math.min(
    text.length * fontPx * AVG_CHAR_W_RATIO,
    Number.MAX_SAFE_INTEGER,
  );
  return { w, h: fontPx * LINE_H_RATIO };
};

const centeredRect = (
  id: string,
  cx: number,
  yTop: number,
  text: string,
  fontPx: number,
): Rect => {
  const { w, h } = measure(text, fontPx);
  return { id, x: cx - w / 2, y: yTop, w, h };
};

export function computeQrCardLayout(
  spec: LayoutSpec,
  texts: QrCardTexts = DEFAULT_TEXTS,
) {
  const { W, H, scale } = spec;
  const cx = W / 2;

  // الشعار
  const logoW = 260;
  const logoH = 130;
  const logoY = 120;
  const logo: Rect = {
    id: "logo",
    x: cx - logoW / 2,
    y: logoY,
    w: logoW,
    h: logoH,
  };

  // العنوان والعنوان الفرعي
  const titleFs = 52 * scale;
  const subFs = 30 * scale;
  const titleY = logoY + logoH + 40;
  const title = centeredRect("title", cx, titleY, texts.title, titleFs);
  const subtitleY = title.y + title.h + 8;
  const subtitle = centeredRect(
    "subtitle",
    cx,
    subtitleY,
    texts.subtitle,
    subFs,
  );

  // فاصل
  const dividerY = subtitle.y + subtitle.h + 18;
  const divider: Rect = {
    id: "divider",
    x: cx - 220,
    y: dividerY - 6,
    w: 440,
    h: 12,
  };

  // التعليقات أسفل الباركود
  const captionFs = 76 * scale;
  const subcapFs = 26 * scale;
  const footerFs = 18 * scale;
  const captionGap = 70;
  const subcapGap = 24;
  const footerBottomMargin = 50;

  // ارتفاع المحتوى أسفل لوحة الباركود
  const belowPlateH =
    captionGap +
    captionFs * LINE_H_RATIO +
    subcapGap +
    subcapFs * LINE_H_RATIO +
    30 +
    footerFs * LINE_H_RATIO +
    footerBottomMargin;

  // المساحة المتاحة للوحة الباركود (مع هامش 30 من الأطراف)
  const pad = 36;
  const plateTop = divider.y + divider.h + 30;
  const availableForPlate = H - plateTop - belowPlateH - 30;
  const qrSize = Math.max(
    360,
    Math.min(760, Math.floor(availableForPlate - pad * 2)),
  );
  const qrPlate: Rect = {
    id: "qrPlate",
    x: cx - qrSize / 2 - pad,
    y: plateTop,
    w: qrSize + pad * 2,
    h: qrSize + pad * 2,
  };

  const caption = centeredRect(
    "caption",
    cx,
    qrPlate.y + qrPlate.h + captionGap,
    texts.caption,
    captionFs,
  );
  const subcaption = centeredRect(
    "subcaption",
    cx,
    caption.y + caption.h + subcapGap,
    texts.subcaption,
    subcapFs,
  );
  const footer = centeredRect(
    "footer",
    cx,
    subcaption.y + subcaption.h + 30,
    texts.footer,
    footerFs,
  );

  return {
    cx,
    qrX: cx - qrSize / 2,
    qrY: qrPlate.y + pad,
    qrSize,
    plate: qrPlate,
    pad,
    rects: [logo, title, subtitle, divider, qrPlate, caption, subcaption, footer],
    fonts: {
      title: titleFs,
      subtitle: subFs,
      caption: captionFs,
      subcaption: subcapFs,
      footer: footerFs,
    },
  };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
}

export function findOverlaps(rects: Rect[]): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (rectsOverlap(rects[i], rects[j])) {
        out.push([rects[i].id, rects[j].id]);
      }
    }
  }
  return out;
}
