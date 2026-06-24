
CREATE TABLE public.platform_launch (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_launched boolean NOT NULL DEFAULT false,
  launched_at timestamptz,
  launched_by uuid,
  launched_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_launch TO anon, authenticated;
GRANT ALL ON public.platform_launch TO service_role;

ALTER TABLE public.platform_launch ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_launch_read_all"
  ON public.platform_launch FOR SELECT
  TO anon, authenticated
  USING (true);

INSERT INTO public.platform_launch (id, is_launched) VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER platform_launch_updated_at
  BEFORE UPDATE ON public.platform_launch
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_launch;
ALTER TABLE public.platform_launch REPLICA IDENTITY FULL;

-- Admin-only launch function
CREATE OR REPLACE FUNCTION public.launch_platform()
RETURNS public.platform_launch
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  uname text;
  result public.platform_launch;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT public.has_role(uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  SELECT full_name INTO uname FROM public.profiles WHERE user_id = uid LIMIT 1;

  UPDATE public.platform_launch
  SET is_launched = true,
      launched_at = COALESCE(launched_at, now()),
      launched_by = COALESCE(launched_by, uid),
      launched_by_name = COALESCE(launched_by_name, uname),
      updated_at = now()
  WHERE id = 1
  RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.launch_platform() TO authenticated;

-- Public read function (works for anon too)
CREATE OR REPLACE FUNCTION public.get_launch_status()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'is_launched', is_launched,
    'launched_at', launched_at,
    'launched_by_name', launched_by_name
  )
  FROM public.platform_launch WHERE id = 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_launch_status() TO anon, authenticated;
