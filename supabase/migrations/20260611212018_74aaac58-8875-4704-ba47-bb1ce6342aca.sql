CREATE TABLE public.wedding_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_score smallint NOT NULL CHECK (organization_score BETWEEN 1 AND 5),
  hospitality_score smallint NOT NULL CHECK (hospitality_score BETWEEN 1 AND 5),
  program_score smallint NOT NULL CHECK (program_score BETWEEN 1 AND 5),
  overall_score smallint NOT NULL CHECK (overall_score BETWEEN 1 AND 5),
  suggestions text,
  respondent_role text,
  respondent_phone text,
  event_year int NOT NULL DEFAULT EXTRACT(YEAR FROM now())::int,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.wedding_feedback TO anon;
GRANT SELECT, INSERT ON public.wedding_feedback TO authenticated;
GRANT ALL ON public.wedding_feedback TO service_role;

ALTER TABLE public.wedding_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY wf_insert_any ON public.wedding_feedback
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY wf_select_staff ON public.wedding_feedback
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'quality')
  );

CREATE INDEX wf_created_idx ON public.wedding_feedback (created_at DESC);
CREATE INDEX wf_year_idx ON public.wedding_feedback (event_year);