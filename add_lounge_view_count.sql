-- 라운지 조회수 추적 (배너 bump_banner_stat 과 동일 패턴)
alter table public.lounge_posts
  add column if not exists view_count bigint not null default 0;

-- 상세페이지 열람 시 +1 (비로그인 포함 → SECURITY DEFINER)
create or replace function public.bump_lounge_view(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.lounge_posts set view_count = view_count + 1 where id = p_id;
end; $$;

grant execute on function public.bump_lounge_view(bigint) to anon, authenticated;
