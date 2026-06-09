-- ============================================================
-- 회원 가입경로(provider) — 일반(email)/카카오(kakao)/네이버(naver)
--  · profiles.provider 컬럼 추가
--  · 신규 가입 시 auth.users.raw_app_meta_data->>'provider' 자동 기록
--  · 기존 회원 백필
-- ============================================================

-- 1) 컬럼 추가 (기본 email)
alter table public.profiles add column if not exists provider text default 'email';

-- 2) 기존 회원 백필 (auth.users 기준)
update public.profiles p
set provider = coalesce(u.raw_app_meta_data->>'provider', 'email')
from auth.users u
where u.id = p.id;

-- 3) 프로필 자동생성 트리거에 provider 기록 추가
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, grade, point_balance, provider)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'normal',
    0,
    coalesce(new.raw_app_meta_data->>'provider', 'email')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
