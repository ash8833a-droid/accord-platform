import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signAlbumPaths } from "@/lib/media-album";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Video as VideoIcon, X, ChevronLeft, ChevronRight, Play } from "lucide-react";

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

      {current.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">لا توجد وسائط في هذا الألبوم بعد.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {current.map((it, idx) => {
            const previewPath = it.thumbnail_url || (it.kind === "image" ? it.file_url : null);
            const preview = previewPath ? signed[previewPath] : null;
            return (
              <button
                key={it.id}
                onClick={() => setLightbox({ items: current, index: idx })}
                className="group relative rounded-xl overflow-hidden border bg-muted aspect-square shadow-soft hover:shadow-elegant transition-shadow"
              >
                {preview ? (
                  <img src={preview} alt={it.title ?? ""} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                    <VideoIcon className="h-8 w-8" />
                  </div>
                )}
                {it.kind === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="h-12 w-12 rounded-full bg-black/55 backdrop-blur flex items-center justify-center shadow-lg">
                      <Play className="h-6 w-6 text-white translate-x-[1px]" fill="white" />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <Lightbox
        state={lightbox}
        signed={signed}
        onClose={() => setLightbox(null)}
        onNav={(dir) => setLightbox((s) => s && ({ ...s, index: (s.index + dir + s.items.length) % s.items.length }))}
      />
    </section>
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
            {it.kind === "image" ? (
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