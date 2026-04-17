-- 1) Delete design committee + all related rows
DO $$
DECLARE
  design_id uuid;
BEGIN
  SELECT id INTO design_id FROM public.committees WHERE type = 'design' LIMIT 1;
  IF design_id IS NOT NULL THEN
    DELETE FROM public.task_attachments WHERE task_id IN (SELECT id FROM public.committee_tasks WHERE committee_id = design_id);
    DELETE FROM public.committee_tasks WHERE committee_id = design_id;
    DELETE FROM public.payment_requests WHERE committee_id = design_id;
    DELETE FROM public.team_members WHERE committee_id = design_id;
    DELETE FROM public.user_roles WHERE committee_id = design_id;
    UPDATE public.membership_requests SET requested_committee_id = NULL WHERE requested_committee_id = design_id;
    UPDATE public.membership_requests SET assigned_committee_id = NULL WHERE assigned_committee_id = design_id;
    DELETE FROM public.reports WHERE committee_id = design_id;
    DELETE FROM public.committees WHERE id = design_id;
  END IF;
END $$;

-- 2) Create platform admin user "لجنة الزواج"
DO $$
DECLARE
  admin_uid uuid;
  admin_email text := '0500000000@phone.local';
BEGIN
  SELECT id INTO admin_uid FROM auth.users WHERE email = admin_email;

  IF admin_uid IS NULL THEN
    admin_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin_uid, 'authenticated', 'authenticated', admin_email,
      crypt('Admin@2025', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name','لجنة الزواج','phone','0500000000'),
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), admin_uid,
      jsonb_build_object('sub', admin_uid::text, 'email', admin_email),
      'email', admin_uid::text, now(), now(), now()
    );
  END IF;

  -- Profile
  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (admin_uid, 'لجنة الزواج', '0500000000')
  ON CONFLICT DO NOTHING;

  -- Admin role
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = admin_uid AND role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (admin_uid, 'admin');
  END IF;
END $$;