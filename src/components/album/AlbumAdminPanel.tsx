import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Pencil, Trash2, Upload, Eye, EyeOff, Image as ImageIcon, Video, Link as LinkIcon } from "lucide-react";
import { compressIfNeeded } from "@/lib/media-compression";
import { extractVideoThumbnail } from "@/lib/video-thumbnail";
import { uploadAlbumFile, signAlbumPaths, removeAlbumFiles } from "@/lib/media-album";
import { parseMediaUrlDetailed, fetchVimeoThumbnail } from "@/lib/media-url";
import { listDriveFolder, extractDriveFolderId } from "@/lib/drive-folder.functions";
import { COMPRESS_TARGET_SIZE, MAX_UPLOAD_SIZE, MAX_UPLOAD_SIZE_LABEL } from "@/lib/uploads";

interface Album {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
}
interface Item {
  id: string;
  album_id: string;
  kind: "image" | "video";
  file_url: string;
  thumbnail_url: string | null;
  title: string | null;
  sort_order: number;
  created_at: string;
}

export function AlbumAdminPanel() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [items, setItems] = useState<Record<string, Item[]>>({});
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Album | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string>("");
  const [confirmDelAlbum, setConfirmDelAlbum] = useState<Album | null>(null);
  const [confirmDelItem, setConfirmDelItem] = useState<Item | null>(null);
  const [urlDialog, setUrlDialog] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const [urlKind, setUrlKind] = useState<"image" | "video">("image");
  const [urlBusy, setUrlBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [{ data: alb }, { data: its }] = await Promise.all([
      supabase.from("media_albums").select("*").order("sort_order").order("created_at", { ascending: false }),
      supabase.from("media_items").select("*").order("sort_order"),
    ]);
    const list = (alb ?? []) as Album[];
    const all = (its ?? []) as Item[];
    const grouped: Record<string, Item[]> = {};
    for (const it of all) (grouped[it.album_id] ||= []).push(it);
    setAlbums(list);
    setItems(grouped);
    const paths = [
      ...list.map((a) => a.cover_url),
      ...all.map((it) => it.thumbnail_url || it.file_url),
      ...all.map((it) => it.file_url),
    ];
    setSigned(await signAlbumPaths(paths));
    if (!selected && list.length) setSelected(list[0].id);
    setLoading(false);
  }, [selected]);

  useEffect(() => { refresh(); }, [refresh]);

  const currentAlbum = albums.find((a) => a.id === selected) ?? null;
  const currentItems = selected ? items[selected] ?? [] : [];

  const saveAlbum = async (form: { title: string; description: string; is_published: boolean }) => {
    if (!form.title.trim()) return toast.error("العنوان مطلوب");
    if (editing) {
      const { error } = await supabase.from("media_albums")
        .update({ title: form.title.trim(), description: form.description.trim() || null, is_published: form.is_published })
        .eq("id", editing.id);
      if (error) return toast.error("فشل الحفظ", { description: error.message });
      toast.success("تم تحديث الألبوم");
    } else {
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("media_albums")
        .insert({
          title: form.title.trim(),
          description: form.description.trim() || null,
          is_published: form.is_published,
          created_by: userRes.user?.id ?? null,
          sort_order: albums.length,
        })
        .select("id").single();
      if (error) return toast.error("فشل الإنشاء", { description: error.message });
      toast.success("تم إنشاء الألبوم");
      if (data) setSelected(data.id);
    }
    setShowForm(false);
    setEditing(null);
    await refresh();
  };

  const deleteAlbum = async (a: Album) => {
    const paths: string[] = [];
    if (a.cover_url) paths.push(a.cover_url);
    for (const it of items[a.id] ?? []) {
      paths.push(it.file_url);
      if (it.thumbnail_url) paths.push(it.thumbnail_url);
    }
    await removeAlbumFiles(paths);
    const { error } = await supabase.from("media_albums").delete().eq("id", a.id);
    if (error) return toast.error("فشل الحذف", { description: error.message });
    toast.success("تم حذف الألبوم");
    setConfirmDelAlbum(null);
    if (selected === a.id) setSelected(null);
    await refresh();
  };

  const deleteItem = async (it: Item) => {
    await removeAlbumFiles([it.file_url, it.thumbnail_url]);
    const { error } = await supabase.from("media_items").delete().eq("id", it.id);
    if (error) return toast.error("فشل الحذف", { description: error.message });
    toast.success("تم حذف العنصر");
    setConfirmDelItem(null);
    await refresh();
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || !selected) return;
    const arr = Array.from(files);
    setUploadBusy(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      for (let i = 0; i < arr.length; i++) {
        let f = arr[i];
        setUploadMsg(`جاري رفع ${i + 1} من ${arr.length}: ${f.name}`);
        if (f.size > MAX_UPLOAD_SIZE) {
          toast.error(`${f.name} أكبر من ${MAX_UPLOAD_SIZE_LABEL}`);
          continue;
        }
        const type = (f.type || "").toLowerCase();
        const isImg = type.startsWith("image/") || /\.(png|jpe?g|webp|heic|heif|gif)$/i.test(f.name);
        const isVid = type.startsWith("video/") || /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(f.name);
        if (!isImg && !isVid) { toast.error(`${f.name}: نوع غير مدعوم`); continue; }

        try {
          f = await compressIfNeeded(f, COMPRESS_TARGET_SIZE, (info) => {
            if (info.message) setUploadMsg(info.message);
          });
        } catch { /* keep original */ }

        const kind: "image" | "video" = isVid ? "video" : "image";
        const filePath = await uploadAlbumFile(f, `album/${selected}/files`);

        let thumbPath: string | null = null;
        if (kind === "video") {
          setUploadMsg("جاري استخراج صورة مصغّرة…");
          const thumb = await extractVideoThumbnail(f).catch(() => null);
          if (thumb) {
            try {
              thumbPath = await uploadAlbumFile(thumb, `album/${selected}/thumbs`);
            } catch { /* ignore */ }
          }
        }

        const { error } = await supabase.from("media_items").insert({
          album_id: selected,
          kind,
          file_url: filePath,
          thumbnail_url: thumbPath,
          title: f.name,
          sort_order: (items[selected]?.length ?? 0) + i,
          created_by: userRes.user?.id ?? null,
        });
        if (error) toast.error(`فشل حفظ ${f.name}`, { description: error.message });
      }
      toast.success("تم رفع الوسائط");
      await refresh();
    } finally {
      setUploadBusy(false);
      setUploadMsg("");
    }
  };

  const setCover = async (it: Item) => {
    const cover = it.thumbnail_url ?? it.file_url;
    const { error } = await supabase.from("media_albums")
      .update({ cover_url: cover }).eq("id", it.album_id);
    if (error) return toast.error("فشل تعيين الغلاف", { description: error.message });
    toast.success("تم تعيين الغلاف");
    await refresh();
  };

  const addFromUrl = async () => {
    if (!selected) return;
    const rawLines = urlInput.split(/\r?\n|\s{2,}/).map((s) => s.trim()).filter(Boolean);
    if (rawLines.length === 0) {
      toast.error("أدخل رابطًا واحدًا على الأقل");
      return;
    }
    setUrlBusy(true);
    let okCount = 0;
    const errors: string[] = [];
    try {
      // Expand Google Drive folder links → individual file links
      const lines: string[] = [];
      const perLineKind: Record<string, "image" | "video" | undefined> = {};
      for (const line of rawLines) {
        const folderId = /drive\.google\.com\/.*\/folders\//i.test(line)
          ? extractDriveFolderId(line)
          : null;
        if (folderId) {
          setUploadMsg(`جاري قراءة مجلد Drive…`);
          try {
            const res = await listDriveFolder({ data: { folderId } });
            if (res.items.length === 0) {
              errors.push(`المجلد فارغ أو غير مشارك بشكل عام (${folderId.slice(0, 8)}…)`);
              continue;
            }
            for (const it of res.items) {
              const fileUrl = `https://drive.google.com/file/d/${it.id}/view`;
              lines.push(fileUrl);
              perLineKind[fileUrl] = it.kind;
            }
          } catch (e: any) {
            errors.push(`تعذّر قراءة المجلد: ${e?.message ?? "خطأ غير معروف"}`);
          }
        } else {
          lines.push(line);
        }
      }
      setUploadMsg("");
      if (lines.length === 0) {
        toast.error("لم يتم العثور على وسائط", {
          description: errors.slice(0, 3).join(" • "),
        });
        return;
      }
      const { data: userRes } = await supabase.auth.getUser();
      let order = items[selected]?.length ?? 0;
      for (const line of lines) {
        const effectiveKind = perLineKind[line] ?? urlKind;
        const parsed = parseMediaUrlDetailed(line, effectiveKind);
        if (!("kind" in parsed)) {
          const short = line.length > 60 ? line.slice(0, 60) + "…" : line;
          const why =
            parsed.code === "gdrive_folder" ? "مجلد Drive (استخدم روابط الملفات المفردة)" :
            parsed.code === "gdrive_needs_kind" ? "حدد نوع محتوى Drive (صورة/فيديو)" :
            parsed.code === "invalid" ? "رابط غير صالح" :
            "غير مدعوم";
          errors.push(`${short} — ${why}`);
          continue;
        }
        let thumb: string | null = null;
        let kind: "image" | "video";
        let fileUrl: string;
        if (parsed.kind === "image") {
          kind = "image";
          fileUrl = parsed.url;
          if (parsed.provider === "gdrive") thumb = parsed.thumbnailUrl;
        } else {
          kind = "video";
          fileUrl = parsed.url;
          if (parsed.provider === "youtube") thumb = parsed.thumbnailUrl;
          else if (parsed.provider === "vimeo") thumb = await fetchVimeoThumbnail(parsed.id);
          else if (parsed.provider === "gdrive") thumb = parsed.thumbnailUrl;
        }
        const { error } = await supabase.from("media_items").insert({
          album_id: selected,
          kind,
          file_url: fileUrl,
          thumbnail_url: thumb,
          title: (lines.length === 1 ? urlTitle.trim() : "") || null,
          sort_order: order++,
          created_by: userRes.user?.id ?? null,
        });
        if (error) errors.push(`فشل الحفظ: ${error.message}`);
        else okCount++;
      }
      if (okCount > 0) toast.success(`تمت إضافة ${okCount} رابط`);
      if (errors.length > 0) {
        toast.error(`تعذّر إضافة ${errors.length} رابط`, {
          description: errors.slice(0, 3).join(" • ") + (errors.length > 3 ? " …" : ""),
        });
      }
      if (okCount > 0) {
        setUrlDialog(false);
        setUrlInput("");
        setUrlTitle("");
        await refresh();
      }
    } finally {
      setUrlBusy(false);
    }
  };

  const togglePublish = async (a: Album) => {
    const { error } = await supabase.from("media_albums")
      .update({ is_published: !a.is_published }).eq("id", a.id);
    if (error) return toast.error("فشل التحديث", { description: error.message });
    await refresh();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">إدارة ألبوم الوسائط</h1>
          <p className="text-sm text-muted-foreground mt-1">أنشئ ألبومات حسب المناسبة وارفع الصور والفيديوهات — تُستخرج صور مصغّرة تلقائيًا من الفيديوهات.</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> ألبوم جديد
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Sidebar: albums list */}
        <aside className="space-y-2">
          {albums.length === 0 && (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              لا توجد ألبومات بعد. أنشئ أول ألبوم للبدء.
            </div>
          )}
          {albums.map((a) => {
            const cover = a.cover_url ? signed[a.cover_url] : null;
            const count = items[a.id]?.length ?? 0;
            const active = a.id === selected;
            return (
              <button
                key={a.id}
                onClick={() => setSelected(a.id)}
                className={`w-full text-right rounded-xl border p-3 flex items-center gap-3 transition-colors ${active ? "bg-primary/10 border-primary/40" : "hover:bg-accent"}`}
              >
                <div className="h-14 w-14 rounded-lg overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                  {cover ? (
                    <img src={cover} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{a.title}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span>{count} عنصر</span>
                    {!a.is_published && <span className="text-amber-600">• مخفي</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </aside>

        {/* Main: current album */}
        <section>
          {!currentAlbum ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
              اختر ألبومًا من القائمة أو أنشئ ألبومًا جديدًا.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border p-4 bg-card">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold">{currentAlbum.title}</h2>
                    {currentAlbum.description && (
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{currentAlbum.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => togglePublish(currentAlbum)}>
                      {currentAlbum.is_published ? <><EyeOff className="h-4 w-4" /> إخفاء</> : <><Eye className="h-4 w-4" /> نشر</>}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => { setEditing(currentAlbum); setShowForm(true); }}>
                      <Pencil className="h-4 w-4" /> تعديل
                    </Button>
                    <Button size="sm" variant="destructive" className="gap-2" onClick={() => setConfirmDelAlbum(currentAlbum)}>
                      <Trash2 className="h-4 w-4" /> حذف
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3 flex-wrap">
                  <label className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold cursor-pointer ${uploadBusy ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground hover:opacity-90"}`}>
                    {uploadBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    رفع صور / فيديوهات
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      className="hidden"
                      disabled={uploadBusy}
                      onChange={(e) => { handleUpload(e.target.files); e.currentTarget.value = ""; }}
                    />
                  </label>
                  <Button variant="outline" className="gap-2" onClick={() => setUrlDialog(true)} disabled={uploadBusy}>
                    <LinkIcon className="h-4 w-4" /> إضافة عبر رابط
                  </Button>
                  {uploadBusy && uploadMsg && (
                    <span className="text-xs text-muted-foreground">{uploadMsg}</span>
                  )}
                </div>
              </div>

              {currentItems.length === 0 ? (
                <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
                  لا توجد وسائط في هذا الألبوم بعد.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {currentItems.map((it) => {
                    const previewPath = it.thumbnail_url || (it.kind === "image" ? it.file_url : null);
                    const previewUrl = previewPath ? signed[previewPath] : null;
                    return (
                      <div key={it.id} className="group relative rounded-xl overflow-hidden border bg-muted aspect-square">
                        {previewUrl ? (
                          <img src={previewUrl} alt={it.title ?? ""} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                            <Video className="h-8 w-8" />
                          </div>
                        )}
                        {it.kind === "video" && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="h-10 w-10 rounded-full bg-black/50 flex items-center justify-center">
                              <Video className="h-5 w-5 text-white" />
                            </div>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                          <Button size="sm" variant="secondary" className="gap-1" onClick={() => setCover(it)}>
                            <ImageIcon className="h-3.5 w-3.5" /> غلاف
                          </Button>
                          <Button size="sm" variant="destructive" className="gap-1" onClick={() => setConfirmDelItem(it)}>
                            <Trash2 className="h-3.5 w-3.5" /> حذف
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Album form dialog */}
      <AlbumFormDialog
        open={showForm}
        initial={editing}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSave={saveAlbum}
      />

      {/* Confirmations */}
      <AlertDialog open={!!confirmDelAlbum} onOpenChange={(o) => !o && setConfirmDelAlbum(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الألبوم؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف الألبوم وجميع الوسائط بداخله نهائيًا. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelAlbum && deleteAlbum(confirmDelAlbum)}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelItem} onOpenChange={(o) => !o && setConfirmDelItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الوسيط؟</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف الملف نهائيًا.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelItem && deleteItem(confirmDelItem)}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add via URL dialog */}
      <Dialog open={urlDialog} onOpenChange={(o) => !urlBusy && setUrlDialog(o)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة وسائط عبر رابط</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الروابط (رابط في كل سطر)</Label>
              <Textarea
                dir="ltr"
                rows={6}
                placeholder={"https://youtube.com/watch?v=...\nhttps://drive.google.com/file/d/FILE_ID/view\nhttps://example.com/image.jpg"}
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                الصق عدة روابط دفعة واحدة (سطر لكل رابط). يدعم YouTube و Vimeo و Google Drive (ملفات مفردة) وروابط الصور/الفيديو المباشرة. لمجلدات Drive: افتح المجلد، حدّد الملفات، انسخ روابطها والصقها هنا.
              </p>
            </div>
            {/drive\.google\.com/i.test(urlInput) && (
              <div className="space-y-2">
                <Label>نوع المحتوى (لروابط Google Drive)</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={urlKind === "image" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUrlKind("image")}
                  >صورة</Button>
                  <Button
                    type="button"
                    variant={urlKind === "video" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUrlKind("video")}
                  >فيديو</Button>
                </div>
                <p className="text-xs text-muted-foreground">تأكد أن مشاركة الملف على Drive مضبوطة على «Anyone with the link».</p>
              </div>
            )}
            {urlInput.trim().split(/\r?\n/).filter((s) => s.trim()).length <= 1 && (
              <div className="space-y-2">
                <Label>عنوان (اختياري)</Label>
                <Input value={urlTitle} onChange={(e) => setUrlTitle(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUrlDialog(false)} disabled={urlBusy}>إلغاء</Button>
            <Button onClick={addFromUrl} disabled={urlBusy || !urlInput.trim()} className="gap-2">
              {urlBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AlbumFormDialog({
  open, initial, onClose, onSave,
}: {
  open: boolean;
  initial: Album | null;
  onClose: () => void;
  onSave: (form: { title: string; description: string; is_published: boolean }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(true);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setDescription(initial?.description ?? "");
      setIsPublished(initial?.is_published ?? true);
    }
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>{initial ? "تعديل الألبوم" : "ألبوم جديد"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>العنوان</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: زفاف 2025" />
          </div>
          <div className="space-y-2">
            <Label>الوصف (اختياري)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="font-semibold text-sm">منشور للزوار</div>
              <div className="text-xs text-muted-foreground">عند الإخفاء لن يظهر الألبوم في الصفحة الرئيسية.</div>
            </div>
            <Switch checked={isPublished} onCheckedChange={setIsPublished} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => onSave({ title, description, is_published: isPublished })}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}