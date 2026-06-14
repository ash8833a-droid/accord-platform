import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { Background } from "../components/Background";
import { THEME } from "../theme";
import { tajawal, amiri } from "../fonts";

const PILLARS = [
  { t: "العمل", i: "⚙" },
  { t: "الإنجاز", i: "★" },
  { t: "الأثر", i: "❖" },
];

export const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Background accent="teal" />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", direction: "rtl", flexDirection: "column" }}>
        <div
          style={{
            fontFamily: amiri,
            fontSize: 80,
            color: THEME.ink,
            opacity: interpolate(frame, [10, 50], [0, 1], { extrapolateRight: "clamp" }),
            transform: `translateY(${interpolate(frame, [10, 50], [30, 0], { extrapolateRight: "clamp" })}px)`,
            textAlign: "center",
          }}
        >
          رحلة من <span style={{ color: THEME.gold }}>العطاء</span>
        </div>
        <div style={{ display: "flex", gap: 60, marginTop: 80 }}>
          {PILLARS.map((p, i) => {
            const s = spring({ frame: frame - 60 - i * 18, fps, config: { damping: 14 } });
            return (
              <div
                key={i}
                style={{
                  width: 260,
                  height: 320,
                  borderRadius: 24,
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${THEME.line}`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 24,
                  opacity: s,
                  transform: `translateY(${(1 - s) * 60}px) scale(${0.85 + s * 0.15})`,
                  boxShadow: `0 30px 80px rgba(0,0,0,0.4), 0 0 60px ${THEME.gold}11`,
                }}
              >
                <div
                  style={{
                    width: 90,
                    height: 90,
                    borderRadius: 999,
                    border: `2px solid ${THEME.gold}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: THEME.gold,
                    fontSize: 42,
                  }}
                >
                  {p.i}
                </div>
                <div style={{ fontFamily: tajawal, fontSize: 32, fontWeight: 700, color: THEME.ink }}>{p.t}</div>
                <div style={{ width: 50, height: 2, background: THEME.gold }} />
              </div>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 70,
            fontFamily: tajawal,
            fontSize: 22,
            color: THEME.inkDim,
            opacity: interpolate(frame, [160, 200], [0, 1], { extrapolateRight: "clamp" }),
            maxWidth: 900,
            textAlign: "center",
          }}
        >
          على مدار رحلتنا، حقّق المشروع إنجازاتٍ تستحق أن تُعرض بصورةٍ تليق بها
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};