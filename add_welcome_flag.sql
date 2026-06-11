-- ════════════════════════════════════════════════════════════════
-- 가입 환영 알림톡 1회 발송 플래그
--   welcome_sent = true  → 이미 발송함 (재로그인 시 재발송 방지)
--   기존 회원은 모두 true 로 백필 (다시 안 가게)
-- ════════════════════════════════════════════════════════════════
alter table public.profiles
  add column if not exists welcome_sent boolean not null default false;

update public.profiles set welcome_sent = true where welcome_sent = false;
