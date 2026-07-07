/**
 * Parse a user-provided URL and extract media metadata for the album.
 * Supports YouTube, Vimeo, and direct image/video file URLs.
 */
export type ParsedMediaUrl =
  | { kind: "video"; provider: "youtube"; id: string; embedUrl: string; thumbnailUrl: string; url: string }
  | { kind: "video"; provider: "vimeo"; id: string; embedUrl: string; thumbnailUrl: string | null; url: string }
  | { kind: "video"; provider: "direct"; url: string; thumbnailUrl: string | null }
  | { kind: "image"; provider: "direct"; url: string };

const IMG_RE = /\.(png|jpe?g|webp|gif|avif|heic|heif)(\?|#|$)/i;
const VID_RE = /\.(mp4|webm|mov|m4v|mkv|ogv)(\?|#|$)/i;

export function parseMediaUrl(raw: string): ParsedMediaUrl | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let u: URL;
  try { u = new URL(trimmed); } catch { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;

  const host = u.hostname.replace(/^www\./, "").toLowerCase();

  // YouTube
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com") {
    let id: string | null = null;
    if (host === "youtu.be") {
      id = u.pathname.slice(1).split("/")[0] || null;
    } else if (u.pathname.startsWith("/watch")) {
      id = u.searchParams.get("v");
    } else if (u.pathname.startsWith("/shorts/") || u.pathname.startsWith("/embed/") || u.pathname.startsWith("/live/")) {
      id = u.pathname.split("/")[2] || null;
    }
    if (id && /^[a-zA-Z0-9_-]{6,}$/.test(id)) {
      return {
        kind: "video",
        provider: "youtube",
        id,
        embedUrl: `https://www.youtube.com/embed/${id}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${id}`,
      };
    }
  }

  // Vimeo
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    const id = parts.find((p) => /^\d+$/.test(p));
    if (id) {
      return {
        kind: "video",
        provider: "vimeo",
        id,
        embedUrl: `https://player.vimeo.com/video/${id}`,
        thumbnailUrl: null,
        url: `https://vimeo.com/${id}`,
      };
    }
  }

  // Direct file
  if (IMG_RE.test(u.pathname)) {
    return { kind: "image", provider: "direct", url: trimmed };
  }
  if (VID_RE.test(u.pathname)) {
    return { kind: "video", provider: "direct", url: trimmed, thumbnailUrl: null };
  }

  return null;
}

/** Try to fetch a Vimeo thumbnail via oEmbed. Returns null on failure. */
export async function fetchVimeoThumbnail(id: string): Promise<string | null> {
  try {
    const res = await fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${id}`);
    if (!res.ok) return null;
    const j = await res.json();
    return typeof j?.thumbnail_url === "string" ? j.thumbnail_url : null;
  } catch {
    return null;
  }
}

/** Detect provider for an already-stored external URL (used by the viewer). */
export function detectProvider(url: string): "youtube" | "vimeo" | "direct" | null {
  const p = parseMediaUrl(url);
  return p && "provider" in p ? p.provider : null;
}