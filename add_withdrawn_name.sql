-- 탈퇴 이력에 이름 저장 (관리자 탈퇴 목록에서 이름 표시용)
-- 기존 행은 name = null (탈퇴 시점에 프로필이 삭제돼 소급 불가) → 관리자에서 '-' 표시.
alter table public.withdrawn_users
  add column if not exists name text;
