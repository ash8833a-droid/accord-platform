
CREATE TABLE IF NOT EXISTS public.groom_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  groom_id uuid NOT NULL REFERENCES public.grooms(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_user_id uuid,
  actor_name text,
  from_status text,
  to_status text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_groom_audit_groom ON public.groom_audit_log(groom_id, created_at DESC);

ALTER TABLE public.groom_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gal_select ON public.groom_audit_log;
CREATE POLICY gal_select ON public.groom_audit_log FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'quality'::app_role)
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN committees c ON c.id = ur.committee_id
    WHERE ur.user_id = auth.uid()
      AND c.type = ANY (ARRAY['media','programs','reception','dinner','procurement','women']::committee_type[])
  )
);

CREATE OR REPLACE FUNCTION public.log_groom_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  uname text;
  evt text;
  note_text text := NULL;
BEGIN
  SELECT full_name INTO uname FROM public.profiles WHERE user_id = uid LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    evt := 'created';
    INSERT INTO public.groom_audit_log (groom_id, event_type, actor_user_id, actor_name, to_status)
    VALUES (NEW.id, evt, uid, uname, NEW.status::text);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    evt := CASE NEW.status::text
      WHEN 'approved' THEN 'approved'
      WHEN 'under_review' THEN 'revision_requested'
      WHEN 'rejected' THEN 'rejected'
      WHEN 'completed' THEN 'completed'
      ELSE 'status_changed'
    END;

    IF evt = 'revision_requested' AND NEW.notes IS DISTINCT FROM OLD.notes THEN
      note_text := substring(COALESCE(NEW.notes,'') from 1 for 500);
    END IF;

    INSERT INTO public.groom_audit_log (groom_id, event_type, actor_user_id, actor_name, from_status, to_status, note)
    VALUES (NEW.id, evt, uid, uname, OLD.status::text, NEW.status::text, note_text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_groom_changes ON public.grooms;
CREATE TRIGGER trg_log_groom_changes
AFTER INSERT OR UPDATE ON public.grooms
FOR EACH ROW EXECUTE FUNCTION public.log_groom_changes();

-- Backfill: create one 'created' event for existing grooms with no log
INSERT INTO public.groom_audit_log (groom_id, event_type, to_status, created_at)
SELECT g.id, 'created', g.status::text, g.created_at
FROM public.grooms g
WHERE NOT EXISTS (SELECT 1 FROM public.groom_audit_log a WHERE a.groom_id = g.id);
