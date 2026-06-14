import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { Background } from "../components/Background";
import { THEME } from "../theme";
import { tajawal, amiri } from "../fonts";

const STATS = [
  { n: 1240, suffix: "+", l: "مستفيد" },
  { n: 87, suffix: "%", l: "رضا" },
  { n: 32, suffix: "", l: "مبادرة" },
  { n: 5, suffix: "", l: "أعوام عطاء" },
];

export const Scene5: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Background accent="gold" />
      <AbsoluteFill style={{ direction: "rtl", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <div
          style={{
            fontFamily: amiri,
            fontSize: 70,
            color: THEME.ink,
            opacity: interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" }),
            textAlign: "center",
            lineHeight: 1.3,
          }}
        >
          نافذة <span style={{ color: THEME.gold }}>رقمية</span> لمسيرة من
          <br />
          <span style={{ color: THEME.teal }}>العطاء والإنجاز</span>
        </div>
        <div style={{ display: "flex", gap: 50, marginTop: 80 }}>
          {STATS.map((s, i) => {
            const sp = spring({ frame: frame - 40 - i * 14, fps, config: { damping: 16 } });
            const count = Math.floor(interpolate(frame, [40 + i * 14, 100 + i * 14], [0, s.n], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
            return (
              <div
                key={i}
                style={{
                  width: 240,
                  padding: "32px 20px",
                  borderRadius: 20,
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${THEME.line}`,
                  textAlign: "center",
                  opacity: sp,
                  transform: `translateY(${(1 - sp) * 40}px)`,
                  boxShadow: `0 20px 60px rgba(0,0,0,0.35)`,
                }}
              >
                <div style={{ fontFamily: tajawal, fontSize: 64, fontWeight: 900, color: THEME.gold, lineHeight: 1 }}>
                  {count.toLocaleString("ar-EG")}
                  <span style={{ color: THEME.teal }}>{s.suffix}</span>
                </div>
                <div style={{ fontFamily: tajawal, fontSize: 20, color: THEME.inkDim, marginTop: 14 }}>{s.l}</div>
              </div>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 60,
            fontFamily: tajawal,
            fontSize: 22,
            color: THEME.inkDim,
            opacity: interpolate(frame, [200, 240], [0, 1], { extrapolateRight: "clamp" }),
            textAlign: "center",
          }}
        >
          مرجعٌ واضح لكل ما تحقّق… وخطوة جديدة نحو مزيدٍ من التأثير
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};