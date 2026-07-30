-- 취향진단 완료율 집계용: 진단 시작(정보입력 후 문항 진입) 로깅 테이블
-- 완료율 = survey_results(완료) / survey_starts(시작). 관리자 취향프로파일 상단 지표에 사용.
-- 실행 위치: Supabase SQL Editor

create table if not exists public.survey_starts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_survey_starts_created on public.survey_starts (created_at);

alter table public.survey_starts enable row level security;

-- 누구나 시작 로깅 insert (비회원 포함)
drop policy if exists survey_starts_insert on public.survey_starts;
create policy survey_starts_insert on public.survey_starts
  for insert to anon, authenticated with check (true);

-- 조회는 로그인 사용자(관리자 화면)만
drop policy if exists survey_starts_select on public.survey_starts;
create policy survey_starts_select on public.survey_starts
  for select to authenticated using (true);

grant insert on public.survey_starts to anon, authenticated;
grant select on public.survey_starts to authenticated;
