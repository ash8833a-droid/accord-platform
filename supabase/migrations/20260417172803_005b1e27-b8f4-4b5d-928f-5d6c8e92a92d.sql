-- Task attachments table
CREATE TABLE public.task_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.committee_tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_attachments_task ON public.task_attachments(task_id);

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- View: admin, quality, or committee member of the task's committee
CREATE POLICY "ta_select" ON public.task_attachments
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'quality'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.committee_tasks t
    WHERE t.id = task_attachments.task_id
      AND is_committee_member(auth.uid(), t.committee_id)
  )
);

-- Insert: admin or committee member of the task's committee
CREATE POLICY "ta_insert" ON public.task_attachments
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.committee_tasks t
    WHERE t.id = task_attachments.task_id
      AND is_committee_member(auth.uid(), t.committee_id)
  )
);

-- Delete: admin or the uploader
CREATE POLICY "ta_delete" ON public.task_attachments
FOR DELETE USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR auth.uid() = uploaded_by
);

-- Storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (path: {committee_id}/{task_id}/{filename})
CREATE POLICY "ta_storage_select" ON storage.objects
FOR SELECT USING (
  bucket_id = 'task-attachments'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'quality'::app_role)
    OR is_committee_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "ta_storage_insert" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'task-attachments'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_committee_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "ta_storage_delete" ON storage.objects
FOR DELETE USING (
  bucket_id = 'task-attachments'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR owner = auth.uid()
  )
);