
-- Storage bucket for task response attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-response-attachments', 'task-response-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies (committee members upload, admins/quality/supreme can read)
CREATE POLICY "tra_select_authorized"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'task-response-attachments' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'quality'::public.app_role) OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.committees c ON c.id = ur.committee_id
      WHERE ur.user_id = auth.uid() AND c.type = 'supreme'
    ) OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.committee_id::text = (storage.foldername(name))[1]
    )
  )
);

CREATE POLICY "tra_insert_committee_member"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-response-attachments' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.committee_id::text = (storage.foldername(name))[1]
    )
  )
);

CREATE POLICY "tra_delete_owner_or_admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-response-attachments' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    owner = auth.uid()
  )
);

-- Table linking storage objects to specific task_responses
CREATE TABLE public.task_response_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES public.task_responses(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.committee_tasks(id) ON DELETE CASCADE,
  committee_id UUID NOT NULL REFERENCES public.committees(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tra_response ON public.task_response_attachments(response_id);
CREATE INDEX idx_tra_task ON public.task_response_attachments(task_id);

ALTER TABLE public.task_response_attachments ENABLE ROW LEVEL SECURITY;

-- Same visibility as task_responses: committee members + admin/quality/supreme
CREATE POLICY "tra_table_select"
ON public.task_response_attachments FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR
  public.has_role(auth.uid(), 'quality'::public.app_role) OR
  public.is_committee_member(auth.uid(), committee_id) OR
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.committees c ON c.id = ur.committee_id
    WHERE ur.user_id = auth.uid() AND c.type = 'supreme'
  )
);

CREATE POLICY "tra_table_insert"
ON public.task_response_attachments FOR INSERT
WITH CHECK (
  auth.uid() = uploaded_by AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.is_committee_member(auth.uid(), committee_id)
  )
);

CREATE POLICY "tra_table_delete"
ON public.task_response_attachments FOR DELETE
USING (
  auth.uid() = uploaded_by OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
