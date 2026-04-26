CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'grooms', (SELECT COUNT(*) FROM public.grooms),
    'historical_shareholders', (SELECT COUNT(*) FROM public.historical_shareholders),
    'historical_amount', (SELECT COALESCE(SUM(amount), 0) FROM public.historical_shareholders),
    'historical_years', (SELECT COUNT(DISTINCT hijri_year) FROM public.historical_shareholders),
    'first_year', (SELECT MIN(hijri_year) FROM public.historical_shareholders),
    'historical_branches', (SELECT COUNT(DISTINCT family_branch) FROM public.historical_shareholders),
    'confirmed_subs', (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'confirmed'),
    'confirmed_amount', (SELECT COALESCE(SUM(amount), 0) FROM public.subscriptions WHERE status = 'confirmed'),
    'committees', (SELECT COUNT(*) FROM public.committees)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon, authenticated;