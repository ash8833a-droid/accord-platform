
-- Allow any committee member to read minutes that belong to the Supreme committee
DROP POLICY IF EXISTS "minutes_select_scoped" ON public.committee_minutes;
CREATE POLICY "minutes_select_scoped"
ON public.committee_minutes
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'quality'::app_role)
  OR is_supreme_member(auth.uid())
  OR (committee_id IS NOT NULL AND is_committee_member(auth.uid(), committee_id))
  OR EXISTS (
    SELECT 1 FROM public.committees c
    WHERE c.id = committee_minutes.committee_id
      AND c.type = 'supreme'::committee_type
  )
);

-- Trigger: when a Supreme minute is inserted, notify every committee member + admins
CREATE OR REPLACE FUNCTION public.notify_all_committees_on_supreme_minute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type committee_type;
  v_name text;
  rec record;
  body_txt text;
BEGIN
  SELECT type, name INTO v_type, v_name FROM public.committees WHERE id = NEW.committee_id;
  IF v_type IS DISTINCT FROM 'supreme'::committee_type THEN
    RETURN NEW;
  END IF;

  body_txt := NEW.title
    || COALESCE(' · بتاريخ ' || NEW.meeting_date::text, '')
    || COALESCE(' · ' || NEW.location, '');

  FOR rec IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.committee_id IS NOT NULL OR ur.role = 'admin'::app_role
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
    VALUES (
      rec.user_id,
      'supreme_minute',
      'محضر جديد من ' || COALESCE(v_name, 'اللجنة العليا') || ' — للاطلاع',
      body_txt,
      '/portal',
      NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_all_committees_on_supreme_minute ON public.committee_minutes;
CREATE TRIGGER trg_notify_all_committees_on_supreme_minute
AFTER INSERT ON public.committee_minutes
FOR EACH ROW EXECUTE FUNCTION public.notify_all_committees_on_supreme_minute();
