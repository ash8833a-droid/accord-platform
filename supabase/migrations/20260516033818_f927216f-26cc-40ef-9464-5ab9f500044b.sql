
-- 1) Comments: include admins in addition to committee members
CREATE OR REPLACE FUNCTION public.notify_task_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  task_rec RECORD;
  comm_type TEXT;
  comm_name TEXT;
  preview TEXT;
BEGIN
  SELECT ct.id, ct.title, ct.committee_id, c.type, c.name
    INTO task_rec
  FROM public.committee_tasks ct
  JOIN public.committees c ON c.id = ct.committee_id
  WHERE ct.id = NEW.task_id;

  IF task_rec.id IS NULL THEN
    RETURN NEW;
  END IF;

  comm_type := task_rec.type;
  comm_name := task_rec.name;
  preview := CASE
    WHEN length(NEW.body) > 140 THEN substring(NEW.body, 1, 140) || '…'
    ELSE NEW.body
  END;

  INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
  SELECT DISTINCT ur.user_id,
                  'task_comment',
                  'تعليق جديد من ' || NEW.author_name
                    || COALESCE(' في ' || comm_name, '')
                    || ' على: ' || COALESCE(task_rec.title, 'مهمة'),
                  preview,
                  '/committee/' || comm_type,
                  NEW.task_id
  FROM public.user_roles ur
  WHERE (ur.committee_id = task_rec.committee_id OR ur.role = 'admin')
    AND ur.user_id <> NEW.user_id;

  RETURN NEW;
END;
$function$;

-- 2) Attachments: notify all admins (and committee members)
CREATE OR REPLACE FUNCTION public.notify_task_attachment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  task_rec RECORD;
  uname TEXT := public.current_actor_name();
BEGIN
  SELECT ct.id, ct.title, ct.committee_id, c.type, c.name
    INTO task_rec
  FROM public.committee_tasks ct
  JOIN public.committees c ON c.id = ct.committee_id
  WHERE ct.id = NEW.task_id;

  IF task_rec.id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
  SELECT DISTINCT ur.user_id,
                  'task_attachment',
                  'مرفق جديد'
                    || COALESCE(' في ' || task_rec.name, '')
                    || ' على: ' || COALESCE(task_rec.title, 'مهمة'),
                  COALESCE(uname, 'عضو') || ' أرفق ملف: ' || NEW.file_name,
                  '/committee/' || task_rec.type,
                  NEW.task_id
  FROM public.user_roles ur
  WHERE (ur.committee_id = task_rec.committee_id OR ur.role = 'admin')
    AND (NEW.uploaded_by IS NULL OR ur.user_id <> NEW.uploaded_by);

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_task_attachment ON public.task_attachments;
CREATE TRIGGER trg_notify_task_attachment
AFTER INSERT ON public.task_attachments
FOR EACH ROW EXECUTE FUNCTION public.notify_task_attachment();

-- 3) Task edits: notify all admins on any update (besides actor)
CREATE OR REPLACE FUNCTION public.notify_admins_task_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  uname text := public.current_actor_name();
  comm RECORD;
  changes TEXT[] := ARRAY[]::TEXT[];
  body_txt TEXT;
BEGIN
  -- skip if nothing meaningful changed
  IF NEW.title IS NOT DISTINCT FROM OLD.title
     AND NEW.description IS NOT DISTINCT FROM OLD.description
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.priority IS NOT DISTINCT FROM OLD.priority
     AND NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to
     AND NEW.due_date IS NOT DISTINCT FROM OLD.due_date THEN
    RETURN NEW;
  END IF;

  SELECT type::text AS type, name FROM public.committees WHERE id = NEW.committee_id INTO comm;

  IF NEW.title       IS DISTINCT FROM OLD.title       THEN changes := changes || 'العنوان'; END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN changes := changes || 'الوصف'; END IF;
  IF NEW.status      IS DISTINCT FROM OLD.status      THEN changes := changes || 'الحالة'; END IF;
  IF NEW.priority    IS DISTINCT FROM OLD.priority    THEN changes := changes || 'الأولوية'; END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN changes := changes || 'المسؤول'; END IF;
  IF NEW.due_date    IS DISTINCT FROM OLD.due_date    THEN changes := changes || 'تاريخ التسليم'; END IF;

  body_txt := COALESCE(uname, 'عضو') || ' عدّل: ' || array_to_string(changes, '، ');

  INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
  SELECT DISTINCT ur.user_id,
                  'task_updated',
                  'تعديل مهمة'
                    || COALESCE(' في ' || comm.name, '')
                    || ': ' || NEW.title,
                  body_txt,
                  '/committee/' || comm.type,
                  NEW.id
  FROM public.user_roles ur
  WHERE ur.role = 'admin'
    AND (uid IS NULL OR ur.user_id <> uid);

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_admins_task_update ON public.committee_tasks;
CREATE TRIGGER trg_notify_admins_task_update
AFTER UPDATE ON public.committee_tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_task_update();
