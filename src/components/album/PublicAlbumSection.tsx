import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signAlbumPaths } from "@/lib/media-album";
import { parseMediaUrl } from "@/lib/media-url";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Camera, Video as VideoIcon, X, ChevronLeft, ChevronRight, Play, Image as ImageIcon, Pause } from "lucide-react";

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

      <PhoneCarousel
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

function PhoneCarousel({
  items, signed, onOpen,
}: { items: Item[]; signed: Record<string, string>; onOpen: (idx: number) => void }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  // Auto-advance
  useEffect(() => {
    if (!playing || items.length <= 1) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, 3800);
    return () => clearInterval(t);
  }, [playing, items.length]);

  // Scroll to index
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const child = el.children[index] as HTMLElement | undefined;
    if (child) el.scrollTo({ left: child.offsetLeft, behavior: "smooth" });
  }, [index]);

  // Track manual scroll
  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const width = el.clientWidth;
    const i = Math.round(el.scrollLeft / width);
    if (i !== index) setIndex(i);
  };

  if (items.length === 0) {
    return (
      <PhoneFrame>
        <div className="h-full w-full flex flex-col items-center justify-center text-white/70 gap-2">
          <ImageIcon className="h-10 w-10 opacity-50" />
          <span className="text-sm">لا يوجد محتوى بعد</span>
        </div>
      </PhoneFrame>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <PhoneFrame>
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          onMouseEnter={() => setPlaying(false)}
          onMouseLeave={() => setPlaying(true)}
          className="h-full w-full overflow-x-auto snap-x snap-mandatory flex scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((it, idx) => {
            const previewPath = it.thumbnail_url || (it.kind === "image" ? it.file_url : null);
            const preview = previewPath ? signed[previewPath] : null;
            return (
              <button
                key={it.id}
                onClick={() => onOpen(idx)}
                className="relative shrink-0 w-full h-full snap-center overflow-hidden group"
              >
                {preview ? (
                  <img
                    src={preview}
                    alt={it.title ?? ""}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-[6000ms] ease-out group-hover:scale-110"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-neutral-900 text-white/40">
                    <VideoIcon className="h-10 w-10" />
                  </div>
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
                {it.kind === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="h-16 w-16 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center shadow-2xl ring-1 ring-white/30 group-hover:scale-110 transition-transform">
                      <Play className="h-7 w-7 text-white translate-x-[2px]" fill="white" />
                    </div>
                  </div>
                )}
                {it.title && (
                  <div className="absolute bottom-3 inset-x-3 text-white text-xs font-semibold text-center drop-shadow">
                    {it.title}
                  </div>
                )}
                <div className="absolute top-3 left-3 rounded-full bg-black/40 backdrop-blur px-2 py-0.5 text-[10px] text-white font-semibold">
                  {idx + 1} / {items.length}
                </div>
              </button>
            );
          })}
        </div>
      </PhoneFrame>

      {/* Controls */}
      <div className="flex items-center gap-3 mt-5">
        <button
          onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)}
          className="h-9 w-9 rounded-full border bg-card hover:bg-accent flex items-center justify-center transition-colors"
          aria-label="السابق"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <button
          onClick={() => setPlaying((p) => !p)}
          className="h-9 w-9 rounded-full bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center shadow-elegant"
          aria-label={playing ? "إيقاف" : "تشغيل"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" fill="currentColor" />}
        </button>

        <button
          onClick={() => setIndex((i) => (i + 1) % items.length)}
          className="h-9 w-9 rounded-full border bg-card hover:bg-accent flex items-center justify-center transition-colors"
          aria-label="التالي"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Dots */}
      {items.length > 1 && items.length <= 20 && (
        <div className="flex items-center gap-1.5 mt-4 flex-wrap justify-center max-w-md">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"}`}
              aria-label={`الانتقال إلى ${i + 1}`}
            />
          ))}
        </div>
      )}
      {items.length > 20 && (
        <div className="mt-4 text-xs text-muted-foreground font-mono tabular-nums">
          {index + 1} / {items.length}
        </div>
      )}
    </div>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto" style={{ width: "min(320px, 92vw)" }}>
      {/* Ambient glow */}
      <div
        aria-hidden
        className="absolute -inset-8 -z-10 rounded-[3rem] blur-3xl opacity-60"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, oklch(0.82 0.1 90 / 0.35), transparent 60%), radial-gradient(circle at 70% 80%, oklch(0.55 0.15 200 / 0.3), transparent 60%)",
        }}
      />
      {/* Phone body */}
      <div className="relative rounded-[2.5rem] p-2 bg-gradient-to-b from-neutral-800 via-neutral-900 to-black shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/5">
        {/* Side buttons */}
        <span className="absolute right-[-3px] top-24 h-10 w-[3px] rounded-l bg-neutral-700" />
        <span className="absolute left-[-3px] top-20 h-6 w-[3px] rounded-r bg-neutral-700" />
        <span className="absolute left-[-3px] top-32 h-12 w-[3px] rounded-r bg-neutral-700" />
        <span className="absolute left-[-3px] top-48 h-12 w-[3px] rounded-r bg-neutral-700" />

        {/* Screen */}
        <div className="relative rounded-[2rem] overflow-hidden bg-black" style={{ aspectRatio: "9 / 16" }}>
          {/* Dynamic island */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 h-6 w-24 rounded-full bg-black ring-1 ring-white/10 flex items-center justify-end pr-2 gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-700" />
            <span className="h-1 w-1 rounded-full bg-neutral-800" />
          </div>
          {children}
        </div>
      </div>
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