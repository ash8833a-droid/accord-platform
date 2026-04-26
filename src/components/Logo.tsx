import logo from "@/assets/logo.jpeg";

export function Logo({ size = 40, withText = true }: { size?: number; withText?: boolean }) {
  // Outer ring (الدبلة) is noticeably larger than the inner logo disc to read clearly
  const ringSize = Math.round(size * 1.45);
  const ringStroke = Math.max(3, Math.round(size * 0.11));
  return (
    <div className="flex items-center gap-3">
      <div
        className="relative flex items-center justify-center"
        style={{ width: ringSize, height: ringSize }}
      >
        {/* Outer wedding ring (الدبلة) — gold gradient with subtle highlight */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full drop-shadow-[0_2px_8px_rgba(196,162,92,0.55)]"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="logoRingGold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F5DE96" />
              <stop offset="45%" stopColor="#D4B36A" />
              <stop offset="100%" stopColor="#8C6E2E" />
            </linearGradient>
            <linearGradient id="logoRingInner" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#FFF1C2" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#C4A25C" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          {/* Main band */}
          <circle
            cx="50"
            cy="50"
            r={50 - ringStroke / 2}
            fill="none"
            stroke="url(#logoRingGold)"
            strokeWidth={ringStroke}
          />
          {/* Inner thin highlight to give jewelry depth */}
          <circle
            cx="50"
            cy="50"
            r={50 - ringStroke + 0.4}
            fill="none"
            stroke="url(#logoRingInner)"
            strokeWidth="0.6"
            opacity="0.8"
          />
          {/* Tiny sparkle */}
          <circle cx="28" cy="22" r="1.6" fill="#FFF8E1" opacity="0.9" />
        </svg>

        {/* Inner logo disc nested inside the ring */}
        <div
          className="relative rounded-full overflow-hidden bg-background ring-1 ring-gold/20"
          style={{ width: size, height: size }}
        >
          <img src={logo} alt="شعار البرنامج" className="w-full h-full object-cover" />
        </div>
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
