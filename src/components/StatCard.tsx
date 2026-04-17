import { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  variant?: "default" | "gold" | "teal";
}

export function StatCard({ label, value, hint, icon: Icon, variant = "default" }: Props) {
  const tones = {
    default: "from-card to-muted",
    gold: "from-gold/15 to-gold/5",
    teal: "from-primary/15 to-primary-glow/5",
  };
  const iconBg = {
    default: "bg-muted text-foreground",
    gold: "bg-gradient-gold text-gold-foreground shadow-gold",
    teal: "bg-gradient-hero text-primary-foreground shadow-elegant",
  };
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${tones[variant]} p-5 shadow-soft hover:shadow-elegant transition-all duration-300 hover:-translate-y-1`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${iconBg[variant]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-gold/5 blur-2xl" />
    </div>
  );
}
