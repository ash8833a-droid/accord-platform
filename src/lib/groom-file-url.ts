import { supabase } from "@/integrations/supabase/client";

/**
 * The `groom-public` bucket used to be public — the app stored full
 * https URLs in `photo_url` / `national_id_url`. It's now private and
 * we store just the storage path. This helper is backward compatible:
 * it accepts either a raw path or a legacy public URL and returns the
 * canonical path portion.
 */
export function extractGroomFilePath(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    const m = pathOrUrl.match(/\/groom-public\/(.+)$/);
    if (m) {
      try {
        return decodeURIComponent(m[1]);
      } catch {
        return m[1];
      }
    }
  }
  return pathOrUrl;
}

/**
 * Create a short-lived signed URL for a groom file. Requires the
 * caller to be authenticated (RLS policy `groom_public_read_auth`).
 * For anonymous callers, resolve the URL via a server function that
 * uses `supabaseAdmin`.
 */
export async function getGroomFileSignedUrl(
  pathOrUrl: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  if (!pathOrUrl) return null;
  const path = extractGroomFilePath(pathOrUrl);
  const { data, error } = await supabase.storage
    .from("groom-public")
    .createSignedUrl(path, expiresIn);
  if (error) {
    console.error("[groom-file-url] createSignedUrl failed", error);
    return null;
  }
  return data?.signedUrl ?? null;
}

/** Download a groom file as a Blob (authenticated users only). */
export async function downloadGroomFile(pathOrUrl: string): Promise<Blob> {
  const path = extractGroomFilePath(pathOrUrl);
  const { data, error } = await supabase.storage.from("groom-public").download(path);
  if (error || !data) throw error ?? new Error("download failed");
  return data;
}