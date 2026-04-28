import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import defaultLogo from "@/assets/logo.jpeg";
import { setExportBrand } from "@/lib/exporters";

export interface BrandIdentity {
  name: string;
  subtitle: string;
  logo_url: string | null;
  primary_color: string;
  gold_color: string;
}

export const DEFAULT_BRAND: BrandIdentity = {
  name: "منصة عمل لجنة الزواج الجماعي",
  subtitle: "لقبيلة الهملة من قريش",
  logo_url: null,
  primary_color: "#1B4F58",
  gold_color: "#C4A25C",
};

export const DEFAULT_LOGO_URL = defaultLogo;

let cached: BrandIdentity | null = null;
const listeners = new Set<(b: BrandIdentity) => void>();

export async function fetchBrand(): Promise<BrandIdentity> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "brand_identity")
    .maybeSingle();
  const merged = { ...DEFAULT_BRAND, ...((data?.value as Partial<BrandIdentity>) ?? {}) };
  cached = merged;
  // Push to exporters (will use logo_url directly; PDF prints in same browser session so cross-origin OK for public bucket).
  try {
    let dataUri: string | undefined;
    if (merged.logo_url) {
      dataUri = await urlToDataUri(merged.logo_url);
    }
    setExportBrand(merged, dataUri);
  } catch { /* non-fatal */ }
  listeners.forEach((l) => l(merged));
  return merged;
}

export async function saveBrand(b: BrandIdentity): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      [{ key: "brand_identity", value: b as unknown as never, updated_at: new Date().toISOString() }],
      { onConflict: "key" },
    );
  if (error) throw error;
  cached = b;
  try {
    let dataUri: string | undefined;
    if (b.logo_url) dataUri = await urlToDataUri(b.logo_url);
    setExportBrand(b, dataUri);
  } catch { /* non-fatal */ }
  listeners.forEach((l) => l(b));
}

export function useBrand() {
  const [brand, setBrand] = useState<BrandIdentity>(cached ?? DEFAULT_BRAND);
  useEffect(() => {
    const cb = (b: BrandIdentity) => setBrand(b);
    listeners.add(cb);
    if (!cached) fetchBrand().catch(() => {});
    else setBrand(cached);
    return () => { listeners.delete(cb); };
  }, []);
  const refresh = useCallback(() => fetchBrand(), []);
  return { brand, refresh };
}

/** Resolve logo URL (uploaded or default bundled image). */
export function brandLogoSrc(brand: BrandIdentity): string {
  return brand.logo_url || DEFAULT_LOGO_URL;
}

/** Apply brand colors to CSS variables on :root for live theming of utilities that use them. */
export function applyBrandCssVars(brand: BrandIdentity) {
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", brand.primary_color);
  root.style.setProperty("--brand-gold", brand.gold_color);
}

/** Convert a remote image URL to a data URI (best-effort) for embedding in printed PDFs. */
export async function urlToDataUri(url: string): Promise<string> {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return url; // fallback to direct URL
  }
}