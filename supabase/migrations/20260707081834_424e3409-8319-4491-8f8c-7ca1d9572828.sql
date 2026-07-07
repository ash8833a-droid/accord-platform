
-- Media albums
CREATE TABLE public.media_albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.media_albums TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_albums TO authenticated;
GRANT ALL ON public.media_albums TO service_role;

ALTER TABLE public.media_albums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published albums"
  ON public.media_albums FOR SELECT
  USING (is_published = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert albums"
  ON public.media_albums FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update albums"
  ON public.media_albums FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete albums"
  ON public.media_albums FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Media items
CREATE TABLE public.media_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID NOT NULL REFERENCES public.media_albums(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('image','video')),
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  title TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_items_album ON public.media_items(album_id, sort_order);

GRANT SELECT ON public.media_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_items TO authenticated;
GRANT ALL ON public.media_items TO service_role;

ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view items of published albums"
  ON public.media_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.media_albums a
      WHERE a.id = media_items.album_id
        AND (a.is_published = true OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Admins can insert media items"
  ON public.media_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update media items"
  ON public.media_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete media items"
  ON public.media_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE TRIGGER media_albums_updated_at
  BEFORE UPDATE ON public.media_albums
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies on media-album bucket
CREATE POLICY "Public read of media-album"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media-album');

CREATE POLICY "Admins upload to media-album"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media-album' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update media-album"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media-album' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete media-album"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media-album' AND public.has_role(auth.uid(), 'admin'));
