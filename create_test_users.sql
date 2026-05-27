-- =====================================================
-- 테스트 계정 생성
-- Supabase SQL Editor에서 실행하세요
--
-- 생성되는 계정:
--   일반 유저  test@delio.co.kr  /  Test1234!
--   관리자     admin@delio.co.kr /  Admin1234!
-- =====================================================

DO $$
DECLARE
  v_test_id  uuid := gen_random_uuid();
  v_admin_id uuid := gen_random_uuid();
BEGIN

  -- ─────────────────────────────────────
  -- 1) 일반 테스트 유저
  -- ─────────────────────────────────────
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_test_id,
    'authenticated', 'authenticated',
    'test@delio.co.kr',
    crypt('Test1234!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false, now(), now(), '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id,
    identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_test_id,
    'test@delio.co.kr',
    json_build_object('sub', v_test_id::text, 'email', 'test@delio.co.kr')::jsonb,
    'email',
    now(), now(), now()
  );

  INSERT INTO public.profiles (id, email, name, grade, point_balance)
  VALUES (v_test_id, 'test@delio.co.kr', '테스트유저', 'normal', 5000)
  ON CONFLICT (id) DO NOTHING;


  -- ─────────────────────────────────────
  -- 2) 관리자 계정
  -- ─────────────────────────────────────
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_admin_id,
    'authenticated', 'authenticated',
    'admin@delio.co.kr',
    crypt('Admin1234!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"admin"}'::jsonb,
    false, now(), now(), '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id,
    identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_admin_id,
    'admin@delio.co.kr',
    json_build_object('sub', v_admin_id::text, 'email', 'admin@delio.co.kr')::jsonb,
    'email',
    now(), now(), now()
  );

  INSERT INTO public.profiles (id, email, name, grade, point_balance)
  VALUES (v_admin_id, 'admin@delio.co.kr', '관리자', 'vvip', 100000)
  ON CONFLICT (id) DO NOTHING;

END $$;
