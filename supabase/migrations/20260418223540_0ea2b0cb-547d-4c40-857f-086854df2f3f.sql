
DROP POLICY IF EXISTS grooms_select ON public.grooms;
CREATE POLICY grooms_select ON public.grooms FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'quality'::app_role)
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN committees c ON c.id = ur.committee_id
    WHERE ur.user_id = auth.uid()
      AND c.type = ANY (ARRAY['media','programs','reception','dinner','procurement','women']::committee_type[])
  )
);

DROP POLICY IF EXISTS grooms_update ON public.grooms;
CREATE POLICY grooms_update ON public.grooms FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN committees c ON c.id = ur.committee_id
    WHERE ur.user_id = auth.uid()
      AND c.type = ANY (ARRAY['media','programs','reception']::committee_type[])
  )
);
