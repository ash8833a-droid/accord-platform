-- Membership requests table for phone-based signup approvals
CREATE TABLE public.membership_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  family_branch TEXT,
  requested_committee_id UUID REFERENCES public.committees(id) ON DELETE SET NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  assigned_committee_id UUID REFERENCES public.committees(id) ON DELETE SET NULL,
  assigned_role app_role,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.membership_requests ENABLE ROW LEVEL SECURITY;

-- Users can see and create their OWN request
CREATE POLICY "mr_select_own_or_admin" ON public.membership_requests
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "mr_insert_own" ON public.membership_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "mr_update_admin" ON public.membership_requests
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "mr_delete_admin" ON public.membership_requests
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER membership_requests_set_updated_at
BEFORE UPDATE ON public.membership_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_mr_status ON public.membership_requests(status);
CREATE INDEX idx_mr_user ON public.membership_requests(user_id);

-- Helper: get user's primary committee_id (first non-null)
CREATE OR REPLACE FUNCTION public.get_user_committee(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT committee_id FROM public.user_roles
   WHERE user_id = _user_id AND committee_id IS NOT NULL
   ORDER BY created_at ASC LIMIT 1;
$$;

-- Helper: is user approved (admin OR has any role)
CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id);
$$;