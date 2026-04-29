
CREATE OR REPLACE FUNCTION public.get_public_committees()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_agg(row)
  FROM (
    SELECT
      c.id,
      c.type,
      c.name,
      c.description,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', tm.id,
          'full_name', tm.full_name,
          'role_title', tm.role_title,
          'specialty', tm.specialty,
          'is_head', tm.is_head
        ) ORDER BY tm.is_head DESC, tm.display_order ASC, tm.full_name ASC)
        FROM public.team_members tm
        WHERE tm.committee_id = c.id
      ), '[]'::jsonb) AS members
    FROM public.committees c
    ORDER BY c.name
  ) row;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_committees() TO anon, authenticated;
