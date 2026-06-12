
DROP POLICY IF EXISTS team_members_select_scoped ON public.team_members;
CREATE POLICY team_members_select_scoped
  ON public.team_members
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'quality'::app_role)
    OR is_supreme_member(auth.uid())
    OR is_committee_member(auth.uid(), committee_id)
    OR EXISTS (
      SELECT 1 FROM public.committees c
      WHERE c.id = team_members.committee_id
        AND c.head_user_id = auth.uid()
    )
  );
