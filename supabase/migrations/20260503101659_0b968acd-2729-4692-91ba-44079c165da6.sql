
CREATE TABLE public.committee_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  committee_type committee_type NOT NULL,
  evaluator_id UUID,
  evaluator_name TEXT NOT NULL,
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  general_note TEXT,
  final_score NUMERIC NOT NULL DEFAULT 0,
  percentage NUMERIC NOT NULL DEFAULT 0,
  grade TEXT NOT NULL DEFAULT '',
  total_weight NUMERIC NOT NULL DEFAULT 0,
  answered_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_ce_committee_type_created ON public.committee_evaluations(committee_type, created_at DESC);

ALTER TABLE public.committee_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ce_select_auth"
ON public.committee_evaluations
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "ce_insert_auth"
ON public.committee_evaluations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = evaluator_id AND is_user_approved(auth.uid()));

CREATE POLICY "ce_update_own_or_admin"
ON public.committee_evaluations
FOR UPDATE
TO authenticated
USING (auth.uid() = evaluator_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'quality'::app_role));

CREATE POLICY "ce_delete_own_or_admin"
ON public.committee_evaluations
FOR DELETE
TO authenticated
USING (auth.uid() = evaluator_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_ce_updated_at
BEFORE UPDATE ON public.committee_evaluations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
