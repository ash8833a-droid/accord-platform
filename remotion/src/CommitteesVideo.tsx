import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Tajawal";
import { loadFont as loadAmiri } from "@remotion/google-fonts/Amiri";

const { fontFamily: tajawal } = loadFont("normal", { weights: ["400", "500", "700", "800"], subsets: ["arabic"] });
const { fontFamily: amiri } = loadAmiri("normal", { weights: ["400", "700"], subsets: ["arabic"] });

// ===== Brand =====
const GREEN = "#0F3D2E";
const GREEN_DEEP = "#08231B";
const GOLD = "#C9A84C";
const GOLD_SOFT = "#E8C97A";
const CREAM = "#F5EFE2";

// ===== Committees data =====
export type Committee = {
  name: string;
  vision: string;
  mission: string;
  glyph: string; // unicode symbol
};

export const COMMITTEES: Committee[] = [
  { name: "اللجنة العليا", vision: "قيادة مرجعية تُحوّل المبادرة إلى نموذج مؤسسي مستدام.", mission: "اعتماد الخطط، متابعة الأداء، وحوكمة عمل اللجان.", glyph: "♛" },
  { name: "اللجنة المالية", vision: "إدارة مالية شفافة تضمن استدامة المبادرة وثقة الداعمين.", mission: "إعداد الموازنة، تحصيل الاشتراكات، وصرف المستحقات.", glyph: "₪" },
  { name: "اللجنة الإعلامية", vision: "صورة إعلامية مشرّفة تعكس قيم المبادرة وتُلهم المجتمع.", mission: "التغطية الإعلامية، إدارة المحتوى الرقمي، وأرشفة الحفل.", glyph: "◉" },
  { name: "لجنة الجودة", vision: "جودة تنفيذية متميزة تجعل تجربة كل عريس وضيف لا تُنسى.", mission: "وضع المعايير، تدقيق أعمال اللجان، وقياس الرضا.", glyph: "✦" },
  { name: "لجنة البرامج", vision: "برامج وفقرات مُحكمة الإخراج تليق بمكانة الحفل.", mission: "تصميم الفقرات، تنسيق البروفات، وإخراج الحفل بسلاسة.", glyph: "♪" },
  { name: "لجنة العشاء", vision: "ضيافة كريمة بمعايير صحية عالية تليق بمقام الضيوف.", mission: "تخطيط القائمة، ضمان السلامة الغذائية، وإدارة التقديم.", glyph: "❖" },
  { name: "لجنة المشتريات", vision: "سلسلة إمداد منضبطة تُسلّم المستلزمات في الوقت والجودة.", mission: "تحديد الاحتياجات، التفاوض، والتسليم في الموعد.", glyph: "◈" },
  { name: "لجنة الاستقبال", vision: "استقبال راقٍ ومنظّم يعكس حُسن الضيافة منذ اللحظة الأولى.", mission: "تنظيم بروتوكول الاستقبال وإدارة كبار الضيوف.", glyph: "✺" },
  { name: "القسم النسائي", vision: "قسم نسائي متكامل يوفّر بيئة آمنة ومريحة للحاضرات.", mission: "تجهيز القسم النسائي والتنسيق مع اللجان لراحة الضيوف.", glyph: "❀" },
];

// Frames
const INTRO = 120;        // 4s
const PER_COMMITTEE = 165; // 5.5s
const OUTRO = 120;        // 4s
export const COMMITTEES_TOTAL_FRAMES = INTRO + PER_COMMITTEE * COMMITTEES.length + OUTRO;

// ===== Persistent backdrop (dark green w/ subtle motion) =====
const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const shimmer = Math.sin(frame / 40) * 8;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% ${50 + shimmer}%, ${GREEN} 0%, ${GREEN_DEEP} 70%, #050F0B 100%)` }}>
      {/* gold dust */}
      <AbsoluteFill style={{ opacity: 0.12, background: `radial-gradient(circle at 20% 30%, ${GOLD} 0%, transparent 25%), radial-gradient(circle at 80% 70%, ${GOLD} 0%, transparent 28%)` }} />
      {/* subtle dot pattern */}
      <AbsoluteFill style={{ opacity: 0.05, backgroundImage: `radial-gradient(${GOLD_SOFT} 1px, transparent 1px)`, backgroundSize: "32px 32px" }} />
    </AbsoluteFill>
  );
};

