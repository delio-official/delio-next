-- 퀵가이드 개편: 카테고리 필터 → 그리팅식 "제목 + 지정 상품" 가이드
--
-- 예) title="부모님 선물 BEST", product_ids=[관리자가 담은 상품들]
-- 메인페이지 퀵가이드 섹션: 가이드 제목이 탭(칩)으로 뜨고, 누르면 그 가이드의 지정 상품이 노출됨.

create table if not exists public.quickguide_groups (
  id          bigint generated always as identity primary key,
  title       text    not null,
  product_ids uuid[]  not null default '{}',   -- 담긴 상품(노출 순서 = 배열 순서)
  sort_order  int     not null default 0,       -- 탭 노출 순서
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.quickguide_groups enable row level security;

drop policy if exists quickguide_groups_read  on public.quickguide_groups;
create policy quickguide_groups_read  on public.quickguide_groups
  for select using (true);

drop policy if exists quickguide_groups_write on public.quickguide_groups;
create policy quickguide_groups_write on public.quickguide_groups
  for all to authenticated using (true) with check (true);

grant select on public.quickguide_groups to anon, authenticated;
grant insert, update, delete on public.quickguide_groups to authenticated;
