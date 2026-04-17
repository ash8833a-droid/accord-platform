-- Remove old admin account 0500000000 if present
DO $$
DECLARE old_uid uuid;
BEGIN
  SELECT id INTO old_uid FROM auth.users WHERE email = '0500000000@phone.local';
  IF old_uid IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = old_uid;
    DELETE FROM public.profiles WHERE user_id = old_uid;
    DELETE FROM public.membership_requests WHERE user_id = old_uid;
    DELETE FROM auth.identities WHERE user_id = old_uid;
    DELETE FROM auth.users WHERE id = old_uid;
  END IF;
END $$;

-- Create or update new admin account 0555223493 / 123456
DO $$
DECLARE
  admin_uid uuid;
  admin_email text := '0555223493@phone.local';
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
      crypt('123456', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name','لجنة الزواج','phone','0555223493'),
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), admin_uid,
      jsonb_build_object('sub', admin_uid::text, 'email', admin_email),
      'email', admin_uid::text, now(), now(), now()
    );
  ELSE
    UPDATE auth.users
       SET encrypted_password = crypt('123456', gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, now()),
           raw_user_meta_data = jsonb_build_object('full_name','لجنة الزواج','phone','0555223493'),
           updated_at = now()
     WHERE id = admin_uid;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (admin_uid, 'لجنة الزواج', '0555223493')
  ON CONFLICT DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = admin_uid AND role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (admin_uid, 'admin');
  END IF;
END $$;