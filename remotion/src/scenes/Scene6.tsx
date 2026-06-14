import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { Background } from "../components/Background";
import { THEME } from "../theme";
import { tajawal, amiri } from "../fonts";

export const Scene6: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 14 } });
  const ring = interpolate(frame, [0, 120], [0, 360]);
  const shimmer = interpolate(frame, [40, 200], [-200, 600]);
  const fadeOut = interpolate(frame, [260, 330], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <Background accent="gold" />
      <AbsoluteFill style={{ direction: "rtl", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <div style={{ position: "relative", width: 220, height: 220, marginBottom: 40, opacity: logo, transform: `scale(${0.6 + logo * 0.4})` }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: 999, border: `2px solid ${THEME.gold}`, transform: `rotate(${ring}deg)`, borderTopColor: "transparent" }} />
          <div style={{ position: "absolute", inset: 18, borderRadius: 999, border: `1px solid ${THEME.teal}`, transform: `rotate(${-ring}deg)`, borderBottomColor: "transparent" }} />
          <div
            style={{
              position: "absolute",
              inset: 40,
              borderRadius: 999,
              background: `linear-gradient(135deg, ${THEME.gold}, ${THEME.teal})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: amiri,
              fontSize: 72,
              fontWeight: 900,
              color: "#07111A",
              boxShadow: `0 0 60px ${THEME.gold}66`,
            }}
          >
            م
          </div>
        </div>
        <h1
          style={{
            fontFamily: amiri,
            fontSize: 96,
            color: THEME.ink,
            margin: 0,
            textAlign: "center",
            lineHeight: 1.2,
            opacity: interpolate(frame, [20, 60], [0, 1], { extrapolateRight: "clamp" }),
            position: "relative",
          }}
        >
          الآن… أصبح للمشروع <span style={{ color: THEME.gold }}>منصّة</span>
        </h1>
        <div
          style={{
            fontFamily: tajawal,
            fontSize: 32,
            color: THEME.inkDim,
            marginTop: 24,
            opacity: interpolate(frame, [60, 100], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          تُوثّق الإنجاز <span style={{ color: THEME.teal }}>·</span> وتُبرز الأثر
        </div>
        <div style={{ marginTop: 50, width: 500, height: 1, background: THEME.line, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -2, left: shimmer, width: 200, height: 4, background: `linear-gradient(90deg, transparent, ${THEME.gold}, transparent)` }} />
        </div>
        <div
          style={{
            marginTop: 40,
            fontFamily: tajawal,
            fontSize: 20,
            letterSpacing: 8,
            color: THEME.gold,
            opacity: interpolate(frame, [120, 160], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          أهلاً بكم في المنصة الرقمية
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};