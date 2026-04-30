-- Allow any committee member to update tasks in their committee
-- (so members can move status, edit details, mark progress)
DROP POLICY IF EXISTS tasks_update ON public.committee_tasks;
CREATE POLICY tasks_update ON public.committee_tasks
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'quality'::app_role)
    OR is_committee_head(auth.uid(), committee_id)
    OR is_committee_member(auth.uid(), committee_id)
  );