-- Team members table for committee staffing
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  committee_id UUID NOT NULL REFERENCES public.committees(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role_title TEXT,
  phone TEXT,
  email TEXT,
  specialty TEXT,
  is_head BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_team_members_committee ON public.team_members(committee_id);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_members_select_auth"
ON public.team_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "team_members_admin_manage"
ON public.team_members FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_team_members_updated_at
BEFORE UPDATE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add max_members capacity column to committees
ALTER TABLE public.committees
ADD COLUMN IF NOT EXISTS max_members INTEGER NOT NULL DEFAULT 0;

-- Set capacities per committee type
UPDATE public.committees SET max_members = CASE type
  WHEN 'finance'    THEN 2
  WHEN 'dinner'     THEN 2
  WHEN 'media'      THEN 2
  WHEN 'programs'   THEN 4
  WHEN 'quality'    THEN 2
  WHEN 'logistics'  THEN 3
  WHEN 'reception'  THEN 3
  ELSE 0
END;

-- Trigger to enforce capacity
CREATE OR REPLACE FUNCTION public.enforce_team_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cap INTEGER;
  cnt INTEGER;
BEGIN
  SELECT max_members INTO cap FROM public.committees WHERE id = NEW.committee_id;
  IF cap IS NULL OR cap = 0 THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO cnt FROM public.team_members WHERE committee_id = NEW.committee_id;
  IF TG_OP = 'INSERT' AND cnt >= cap THEN
    RAISE EXCEPTION 'تم الوصول إلى الحد الأقصى لأعضاء هذه اللجنة (%).', cap;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_team_capacity
BEFORE INSERT ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_team_capacity();