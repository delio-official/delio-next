-- ══════════════════════════════════════════════════════════════
--  회원 탈퇴 기록 (재가입 어뷰징 방어 데이터)
--  A단계: 탈퇴자 이메일/번호 기록 (소프트 탈퇴로 동일 이메일 재가입은 자동 차단)
--  B단계: 본인인증 적용 시 ci(연계정보) 채워 새 이메일 우회까지 차단
--  ⚠️ Supabase SQL Editor 에서 1회 실행
-- ══════════════════════════════════════════════════════════════
create table if not exists withdrawn_users (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid,
  email        text,
  phone        text,
  ci           text,         -- 본인인증 연계정보(B단계) — 같은 사람 식별
  withdrawn_at timestamptz not null default now()
);

create index if not exists withdrawn_users_email_idx on withdrawn_users (lower(email));
create index if not exists withdrawn_users_phone_idx on withdrawn_users (phone);

alter table withdrawn_users enable row level security;
drop policy if exists "wu_admin_select" on withdrawn_users;
create policy "wu_admin_select" on withdrawn_users for select using (public.is_current_user_admin());
grant all on withdrawn_users to service_role;
