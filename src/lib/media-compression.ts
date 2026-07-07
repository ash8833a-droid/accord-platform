/**
 * Client-side media compression for images and videos.
 *
 * - Images: canvas resize + JPEG/WebP re-encode.
 * - Videos: playback → canvas capture → MediaRecorder (webm) at bounded
 *   resolution + bitrate. Best-effort: browsers cannot decode every format
 *   (notably iPhone .mov/HEVC in some Safari builds); on failure we return
 *   the original file so the upload still proceeds.
 */

export type CompressionProgress = (info: {
  phase: "image" | "video" | "skip";
  ratio?: number; // 0..1
  message?: string;
}) => void;

const IMAGE_MAX_DIM = 2400;
const IMAGE_QUALITY = 0.82;

/** True if this file is worth attempting to compress. */
export function isCompressible(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  const n = file.name.toLowerCase();
  if (t.startsWith("image/")) return true;
  if (t.startsWith("video/")) return true;
  return /\.(png|jpe?g|webp|heic|heif|mp4|mov|m4v|webm|mkv|avi)$/i.test(n);
}

function replaceExt(name: string, newExt: string) {
  return name.replace(/\.[^.]+$/, "") + "." + newExt;
}

export async function compressImage(file: File): Promise<File> {
  // Load
  const bmpSrc: ImageBitmapSource = file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(bmpSrc);
  } catch {
    return file; // Unsupported (e.g. HEIC on some browsers)
  }

  const { width, height } = bitmap;
  const scale = Math.min(1, IMAGE_MAX_DIM / Math.max(width, height));
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, outW, outH);
  bitmap.close?.();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", IMAGE_QUALITY),
  );
  if (!blob || blob.size >= file.size) return file;

  return new File([blob], replaceExt(file.name, "jpg"), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export async function compressVideo(
  file: File,
  onProgress?: CompressionProgress,
): Promise<File> {
  // Feature detection — MediaRecorder + canvas.captureStream
  const anyDoc = document.createElement("canvas") as HTMLCanvasElement & {
    captureStream?: (fps?: number) => MediaStream;
  };
  if (typeof MediaRecorder === "undefined" || !anyDoc.captureStream) return file;

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("cannot decode video"));
      // Some browsers need play() to trigger metadata
      setTimeout(() => reject(new Error("timeout decoding video")), 15000);
    });
  } catch {
    URL.revokeObjectURL(url);
    return file;
  }

  const srcW = video.videoWidth;
  const srcH = video.videoHeight;
  if (!srcW || !srcH) {
    URL.revokeObjectURL(url);
    return file;
  }

  // Cap resolution — target 720p on the longest edge
  const MAX_EDGE = 1280;
  const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH));
  const outW = Math.max(2, Math.round((srcW * scale) / 2) * 2);
  const outH = Math.max(2, Math.round((srcH * scale) / 2) * 2);
  const duration = isFinite(video.duration) ? video.duration : 0;

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    URL.revokeObjectURL(url);
    return file;
  }

  // Pick a webm mime the browser supports
  const mimeCandidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m));
  if (!mimeType) {
    URL.revokeObjectURL(url);
    return file;
  }

  const videoStream = anyDoc.captureStream!(30);
  // Try to include audio (may fail silently on some browsers)
  try {
    const anyVid = video as HTMLVideoElement & {
      captureStream?: () => MediaStream;
      mozCaptureStream?: () => MediaStream;
    };
    const src = anyVid.captureStream?.() ?? anyVid.mozCaptureStream?.();
    src?.getAudioTracks().forEach((t) => videoStream.addTrack(t));
  } catch { /* no audio */ }

  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(videoStream, {
    mimeType,
    videoBitsPerSecond: 1_500_000, // ~1.5 Mbps → roughly 11 MB/min
    audioBitsPerSecond: 96_000,
  });
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  const done = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });

  try {
    recorder.start(1000);
    await video.play();
  } catch {
    try { recorder.stop(); } catch { /* noop */ }
    URL.revokeObjectURL(url);
    return file;
  }

  await new Promise<void>((resolve) => {
    let raf = 0;
    const tick = () => {
      if (video.ended || video.paused) return resolve();
      ctx.drawImage(video, 0, 0, outW, outH);
      if (duration) onProgress?.({ phase: "video", ratio: Math.min(1, video.currentTime / duration) });
      raf = requestAnimationFrame(tick);
    };
    tick();
    video.onended = () => { cancelAnimationFrame(raf); resolve(); };
  });

  try { recorder.stop(); } catch { /* noop */ }
  await done;
  URL.revokeObjectURL(url);

  const blob = new Blob(chunks, { type: mimeType });
  if (blob.size === 0 || blob.size >= file.size) return file;
  return new File([blob], replaceExt(file.name, "webm"), {
    type: "video/webm",
    lastModified: Date.now(),
  });
}

/**
 * Compress a file when it exceeds `targetBytes`. Falls back to the original
 * file when compression is not possible or does not reduce size.
 */
export async function compressIfNeeded(
  file: File,
  targetBytes: number,
  onProgress?: CompressionProgress,
): Promise<File> {
  const t = (file.type || "").toLowerCase();
  const n = file.name.toLowerCase();
  const isImg = t.startsWith("image/") || /\.(png|jpe?g|webp|heic|heif)$/i.test(n);
  const isVid = t.startsWith("video/") || /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(n);

  if (!isImg && !isVid) return file;
  // Always compress oversized files; also shrink images >4 MB proactively.
  if (isImg && file.size < 4 * 1024 * 1024) return file;
  if (isVid && file.size <= targetBytes) return file;

  try {
    if (isImg) {
      onProgress?.({ phase: "image", message: "جاري ضغط الصورة…" });
      return await compressImage(file);
    }
    onProgress?.({ phase: "video", message: "جاري ضغط الفيديو…" });
    return await compressVideo(file, onProgress);
  } catch {
    return file;
  }
}