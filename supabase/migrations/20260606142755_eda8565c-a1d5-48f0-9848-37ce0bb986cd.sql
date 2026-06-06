
CREATE TABLE public.budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id uuid NOT NULL REFERENCES public.committees(id) ON DELETE CASCADE,
  item_name text NOT NULL CHECK (length(btrim(item_name)) > 0),
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  unit_cost numeric(12,2) NOT NULL CHECK (unit_cost >= 0),
  total_cost numeric(14,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX budget_items_committee_idx ON public.budget_items(committee_id);
CREATE INDEX budget_items_created_idx ON public.budget_items(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_items TO authenticated;
GRANT ALL ON public.budget_items TO service_role;

ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;

-- SELECT: admin / quality / supreme / finance / owning committee member
CREATE POLICY "budget_items_select" ON public.budget_items
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.is_quality_committee_member(auth.uid())
  OR public.is_supreme_member(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.committees c ON c.id = ur.committee_id
    WHERE ur.user_id = auth.uid() AND c.type = 'finance'
  )
  OR public.is_committee_member(auth.uid(), committee_id)
);

-- INSERT/UPDATE/DELETE: admin or member of the owning committee
CREATE POLICY "budget_items_insert" ON public.budget_items
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.is_committee_member(auth.uid(), committee_id)
);

CREATE POLICY "budget_items_update" ON public.budget_items
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.is_committee_member(auth.uid(), committee_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.is_committee_member(auth.uid(), committee_id)
);

CREATE POLICY "budget_items_delete" ON public.budget_items
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.is_committee_member(auth.uid(), committee_id)
);

CREATE TRIGGER budget_items_set_updated_at
BEFORE UPDATE ON public.budget_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.budget_items REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.budget_items;
