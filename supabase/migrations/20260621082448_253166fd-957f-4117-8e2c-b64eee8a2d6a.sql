
-- 1) Notifications: remove permissive authenticated INSERT
DROP POLICY IF EXISTS notif_insert_self ON public.notifications;

-- (service_role bypasses RLS; SECURITY DEFINER triggers continue to work)

-- 2) RPC for Task Center evidence reminder (replaces client insert)
CREATE OR REPLACE FUNCTION public.create_task_evidence_reminders(_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  t RECORD;
  c_name text;
  body_txt text;
  recipients uuid[];
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT id, title, committee_id, assigned_to, status
    INTO t
  FROM public.committee_tasks
  WHERE id = _task_id;

  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  -- Caller must be a committee member of this task's committee, or an admin
  IF NOT (public.is_committee_member(uid, t.committee_id) OR public.has_role(uid, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT name INTO c_name FROM public.committees WHERE id = t.committee_id;

  body_txt := 'تذكير لجميع اللجان وجميع المهام: لا يُعتبر إغلاق المهمة «'
              || COALESCE(t.title,'') || '»'
              || CASE WHEN c_name IS NOT NULL THEN ' في لجنة ' || c_name ELSE '' END
              || ' نهائياً إلا بوجود شواهد على الإنجاز (مرفقات أو ملاحظات تنفيذية). يرجى إرفاق الشواهد لاعتمادها رسمياً.';

  recipients := ARRAY[uid];
  IF t.assigned_to IS NOT NULL AND t.assigned_to <> uid THEN
    recipients := recipients || t.assigned_to;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
  SELECT r, 'task_evidence_required',
         'تذكير بإرفاق شواهد إكمال المهمة',
         body_txt, '/admin/tasks', _task_id
  FROM unnest(recipients) AS r;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_task_evidence_reminders(uuid) TO authenticated;

-- 3) Wedding feedback validation (immutable, safe for CHECK)
ALTER TABLE public.wedding_feedback
  DROP CONSTRAINT IF EXISTS wf_scores_range,
  DROP CONSTRAINT IF EXISTS wf_event_year_range;

ALTER TABLE public.wedding_feedback
  ADD CONSTRAINT wf_scores_range CHECK (
    hospitality_score  BETWEEN 1 AND 5
    AND organization_score BETWEEN 1 AND 5
    AND overall_score      BETWEEN 1 AND 5
    AND program_score      BETWEEN 1 AND 5
  ),
  ADD CONSTRAINT wf_event_year_range CHECK (event_year BETWEEN 1440 AND 1600);
