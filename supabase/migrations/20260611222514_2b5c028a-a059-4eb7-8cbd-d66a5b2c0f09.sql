
CREATE TABLE public.wedding_archive_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_year INTEGER NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('grooms','media','programs','finance','organization')),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  file_type TEXT,
  file_size BIGINT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wedding_archive_items TO authenticated;
GRANT ALL ON public.wedding_archive_items TO service_role;

ALTER TABLE public.wedding_archive_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view archive items"
  ON public.wedding_archive_items FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can create archive items"
  ON public.wedding_archive_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update archive items"
  ON public.wedding_archive_items FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins or owners can delete archive items"
  ON public.wedding_archive_items FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = created_by);

CREATE INDEX idx_wedding_archive_year ON public.wedding_archive_items(wedding_year);
CREATE INDEX idx_wedding_archive_category ON public.wedding_archive_items(category);

CREATE TRIGGER trg_wedding_archive_updated
  BEFORE UPDATE ON public.wedding_archive_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for wedding-archive bucket
CREATE POLICY "Authenticated can read wedding-archive"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'wedding-archive');

CREATE POLICY "Authenticated can upload to wedding-archive"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'wedding-archive');

CREATE POLICY "Admins can update wedding-archive"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'wedding-archive' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins or owners can delete wedding-archive"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'wedding-archive' AND (public.has_role(auth.uid(), 'admin') OR owner = auth.uid()));
