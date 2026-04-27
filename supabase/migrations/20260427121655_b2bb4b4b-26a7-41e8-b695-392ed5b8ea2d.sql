-- Fix infinite recursion in user_roles SELECT policy
-- The previous policy referenced user_roles inside its own USING clause via is_committee_member,
-- which itself queries user_roles. We replace it with a SECURITY DEFINER helper that bypasses RLS.

CREATE OR REPLACE FUNCTION public.shares_committee_with(_viewer uuid, _target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles a
    JOIN public.user_roles b ON b.committee_id = a.committee_id
    WHERE a.user_id = _viewer
      AND b.user_id = _target
      AND a.committee_id IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_supreme_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.committees c ON c.id = ur.committee_id
    WHERE ur.user_id = _user_id
      AND c.type = 'supreme'::committee_type
  );
$$;

-- Replace user_roles SELECT policy
DROP POLICY IF EXISTS roles_select_own_or_admin ON public.user_roles;

CREATE POLICY roles_select_own_or_admin
ON public.user_roles
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'quality'::app_role)
  OR public.shares_committee_with(auth.uid(), user_id)
  OR public.is_supreme_member(auth.uid())
);

-- Replace profiles SELECT policy to also use the safe helper (avoids any cross-policy recursion)
DROP POLICY IF EXISTS profiles_select_own_or_admin ON public.profiles;

CREATE POLICY profiles_select_own_or_admin
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'quality'::app_role)
  OR public.shares_committee_with(auth.uid(), user_id)
  OR public.is_supreme_member(auth.uid())
);