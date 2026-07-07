import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Fetch a publicly-shared Google Drive folder listing (no OAuth) by scraping
 * the embeddedfolderview HTML — the same endpoint Drive uses for "list view"
 * embeds. Only works when the folder is shared as "Anyone with the link".
 */
export const listDriveFolder = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ folderId: z.string().min(10).max(80) }).parse(data),
  )
  .handler(async ({ data }) => {
    const url = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(data.folderId)}#list`;
    const res = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; LovableBot/1.0; +https://lovable.dev)",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) {
      throw new Error(`Drive returned ${res.status} — تأكد أن المجلد مشارك على «Anyone with the link».`);
    }
    const html = await res.text();

    // Each entry is an anchor like:
    //   <a href="https://drive.google.com/file/d/FILE_ID/view?usp=drive_web" ...>
    //     <div ...>NAME.ext</div>
    //   </a>
    // The filename shows up as the anchor's visible text; strip inner tags.
    const entryRe =
      /href="https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{15,})\/view[^"]*"[^>]*>([\s\S]*?)<\/a>/g;

    type Item = { id: string; name: string; kind: "image" | "video" | "other" };
    const seen = new Set<string>();
    const items: Item[] = [];
    let m: RegExpExecArray | null;
    while ((m = entryRe.exec(html)) !== null) {
      const id = m[1];
      if (seen.has(id)) continue;
      seen.add(id);
      const name = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const isImg = /\.(png|jpe?g|webp|gif|avif|heic|heif|bmp|tiff?)$/i.test(name);
      const isVid = /\.(mp4|mov|m4v|webm|mkv|avi|ogv|3gp)$/i.test(name);
      items.push({ id, name, kind: isImg ? "image" : isVid ? "video" : "other" });
    }

    const media = items.filter((i) => i.kind !== "other");
    return { total: items.length, items: media as { id: string; name: string; kind: "image" | "video" }[] };
  });

/** Extract a Drive folder ID from a common Drive folder URL. */
export function extractDriveFolderId(raw: string): string | null {
  const s = raw.trim();
  const m = s.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (m) return m[1];
  try {
    const u = new URL(s);
    const id = u.searchParams.get("id");
    if (id && /^[a-zA-Z0-9_-]{10,}$/.test(id)) return id;
  } catch { /* ignore */ }
  return null;
}