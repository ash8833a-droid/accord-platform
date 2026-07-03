DROP POLICY IF EXISTS groom_public_read_auth ON storage.objects;
CREATE POLICY groom_public_read_auth ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'groom-public' AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'quality'::app_role)
    OR EXISTS (
      SELECT 1 FROM user_roles ur JOIN committees c ON c.id = ur.committee_id
      WHERE ur.user_id = auth.uid() AND c.type = ANY (ARRAY['programs'::committee_type, 'reception'::committee_type])
    )
  )
);