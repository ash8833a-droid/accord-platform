
DROP POLICY IF EXISTS pc_select ON public.committee_post_comments;
CREATE POLICY pc_select ON public.committee_post_comments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.committee_posts p
    WHERE p.id = post_id
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'quality'::app_role)
        OR public.is_supreme_member(auth.uid())
        OR p.scope = 'all'
        OR (p.scope = 'committee' AND public.is_committee_member(auth.uid(), p.source_committee_id))
        OR (p.scope = 'targeted' AND (
              public.is_committee_member(auth.uid(), p.source_committee_id)
              OR (p.target_committee_id IS NOT NULL AND public.is_committee_member(auth.uid(), p.target_committee_id))
            ))
      )
  )
);

DROP POLICY IF EXISTS pc_insert ON public.committee_post_comments;
CREATE POLICY pc_insert ON public.committee_post_comments FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.committee_posts p
    WHERE p.id = post_id
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'quality'::app_role)
        OR public.is_supreme_member(auth.uid())
        OR p.scope = 'all'
        OR (p.scope = 'committee' AND public.is_committee_member(auth.uid(), p.source_committee_id))
        OR (p.scope = 'targeted' AND (
              public.is_committee_member(auth.uid(), p.source_committee_id)
              OR (p.target_committee_id IS NOT NULL AND public.is_committee_member(auth.uid(), p.target_committee_id))
            ))
      )
  )
);

DROP POLICY IF EXISTS "reports_select_auth" ON public.reports;
CREATE POLICY "reports_select_auth" ON public.reports FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'quality'::app_role)
  OR public.is_supreme_member(auth.uid())
  OR (committee_id IS NOT NULL AND public.is_committee_member(auth.uid(), committee_id))
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "reports_auth_read" ON storage.objects;
DROP POLICY IF EXISTS "reports_read_auth" ON storage.objects;
CREATE POLICY "reports_read_scoped" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'reports'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'quality'::app_role)
    OR public.is_supreme_member(auth.uid())
    OR auth.uid()::text = (storage.foldername(name))[1]
  )
);
