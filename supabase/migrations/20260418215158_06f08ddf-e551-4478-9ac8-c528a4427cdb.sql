-- Helper: is the user the head of the given committee?
CREATE OR REPLACE FUNCTION public.is_committee_head(_user_id uuid, _committee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.committees
    WHERE id = _committee_id AND head_user_id = _user_id
  );
$$;

-- Restrict task creation to admin or committee head
DROP POLICY IF EXISTS tasks_insert ON public.committee_tasks;
CREATE POLICY tasks_insert
ON public.committee_tasks
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_committee_head(auth.uid(), committee_id)
);

-- Restrict task updates to admin, committee head, or the assignee (so members can move their own tasks)
DROP POLICY IF EXISTS tasks_update ON public.committee_tasks;
CREATE POLICY tasks_update
ON public.committee_tasks
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_committee_head(auth.uid(), committee_id)
  OR (
    assigned_to IS NOT NULL
    AND public.user_id_for_team_member(assigned_to) = auth.uid()
  )
);

-- Restrict task delete to admin or committee head
DROP POLICY IF EXISTS tasks_delete ON public.committee_tasks;
CREATE POLICY tasks_delete
ON public.committee_tasks
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_committee_head(auth.uid(), committee_id)
);