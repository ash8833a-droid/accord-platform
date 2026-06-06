
-- Enum for purchase request status
DO $$ BEGIN
  CREATE TYPE public.purchase_request_status AS ENUM ('pending','approved','rejected','completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.purchase_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  committee_id UUID NOT NULL REFERENCES public.committees(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  justification TEXT,
  status public.purchase_request_status NOT NULL DEFAULT 'pending',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchase_requests_committee ON public.purchase_requests(committee_id);
CREATE INDEX idx_purchase_requests_status ON public.purchase_requests(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_requests TO authenticated;
GRANT ALL ON public.purchase_requests TO service_role;

ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;

-- Helper: is procurement member
-- (reuse existing pattern: check committee type = 'procurement')

-- SELECT: requesting committee members, procurement members, admins
CREATE POLICY "View purchase requests"
ON public.purchase_requests FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.is_committee_member(auth.uid(), committee_id)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.committees c ON c.id = ur.committee_id
    WHERE ur.user_id = auth.uid() AND c.type = 'procurement'::committee_type
  )
);

-- INSERT: members of the requesting committee
CREATE POLICY "Committee members can create purchase requests"
ON public.purchase_requests FOR INSERT
TO authenticated
WITH CHECK (
  public.is_committee_member(auth.uid(), committee_id)
  AND created_by = auth.uid()
);

-- UPDATE: creator, procurement members, admins
CREATE POLICY "Update purchase requests"
ON public.purchase_requests FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.committees c ON c.id = ur.committee_id
    WHERE ur.user_id = auth.uid() AND c.type = 'procurement'::committee_type
  )
);

-- DELETE: creator or admins
CREATE POLICY "Delete purchase requests"
ON public.purchase_requests FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
);

CREATE TRIGGER update_purchase_requests_updated_at
BEFORE UPDATE ON public.purchase_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
