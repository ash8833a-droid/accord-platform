-- Allow committee members to see other members of the same committee
DROP POLICY IF EXISTS roles_select_own_or_admin ON public.user_roles;

CREATE POLICY roles_select_own_or_admin
ON public.user_roles
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'quality'::app_role)
  OR (
    committee_id IS NOT NULL
    AND public.is_committee_member(auth.uid(), committee_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.committees c ON c.id = ur.committee_id
    WHERE ur.user_id = auth.uid()
      AND c.type = 'supreme'::committee_type
  )
);

-- Also allow members to see profiles of their committee mates (names/phones)
DROP POLICY IF EXISTS profiles_select_own_or_admin ON public.profiles;

CREATE POLICY profiles_select_own_or_admin
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'quality'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.user_roles me
    JOIN public.user_roles them ON them.committee_id = me.committee_id
    WHERE me.user_id = auth.uid()
      AND them.user_id = profiles.user_id
      AND me.committee_id IS NOT NULL
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.committees c ON c.id = ur.committee_id
    WHERE ur.user_id = auth.uid()
      AND c.type = 'supreme'::committee_type
  )
);