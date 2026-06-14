import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { THEME } from "../theme";
import { tajawal } from "../fonts";

export const Phone: React.FC<{ screen: "home" | "achievements" | "impact" | "stages" | "metrics"; delay?: number }> = ({
  screen,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 110 } });
  const tilt = Math.sin(frame / 60) * 2;
  return (
    <div
      style={{
        width: 360,
        height: 740,
        borderRadius: 52,
        background: "linear-gradient(160deg, #1a2530, #07111A)",
        padding: 12,
        boxShadow: `0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px ${THEME.line}, 0 0 80px ${THEME.gold}22`,
        transform: `translateY(${interpolate(enter, [0, 1], [80, 0])}px) scale(${0.6 + enter * 0.4}) rotateZ(${tilt}deg) perspective(1200px) rotateY(-6deg)`,
        opacity: enter,
        transformOrigin: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 42,
          background: THEME.bg,
          overflow: "hidden",
          position: "relative",
          fontFamily: tajawal,
          direction: "rtl",
        }}
      >
        {/* notch */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: "50%",
            transform: "translateX(-50%)",
            width: 110,
            height: 26,
            background: "#000",
            borderRadius: 14,
            zIndex: 5,
          }}
        />
        <PhoneScreen screen={screen} frame={frame - delay} />
      </div>
    </div>
  );
};

const PhoneScreen: React.FC<{ screen: string; frame: number }> = ({ screen, frame }) => {
  const f = Math.max(0, frame);
  const reveal = (start: number) => interpolate(f, [start, start + 14], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  return (
    <div style={{ position: "absolute", inset: 0, padding: "60px 22px 22px", color: THEME.ink }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: THEME.inkDim, marginBottom: 22 }}>
        <span>9:41</span>
        <span>●●●● 5G</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, opacity: reveal(0) }}>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: `linear-gradient(135deg, ${THEME.gold}, ${THEME.teal})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#07111A" }}>م</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>المنصة الرقمية</div>
          <div style={{ fontSize: 9, color: THEME.inkDim }}>توثيق الإنجاز</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: THEME.gold, marginBottom: 8, opacity: reveal(8), fontWeight: 700 }}>
        {screen === "achievements" && "الإنجازات"}
        {screen === "impact" && "الأثر المجتمعي"}
        {screen === "stages" && "مراحل العمل"}
        {screen === "metrics" && "المؤشرات والأرقام"}
        {screen === "home" && "الرئيسية"}
      </div>
      {screen === "achievements" && <Achievements reveal={reveal} />}
      {screen === "impact" && <Impact reveal={reveal} />}
      {screen === "stages" && <Stages reveal={reveal} />}
      {screen === "metrics" && <Metrics reveal={reveal} frame={f} />}
      {screen === "home" && <Home reveal={reveal} />}
    </div>
  );
};

const Card: React.FC<{ children: React.ReactNode; o: number; mt?: number }> = ({ children, o, mt = 10 }) => (
  <div
    style={{
      background: "rgba(255,255,255,0.04)",
      border: `1px solid ${THEME.line}`,
      borderRadius: 14,
      padding: 12,
      marginTop: mt,
      opacity: o,
      transform: `translateY(${(1 - o) * 12}px)`,
    }}
  >
    {children}
  </div>
);

const Achievements: React.FC<{ reveal: (s: number) => number }> = ({ reveal }) => (
  <>
    {["إطلاق برنامج التطوير", "توسيع فرق العمل", "شراكات استراتيجية", "إصدار التقرير السنوي"].map((t, i) => (
      <Card key={i} o={reveal(14 + i * 8)}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{t}</span>
          <span style={{ width: 24, height: 24, borderRadius: 8, background: THEME.gold, color: "#07111A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 }}>✓</span>
        </div>
        <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 4, marginTop: 8, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${60 + i * 10}%`, background: `linear-gradient(90deg, ${THEME.teal}, ${THEME.gold})` }} />
        </div>
      </Card>
    ))}
  </>
);

const Impact: React.FC<{ reveal: (s: number) => number }> = ({ reveal }) => (
  <>
    {[
      { n: "+1,240", l: "مستفيد مباشر" },
      { n: "%87", l: "رضا المجتمع" },
      { n: "32", l: "مبادرة منفذة" },
    ].map((s, i) => (
      <Card key={i} o={reveal(14 + i * 10)}>
        <div style={{ fontSize: 22, fontWeight: 900, color: THEME.gold }}>{s.n}</div>
        <div style={{ fontSize: 11, color: THEME.inkDim, marginTop: 2 }}>{s.l}</div>
      </Card>
    ))}
  </>
);

const Stages: React.FC<{ reveal: (s: number) => number }> = ({ reveal }) => (
  <>
    {["التأسيس", "التخطيط", "التنفيذ", "التقييم", "النشر"].map((t, i) => (
      <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, opacity: reveal(14 + i * 7) }}>
        <div style={{ width: 26, height: 26, borderRadius: 999, border: `2px solid ${THEME.gold}`, color: THEME.gold, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{i + 1}</div>
        <div style={{ flex: 1, height: 1, background: THEME.line }} />
        <span style={{ fontSize: 12, fontWeight: 600 }}>{t}</span>
      </div>
    ))}
  </>
);

const Metrics: React.FC<{ reveal: (s: number) => number; frame: number }> = ({ reveal, frame }) => {
  const bars = [55, 78, 42, 88, 64, 73];
  return (
    <>
      <Card o={reveal(14)}>
        <div style={{ fontSize: 11, color: THEME.inkDim, marginBottom: 8 }}>الأداء الشهري</div>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 80 }}>
          {bars.map((b, i) => {
            const h = interpolate(frame, [20 + i * 3, 40 + i * 3], [0, b], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return <div key={i} style={{ flex: 1, height: `${h}%`, background: `linear-gradient(180deg, ${THEME.gold}, ${THEME.teal})`, borderRadius: 4 }} />;
          })}
        </div>
      </Card>
      <Card o={reveal(28)}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, color: THEME.inkDim }}>معدل الإنجاز</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: THEME.gold }}>92%</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: THEME.inkDim }}>النمو</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: THEME.teal }}>+24%</div>
          </div>
        </div>
      </Card>
    </>
  );
};

const Home: React.FC<{ reveal: (s: number) => number }> = ({ reveal }) => (
  <>
    {["الإنجازات", "الأثر المجتمعي", "مراحل العمل", "المؤشرات والأرقام"].map((t, i) => (
      <Card key={i} o={reveal(10 + i * 6)}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{t}</span>
          <span style={{ color: THEME.gold, fontSize: 16 }}>‹</span>
        </div>
      </Card>
    ))}
  </>
);