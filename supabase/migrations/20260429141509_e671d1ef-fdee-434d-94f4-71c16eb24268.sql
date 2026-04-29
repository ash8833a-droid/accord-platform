-- 1) Activity log table
CREATE TABLE IF NOT EXISTS public.task_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  committee_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  actor_user_id UUID,
  actor_name TEXT,
  from_value TEXT,
  to_value TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tal_task ON public.task_activity_log(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tal_committee ON public.task_activity_log(committee_id, created_at DESC);

ALTER TABLE public.task_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY tal_select ON public.task_activity_log
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

-- helper: actor name
CREATE OR REPLACE FUNCTION public.current_actor_name()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT full_name FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 2) Trigger on committee_tasks to log + notify
CREATE OR REPLACE FUNCTION public.log_and_notify_task_changes()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
  status_label_fn text;
BEGIN
  status_label_fn := NULL; -- placeholder
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.task_activity_log (task_id, committee_id, event_type, actor_user_id, actor_name, to_value, meta)
    VALUES (NEW.id, NEW.committee_id, 'created', uid, uname, NEW.status::text,
            jsonb_build_object('title', NEW.title, 'priority', NEW.priority, 'assigned_to', NEW.assigned_to, 'due_date', NEW.due_date));

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
    -- status change
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

    -- assignee change
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      INSERT INTO public.task_activity_log (task_id, committee_id, event_type, actor_user_id, actor_name, from_value, to_value)
      VALUES (NEW.id, NEW.committee_id, 'assignee_changed', uid, uname, OLD.assigned_to::text, NEW.assigned_to::text);
    END IF;

    -- priority change
    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      INSERT INTO public.task_activity_log (task_id, committee_id, event_type, actor_user_id, actor_name, from_value, to_value)
      VALUES (NEW.id, NEW.committee_id, 'priority_changed', uid, uname, OLD.priority::text, NEW.priority::text);
    END IF;

    -- title/desc/due
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

    -- notify on generic edit (non-status) once
    IF (NEW.title IS DISTINCT FROM OLD.title
        OR NEW.description IS DISTINCT FROM OLD.description
        OR NEW.priority IS DISTINCT FROM OLD.priority
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
$$;

DROP TRIGGER IF EXISTS trg_task_log_notify ON public.committee_tasks;
CREATE TRIGGER trg_task_log_notify
AFTER INSERT OR UPDATE OR DELETE ON public.committee_tasks
FOR EACH ROW EXECUTE FUNCTION public.log_and_notify_task_changes();

-- 3) Comments log
CREATE OR REPLACE FUNCTION public.log_task_comment_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cid uuid;
BEGIN
  SELECT committee_id INTO cid FROM public.committee_tasks WHERE id = NEW.task_id;
  IF cid IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.task_activity_log (task_id, committee_id, event_type, actor_user_id, actor_name, note)
  VALUES (NEW.task_id, cid, 'comment_added', NEW.user_id, NEW.author_name,
          CASE WHEN length(NEW.body) > 200 THEN substring(NEW.body, 1, 200) || '…' ELSE NEW.body END);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_task_comment_log ON public.task_comments;
CREATE TRIGGER trg_task_comment_log
AFTER INSERT ON public.task_comments
FOR EACH ROW EXECUTE FUNCTION public.log_task_comment_activity();

-- 4) Attachments log
CREATE OR REPLACE FUNCTION public.log_task_attachment_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cid uuid;
  uname text := public.current_actor_name();
BEGIN
  SELECT committee_id INTO cid FROM public.committee_tasks WHERE id = NEW.task_id;
  IF cid IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.task_activity_log (task_id, committee_id, event_type, actor_user_id, actor_name, note)
  VALUES (NEW.task_id, cid, 'attachment_added', NEW.uploaded_by, uname, NEW.file_name);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_task_attachment_log ON public.task_attachments;
CREATE TRIGGER trg_task_attachment_log
AFTER INSERT ON public.task_attachments
FOR EACH ROW EXECUTE FUNCTION public.log_task_attachment_activity();

-- 5) Response log
CREATE OR REPLACE FUNCTION public.log_task_response_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.task_activity_log (task_id, committee_id, event_type, actor_user_id, actor_name, to_value, note)
    VALUES (NEW.task_id, NEW.committee_id, 'response_added', NEW.user_id, NEW.author_name, NEW.completion_percent::text,
            CASE WHEN length(COALESCE(NEW.action_taken,'')) > 200 THEN substring(NEW.action_taken,1,200)||'…' ELSE NEW.action_taken END);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.task_activity_log (task_id, committee_id, event_type, actor_user_id, actor_name, from_value, to_value)
    VALUES (NEW.task_id, NEW.committee_id, 'response_updated', NEW.user_id, NEW.author_name, OLD.completion_percent::text, NEW.completion_percent::text);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_task_response_log ON public.task_responses;
CREATE TRIGGER trg_task_response_log
AFTER INSERT OR UPDATE ON public.task_responses
FOR EACH ROW EXECUTE FUNCTION public.log_task_response_activity();

-- 6) Re-attach existing comment notification trigger if missing (it exists but triggers are listed empty; re-create defensively)
DROP TRIGGER IF EXISTS trg_notify_task_comment ON public.task_comments;
CREATE TRIGGER trg_notify_task_comment
AFTER INSERT ON public.task_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_task_comment();

DROP TRIGGER IF EXISTS trg_notify_task_assignment ON public.committee_tasks;
CREATE TRIGGER trg_notify_task_assignment
AFTER INSERT OR UPDATE OF assigned_to ON public.committee_tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_assignment();