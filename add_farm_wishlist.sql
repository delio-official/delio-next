-- 농장 찜(팔로우) — 상품 찜(wishlist)과 별개
create table if not exists public.farm_wishlist (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  farm_id    uuid not null references public.farms(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, farm_id)
);
create index if not exists farm_wishlist_farm_idx on public.farm_wishlist(farm_id);

alter table public.farm_wishlist enable row level security;
-- 팔로워 수 집계용: 조회는 전체 허용
drop policy if exists farm_wishlist_select on public.farm_wishlist;
create policy farm_wishlist_select on public.farm_wishlist for select using (true);
-- 추가/삭제는 본인 것만
drop policy if exists farm_wishlist_insert on public.farm_wishlist;
create policy farm_wishlist_insert on public.farm_wishlist for insert with check (auth.uid() = user_id);
drop policy if exists farm_wishlist_delete on public.farm_wishlist;
create policy farm_wishlist_delete on public.farm_wishlist for delete using (auth.uid() = user_id);

grant select on public.farm_wishlist to anon, authenticated;
grant insert, delete on public.farm_wishlist to authenticated;
