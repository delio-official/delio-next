-- ══════════════════════════════════════════════════════════════
--  🔴 긴급: 신규 가입 전체 실패 수정
--  원인: profiles 자동생성 트리거가 grade='normal' 삽입 →
--        멤버십 개편의 profiles_grade_check(beginner/taster/buyer/master) 위반
--        → "Database error creating new user" 로 모든 가입(이메일·카카오·네이버) 실패
--  조치: 트리거 기본 등급을 'beginner' 로 변경
--  ⚠️ Supabase SQL Editor 에서 즉시 1회 실행
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, grade, point_balance)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'beginner',
    0
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
