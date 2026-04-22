import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useAppSetting<T = any>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const channel = supabase
      .channel(`app_settings_${key}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: `key=eq.${key}` },
        (payload: any) => {
          const newVal = payload?.new?.value;
          if (newVal !== undefined && newVal !== null) setValue(newVal as T);
        },
      )
      .subscribe();

    const load = async () => {
      const { data } = await supabase
        .from("app_settings" as any)
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (!active) return;
      if (data && (data as any).value !== undefined && (data as any).value !== null) {
        setValue((data as any).value as T);
      }
      setLoading(false);
    };
    load();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [key]);

  return { value, loading };
}