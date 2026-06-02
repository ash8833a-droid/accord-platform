-- 1) Scope committee_minutes SELECT to members + admin/quality/supreme
DROP POLICY IF EXISTS minutes_select_auth ON public.committee_minutes;
CREATE POLICY minutes_select_scoped ON public.committee_minutes
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'quality'::app_role)
    OR is_supreme_member(auth.uid())
    OR (committee_id IS NOT NULL AND is_committee_member(auth.uid(), committee_id))
  );

-- 2) Remove sensitive finance table from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.family_contributions;

-- 3) Lock down realtime.messages: require auth to subscribe
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "realtime_authenticated_only" ON realtime.messages;
CREATE POLICY "realtime_authenticated_only" ON realtime.messages
  FOR SELECT TO authenticated USING (true);

-- 4) Revoke EXECUTE on SECURITY DEFINER helper functions from anon
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon', fn.proname, fn.args);
  END LOOP;
END$$;
