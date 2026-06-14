import { AbsoluteFill, useCurrentFrame } from "remotion";
import { THEME } from "../theme";

export const Background: React.FC<{ accent?: "gold" | "teal" }> = ({ accent = "gold" }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 80) * 30;
  const drift2 = Math.cos(frame / 110) * 40;
  const c = accent === "gold" ? THEME.gold : THEME.teal;
  return (
    <AbsoluteFill style={{ background: THEME.bg, overflow: "hidden" }}>
      {/* radial vignettes */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(1000px 700px at ${50 + drift / 8}% ${30 + drift2 / 20}%, ${c}22, transparent 70%), radial-gradient(900px 600px at ${20 - drift / 10}% ${80 + drift / 30}%, ${THEME.tealDeep}33, transparent 65%)`,
        }}
      />
      {/* grid */}
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.08 }}>
        <defs>
          <pattern id="g" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke={THEME.gold} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#g)" />
      </svg>
      {/* floating particles */}
      {Array.from({ length: 18 }).map((_, i) => {
        const x = (i * 137) % 1920;
        const y = ((i * 211) % 1080) + Math.sin((frame + i * 30) / 40) * 25;
        const s = 2 + (i % 4);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: s,
              height: s,
              borderRadius: 999,
              background: i % 3 === 0 ? THEME.gold : THEME.teal,
              opacity: 0.45,
              boxShadow: `0 0 ${s * 4}px ${i % 3 === 0 ? THEME.gold : THEME.teal}`,
            }}
          />
        );
      })}
      {/* corner ornaments */}
      <CornerOrnament corner="tl" />
      <CornerOrnament corner="tr" />
      <CornerOrnament corner="bl" />
      <CornerOrnament corner="br" />
    </AbsoluteFill>
  );
};

const CornerOrnament: React.FC<{ corner: "tl" | "tr" | "bl" | "br" }> = ({ corner }) => {
  const pos: Record<string, React.CSSProperties> = {
    tl: { top: 40, left: 40 },
    tr: { top: 40, right: 40, transform: "scaleX(-1)" },
    bl: { bottom: 40, left: 40, transform: "scaleY(-1)" },
    br: { bottom: 40, right: 40, transform: "scale(-1,-1)" },
  };
  return (
    <svg width="120" height="120" style={{ position: "absolute", ...pos[corner], opacity: 0.55 }} viewBox="0 0 120 120">
      <path d="M 10 50 L 10 10 L 50 10" stroke={THEME.gold} strokeWidth="1.5" fill="none" />
      <circle cx="10" cy="10" r="3" fill={THEME.gold} />
      <path d="M 20 20 L 35 20 M 20 20 L 20 35" stroke={THEME.gold} strokeWidth="1" opacity="0.6" fill="none" />
    </svg>
  );
};