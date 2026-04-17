
-- RLS policies for invoices bucket
-- Allow committee members to upload invoices for their own committee folder
-- Path convention: {committee_id}/{filename}

CREATE POLICY "invoices_upload_committee_members"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoices'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.is_committee_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "invoices_select_committee_members"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'invoices'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'quality')
    OR public.is_committee_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "invoices_delete_admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'invoices'
  AND public.has_role(auth.uid(), 'admin')
);
