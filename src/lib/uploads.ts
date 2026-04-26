/**
 * Storage upload helpers.
 *
 * Supabase Storage rejects object keys that contain non-ASCII characters
 * (e.g. Arabic file names) with "Invalid key". To stay safe across all
 * languages we always build the storage path from a random ASCII id +
 * the file extension, and keep the original file name only in the DB
 * column (file_name) for display.
 */

/** Maximum allowed upload size (100 MB) — applies to every bucket. */
export const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;

/** Human readable size limit string. */
export const MAX_UPLOAD_SIZE_LABEL = "100 ميجابايت";

/** Broadly accepted file types — images, PDFs, Office, archives, audio, video, text. */
export const ACCEPT_ANY_FILE =
  "image/*,application/pdf," +
  ".doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.rtf,.odt,.ods,.odp," +
  ".zip,.rar,.7z,audio/*,video/*";

/** Extract a safe lowercase ASCII extension from a file name. */
export function safeExt(name: string, fallback = "bin"): string {
  const dot = name.lastIndexOf(".");
  if (dot < 0 || dot === name.length - 1) return fallback;
  const raw = name.slice(dot + 1).toLowerCase();
  const cleaned = raw.replace(/[^a-z0-9]+/g, "");
  return cleaned || fallback;
}

/** Build a fully ASCII-safe storage key (no Arabic / no spaces). */
export function safeStorageKey(name: string, prefix = ""): string {
  const ext = safeExt(name);
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now();
  const base = `${ts}-${rand}.${ext}`;
  return prefix ? `${prefix.replace(/\/+$/, "")}/${base}` : base;
}

/** Format file size for display. */
export function formatFileSize(n: number | null | undefined): string {
  if (!n) return "";
  if (n < 1024) return `${n} ب`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} ك.ب`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} م.ب`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} ج.ب`;
}
