CREATE TABLE IF NOT EXISTS public.committee_weekly_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id uuid NOT NULL REFERENCES public.committees(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  completion_rate numeric NOT NULL DEFAULT 0,
  total_tasks integer NOT NULL DEFAULT 0,
  done_tasks integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (committee_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_cws_committee ON public.committee_weekly_snapshots(committee_id);
CREATE INDEX IF NOT EXISTS idx_cws_week ON public.committee_weekly_snapshots(week_start);

ALTER TABLE public.committee_weekly_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY cws_select_priv ON public.committee_weekly_snapshots
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'quality'::app_role) OR public.is_supreme_member(auth.uid()));

CREATE POLICY cws_insert_priv ON public.committee_weekly_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'quality'::app_role));

CREATE POLICY cws_update_priv ON public.committee_weekly_snapshots
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'quality'::app_role));