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
  IF NEW.title IS NOT DISTINCT FROM OLD.title
     AND NEW.description IS NOT DISTINCT FROM OLD.description
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to
     AND NEW.due_date IS NOT DISTINCT FROM OLD.due_date THEN
    RETURN NEW;
  END IF;

  SELECT type::text AS type, name FROM public.committees WHERE id = NEW.committee_id INTO comm;

  IF NEW.title       IS DISTINCT FROM OLD.title       THEN changes := changes || 'العنوان'; END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN changes := changes || 'الوصف'; END IF;
  IF NEW.status      IS DISTINCT FROM OLD.status      THEN changes := changes || 'الحالة'; END IF;
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