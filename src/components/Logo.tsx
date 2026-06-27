import { useBrand, brandLogoSrc } from "@/lib/brand";

export function Logo({ size = 40, withText = true }: { size?: number; withText?: boolean }) {
  const { brand } = useBrand();
  const logo = brandLogoSrc(brand);
  const displaySize = Math.round(size * 1.55);
  return (
    <div className="flex items-center gap-3">
      <div
        className="relative flex items-center justify-center bg-transparent drop-shadow-[0_5px_10px_rgba(0,0,0,0.16)]"
        style={{ width: displaySize, height: displaySize }}
      >
        <img
          src={logo}
          alt={brand.name}
          className="w-full h-full object-contain bg-transparent"
        />
      </div>
      {withText && (
        <div className="flex flex-col leading-tight">
          <span className="text-shimmer-gold font-bold text-base">{brand.name}</span>
          {brand.subtitle && (
            <span className="text-[10px] text-sidebar-foreground/70">{brand.subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
}

/** Animated interlocking rings inspired by the logo */
export function AnimatedRings({ className = "" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 200 120" className="w-full h-full">
        <defs>
          <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.88 0.14 90)" />
            <stop offset="100%" stopColor="oklch(0.65 0.13 70)" />
          </linearGradient>
          <linearGradient id="tealGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.65 0.13 190)" />
            <stop offset="100%" stopColor="oklch(0.4 0.1 200)" />
          </linearGradient>
        </defs>
        <g style={{ transformOrigin: "75px 60px" }} className="animate-ring-slow">
          <circle cx="75" cy="60" r="42" fill="none" stroke="url(#goldGrad)" strokeWidth="9" />
        </g>
        <g style={{ transformOrigin: "125px 60px" }} className="animate-ring-rev">
          <circle cx="125" cy="60" r="42" fill="none" stroke="url(#tealGrad)" strokeWidth="9" />
        </g>
      </svg>
    </div>
  );
}
