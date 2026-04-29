import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "lucide-react" extends never ? never : any;

/**
 * Shared hero header used at the top of internal pages.
 * Visual style mirrors the analytics dashboard hero: gradient background,
 * gold blob, RTL layout, and an optional right-side action slot.
 */
export interface PageHeroHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  highlight?: string;
  subtitle?: string;
  icon: LucideIcon;
  actions?: ReactNode;
}

export function PageHeroHeader({
  eyebrow,
  title,
  highlight,
  subtitle,
  icon: Icon,
  actions,
}: PageHeroHeaderProps) {
  return (
    <div
      dir="rtl"
      className="relative overflow-hidden rounded-3xl bg-gradient-hero p-6 lg:p-8 text-primary-foreground shadow-elegant"
    >
      <div className="absolute -top-10 -left-10 w-72 h-72 bg-gold/20 rounded-full blur-3xl" />
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="h-12 w-12 rounded-2xl bg-gold/20 flex items-center justify-center backdrop-blur-sm shrink-0">
            <Icon className="h-6 w-6 text-gold" />
          </div>
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-xs text-primary-foreground/70">{eyebrow}</p>
            )}
            <h1 className="text-xl lg:text-2xl font-extrabold leading-tight">
              {highlight ? (
                <>
                  <span className="text-shimmer-gold">{highlight}</span> {title}
                </>
              ) : (
                title
              )}
            </h1>
            {subtitle && (
              <p className="text-primary-foreground/80 text-xs mt-1">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}