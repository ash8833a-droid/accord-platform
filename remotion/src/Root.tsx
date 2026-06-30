import { Composition } from "remotion";
import { MainVideo, TOTAL_FRAMES } from "./MainVideo";
import { CommitteesVideo, COMMITTEES_TOTAL_FRAMES } from "./CommitteesVideo";
import { IntroVideo, INTRO_TOTAL_FRAMES } from "./IntroVideo";

export const RemotionRoot = () => (
  <>
  <Composition
    id="main"
    component={MainVideo}
    durationInFrames={TOTAL_FRAMES}
    fps={30}
    width={1920}
    height={1080}
  />
  <Composition
    id="committees"
    component={CommitteesVideo}
    durationInFrames={COMMITTEES_TOTAL_FRAMES}
    fps={30}
    width={1920}
    height={1080}
  />
  <Composition
    id="intro"
    component={IntroVideo}
    durationInFrames={INTRO_TOTAL_FRAMES}
    fps={30}
    width={1920}
    height={1080}
  />
  </>
);