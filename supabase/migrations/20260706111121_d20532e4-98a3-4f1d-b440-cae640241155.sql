
CREATE TABLE public.procurement_roadmap_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','completed')),
  notes text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.procurement_roadmap_progress TO authenticated;
GRANT ALL ON public.procurement_roadmap_progress TO service_role;

ALTER TABLE public.procurement_roadmap_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view roadmap progress"
  ON public.procurement_roadmap_progress FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins or procurement members can upsert roadmap progress"
  ON public.procurement_roadmap_progress FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.committees c ON c.id = ur.committee_id
      WHERE ur.user_id = auth.uid() AND c.type = 'procurement'
    )
  );

CREATE POLICY "Admins or procurement members can update roadmap progress"
  ON public.procurement_roadmap_progress FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.committees c ON c.id = ur.committee_id
      WHERE ur.user_id = auth.uid() AND c.type = 'procurement'
    )
  );

CREATE TRIGGER trg_roadmap_progress_updated
BEFORE UPDATE ON public.procurement_roadmap_progress
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
