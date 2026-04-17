import logo from "@/assets/logo.jpeg";

export function Logo({ size = 40, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="relative rounded-full overflow-hidden ring-2 ring-gold/40 shadow-gold"
        style={{ width: size, height: size }}
      >
        <img src={logo} alt="شعار البرنامج" className="w-full h-full object-cover" />
      </div>
      {withText && (
        <div className="flex flex-col leading-tight">
          <span className="text-shimmer-gold font-bold text-base">منصة عمل لجنة الزواج الجماعي</span>
          <span className="text-[10px] text-sidebar-foreground/70">لقبيلة الهملة من قريش</span>
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
