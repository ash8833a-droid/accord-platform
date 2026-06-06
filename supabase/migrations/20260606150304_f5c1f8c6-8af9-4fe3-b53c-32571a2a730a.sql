
-- Helper: finance committee member check
CREATE OR REPLACE FUNCTION public.is_finance_committee_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.committees c ON c.id = ur.committee_id
    WHERE ur.user_id = _user_id AND c.type = 'finance'::committee_type
  );
$$;

-- Add column to flag items added by Finance committee
ALTER TABLE public.budget_items
  ADD COLUMN IF NOT EXISTS assigned_by_finance boolean NOT NULL DEFAULT false;

-- Replace write policies so finance committee can add/edit/delete for any committee
DROP POLICY IF EXISTS budget_items_insert ON public.budget_items;
DROP POLICY IF EXISTS budget_items_update ON public.budget_items;
DROP POLICY IF EXISTS budget_items_delete ON public.budget_items;

CREATE POLICY budget_items_insert ON public.budget_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_finance_committee_member(auth.uid())
    OR public.is_committee_member(auth.uid(), committee_id)
  );

CREATE POLICY budget_items_update ON public.budget_items
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_finance_committee_member(auth.uid())
    OR public.is_committee_member(auth.uid(), committee_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_finance_committee_member(auth.uid())
    OR public.is_committee_member(auth.uid(), committee_id)
  );

CREATE POLICY budget_items_delete ON public.budget_items
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_finance_committee_member(auth.uid())
    OR public.is_committee_member(auth.uid(), committee_id)
  );
