
-- 1) Tighten 'grooms' bucket read access (bucket already set private via storage tool)
DROP POLICY IF EXISTS "grooms_public_read" ON storage.objects;

CREATE POLICY "grooms_scoped_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'grooms'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'quality'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.committees c ON c.id = ur.committee_id
      WHERE ur.user_id = auth.uid()
        AND c.type = ANY (ARRAY['media'::committee_type, 'programs'::committee_type, 'reception'::committee_type])
    )
  )
);

-- 2) historical_shareholders INSERT: restrict role to authenticated only
DROP POLICY IF EXISTS "hs_insert" ON public.historical_shareholders;

CREATE POLICY "hs_insert"
ON public.historical_shareholders FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.committees c ON c.id = ur.committee_id
    WHERE ur.user_id = auth.uid()
      AND c.type = 'finance'::committee_type
  )
);

-- 3) Realtime: restrict to approved app members (users with at least one role)
DROP POLICY IF EXISTS "realtime_authenticated_only" ON realtime.messages;

CREATE POLICY "realtime_approved_members_only"
ON realtime.messages FOR SELECT
TO authenticated
USING (public.is_user_approved(auth.uid()));

-- 4) Tighten reports storage read: also verify caller is a member of the
--    committee that owns the report row referenced by file_url
DROP POLICY IF EXISTS "reports_read_scoped" ON storage.objects;

CREATE POLICY "reports_read_scoped"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'reports'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'quality'::app_role)
    OR is_supreme_member(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.file_url = storage.objects.name
        AND (
          r.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.committee_id = r.committee_id
          )
        )
    )
  )
);
