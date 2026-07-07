import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signAlbumPaths } from "@/lib/media-album";
import { parseMediaUrl } from "@/lib/media-url";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Camera, Video as VideoIcon, X, ChevronLeft, ChevronRight, Play, Image as ImageIcon, Pause, Move, Maximize2, RotateCcw } from "lucide-react";

interface Album {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
}
interface Item {
  id: string;
  album_id: string;
  kind: "image" | "video";
  file_url: string;
  thumbnail_url: string | null;
  title: string | null;
}

export function PublicAlbumSection() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [items, setItems] = useState<Record<string, Item[]>>({});
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ items: Item[]; index: number } | null>(null);
  const [mediaTab, setMediaTab] = useState<"image" | "video">("image");

  useEffect(() => {
    (async () => {
      const { data: alb } = await supabase
        .from("media_albums")
        .select("id,title,description,cover_url")
        .eq("is_published", true)
        .order("sort_order")
        .order("created_at", { ascending: false });
      const list = (alb ?? []) as Album[];
      setAlbums(list);
      if (list.length === 0) return;
      const ids = list.map((a) => a.id);
      const { data: its } = await supabase
        .from("media_items")
        .select("id,album_id,kind,file_url,thumbnail_url,title")
        .in("album_id", ids)
        .order("sort_order");
      const all = (its ?? []) as Item[];
      const grouped: Record<string, Item[]> = {};
      for (const it of all) (grouped[it.album_id] ||= []).push(it);
      setItems(grouped);
      const paths = [
        ...list.map((a) => a.cover_url),
        ...all.map((it) => it.thumbnail_url || it.file_url),
        ...all.map((it) => it.file_url),
      ];
      setSigned(await signAlbumPaths(paths, 3600));
      setSelectedAlbum(list[0].id);
    })();
  }, []);

  if (albums.length === 0) return null;

  const current = selectedAlbum ? items[selectedAlbum] ?? [] : [];
  const currentAlbum = albums.find((a) => a.id === selectedAlbum);
  const images = current.filter((i) => i.kind === "image");
  const videos = current.filter((i) => i.kind === "video");
  const activeList = mediaTab === "image" ? images : videos;

  return (
    <section className="max-w-7xl mx-auto px-4 lg:px-8 py-14" dir="rtl">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-[11px] sm:text-xs font-bold text-gold tracking-wider mb-4">
          <Camera className="h-3.5 w-3.5" />
          ألبوم الوسائط
        </div>
        <h2 className="text-2xl lg:text-3xl font-bold">لحظاتٌ من مسيرة العائلة</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl mx-auto">
          مختاراتٌ من الصور والفيديوهات التي توثّقُ حفلاتِ الزواج الجماعي واجتماعاتِ اللجان.
        </p>
      </div>

      {/* Album tabs */}
      <div className="flex flex-wrap gap-2 justify-center mb-6">
        {albums.map((a) => {
          const active = a.id === selectedAlbum;
          return (
            <button
              key={a.id}
              onClick={() => setSelectedAlbum(a.id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"}`}
            >
              {a.title}
              <span className={`text-xs ${active ? "opacity-80" : "text-muted-foreground"}`}>
                ({items[a.id]?.length ?? 0})
              </span>
            </button>
          );
        })}
      </div>

      {currentAlbum?.description && (
        <p className="text-center text-sm text-muted-foreground mb-6 max-w-2xl mx-auto whitespace-pre-wrap">
          {currentAlbum.description}
        </p>
      )}

      {/* Media type toggle */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex items-center gap-1 rounded-full border bg-card p-1 shadow-soft">
          <MediaTabBtn
            active={mediaTab === "image"}
            onClick={() => setMediaTab("image")}
            icon={<ImageIcon className="h-3.5 w-3.5" />}
            label="صور"
            count={images.length}
          />
          <MediaTabBtn
            active={mediaTab === "video"}
            onClick={() => setMediaTab("video")}
            icon={<VideoIcon className="h-3.5 w-3.5" />}
            label="فيديوهات"
            count={videos.length}
          />
        </div>
      </div>

      <DraggableBannersStage
        key={`${selectedAlbum}-${mediaTab}`}
        items={activeList}
        signed={signed}
        onOpen={(idx) => setLightbox({ items: activeList, index: idx })}
      />

      <Lightbox
        state={lightbox}
        signed={signed}
        onClose={() => setLightbox(null)}
        onNav={(dir) => setLightbox((s) => s && ({ ...s, index: (s.index + dir + s.items.length) % s.items.length }))}
      />
    </section>
  );
}

function MediaTabBtn({
  active, onClick, icon, label, count,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
        active
          ? "bg-primary text-primary-foreground shadow-elegant"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
      <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${active ? "bg-primary-foreground/20" : "bg-muted"}`}>
        {count}
      </span>
    </button>
  );
}

type Placement = { x: number; y: number; w: number; h: number };

function DraggableBannersStage({
  items, signed, onOpen,
}: { items: Item[]; signed: Record<string, string>; onOpen: (idx: number) => void }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  // Initialize placement based on stage size
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || placement) return;
    const rect = stage.getBoundingClientRect();
    const w = Math.min(880, rect.width - 40);
    const h = Math.min(460, rect.height - 40);
    setPlacement({
      x: Math.max(0, (rect.width - w) / 2),
      y: 20,
      w,
      h,
    });
  }, [placement]);

  const reset = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const w = Math.min(880, rect.width - 40);
    const h = Math.min(460, rect.height - 40);
    setPlacement({ x: Math.max(0, (rect.width - w) / 2), y: 20, w, h });
  };

  // Auto-advance
  useEffect(() => {
    if (!playing || items.length <= 1 || dragging || resizing) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, 3600);
    return () => clearInterval(t);
  }, [playing, items.length, dragging, resizing]);

  // Drag handler (header)
  const startDrag = (e: React.PointerEvent) => {
    if (!placement || !stageRef.current) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragging(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { ...placement };
    const stageRect = stageRef.current.getBoundingClientRect();

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const nx = Math.min(Math.max(0, orig.x + dx), stageRect.width - orig.w);
      const ny = Math.min(Math.max(0, orig.y + dy), stageRect.height - orig.h);
      setPlacement({ ...orig, x: nx, y: ny });
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Resize handler
  const startResize = (e: React.PointerEvent) => {
    if (!placement || !stageRef.current) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { ...placement };
    const stageRect = stageRef.current.getBoundingClientRect();

    const move = (ev: PointerEvent) => {
      // Resize handle is on the LEFT-bottom (RTL bottom-start)
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const newW = Math.min(Math.max(360, orig.w - dx), stageRect.width - orig.x);
      const newH = Math.min(Math.max(260, orig.h + dy), stageRect.height - orig.y);
      setPlacement({ ...orig, w: newW, h: newH });
    };
    const up = () => {
      setResizing(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // The three banners: prev / current / next
  const banners = items.length
    ? [-1, 0, 1].map((off) => {
        const i = ((index + off) % items.length + items.length) % items.length;
        return { item: items[i], realIndex: i, offset: off };
      })
    : [];

  return (
    <div
      ref={stageRef}
      className="relative w-full rounded-2xl overflow-hidden border border-border/60 bg-gradient-to-br from-muted/40 via-background to-muted/20"
      style={{
        height: "min(640px, 78vh)",
        minHeight: 480,
        backgroundImage:
          "radial-gradient(circle at 20% 20%, oklch(0.82 0.1 90 / 0.10), transparent 40%), radial-gradient(circle at 80% 80%, oklch(0.55 0.15 200 / 0.10), transparent 45%), linear-gradient(0deg, transparent 24px, oklch(0.55 0.02 200 / 0.06) 25px), linear-gradient(90deg, transparent 24px, oklch(0.55 0.02 200 / 0.06) 25px)",
        backgroundSize: "auto, auto, 25px 25px, 25px 25px",
      }}
      dir="ltr"
    >
      {/* Hint pill */}
      <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-background/80 backdrop-blur px-2.5 py-1 text-[10px] font-semibold text-muted-foreground border border-border/60 pointer-events-none">
        <Move className="h-3 w-3" /> اسحب الرأس • غيّر الحجم من الزاوية
      </div>
      <button
        onClick={reset}
        className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 rounded-full bg-background/80 backdrop-blur px-2.5 py-1 text-[10px] font-semibold text-muted-foreground border border-border/60 hover:text-foreground hover:bg-background"
      >
        <RotateCcw className="h-3 w-3" /> إعادة الترتيب
      </button>

      {placement && (
        <div
          ref={panelRef}
          className={`absolute rounded-2xl bg-card/95 backdrop-blur-xl border border-border shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)] ring-1 ring-primary/10 flex flex-col overflow-hidden select-none ${dragging || resizing ? "" : "transition-shadow"}`}
          style={{
            left: placement.x,
            top: placement.y,
            width: placement.w,
            height: placement.h,
          }}
          dir="rtl"
        >
          {/* Header (drag handle) */}
          <div
            onPointerDown={startDrag}
            className={`h-10 shrink-0 flex items-center gap-2 px-3 border-b bg-gradient-to-l from-muted/60 to-card ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
          >
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.72_0.18_25)]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.82_0.15_85)]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.72_0.18_150)]" />
            </div>
            <div className="flex-1 text-center text-[11px] font-semibold text-muted-foreground tracking-wide">
              معرض الوسائط · {items.length ? `${index + 1} / ${items.length}` : "0"}
            </div>
            <Move className="h-3.5 w-3.5 text-muted-foreground/60" />
          </div>

          {/* Body: 3 banners */}
          <div className="flex-1 relative bg-gradient-to-br from-background to-muted/30 overflow-hidden">
            {items.length === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                <ImageIcon className="h-10 w-10 opacity-50" />
                <span className="text-sm">لا يوجد محتوى بعد</span>
              </div>
            ) : (
              <div className="h-full w-full flex items-stretch gap-3 p-4">
                {banners.map(({ item, realIndex, offset }) => {
                  const isCenter = offset === 0;
                  const previewPath = item.thumbnail_url || (item.kind === "image" ? item.file_url : null);
                  const preview = previewPath ? signed[previewPath] : null;
                  return (
                    <button
                      key={`${item.id}-${offset}`}
                      onClick={() => {
                        if (isCenter) onOpen(realIndex);
                        else setIndex(realIndex);
                      }}
                      className={`group relative overflow-hidden rounded-xl border shadow-lg transition-all duration-500 ease-out ${
                        isCenter
                          ? "flex-[2] ring-2 ring-primary/60 scale-100 opacity-100"
                          : "flex-[1] opacity-70 hover:opacity-95 scale-[0.96] hover:scale-[0.99]"
                      }`}
                      style={{ minWidth: 0 }}
                    >
                      {preview ? (
                        <img
                          src={preview}
                          alt={item.title ?? ""}
                          loading="lazy"
                          className={`h-full w-full object-cover transition-transform duration-[6000ms] ease-out ${isCenter ? "group-hover:scale-110" : ""}`}
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-neutral-900 text-white/40">
                          <VideoIcon className="h-10 w-10" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />
                      {item.kind === "video" && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className={`rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center shadow-2xl ring-1 ring-white/30 transition-transform ${isCenter ? "h-14 w-14" : "h-9 w-9"}`}>
                            <Play className={`text-white translate-x-[2px] ${isCenter ? "h-6 w-6" : "h-4 w-4"}`} fill="white" />
                          </div>
                        </div>
                      )}
                      <div className={`absolute top-2 right-2 rounded-full bg-black/50 backdrop-blur px-2 py-0.5 font-semibold text-white ${isCenter ? "text-[11px]" : "text-[10px]"}`}>
                        {realIndex + 1}
                      </div>
                      {isCenter && item.title && (
                        <div className="absolute bottom-3 inset-x-3 text-white text-sm font-semibold text-center drop-shadow-lg">
                          {item.title}
                        </div>
                      )}
                      {isCenter && (
                        <div className="absolute top-2 left-2 rounded-full bg-primary/90 text-primary-foreground px-2 py-0.5 text-[10px] font-bold">
                          الحالي
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer controls */}
          <div className="h-12 shrink-0 flex items-center justify-between px-3 border-t bg-gradient-to-r from-card to-muted/40">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIndex((i) => (i - 1 + Math.max(1, items.length)) % Math.max(1, items.length))}
                className="h-8 w-8 rounded-full border bg-background hover:bg-accent flex items-center justify-center"
                aria-label="السابق"
                disabled={items.length === 0}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPlaying((p) => !p)}
                className="h-8 w-8 rounded-full bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center shadow"
                aria-label={playing ? "إيقاف" : "تشغيل"}
                disabled={items.length === 0}
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" fill="currentColor" />}
              </button>
              <button
                onClick={() => setIndex((i) => (i + 1) % Math.max(1, items.length))}
                className="h-8 w-8 rounded-full border bg-background hover:bg-accent flex items-center justify-center"
                aria-label="التالي"
                disabled={items.length === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            {/* Progress dots */}
            <div className="flex-1 mx-3 flex items-center gap-1 justify-center overflow-hidden">
              {items.slice(0, 30).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${i === index % Math.max(1, items.length) ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"}`}
                  aria-label={`عنصر ${i + 1}`}
                />
              ))}
              {items.length > 30 && (
                <span className="text-[10px] text-muted-foreground mr-1 tabular-nums">+{items.length - 30}</span>
              )}
            </div>

            <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
              {Math.round(placement.w)}×{Math.round(placement.h)}
            </span>
          </div>

          {/* Resize handle (bottom-left in RTL) */}
          <div
            onPointerDown={startResize}
            className={`absolute bottom-1 left-1 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 ${resizing ? "cursor-nesw-resize text-primary" : "cursor-nesw-resize"}`}
            style={{ touchAction: "none" }}
            aria-label="تغيير الحجم"
          >
            <Maximize2 className="h-3.5 w-3.5 -scale-x-100" />
          </div>
        </div>
      )}
    </div>
  );
}

function Lightbox({
  state, signed, onClose, onNav,
}: {
  state: { items: Item[]; index: number } | null;
  signed: Record<string, string>;
  onClose: () => void;
  onNav: (dir: number) => void;
}) {
  useEffect(() => {
    if (!state) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onNav(-1);
      if (e.key === "ArrowRight") onNav(1);
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [state, onNav, onClose]);

  if (!state) return null;
  const it = state.items[state.index];
  const url = signed[it.file_url];
  const external = /^https?:\/\//i.test(it.file_url) ? parseMediaUrl(it.file_url) : null;
  const embedUrl =
    external && "embedUrl" in external ? external.embedUrl : null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl bg-black/95 border-0 p-0" dir="rtl">
        <div className="relative">
          <button
            onClick={onClose}
            className="absolute top-2 right-2 z-10 h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
          {state.items.length > 1 && (
            <>
              <button
                onClick={() => onNav(1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                aria-label="السابق"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              <button
                onClick={() => onNav(-1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                aria-label="التالي"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            </>
          )}
          <div className="flex items-center justify-center min-h-[60vh] max-h-[85vh]">
            {embedUrl ? (
              <iframe
                src={`${embedUrl}?autoplay=1`}
                title={it.title ?? "video"}
                className="w-full aspect-video max-h-[85vh]"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            ) : it.kind === "image" ? (
              url ? <img src={url} alt={it.title ?? ""} className="max-h-[85vh] max-w-full object-contain" /> : null
            ) : (
              url ? (
                <video src={url} controls autoPlay className="max-h-[85vh] max-w-full">
                  متصفحك لا يدعم تشغيل الفيديو.
                </video>
              ) : null
            )}
          </div>
          {it.title && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-center text-white text-sm">
              {it.title}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}