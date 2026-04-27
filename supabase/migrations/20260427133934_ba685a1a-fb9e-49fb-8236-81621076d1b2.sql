-- Notify committee members when a new comment is added to a task
CREATE OR REPLACE FUNCTION public.notify_task_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_rec RECORD;
  comm_type TEXT;
  preview TEXT;
BEGIN
  SELECT ct.id, ct.title, ct.committee_id, c.type
    INTO task_rec
  FROM public.committee_tasks ct
  JOIN public.committees c ON c.id = ct.committee_id
  WHERE ct.id = NEW.task_id;

  IF task_rec.id IS NULL THEN
    RETURN NEW;
  END IF;

  comm_type := task_rec.type;
  preview := CASE
    WHEN length(NEW.body) > 140 THEN substring(NEW.body, 1, 140) || '…'
    ELSE NEW.body
  END;

  INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
  SELECT DISTINCT ur.user_id,
                  'task_comment',
                  'تعليق جديد من ' || NEW.author_name || ' على: ' || COALESCE(task_rec.title, 'مهمة'),
                  preview,
                  '/committee/' || comm_type,
                  NEW.task_id
  FROM public.user_roles ur
  WHERE ur.committee_id = task_rec.committee_id
    AND ur.user_id <> NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task_comment ON public.task_comments;
CREATE TRIGGER trg_notify_task_comment
AFTER INSERT ON public.task_comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_comment();