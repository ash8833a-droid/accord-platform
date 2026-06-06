DROP POLICY IF EXISTS "minutes_storage_select" ON storage.objects;
CREATE POLICY "minutes_storage_select_scoped"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'minutes' AND (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'quality') OR
    public.is_supreme_member(auth.uid()) OR
    public.is_committee_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);