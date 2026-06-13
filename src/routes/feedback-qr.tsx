import { createFileRoute } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import weddingLogo from "@/assets/wedding-logo.png.asset.json";

const FEEDBACK_URL = "https://www.lajnat-zawaj.org/wedding-feedback";
const BRAND_GOLD = "#C9A24C";
const BRAND_TEAL = "#0E7C6B";

export const Route = createFileRoute("/feedback-qr")({
  component: FeedbackQrPage,
  head: () => ({
    meta: [
      { title: "باركود الاستبيان | الزواج الجماعي" },
      { name: "description", content: "امسح الباركود للمشاركة في الاستبيان" },
    ],
  }),
});

function FeedbackQrPage() {
  return (
    <div
      dir="rtl"
      className="min-h-screen flex items-center justify-center p-6 print:p-0"
      style={{ background: "transparent" }}
    >
      <div className="flex flex-col items-center gap-6 max-w-md w-full">
        <img
          src={weddingLogo.url}
          alt="شعار الزواج الجماعي"
          className="h-16 w-auto opacity-90"
        />

        <div
          className="relative rounded-3xl p-6 bg-transparent"
          style={{
            border: `2px solid ${BRAND_GOLD}`,
            boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
          }}
        >
          {/* Corner brackets */}
          {[
            "top-2 right-2 border-t-4 border-r-4 rounded-tr-xl",
            "top-2 left-2 border-t-4 border-l-4 rounded-tl-xl",
            "bottom-2 right-2 border-b-4 border-r-4 rounded-br-xl",
            "bottom-2 left-2 border-b-4 border-l-4 rounded-bl-xl",
          ].map((c, i) => (
            <span
              key={i}
              className={`absolute w-6 h-6 ${c}`}
              style={{ borderColor: BRAND_TEAL }}
            />
          ))}

          <div className="relative">
            <QRCodeSVG
              value={FEEDBACK_URL}
              size={260}
              level="H"
              bgColor="transparent"
              fgColor={BRAND_TEAL}
              imageSettings={{
                src: weddingLogo.url,
                height: 56,
                width: 56,
                excavate: true,
              }}
            />
          </div>
        </div>

        <div className="text-center space-y-2">
          <p
            className="text-2xl font-bold tracking-wide"
            style={{ color: BRAND_TEAL }}
          >
            رأيك يهمّنا
          </p>
          <p className="text-sm" style={{ color: BRAND_GOLD }}>
            امسح الباركود للمشاركة في الاستبيان
          </p>
        </div>
      </div>
    </div>
  );
}