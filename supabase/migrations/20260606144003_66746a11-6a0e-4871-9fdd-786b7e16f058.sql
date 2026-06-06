
-- 1) Grooms: drop public self select/update (handled via server functions with token verification)
DROP POLICY IF EXISTS grooms_public_self_select ON public.grooms;
DROP POLICY IF EXISTS grooms_public_self_update ON public.grooms;

-- 2) Team members: restrict SELECT to admin/quality/supreme/own-committee
DROP POLICY IF EXISTS team_members_select_auth ON public.team_members;
CREATE POLICY team_members_select_scoped ON public.team_members
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'quality'::app_role)
    OR public.is_supreme_member(auth.uid())
    OR public.is_committee_member(auth.uid(), committee_id)
  );

-- 3) Women talent responses: enforce minimum field validation
DROP POLICY IF EXISTS "Anyone can submit a women talent response" ON public.women_talent_responses;
CREATE POLICY "Anyone can submit a women talent response"
  ON public.women_talent_responses
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    full_name IS NOT NULL AND length(btrim(full_name)) BETWEEN 2 AND 200
    AND phone IS NOT NULL AND length(btrim(phone)) BETWEEN 7 AND 20
  );

-- 4) Minutes storage: restrict writes to user's own committee folder
DROP POLICY IF EXISTS minutes_storage_insert ON storage.objects;
DROP POLICY IF EXISTS minutes_storage_update ON storage.objects;
DROP POLICY IF EXISTS minutes_storage_delete ON storage.objects;

CREATE POLICY minutes_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'minutes' AND (
      public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'quality'::app_role)
      OR public.is_committee_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  );

CREATE POLICY minutes_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'minutes' AND (
      public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'quality'::app_role)
      OR public.is_committee_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  )
  WITH CHECK (
    bucket_id = 'minutes' AND (
      public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'quality'::app_role)
      OR public.is_committee_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  );

CREATE POLICY minutes_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'minutes' AND (
      public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'quality'::app_role)
      OR public.is_committee_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  );
