-- 배너 조회수/클릭수 추적
alter table public.banners
  add column if not exists view_count  bigint not null default 0,
  add column if not exists click_count bigint not null default 0;

-- 노출/클릭 카운트 증가 함수 (비로그인 포함 누구나 호출 가능, 본인 데이터 아님 → SECURITY DEFINER)
create or replace function public.bump_banner_stat(p_id uuid, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_kind = 'view' then
    update public.banners set view_count = view_count + 1 where id = p_id;
  elsif p_kind = 'click' then
    update public.banners set click_count = click_count + 1 where id = p_id;
  end if;
end; $$;

grant execute on function public.bump_banner_stat(uuid, text) to anon, authenticated;
