
-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  related_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread
  ON public.notifications (user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_select_own" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "notif_delete_own" ON public.notifications
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Inserts only via security-definer triggers; no direct insert policy.

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Helper: resolve user_id by team_member.id via profiles.full_name
CREATE OR REPLACE FUNCTION public.user_id_for_team_member(_member_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.user_id
    FROM public.team_members tm
    JOIN public.profiles p
      ON btrim(p.full_name) = btrim(tm.full_name)
   WHERE tm.id = _member_id
   LIMIT 1;
$$;

-- Trigger: notify assignee on task insert/update
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid;
  c_name text;
  c_type text;
BEGIN
  IF NEW.assigned_to IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.assigned_to IS NOT DISTINCT FROM NEW.assigned_to THEN
    RETURN NEW;
  END IF;
  uid := public.user_id_for_team_member(NEW.assigned_to);
  IF uid IS NULL THEN RETURN NEW; END IF;
  SELECT name, type::text INTO c_name, c_type FROM public.committees WHERE id = NEW.committee_id;
  INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
  VALUES (
    uid,
    'task_assigned',
    'تم تعيين مهمة جديدة لك',
    COALESCE(c_name, '') || ' · ' || NEW.title,
    '/inbox',
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_task_assignment
AFTER INSERT OR UPDATE OF assigned_to ON public.committee_tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_assignment();

-- Trigger: notify on new payment request (recipient parsed from description prefix [إلى: NAME])
CREATE OR REPLACE FUNCTION public.notify_payment_request()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  recipient_name text;
  recipient_uid uuid;
  c_name text;
  admin_rec record;
BEGIN
  -- Try to parse "[إلى: <name>]" or "[إلى: <name> (committee)]"
  recipient_name := NULL;
  IF NEW.description IS NOT NULL THEN
    recipient_name := substring(NEW.description from '\[إلى:\s*([^\]\(]+?)\s*[\]\(]');
    IF recipient_name IS NOT NULL THEN
      recipient_name := btrim(recipient_name);
    END IF;
  END IF;

  SELECT name INTO c_name FROM public.committees WHERE id = NEW.committee_id;

  -- Notify specific recipient if matched a profile
  IF recipient_name IS NOT NULL AND recipient_name <> 'اللجنة المالية' THEN
    SELECT user_id INTO recipient_uid
      FROM public.profiles
     WHERE btrim(full_name) = recipient_name
     LIMIT 1;
    IF recipient_uid IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
      VALUES (
        recipient_uid,
        'payment_request',
        'طلب صرف موجّه إليك',
        COALESCE(c_name, '') || ' · ' || NEW.title || ' (' || NEW.amount::text || ' ر.س)',
        '/inbox',
        NEW.id
      );
    END IF;
  END IF;

  -- Notify all admins
  FOR admin_rec IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
    VALUES (
      admin_rec.user_id,
      'payment_request',
      'طلب صرف جديد',
      COALESCE(c_name, '') || ' · ' || NEW.title || ' (' || NEW.amount::text || ' ر.س)',
      '/inbox',
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_payment_request
AFTER INSERT ON public.payment_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_payment_request();
