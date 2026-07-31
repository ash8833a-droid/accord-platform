DO $$
DECLARE r record;
BEGIN
  -- trigger functions never need to be callable directly
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated, public', r.sig);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.launch_platform() FROM anon;
REVOKE ALL ON FUNCTION public.reset_launch_status() FROM anon;
REVOKE ALL ON FUNCTION public.create_task_evidence_reminders(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.launch_platform() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_launch_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_task_evidence_reminders(uuid) TO authenticated;