import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Img, Audio, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Tajawal";
import { loadFont as loadAmiri } from "@remotion/google-fonts/Amiri";

const { fontFamily: tajawal } = loadFont("normal", { weights: ["400", "500", "700", "800"], subsets: ["arabic"] });
const { fontFamily: amiri } = loadAmiri("normal", { weights: ["400", "700"], subsets: ["arabic"] });

const GREEN = "#0F3D2E";
const GOLD = "#B8902F";
const GOLD_SOFT = "#D4AF55";
const INK = "#0E2A22";
const PAPER = "#FBF7EE";
const PAPER_DEEP = "#F1E9D4";

const FPS = 30;
const SCENE = 12 * FPS; // 360
const SCENES = 5;
export const INTRO_TOTAL_FRAMES = SCENE * SCENES; // 1800 = 60s

const Backdrop: React.FC = () => {
  const f = useCurrentFrame();
  const drift = Math.sin(f / 60) * 6;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% ${50 + drift}%, ${PAPER} 0%, ${PAPER_DEEP} 100%)` }}>
      <AbsoluteFill style={{ opacity: 0.18, background: `radial-gradient(circle at 18% 24%, ${GOLD_SOFT} 0%, transparent 30%), radial-gradient(circle at 82% 78%, ${GOLD_SOFT} 0%, transparent 32%)` }} />
      <AbsoluteFill style={{ opacity: 0.15, backgroundImage: `radial-gradient(${GOLD}55 1px, transparent 1px)`, backgroundSize: "28px 28px" }} />
      <AbsoluteFill style={{ boxShadow: `inset 0 0 220px ${PAPER_DEEP}` }} />
    </AbsoluteFill>
  );
};

const Header: React.FC = () => (
  <div style={{ position: "absolute", top: 40, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 18, zIndex: 5 }}>
    <Img src={staticFile("images/wedding-logo.png")} style={{ width: 88, height: 88, objectFit: "contain" }} />
    <div style={{ fontFamily: amiri, fontSize: 32, color: GREEN, fontWeight: 700, direction: "rtl" }}>
      منصة الزواج الجماعي · لقبيلة الهِملة من قريش
    </div>
  </div>
);

const Footer: React.FC = () => (
  <div style={{ position: "absolute", bottom: 36, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 60, zIndex: 5, direction: "rtl", fontFamily: tajawal }}>
    {[
      { n: "12", l: "حفلاً مباركاً" },
      { n: "114", l: "عريساً وعروساً" },
      { n: "9", l: "لجان متكاملة" },
    ].map((s) => (
      <div key={s.l} style={{ textAlign: "center" }}>
        <div style={{ fontFamily: amiri, fontSize: 44, fontWeight: 700, color: GOLD, lineHeight: 1 }}>{s.n}</div>
        <div style={{ fontSize: 18, color: INK, marginTop: 6 }}>{s.l}</div>
      </div>
    ))}
  </div>
);

const Mockup: React.FC<{ src: string; localFrame: number }> = ({ src, localFrame }) => {
  const scale = interpolate(localFrame, [0, SCENE], [1.02, 1.08], { extrapolateRight: "clamp" });
  const opacity = interpolate(localFrame, [0, 20, SCENE - 20, SCENE], [0, 1, 1, 0]);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity }}>
      <div style={{ width: 1100, borderRadius: 22, overflow: "hidden", boxShadow: `0 30px 80px ${GREEN}55, 0 0 0 2px ${GOLD}66`, transform: `scale(${scale})` }}>
        <Img src={staticFile(src)} style={{ width: "100%", display: "block" }} />
      </div>
    </div>
  );
};

const Caption: React.FC<{ title: string; sub: string; localFrame: number; side?: "left" | "right" }> = ({ title, sub, localFrame, side = "right" }) => {
  const y = interpolate(localFrame, [0, 25], [30, 0], { extrapolateRight: "clamp" });
  const op = interpolate(localFrame, [0, 25, SCENE - 25, SCENE], [0, 1, 1, 0]);
  return (
    <div style={{
      position: "absolute", top: 180, [side]: 80, maxWidth: 460,
      transform: `translateY(${y}px)`, opacity: op, zIndex: 6,
      direction: "rtl", textAlign: "right",
      background: `${PAPER}EE`, border: `1.5px solid ${GOLD}55`,
      borderRadius: 18, padding: "26px 30px",
      boxShadow: `0 20px 60px ${GREEN}22`,
    } as React.CSSProperties}>
      <div style={{ fontFamily: amiri, fontSize: 38, color: GREEN, fontWeight: 700, lineHeight: 1.25 }}>{title}</div>
      <div style={{ width: 60, height: 3, background: GOLD, margin: "14px 0", borderRadius: 2 }} />
      <div style={{ fontFamily: tajawal, fontSize: 20, color: INK, lineHeight: 1.7 }}>{sub}</div>
    </div>
  );
};

const SCENES_DATA = [
  { src: "images/mockup-home.png", title: "بسم الله الرحمن الرحيم", sub: "صرحٌ رقمي يحفظ ذاكرة العطاء، ويوثّق مسيرة اثني عشر عاماً من البذل والوفاء.", side: "right" as const },
  { src: "images/mockup-committees.png", title: "تسع لجانٍ متكاملة", sub: "من العليا والمالية والإعلام والجودة والضيافة… منظومةٌ متناغمة تخدم أبناء القبيلة.", side: "left" as const },
  { src: "images/mockup-register.png", title: "تسجيلٌ ميسّر للعرسان", sub: "مئةٌ وأربعة عشر عريساً وعروساً اكتملت فرحتهم تحت مظلة اللجنة.", side: "right" as const },
  { src: "images/mockup-feedback.png", title: "رأيكم يصنع غدنا", sub: "استبياناتٌ ذكية وتقاريرُ شفافة لتطوير التجربة في كل حفل قادم.", side: "left" as const },
  { src: "images/mockup-qr.png", title: "تكتمل الهمم… ويمتدّ العطاء", sub: "منصة الزواج الجماعي · حيث يلتقي الإخلاص بالإتقان. والحمد لله رب العالمين.", side: "right" as const },
];

const Scene: React.FC<{ index: number }> = ({ index }) => {
  const f = useCurrentFrame();
  const data = SCENES_DATA[index];
  return (
    <AbsoluteFill>
      <Mockup src={data.src} localFrame={f} />
      <Caption title={data.title} sub={data.sub} localFrame={f} side={data.side} />
    </AbsoluteFill>
  );
};

export const IntroVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Backdrop />
      <Header />
      {SCENES_DATA.map((_, i) => (
        <Sequence key={i} from={i * SCENE} durationInFrames={SCENE}>
          <Scene index={i} />
        </Sequence>
      ))}
      <Footer />
      <Audio src={staticFile("audio/narration.mp3")} />
    </AbsoluteFill>
  );
};