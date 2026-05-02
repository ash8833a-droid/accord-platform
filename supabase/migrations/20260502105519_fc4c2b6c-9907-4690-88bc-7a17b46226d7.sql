-- Status enum for survey responses
CREATE TYPE public.women_talent_status AS ENUM ('new', 'contacted', 'accepted', 'rejected', 'on_hold');

CREATE TABLE public.women_talent_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  age INTEGER,
  family_branch TEXT,
  phone TEXT NOT NULL,
  city TEXT,
  marital_status TEXT,
  education_level TEXT,
  specialization TEXT,
  skills TEXT[] NOT NULL DEFAULT '{}',
  tools TEXT,
  experience_years INTEGER,
  previous_work TEXT,
  certifications TEXT,
  interest_areas TEXT[] NOT NULL DEFAULT '{}',
  weekly_hours TEXT,
  preferred_times TEXT[] NOT NULL DEFAULT '{}',
  motivation TEXT,
  notes TEXT,
  status public.women_talent_status NOT NULL DEFAULT 'new',
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_women_talent_responses_created ON public.women_talent_responses (created_at DESC);
CREATE INDEX idx_women_talent_responses_status ON public.women_talent_responses (status);

ALTER TABLE public.women_talent_responses ENABLE ROW LEVEL SECURITY;

-- Anyone (even anonymous) can submit a response via the public link
CREATE POLICY "Anyone can submit a women talent response"
  ON public.women_talent_responses FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Helper: check if user belongs to the women's committee
CREATE OR REPLACE FUNCTION public.is_women_committee_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.committees c ON c.id = ur.committee_id
    WHERE ur.user_id = _user_id
      AND c.type = 'women'::committee_type
  );
$$;

-- Admins + women's committee members can view
CREATE POLICY "Admins and women committee can view responses"
  ON public.women_talent_responses FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_women_committee_member(auth.uid())
  );

-- Admins + women's committee members can update (status, reviewer notes)
CREATE POLICY "Admins and women committee can update responses"
  ON public.women_talent_responses FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_women_committee_member(auth.uid())
  );

-- Admins + women's committee members can delete
CREATE POLICY "Admins and women committee can delete responses"
  ON public.women_talent_responses FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_women_committee_member(auth.uid())
  );

-- updated_at trigger
CREATE TRIGGER trg_women_talent_responses_updated_at
  BEFORE UPDATE ON public.women_talent_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notify women's committee on new response
CREATE OR REPLACE FUNCTION public.notify_women_committee_on_talent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  women_id uuid;
  member_rec record;
BEGIN
  SELECT id INTO women_id FROM public.committees WHERE type = 'women' LIMIT 1;
  IF women_id IS NULL THEN RETURN NEW; END IF;

  FOR member_rec IN
    SELECT DISTINCT user_id FROM public.user_roles WHERE committee_id = women_id
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
    VALUES (
      member_rec.user_id,
      'women_talent_response',
      'استبيان جديد: ' || NEW.full_name,
      COALESCE(NEW.family_branch, '') || CASE WHEN array_length(NEW.skills, 1) > 0
        THEN ' · مهارات: ' || array_to_string(NEW.skills, '، ')
        ELSE '' END,
      '/committee/women',
      NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_women_talent_notify
  AFTER INSERT ON public.women_talent_responses
  FOR EACH ROW EXECUTE FUNCTION public.notify_women_committee_on_talent();
