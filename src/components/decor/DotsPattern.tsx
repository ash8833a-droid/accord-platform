import { cn } from "@/lib/utils";

/**
 * Decorative dots/circles grid that fades out toward one edge.
 * Inspired by Najiz-style institutional visuals — used sparingly as a
 * brand accent in corners of hero sections and auth surfaces.
 *
 * - Pure SVG, no runtime deps.
 * - Color comes from `currentColor` so callers control tone via Tailwind text-* classes.
 * - `fade` controls the direction of the opacity falloff.
 */
export interface DotsPatternProps {
  className?: string;
  /** Direction toward which the pattern fades to transparent. */
  fade?: "left" | "right" | "top" | "bottom" | "tr" | "tl" | "br" | "bl";
  /** Grid columns × rows. Defaults to a wide 10×6 strip. */
  cols?: number;
  rows?: number;
  /** Circle radius in viewBox units (cell is 24). */
  radius?: number;
  /** Aria-hidden by default — purely decorative. */
  ariaHidden?: boolean;
}

const FADE_GRADIENT: Record<NonNullable<DotsPatternProps["fade"]>, string> = {
  left: "linear-gradient(to left, black, transparent)",
  right: "linear-gradient(to right, black, transparent)",
  top: "linear-gradient(to top, black, transparent)",
  bottom: "linear-gradient(to bottom, black, transparent)",
  tr: "linear-gradient(to top right, black, transparent 70%)",
  tl: "linear-gradient(to top left, black, transparent 70%)",
  br: "linear-gradient(to bottom right, black, transparent 70%)",
  bl: "linear-gradient(to bottom left, black, transparent 70%)",
};

export function DotsPattern({
  className,
  fade = "right",
  cols = 10,
  rows = 6,
  radius = 8,
  ariaHidden = true,
}: DotsPatternProps) {
  const cell = 24;
  const w = cols * cell;
  const h = rows * cell;
  const mask = FADE_GRADIENT[fade];

  return (
    <svg
      aria-hidden={ariaHidden}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid slice"
      className={cn("pointer-events-none select-none text-primary/25", className)}
      style={{
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    >
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => (
          <circle
            key={`${r}-${c}`}
            cx={c * cell + cell / 2}
            cy={r * cell + cell / 2}
            r={radius}
            fill="currentColor"
          />
        )),
      )}
    </svg>
  );
}
