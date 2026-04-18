-- Notify all media committee members when a new groom is registered
CREATE OR REPLACE FUNCTION public.notify_media_on_new_groom()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  media_committee_id uuid;
  member_rec record;
  request_label text;
BEGIN
  SELECT id INTO media_committee_id FROM public.committees WHERE type = 'media' LIMIT 1;
  IF media_committee_id IS NULL THEN RETURN NEW; END IF;

  request_label := CASE NEW.request_type
    WHEN 'extra_sheep' THEN ' · طلب: زيادة ذبائح'
    WHEN 'transfer' THEN ' · طلب: تنازل'
    WHEN 'decline_extra' THEN ' · طلب: اعتذار عن الزيادة'
    ELSE ''
  END;

  -- Notify head if exists
  FOR member_rec IN
    SELECT DISTINCT ur.user_id
      FROM public.user_roles ur
     WHERE ur.committee_id = media_committee_id
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
    VALUES (
      member_rec.user_id,
      'new_groom',
      'تسجيل عريس جديد — للتدقيق والتنسيق',
      NEW.full_name || ' · ' || NEW.family_branch || COALESCE(request_label, ''),
      '/grooms',
      NEW.id
    );
  END LOOP;

  -- Also notify admins
  FOR member_rec IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
    VALUES (
      member_rec.user_id,
      'new_groom',
      'تسجيل عريس جديد',
      NEW.full_name || ' · ' || NEW.family_branch,
      '/grooms',
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_media_on_new_groom ON public.grooms;
CREATE TRIGGER trg_notify_media_on_new_groom
AFTER INSERT ON public.grooms
FOR EACH ROW
EXECUTE FUNCTION public.notify_media_on_new_groom();