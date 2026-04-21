-- Standardized response fields for committee tasks
CREATE TABLE public.task_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.committee_tasks(id) ON DELETE CASCADE,
  committee_id UUID NOT NULL REFERENCES public.committees(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  author_name TEXT NOT NULL,
  action_taken TEXT NOT NULL,
  outcomes TEXT,
  completion_percent INTEGER NOT NULL DEFAULT 0 CHECK (completion_percent >= 0 AND completion_percent <= 100),
  challenges TEXT,
  recommendations TEXT,
  execution_date DATE,
  attachments_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_responses_task ON public.task_responses(task_id);
CREATE INDEX idx_task_responses_committee ON public.task_responses(committee_id);
CREATE INDEX idx_task_responses_created ON public.task_responses(created_at DESC);

ALTER TABLE public.task_responses ENABLE ROW LEVEL SECURITY;

-- SELECT: Supreme committee members, admin, quality, and members of the owning committee
CREATE POLICY "tr_select"
ON public.task_responses
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'quality'::app_role)
  OR is_committee_member(auth.uid(), committee_id)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.committees c ON c.id = ur.committee_id
    WHERE ur.user_id = auth.uid() AND c.type = 'supreme'::committee_type
  )
);

-- INSERT: Committee members can add responses for their committee's tasks; admin can add anything
CREATE POLICY "tr_insert"
ON public.task_responses
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_committee_member(auth.uid(), committee_id)
  )
);

-- UPDATE: Author or admin
CREATE POLICY "tr_update"
ON public.task_responses
FOR UPDATE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- DELETE: Author or admin
CREATE POLICY "tr_delete"
ON public.task_responses
FOR DELETE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Auto-update updated_at
CREATE TRIGGER trg_task_responses_updated_at
BEFORE UPDATE ON public.task_responses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();