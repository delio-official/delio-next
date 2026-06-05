-- 회원별 관리자 메모(누적 기록) — 상담내역처럼 기간+내용 누적
create table if not exists public.member_memos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  content     text not null,
  admin_name  text,
  created_at  timestamptz not null default now()
);
create index if not exists member_memos_user_idx on public.member_memos(user_id, created_at desc);

-- RLS: 관리자만 조회/작성/삭제 (is_current_user_admin 함수 사용)
alter table public.member_memos enable row level security;
drop policy if exists member_memos_admin_all on public.member_memos;
create policy member_memos_admin_all on public.member_memos
  for all using (public.is_current_user_admin()) with check (public.is_current_user_admin());
grant select, insert, update, delete on public.member_memos to authenticated;
