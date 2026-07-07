/**
 * Extract a JPEG thumbnail from the first playable frame of a video file.
 * Returns null when the browser cannot decode the video (e.g. HEVC on Chrome).
 */
export async function extractVideoThumbnail(
  file: File,
  opts: { seekTo?: number; maxDim?: number; quality?: number } = {},
): Promise<File | null> {
  const seekTo = opts.seekTo ?? 1.0;
  const maxDim = opts.maxDim ?? 1280;
  const quality = opts.quality ?? 0.82;

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("metadata failed"));
      setTimeout(() => reject(new Error("metadata timeout")), 12000);
    });

    const t = Math.min(seekTo, Math.max(0, (video.duration || 0) - 0.05));
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("seek failed"));
      try { video.currentTime = t; } catch { reject(new Error("seek threw")); }
      setTimeout(() => reject(new Error("seek timeout")), 12000);
    });

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    const outW = Math.max(2, Math.round(w * scale));
    const outH = Math.max(2, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, outW, outH);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return null;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "thumb";
    return new File([blob], `${baseName}.thumb.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}