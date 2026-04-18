-- Update notification triggers to link directly to the relevant committee page
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    '/committee/' || COALESCE(c_type, 'finance'),
    NEW.id
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_payment_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  recipient_name text;
  recipient_uid uuid;
  c_name text;
  c_type text;
  admin_rec record;
  link_url text;
BEGIN
  recipient_name := NULL;
  IF NEW.description IS NOT NULL THEN
    recipient_name := substring(NEW.description from '\[إلى:\s*([^\]\(]+?)\s*[\]\(]');
    IF recipient_name IS NOT NULL THEN
      recipient_name := btrim(recipient_name);
    END IF;
  END IF;

  SELECT name, type::text INTO c_name, c_type FROM public.committees WHERE id = NEW.committee_id;
  link_url := '/committee/' || COALESCE(c_type, 'finance');

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
        link_url,
        NEW.id
      );
    END IF;
  END IF;

  FOR admin_rec IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
    VALUES (
      admin_rec.user_id,
      'payment_request',
      'طلب صرف جديد',
      COALESCE(c_name, '') || ' · ' || NEW.title || ' (' || NEW.amount::text || ' ر.س)',
      link_url,
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$function$;