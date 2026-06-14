import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Scene1 } from "./scenes/Scene1";
import { Scene2 } from "./scenes/Scene2";
import { Scene3 } from "./scenes/Scene3";
import { Scene4 } from "./scenes/Scene4";
import { Scene5 } from "./scenes/Scene5";
import { Scene6 } from "./scenes/Scene6";

const D = { s1: 330, s2: 360, s3: 360, s4: 540, s5: 360, s6: 360 };
const TR = 25;
// total = sum - 5 transitions overlap
export const TOTAL_FRAMES = D.s1 + D.s2 + D.s3 + D.s4 + D.s5 + D.s6 - TR * 5;

const t = () => ({ presentation: fade(), timing: linearTiming({ durationInFrames: TR }) });

export const MainVideo: React.FC = () => (
  <AbsoluteFill style={{ background: "#07111A" }}>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={D.s1}><Scene1 /></TransitionSeries.Sequence>
      <TransitionSeries.Transition {...t()} />
      <TransitionSeries.Sequence durationInFrames={D.s2}><Scene2 /></TransitionSeries.Sequence>
      <TransitionSeries.Transition {...t()} />
      <TransitionSeries.Sequence durationInFrames={D.s3}><Scene3 /></TransitionSeries.Sequence>
      <TransitionSeries.Transition {...t()} />
      <TransitionSeries.Sequence durationInFrames={D.s4}><Scene4 /></TransitionSeries.Sequence>
      <TransitionSeries.Transition {...t()} />
      <TransitionSeries.Sequence durationInFrames={D.s5}><Scene5 /></TransitionSeries.Sequence>
      <TransitionSeries.Transition {...t()} />
      <TransitionSeries.Sequence durationInFrames={D.s6}><Scene6 /></TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);