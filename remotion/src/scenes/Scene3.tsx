import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { Background } from "../components/Background";
import { Phone } from "../components/Phone";
import { THEME } from "../theme";
import { tajawal, amiri } from "../fonts";

export const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const burst = spring({ frame: frame - 60, fps, config: { damping: 12, stiffness: 90 } });
  const ringR = interpolate(burst, [0, 1], [0, 700]);
  const ringO = interpolate(burst, [0, 0.6, 1], [0, 0.5, 0]);
  return (
    <AbsoluteFill>
      <Background accent="gold" />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", direction: "rtl" }}>
        {/* ring burst behind phone */}
        <div style={{ position: "absolute", width: ringR, height: ringR, borderRadius: 999, border: `2px solid ${THEME.gold}`, opacity: ringO }} />
        <div style={{ position: "absolute", width: ringR * 0.6, height: ringR * 0.6, borderRadius: 999, border: `1px solid ${THEME.teal}`, opacity: ringO }} />

        <div style={{ display: "flex", alignItems: "center", gap: 120 }}>
          <div style={{ textAlign: "right", maxWidth: 700 }}>
            <div
              style={{
                fontFamily: tajawal,
                fontSize: 18,
                color: THEME.gold,
                letterSpacing: 8,
                opacity: interpolate(frame, [10, 40], [0, 1], { extrapolateRight: "clamp" }),
              }}
            >
              لحظة الإطلاق
            </div>
            <h1
              style={{
                fontFamily: amiri,
                fontSize: 96,
                color: THEME.ink,
                lineHeight: 1.2,
                margin: "20px 0 0",
                opacity: interpolate(frame, [25, 65], [0, 1], { extrapolateRight: "clamp" }),
                transform: `translateX(${interpolate(frame, [25, 65], [40, 0], { extrapolateRight: "clamp" })}px)`,
              }}
            >
              تدشين <br />
              <span style={{ color: THEME.gold }}>المنصة الرقمية</span> <br />
              للمشروع
            </h1>
            <div
              style={{
                marginTop: 32,
                fontFamily: tajawal,
                fontSize: 22,
                color: THEME.inkDim,
                opacity: interpolate(frame, [100, 140], [0, 1], { extrapolateRight: "clamp" }),
              }}
            >
              واليوم، نُعلن عن انطلاق منصةٍ تليق بالمسيرة
            </div>
          </div>
          <Phone screen="home" delay={50} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};