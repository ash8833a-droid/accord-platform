import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { Background } from "../components/Background";
import { THEME } from "../theme";
import { tajawal, amiri } from "../fonts";

export const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lineW = interpolate(frame, [10, 50], [0, 600], { extrapolateRight: "clamp" });
  const titleY = spring({ frame: frame - 20, fps, config: { damping: 18 } });
  const subY = spring({ frame: frame - 50, fps, config: { damping: 20 } });
  const fade = interpolate(frame, [280, 340], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Background accent="gold" />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", direction: "rtl" }}>
        <div style={{ textAlign: "center", padding: 60 }}>
          <div
            style={{
              fontFamily: tajawal,
              fontSize: 16,
              letterSpacing: 12,
              color: THEME.gold,
              opacity: interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" }),
              marginBottom: 24,
            }}
          >
            ت ـ د ش ـ ي ـ ن
          </div>
          <div style={{ height: 1, width: lineW, background: `linear-gradient(90deg, transparent, ${THEME.gold}, transparent)`, margin: "0 auto 40px" }} />
          <h1
            style={{
              fontFamily: amiri,
              fontSize: 110,
              fontWeight: 700,
              color: THEME.ink,
              lineHeight: 1.15,
              margin: 0,
              transform: `translateY(${interpolate(titleY, [0, 1], [40, 0])}px)`,
              opacity: titleY,
            }}
          >
            من <span style={{ color: THEME.gold }}>الإنجاز</span>
          </h1>
          <h1
            style={{
              fontFamily: amiri,
              fontSize: 110,
              fontWeight: 700,
              color: THEME.ink,
              lineHeight: 1.15,
              margin: "12px 0 0",
              transform: `translateY(${interpolate(subY, [0, 1], [40, 0])}px)`,
              opacity: subY,
            }}
          >
            إلى <span style={{ color: THEME.teal }}>التوثيق الرقمي</span>
          </h1>
          <div
            style={{
              marginTop: 50,
              fontFamily: tajawal,
              fontSize: 24,
              color: THEME.inkDim,
              opacity: interpolate(frame, [90, 130], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" }),
            }}
          >
            لكل إنجاز قصة… ولكل أثر نافذة تُظهره للجميع
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};