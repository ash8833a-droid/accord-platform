
-- Allow media committee members to insert grooms
DROP POLICY IF EXISTS grooms_insert ON public.grooms;
CREATE POLICY grooms_insert ON public.grooms
FOR INSERT TO public
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN committees c ON c.id = ur.committee_id
    WHERE ur.user_id = auth.uid()
      AND c.type = ANY (ARRAY['programs'::committee_type,'reception'::committee_type,'media'::committee_type])
  )
);

-- Update policy already includes media; keep as-is but ensure
DROP POLICY IF EXISTS grooms_update ON public.grooms;
CREATE POLICY grooms_update ON public.grooms
FOR UPDATE TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN committees c ON c.id = ur.committee_id
    WHERE ur.user_id = auth.uid()
      AND c.type = ANY (ARRAY['media'::committee_type,'programs'::committee_type,'reception'::committee_type])
  )
);

-- Allow media committee members to delete grooms
DROP POLICY IF EXISTS grooms_admin_delete ON public.grooms;
CREATE POLICY grooms_delete ON public.grooms
FOR DELETE TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN committees c ON c.id = ur.committee_id
    WHERE ur.user_id = auth.uid()
      AND c.type = 'media'::committee_type
  )
);

-- Backfill page_permissions: grant 'edit' on grooms page to all current media committee members
INSERT INTO public.page_permissions (user_id, page_key, access_level)
SELECT DISTINCT ur.user_id, 'grooms', 'edit'::page_access_level
FROM user_roles ur
JOIN committees c ON c.id = ur.committee_id
WHERE c.type = 'media'::committee_type
ON CONFLICT ON CONSTRAINT page_permissions_user_page_unique
DO UPDATE SET access_level = 'edit'::page_access_level;
