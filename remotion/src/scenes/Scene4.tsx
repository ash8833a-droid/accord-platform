import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Sequence } from "remotion";
import { Background } from "../components/Background";
import { Phone } from "../components/Phone";
import { THEME } from "../theme";
import { tajawal, amiri } from "../fonts";

const SECTIONS = ["الإنجازات", "الأثر المجتمعي", "مراحل العمل", "المؤشرات والأرقام"] as const;
const SCREENS = ["achievements", "impact", "stages", "metrics"] as const;
const SEG = 110;

export const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Background accent="teal" />
      <AbsoluteFill style={{ direction: "rtl", padding: "80px 100px", flexDirection: "column" }}>
        <div
          style={{
            fontFamily: amiri,
            fontSize: 64,
            color: THEME.ink,
            opacity: interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" }),
            textAlign: "center",
          }}
        >
          استكشف <span style={{ color: THEME.gold }}>المنصة</span>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 100, marginTop: 20 }}>
          {/* phone with switching screens */}
          <div style={{ position: "relative", width: 360, height: 740 }}>
            {SCREENS.map((s, i) => {
              const start = 40 + i * SEG;
              const local = frame - start;
              const visible = local >= 0 && local < SEG + 20;
              if (!visible) return null;
              const o = interpolate(local, [0, 18, SEG - 10, SEG + 10], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <div key={i} style={{ position: "absolute", inset: 0, opacity: o }}>
                  <Sequence from={start}>
                    <Phone screen={s} delay={0} />
                  </Sequence>
                </div>
              );
            })}
          </div>

          {/* labels list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {SECTIONS.map((t, i) => {
              const start = 40 + i * SEG;
              const active = frame >= start && frame < start + SEG;
              const enter = interpolate(frame, [start - 10, start + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 20,
                    opacity: 0.35 + enter * 0.65,
                    transform: `translateX(${(1 - enter) * 40}px)`,
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      background: active ? THEME.gold : "transparent",
                      border: `2px solid ${THEME.gold}`,
                      boxShadow: active ? `0 0 20px ${THEME.gold}` : "none",
                    }}
                  />
                  <div style={{ fontFamily: tajawal, fontSize: 38, fontWeight: active ? 900 : 500, color: active ? THEME.ink : THEME.inkDim }}>
                    {t}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};