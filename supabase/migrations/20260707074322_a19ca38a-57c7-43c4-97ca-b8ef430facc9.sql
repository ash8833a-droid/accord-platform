
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  vendor TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  invoice_date DATE NOT NULL,
  committee_id UUID REFERENCES public.committees(id) ON DELETE SET NULL,
  description TEXT,
  attachment_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_invoice_date ON public.invoices(invoice_date);
CREATE INDEX idx_invoices_committee ON public.invoices(committee_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can view invoices
CREATE POLICY "Authenticated can view invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (true);

-- Only admins or finance committee head can insert/update/delete
CREATE POLICY "Finance managers can insert invoices"
  ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.committees c
      WHERE c.type = 'finance' AND c.head_user_id = auth.uid()
    )
  );

CREATE POLICY "Finance managers can update invoices"
  ON public.invoices FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.committees c
      WHERE c.type = 'finance' AND c.head_user_id = auth.uid()
    )
  );

CREATE POLICY "Finance managers can delete invoices"
  ON public.invoices FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.committees c
      WHERE c.type = 'finance' AND c.head_user_id = auth.uid()
    )
  );

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
