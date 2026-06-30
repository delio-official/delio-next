-- 회원가입 이메일 중복확인용 함수.
-- 비로그인(anon)은 RLS로 profiles/auth.users 를 직접 못 읽으므로,
-- auth.users 를 보안 정의자(security definer)로 조회해 존재 여부(boolean)만 반환한다.
-- Supabase SQL Editor에서 실행해주세요.

create or replace function public.email_exists(p_email text)
returns boolean
language sql
security definer
set search_path = auth, public
as $$
  select exists (
    select 1 from auth.users where lower(email) = lower(trim(p_email))
  );
$$;

grant execute on function public.email_exists(text) to anon, authenticated;
