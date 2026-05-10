
-- Meeting minutes (محاضر الاجتماعات) per committee
CREATE TABLE public.committee_minutes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  committee_id UUID NOT NULL REFERENCES public.committees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  meeting_date DATE,
  notes TEXT,
  file_url TEXT,
  file_type TEXT,
  file_size BIGINT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_committee_minutes_committee ON public.committee_minutes(committee_id, meeting_date DESC);

ALTER TABLE public.committee_minutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "minutes_select_auth"
ON public.committee_minutes FOR SELECT TO authenticated USING (true);

CREATE POLICY "minutes_insert"
ON public.committee_minutes FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (committee_id IS NOT NULL AND is_committee_member(auth.uid(), committee_id))
);

CREATE POLICY "minutes_update"
ON public.committee_minutes FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (committee_id IS NOT NULL AND is_committee_member(auth.uid(), committee_id))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (committee_id IS NOT NULL AND is_committee_member(auth.uid(), committee_id))
);

CREATE POLICY "minutes_delete"
ON public.committee_minutes FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (committee_id IS NOT NULL AND is_committee_member(auth.uid(), committee_id))
);

CREATE TRIGGER update_committee_minutes_updated_at
BEFORE UPDATE ON public.committee_minutes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for minutes files (private; signed URLs used for access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('minutes', 'minutes', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "minutes_storage_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'minutes');

CREATE POLICY "minutes_storage_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'minutes');

CREATE POLICY "minutes_storage_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'minutes');

CREATE POLICY "minutes_storage_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'minutes');
