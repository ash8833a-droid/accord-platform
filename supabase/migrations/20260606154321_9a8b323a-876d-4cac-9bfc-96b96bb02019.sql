
-- 1 & 2: 'grooms' bucket — unused for client writes; remove unsafe anon insert/update.
DROP POLICY IF EXISTS grooms_public_insert ON storage.objects;
DROP POLICY IF EXISTS grooms_public_update ON storage.objects;

-- 3: 'groom-public' bucket — keep anon insert (public registration) but constrain path.
DROP POLICY IF EXISTS groom_public_insert ON storage.objects;
CREATE POLICY groom_public_insert
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'groom-public'
    AND (
      (storage.foldername(name))[1] = 'photo'
      OR (storage.foldername(name))[1] = 'id'
    )
  );

-- 4 & 5: 'minutes' bucket — strip quality-role bypass from write policies.
DROP POLICY IF EXISTS minutes_storage_insert ON storage.objects;
CREATE POLICY minutes_storage_insert
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'minutes'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR is_committee_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  );

DROP POLICY IF EXISTS minutes_storage_update ON storage.objects;
CREATE POLICY minutes_storage_update
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'minutes'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR is_committee_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  )
  WITH CHECK (
    bucket_id = 'minutes'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR is_committee_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  );

DROP POLICY IF EXISTS minutes_storage_delete ON storage.objects;
CREATE POLICY minutes_storage_delete
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'minutes'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR is_committee_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  );
