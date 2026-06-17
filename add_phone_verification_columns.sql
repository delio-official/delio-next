-- 다날 휴대폰 본인인증 도입 사전작업
-- 본인인증 완료 시 다날에서 받는 값(CI/DI/생년월일/성별)을 저장할 컬럼.
-- CI(연계정보) = 사람당 1개 → 중복가입/재가입 어뷰징 차단의 핵심 키.
-- 값 기록은 본인인증 서버 라우트(service_role)에서만 수행 (클라이언트 직접수정 금지).

-- 1) profiles 본인인증 정보
alter table public.profiles
  add column if not exists ci text,            -- 연계정보 (1인 1값)
  add column if not exists di text,            -- 중복가입확인정보 (사이트별)
  add column if not exists gender text,        -- 'M' | 'F'
  add column if not exists verified_at timestamptz;  -- 본인인증 완료 시각
-- birth 는 기존 컬럼 사용 (다날 인증값으로 갱신)

-- CI 중복 조회용 인덱스 (가입 시 1인1계정 체크)
create index if not exists idx_profiles_ci on public.profiles (ci) where ci is not null;

-- 2) withdrawn_users 에 CI 저장 → 재가입 시 매칭(30일 제한/쿠폰차단)
alter table public.withdrawn_users
  add column if not exists ci text;
create index if not exists idx_withdrawn_users_ci on public.withdrawn_users (ci) where ci is not null;
