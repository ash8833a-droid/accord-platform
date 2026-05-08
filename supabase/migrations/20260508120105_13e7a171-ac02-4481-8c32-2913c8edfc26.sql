CREATE TABLE IF NOT EXISTS public.family_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_name text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  contribution_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fc_date ON public.family_contributions(contribution_date DESC);

ALTER TABLE public.family_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY fc_select ON public.family_contributions
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'quality'::app_role)
    OR EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.committees c ON c.id = ur.committee_id
               WHERE ur.user_id = auth.uid() AND c.type IN ('finance'::committee_type,'supreme'::committee_type))
  );

CREATE POLICY fc_insert ON public.family_contributions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.committees c ON c.id = ur.committee_id
               WHERE ur.user_id = auth.uid() AND c.type = 'finance'::committee_type)
  );

CREATE POLICY fc_update ON public.family_contributions
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.committees c
               WHERE c.type = 'finance'::committee_type AND c.head_user_id = auth.uid())
  );

CREATE POLICY fc_delete ON public.family_contributions
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.committees c
               WHERE c.type = 'finance'::committee_type AND c.head_user_id = auth.uid())
  );

CREATE TRIGGER trg_fc_updated_at
  BEFORE UPDATE ON public.family_contributions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.family_contributions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.family_contributions;