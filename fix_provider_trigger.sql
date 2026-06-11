-- ══════════════════════════════════════════════════════════════
--  가입경로(provider) 누락 수정
--  원인: 등급 긴급수정(fix_profile_trigger_grade.sql)이 handle_new_user 를
--        덮어쓰면서 provider 기록을 빠뜨림 → 이후 가입자가 전부 'email'(일반)
--  조치: 트리거에 grade='beginner' + provider(raw_app_meta_data) 둘 다 기록
--        + 기존 카카오/네이버 회원 백필
--  ⚠️ Supabase SQL Editor 에서 1회 실행
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, grade, point_balance, provider)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'beginner',
    0,
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 회원 provider 백필 (auth.users 의 실제 가입경로로 보정)
UPDATE public.profiles p
SET provider = COALESCE(u.raw_app_meta_data->>'provider', 'email')
FROM auth.users u
WHERE p.id = u.id
  AND COALESCE(p.provider, 'email') <> COALESCE(u.raw_app_meta_data->>'provider', 'email');
