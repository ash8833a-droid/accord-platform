
INSERT INTO public.user_roles (user_id, role)
SELECT '69e149bf-82ef-409a-bcdf-00091a430577'::uuid, 'admin'::public.app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = '69e149bf-82ef-409a-bcdf-00091a430577' AND role = 'admin'
);

UPDATE public.page_permissions
SET access_level = 'edit'
WHERE user_id = '69e149bf-82ef-409a-bcdf-00091a430577'
  AND access_level <> 'edit';

UPDATE public.user_account_status
SET is_disabled = false, disabled_reason = NULL, disabled_at = NULL, disabled_by = NULL
WHERE user_id = '69e149bf-82ef-409a-bcdf-00091a430577' AND is_disabled = true;
