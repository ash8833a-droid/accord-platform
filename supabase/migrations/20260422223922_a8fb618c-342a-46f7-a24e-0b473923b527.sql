
-- Remove broad SELECT policy that allows listing all files
DROP POLICY IF EXISTS groom_public_read ON storage.objects;

-- Public URLs (via CDN getPublicUrl) still work for public buckets without a SELECT policy.
-- Authenticated staff can still read via authenticated role.
CREATE POLICY groom_public_read_auth
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'groom-public');
