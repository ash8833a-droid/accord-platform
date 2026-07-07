import { supabase } from "@/integrations/supabase/client";

const BUCKET = "media-album";

/**
 * Batch-sign storage paths into short-lived HTTPS URLs. Silently returns
 * null for entries the server can't sign (e.g. deleted objects).
 */
export async function signAlbumPaths(
  paths: (string | null | undefined)[],
  expiresIn = 3600,
): Promise<Record<string, string>> {
  const uniq = Array.from(new Set(paths.filter((p): p is string => !!p)));
  if (uniq.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(uniq, expiresIn);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const row of data) {
    if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  }
  return out;
}

/** Upload a file to the album bucket. Returns the storage path (not a URL). */
export async function uploadAlbumFile(
  file: File,
  prefix: string,
): Promise<string> {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const key = `${prefix.replace(/\/+$/, "")}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}.${ext || "bin"}`;
  const { error } = await supabase.storage.from(BUCKET).upload(key, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return key;
}

export async function removeAlbumFiles(paths: (string | null | undefined)[]) {
  const clean = paths.filter((p): p is string => !!p);
  if (clean.length === 0) return;
  await supabase.storage.from(BUCKET).remove(clean);
}

export const ALBUM_BUCKET = BUCKET;