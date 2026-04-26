DROP POLICY IF EXISTS tr_delete ON public.task_responses;

CREATE POLICY tr_delete ON public.task_responses
FOR DELETE
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'quality'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.committees c ON c.id = ur.committee_id
    WHERE ur.user_id = auth.uid() AND c.type = 'supreme'::committee_type
  )
);