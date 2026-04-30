UPDATE public.user_roles
SET role = 'committee'::app_role
WHERE role = 'delegate'::app_role;