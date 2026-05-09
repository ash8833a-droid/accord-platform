CREATE OR REPLACE FUNCTION public.log_and_notify_task_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  uname text := public.current_actor_name();
  c_type text;
  c_name text;
  member_rec record;
  link_url text;
  notif_title text;
  notif_body text;
  status_label_old text;
  status_label_new text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.task_activity_log (task_id, committee_id, event_type, actor_user_id, actor_name, to_value, meta)
    VALUES (NEW.id, NEW.committee_id, 'created', uid, uname, NEW.status::text,
            jsonb_build_object('title', NEW.title, 'assigned_to', NEW.assigned_to, 'due_date', NEW.due_date));

    SELECT type::text, name INTO c_type, c_name FROM public.committees WHERE id = NEW.committee_id;
    link_url := '/portal';
    notif_title := 'مهمة جديدة في ' || COALESCE(c_name, 'لجنتك') || ': ' || NEW.title;
    notif_body := COALESCE(uname, 'عضو') || ' أنشأ مهمة جديدة';
    FOR member_rec IN
      SELECT DISTINCT user_id FROM public.user_roles
      WHERE committee_id = NEW.committee_id AND (uid IS NULL OR user_id <> uid)
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
      VALUES (member_rec.user_id, 'task_created', notif_title, notif_body, link_url, NEW.id);
    END LOOP;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.task_activity_log (task_id, committee_id, event_type, actor_user_id, actor_name, from_value, to_value)
      VALUES (NEW.id, NEW.committee_id, 'status_changed', uid, uname, OLD.status::text, NEW.status::text);

      SELECT name INTO c_name FROM public.committees WHERE id = NEW.committee_id;
      status_label_old := CASE OLD.status::text WHEN 'todo' THEN 'قائمة الانتظار' WHEN 'in_progress' THEN 'قيد التنفيذ' WHEN 'completed' THEN 'مكتملة' ELSE OLD.status::text END;
      status_label_new := CASE NEW.status::text WHEN 'todo' THEN 'قائمة الانتظار' WHEN 'in_progress' THEN 'قيد التنفيذ' WHEN 'completed' THEN 'مكتملة' ELSE NEW.status::text END;
      notif_title := 'نقل مهمة: ' || NEW.title;
      notif_body := COALESCE(uname, 'عضو') || ' نقل من «' || status_label_old || '» إلى «' || status_label_new || '» — ' || COALESCE(c_name, '');
      FOR member_rec IN
        SELECT DISTINCT user_id FROM public.user_roles
        WHERE committee_id = NEW.committee_id AND (uid IS NULL OR user_id <> uid)
      LOOP
        INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
        VALUES (member_rec.user_id, 'task_moved', notif_title, notif_body, '/portal', NEW.id);
      END LOOP;
    END IF;

    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      INSERT INTO public.task_activity_log (task_id, committee_id, event_type, actor_user_id, actor_name, from_value, to_value)
      VALUES (NEW.id, NEW.committee_id, 'assignee_changed', uid, uname, OLD.assigned_to::text, NEW.assigned_to::text);
    END IF;

    IF NEW.title IS DISTINCT FROM OLD.title THEN
      INSERT INTO public.task_activity_log (task_id, committee_id, event_type, actor_user_id, actor_name, from_value, to_value)
      VALUES (NEW.id, NEW.committee_id, 'title_changed', uid, uname, OLD.title, NEW.title);
    END IF;
    IF NEW.description IS DISTINCT FROM OLD.description THEN
      INSERT INTO public.task_activity_log (task_id, committee_id, event_type, actor_user_id, actor_name)
      VALUES (NEW.id, NEW.committee_id, 'description_changed', uid, uname);
    END IF;
    IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
      INSERT INTO public.task_activity_log (task_id, committee_id, event_type, actor_user_id, actor_name, from_value, to_value)
      VALUES (NEW.id, NEW.committee_id, 'due_date_changed', uid, uname, OLD.due_date::text, NEW.due_date::text);
    END IF;

    IF (NEW.title IS DISTINCT FROM OLD.title
        OR NEW.description IS DISTINCT FROM OLD.description
        OR NEW.due_date IS DISTINCT FROM OLD.due_date
        OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to)
       AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
      SELECT name INTO c_name FROM public.committees WHERE id = NEW.committee_id;
      notif_title := 'تحديث مهمة: ' || NEW.title;
      notif_body := COALESCE(uname, 'عضو') || ' عدّل بيانات المهمة — ' || COALESCE(c_name, '');
      FOR member_rec IN
        SELECT DISTINCT user_id FROM public.user_roles
        WHERE committee_id = NEW.committee_id AND (uid IS NULL OR user_id <> uid)
      LOOP
        INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
        VALUES (member_rec.user_id, 'task_updated', notif_title, notif_body, '/portal', NEW.id);
      END LOOP;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.task_activity_log (task_id, committee_id, event_type, actor_user_id, actor_name, from_value, meta)
    VALUES (OLD.id, OLD.committee_id, 'deleted', uid, uname, OLD.status::text, jsonb_build_object('title', OLD.title));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;