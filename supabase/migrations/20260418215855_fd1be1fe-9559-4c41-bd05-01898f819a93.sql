UPDATE public.user_roles
SET role = 'admin'
WHERE user_id = '9a72de6e-4b81-4ba2-9bc1-baa748be7a0f'
  AND committee_id = '981c850e-f5ec-4e83-95e6-7320150e2fcf';

UPDATE public.committees
SET head_user_id = '9a72de6e-4b81-4ba2-9bc1-baa748be7a0f',
    updated_at = now()
WHERE id = '981c850e-f5ec-4e83-95e6-7320150e2fcf';