-- ============================================================
-- 카테고리 대분류/소분류 계층 + 상단 메뉴 CRUD
-- ============================================================

-- 1) filter_tabs(category형)에 상위(대분류) 연결 컬럼 추가
--    parent = NULL → 대분류 / parent = 상위 category의 tab_value → 소분류
alter table public.filter_tabs add column if not exists parent text;

-- 2) 상단 메뉴(브랜드소개관·이벤트·라운지·취향진단 등) CRUD 테이블
create table if not exists public.menu_items (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,                  -- 표시명 (브랜드소개관)
  href        text not null,                  -- 이동 경로 (/brand-intro)
  emoji       text default '',
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  show_in_header   boolean not null default true,   -- PC 헤더 상단 nav
  show_in_shortcut boolean not null default false,  -- 모바일 하단 단축
  created_at  timestamptz not null default now()
);

alter table public.menu_items enable row level security;
drop policy if exists "menu_items read"  on public.menu_items;
drop policy if exists "menu_items admin" on public.menu_items;
create policy "menu_items read"  on public.menu_items for select using (true);
create policy "menu_items admin" on public.menu_items for all
  using (is_current_user_admin()) with check (is_current_user_admin());
grant select on public.menu_items to anon, authenticated;
grant insert, update, delete on public.menu_items to authenticated;
