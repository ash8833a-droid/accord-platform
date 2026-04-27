INSERT INTO storage.buckets (id, name, public) VALUES ('brand-assets', 'brand-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "brand_assets_public_read" ON storage.objects;
CREATE POLICY "brand_assets_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'brand-assets');

DROP POLICY IF EXISTS "brand_assets_admin_insert" ON storage.objects;
CREATE POLICY "brand_assets_admin_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'brand-assets' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "brand_assets_admin_update" ON storage.objects;
CREATE POLICY "brand_assets_admin_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'brand-assets' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "brand_assets_admin_delete" ON storage.objects;
CREATE POLICY "brand_assets_admin_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'brand-assets' AND public.has_role(auth.uid(), 'admin'));

INSERT INTO public.app_settings (key, value)
VALUES ('brand_identity', '{
  "name": "منصة عمل لجنة الزواج الجماعي",
  "subtitle": "لقبيلة الهملة من قريش",
  "logo_url": null,
  "primary_color": "#1B4F58",
  "gold_color": "#C4A25C"
}'::jsonb)
ON CONFLICT (key) DO NOTHING;