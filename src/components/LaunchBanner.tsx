import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, PartyPopper } from "lucide-react";

type LaunchStatus = {
  is_launched: boolean;
  launched_at: string | null;
  launched_by_name: string | null;
};

export function useLaunchStatus() {
  const [status, setStatus] = useState<LaunchStatus | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.rpc("get_launch_status");
      if (active && data) setStatus(data as unknown as LaunchStatus);
    };
    load();
    const channel = supabase
      .channel("platform_launch_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_launch" },
        () => load(),
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return status;
}

export function LaunchBanner() {
  const status = useLaunchStatus();
  if (!status?.is_launched) return null;

  const date = status.launched_at
    ? new Intl.DateTimeFormat("ar-SA", {
        dateStyle: "long",
      }).format(new Date(status.launched_at))
    : "";

  return (
    <div
      dir="rtl"
      className="relative overflow-hidden border-b border-gold/40 bg-gradient-to-l from-primary/15 via-gold/15 to-primary/15"
    >
      <div className="absolute inset-0 pointer-events-none opacity-40 animate-pulse">
        <div className="absolute -top-10 right-1/4 h-40 w-40 rounded-full bg-gold/40 blur-3xl" />
        <div className="absolute -bottom-10 left-1/4 h-40 w-40 rounded-full bg-primary/40 blur-3xl" />
      </div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-center gap-3 text-center">
        <PartyPopper className="h-5 w-5 text-gold shrink-0" />
        <p className="text-sm sm:text-base font-bold text-foreground">
          تم تدشين المنصة رسميًا
          {status.launched_by_name ? ` بواسطة ${status.launched_by_name}` : ""}
          {date ? ` — ${date}` : ""}
        </p>
        <Sparkles className="h-5 w-5 text-primary shrink-0" />
      </div>
    </div>
  );
}