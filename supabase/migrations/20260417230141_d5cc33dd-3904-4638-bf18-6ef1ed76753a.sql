-- Extend reports table to support committee archive uploads + admin year tagging
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS archive_year integer,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS file_type text,
  ADD COLUMN IF NOT EXISTS file_size bigint;

-- Allow admins (and quality) to update reports for archive tagging
DROP POLICY IF EXISTS reports_admin_update ON public.reports;
CREATE POLICY reports_admin_update ON public.reports
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'quality'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'quality'::app_role));

-- Allow committee members to upload reports for their committee (extends existing reports_insert)
DROP POLICY IF EXISTS reports_insert ON public.reports;
CREATE POLICY reports_insert ON public.reports
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'quality'::app_role)
    OR (committee_id IS NOT NULL AND is_committee_member(auth.uid(), committee_id))
  );

-- Storage policies for the existing 'reports' bucket
-- Allow authenticated users to read report files (they're referenced from the app)
DROP POLICY IF EXISTS "reports_read_auth" ON storage.objects;
CREATE POLICY "reports_read_auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'reports');

-- Allow authenticated approved users to upload to reports bucket
DROP POLICY IF EXISTS "reports_upload_auth" ON storage.objects;
CREATE POLICY "reports_upload_auth" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reports' AND is_user_approved(auth.uid()));

-- Allow admins to delete report files
DROP POLICY IF EXISTS "reports_delete_admin" ON storage.objects;
CREATE POLICY "reports_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'reports' AND has_role(auth.uid(), 'admin'::app_role));