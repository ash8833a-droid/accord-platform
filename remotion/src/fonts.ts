import { loadFont as loadTajawal } from "@remotion/google-fonts/Tajawal";
import { loadFont as loadAmiri } from "@remotion/google-fonts/Amiri";

export const tajawal = loadTajawal("normal", {
  weights: ["400", "500", "700", "900"],
  subsets: ["arabic"],
}).fontFamily;

export const amiri = loadAmiri("normal", {
  weights: ["400", "700"],
  subsets: ["arabic"],
}).fontFamily;