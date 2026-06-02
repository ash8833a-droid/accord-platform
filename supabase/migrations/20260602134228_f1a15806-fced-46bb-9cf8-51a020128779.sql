
-- 1) committee_evaluations: restrict SELECT
DROP POLICY IF EXISTS ce_select_auth ON public.committee_evaluations;
CREATE POLICY ce_select_scoped ON public.committee_evaluations
  FOR SELECT TO authenticated
  USING (
    auth.uid() = evaluator_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'quality'::app_role)
  );

-- 2) team_members: revoke email/phone from authenticated (admin/quality role can still read via service or future RPC)
REVOKE SELECT (email, phone) ON public.team_members FROM authenticated;
REVOKE SELECT (email, phone) ON public.team_members FROM anon;

-- 3) minutes storage: restrict writes to admins or committee members (anyone with a committee role)
DROP POLICY IF EXISTS minutes_storage_insert ON storage.objects;
DROP POLICY IF EXISTS minutes_storage_update ON storage.objects;
DROP POLICY IF EXISTS minutes_storage_delete ON storage.objects;

CREATE POLICY minutes_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'minutes'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'quality'::app_role)
      OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.committee_id IS NOT NULL)
    )
  );

CREATE POLICY minutes_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'minutes'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'quality'::app_role)
      OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.committee_id IS NOT NULL)
    )
  );

CREATE POLICY minutes_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'minutes'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'quality'::app_role)
      OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.committee_id IS NOT NULL)
    )
  );
