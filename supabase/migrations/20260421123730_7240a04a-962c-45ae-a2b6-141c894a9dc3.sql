-- Allow quality role to update committee tasks (status + audit notes in description)
DROP POLICY IF EXISTS tasks_update ON public.committee_tasks;
CREATE POLICY tasks_update ON public.committee_tasks
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'quality'::app_role)
    OR is_committee_head(auth.uid(), committee_id)
    OR ((assigned_to IS NOT NULL) AND (user_id_for_team_member(assigned_to) = auth.uid()))
  );