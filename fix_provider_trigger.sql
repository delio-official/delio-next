-- ══════════════════════════════════════════════════════════════
--  가입경로(provider) 수정 — 안전판 (네이버 보존)
--
--  배경:
--   · 카카오: 진짜 OAuth → auth.users.raw_app_meta_data.provider='kakao' 신뢰 가능
--   · 네이버: 커스텀 구현. GoTrue가 provider를 'email'로 덮어쓰므로
--             네이버 콜백이 profiles.provider='naver' 를 "직접" 기록해 유지함.
--             (auth.users 에는 providers 배열에만 'naver' 흔적이 남음)
--
--  ⚠️ 이전 버전 백필이 auth.users(email) 기준으로 맞춰 네이버를 일반으로
--     되돌렸음 → 아래는 절대 'email'로 강등하지 않고, 카카오/네이버로만 올림.
--  ⚠️ Supabase SQL Editor 에서 1회 실행
-- ══════════════════════════════════════════════════════════════

-- 1) 가입 트리거: 등급 + provider 기록 (카카오/이메일은 여기서 처리, 네이버는 콜백이 보정)
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

-- 2) 카카오 백필: auth.users 에 provider='kakao' 인 회원
UPDATE public.profiles p
SET provider = 'kakao'
FROM auth.users u
WHERE p.id = u.id
  AND u.raw_app_meta_data->>'provider' = 'kakao'
  AND COALESCE(p.provider, '') <> 'kakao';

-- 3) 네이버 복원: providers 배열에 'naver' 흔적이 있거나 provider='naver' 인 회원
UPDATE public.profiles p
SET provider = 'naver'
FROM auth.users u
WHERE p.id = u.id
  AND (
        u.raw_app_meta_data->>'provider' = 'naver'
     OR (u.raw_app_meta_data->'providers') ? 'naver'
      )
  AND COALESCE(p.provider, '') <> 'naver';