// ===== Ornament divider =====
const Divider: React.FC<{ width?: number }> = ({ width = 320 }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, direction: "rtl" }}>
    <div style={{ height: 1, width, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
    <div style={{ color: GOLD, fontSize: 22 }}>✦</div>
    <div style={{ height: 1, width, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
  </div>
);

// ===== Intro =====
const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoScale = spring({ frame, fps, config: { damping: 18, stiffness: 90 } });
  const logoY = interpolate(logoScale, [0, 1], [40, 0]);
  const titleOp = interpolate(frame, [30, 55], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [30, 55], [25, 0], { extrapolateRight: "clamp" });
  const subOp = interpolate(frame, [55, 80], [0, 1], { extrapolateRight: "clamp" });
  const haloPulse = 1 + Math.sin(frame / 14) * 0.04;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: tajawal, direction: "rtl" }}>
      {/* gold halo behind logo */}
      <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle, ${GOLD}55 0%, transparent 60%)`, transform: `scale(${haloPulse * logoScale})`, top: "18%" }} />
      <div style={{ transform: `translateY(${logoY}px) scale(${0.9 + logoScale * 0.1})`, opacity: logoScale, marginBottom: 40 }}>
        <Img src={staticFile("images/wedding-logo.png")} style={{ width: 360, height: "auto", filter: `drop-shadow(0 12px 40px ${GOLD}55)` }} />
      </div>
      <div style={{ opacity: titleOp, transform: `translateY(${titleY}px)`, textAlign: "center" }}>
        <div style={{ fontFamily: amiri, fontWeight: 700, fontSize: 78, color: CREAM, letterSpacing: 1, lineHeight: 1.3 }}>
          لِجانُ الزواجِ الجماعي
        </div>
        <div style={{ marginTop: 18, opacity: subOp }}>
          <Divider width={220} />
        </div>
        <div style={{ marginTop: 18, fontSize: 28, color: GOLD_SOFT, opacity: subOp, letterSpacing: 2 }}>
          تسعُ لجانٍ • منظومةٌ واحدةٌ تصنعُ الفرح
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ===== Committee Scene =====
const CommitteeScene: React.FC<{ index: number; committee: Committee }> = ({ index, committee }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardSpring = spring({ frame, fps, config: { damping: 22, stiffness: 110 } });
  const cardOp = interpolate(cardSpring, [0, 1], [0, 1]);
  const cardY = interpolate(cardSpring, [0, 1], [40, 0]);

  const numSpring = spring({ frame: frame - 6, fps, config: { damping: 14, stiffness: 90 } });
  const numScale = interpolate(numSpring, [0, 1], [0.6, 1]);

  const titleOp = interpolate(frame, [18, 38], [0, 1], { extrapolateRight: "clamp" });
  const titleX = interpolate(frame, [18, 38], [40, 0], { extrapolateRight: "clamp" });

  const visionOp = interpolate(frame, [38, 58], [0, 1], { extrapolateRight: "clamp" });
  const missionOp = interpolate(frame, [56, 78], [0, 1], { extrapolateRight: "clamp" });

  // exit
  const exitOp = interpolate(frame, [PER_COMMITTEE - 18, PER_COMMITTEE - 2], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const idx = String(index + 1).padStart(2, "0");

  return (
    <AbsoluteFill style={{ fontFamily: tajawal, direction: "rtl", alignItems: "center", justifyContent: "center", opacity: exitOp }}>
      {/* small top brand */}
      <div style={{ position: "absolute", top: 60, right: 80, display: "flex", alignItems: "center", gap: 16, opacity: 0.85 }}>
        <Img src={staticFile("images/wedding-logo.png")} style={{ width: 70, height: "auto" }} />
        <div style={{ color: CREAM, fontSize: 22, opacity: 0.9 }}>لجنة الزواج الجماعي</div>
      </div>
      <div style={{ position: "absolute", top: 78, left: 90, color: GOLD, fontSize: 20, letterSpacing: 6, direction: "ltr" }}>
        {idx} / 09
      </div>

      {/* card */}
      <div
        style={{
          width: 1280,
          padding: "70px 80px",
          background: `linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))`,
          border: `1.5px solid ${GOLD}55`,
          borderRadius: 28,
          backdropFilter: undefined,
          boxShadow: `0 30px 80px rgba(0,0,0,0.45), inset 0 1px 0 ${GOLD}33`,
          opacity: cardOp,
          transform: `translateY(${cardY}px)`,
          textAlign: "center",
          position: "relative",
        }}
      >
        {/* glyph badge */}
        <div
          style={{
            width: 130,
            height: 130,
            margin: "0 auto 28px",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${GOLD}22 0%, transparent 70%)`,
            border: `2px solid ${GOLD}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: GOLD,
            fontSize: 64,
            transform: `scale(${numScale})`,
          }}
        >
          {committee.glyph}
        </div>

        <div style={{ opacity: titleOp, transform: `translateX(${titleX}px)` }}>
          <div style={{ fontFamily: amiri, fontWeight: 700, fontSize: 78, color: CREAM, lineHeight: 1.2 }}>
            {committee.name}
          </div>
          <div style={{ marginTop: 18 }}>
            <Divider width={180} />
          </div>
        </div>

        <div style={{ marginTop: 36, opacity: visionOp }}>
          <div style={{ fontSize: 20, color: GOLD, letterSpacing: 4, marginBottom: 12 }}>الرؤية</div>
          <div style={{ fontSize: 34, color: CREAM, lineHeight: 1.7, maxWidth: 1000, margin: "0 auto" }}>
            {committee.vision}
          </div>
        </div>

        <div style={{ marginTop: 32, opacity: missionOp }}>
          <div style={{ fontSize: 20, color: GOLD, letterSpacing: 4, marginBottom: 12 }}>أبرز الأعمال</div>
          <div style={{ fontSize: 28, color: "#D9D2BE", lineHeight: 1.8, maxWidth: 1000, margin: "0 auto" }}>
            {committee.mission}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ===== Outro =====
const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 20, stiffness: 90 } });
  const op2 = interpolate(frame, [25, 55], [0, 1], { extrapolateRight: "clamp" });
  const op3 = interpolate(frame, [55, 85], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: tajawal, direction: "rtl", textAlign: "center" }}>
      <div style={{ opacity: s, transform: `scale(${0.9 + s * 0.1})` }}>
        <Img src={staticFile("images/wedding-logo.png")} style={{ width: 280, height: "auto", filter: `drop-shadow(0 10px 30px ${GOLD}66)` }} />
      </div>
      <div style={{ marginTop: 30, opacity: op2 }}>
        <Divider width={200} />
      </div>
      <div style={{ marginTop: 26, fontFamily: amiri, fontWeight: 700, fontSize: 60, color: CREAM, opacity: op2, lineHeight: 1.3 }}>
        حيثُ تَلتقي الهِمَمُ ويَكتمِلُ الفَرَح
      </div>
      <div style={{ marginTop: 22, fontSize: 26, color: GOLD_SOFT, opacity: op3, letterSpacing: 3 }}>
        lajnat-zawaj.org
      </div>
    </AbsoluteFill>
  );
};

// ===== Main =====
export const CommitteesVideo: React.FC = () => {
  let cursor = 0;
  const introStart = cursor; cursor += INTRO;
  const committeeStarts = COMMITTEES.map(() => { const s = cursor; cursor += PER_COMMITTEE; return s; });
  const outroStart = cursor;

  return (
    <AbsoluteFill>
      <Backdrop />
      <Sequence from={introStart} durationInFrames={INTRO}>
        <Intro />
      </Sequence>
      {COMMITTEES.map((c, i) => (
        <Sequence key={i} from={committeeStarts[i]} durationInFrames={PER_COMMITTEE}>
          <CommitteeScene index={i} committee={c} />
        </Sequence>
      ))}
      <Sequence from={outroStart} durationInFrames={OUTRO}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};