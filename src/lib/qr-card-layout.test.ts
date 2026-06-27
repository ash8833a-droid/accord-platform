import { describe, test, expect } from "bun:test";
import {
  computeQrCardLayout,
  findOverlaps,
  DEFAULT_TEXTS,
} from "./qr-card-layout";

/**
 * يضمن هذا الاختبار خلوّ بطاقة الباركود (QR) من تداخل النصوص
 * عبر مقاسات خط متعددة، سواء عند تصدير PNG أو الطباعة كـ PDF.
 */
describe("بطاقة الباركود — لا تداخل بين النصوص", () => {
  const sizes = [
    { name: "PNG كنفاس قياسي 1200×1600", W: 1200, H: 1600 },
    { name: "PDF A4 تقريبي 1240×1754", W: 1240, H: 1754 },
  ];
  const scales = [0.85, 1.0, 1.15, 1.3, 1.5];

  for (const s of sizes) {
    for (const scale of scales) {
      test(`${s.name} — مقاس خط ×${scale}`, () => {
        const layout = computeQrCardLayout({ W: s.W, H: s.H, scale });
        // نستثني لوحة الباركود لأنها مقصودة لتحوي رمز الـ QR.
        const textRects = layout.rects.filter((r) => r.id !== "qrPlate");
        const overlaps = findOverlaps(textRects);
        expect(overlaps).toEqual([]);
      });
    }
  }

  test("جميع العناصر تبقى داخل حدود البطاقة (هوامش ≥ 30px)", () => {
    const W = 1200;
    const H = 1600;
    const layout = computeQrCardLayout({ W, H, scale: 1.2 });
    for (const r of layout.rects) {
      expect(r.x).toBeGreaterThanOrEqual(30);
      expect(r.y).toBeGreaterThanOrEqual(30);
      expect(r.x + r.w).toBeLessThanOrEqual(W - 30);
      expect(r.y + r.h).toBeLessThanOrEqual(H - 30);
    }
  });

  test("لا تكرار لعبارة «الزواج الجماعي» أكثر من مرة واحدة في نصوص البطاقة", () => {
    const all = [
      DEFAULT_TEXTS.title,
      DEFAULT_TEXTS.subtitle,
      DEFAULT_TEXTS.caption,
      DEFAULT_TEXTS.subcaption,
      DEFAULT_TEXTS.footer,
    ].join(" | ");
    const matches = all.match(/الزواج الجماعي/g) ?? [];
    expect(matches.length).toBeLessThanOrEqual(1);
  });
});
