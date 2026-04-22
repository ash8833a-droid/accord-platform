
-- Allow public (anonymous) submissions to grooms registration form
DROP POLICY IF EXISTS grooms_public_insert ON public.grooms;
CREATE POLICY grooms_public_insert
  ON public.grooms
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'new'::groom_status AND created_by IS NULL);

-- Storage policies for groom-public bucket (used by /register-groom)
DROP POLICY IF EXISTS groom_public_read ON storage.objects;
CREATE POLICY groom_public_read
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'groom-public');

DROP POLICY IF EXISTS groom_public_insert ON storage.objects;
CREATE POLICY groom_public_insert
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'groom-public');
