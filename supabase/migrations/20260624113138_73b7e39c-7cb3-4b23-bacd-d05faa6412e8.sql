CREATE OR REPLACE FUNCTION public.reset_launch_status()
RETURNS public.platform_launch
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  result public.platform_launch;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT public.has_role(uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  UPDATE public.platform_launch
  SET is_launched = false,
      launched_at = null,
      launched_by = null,
      launched_by_name = null,
      updated_at = now()
  WHERE id = 1
  RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_launch_status() TO authenticated;