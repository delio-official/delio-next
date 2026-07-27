-- 라운지 카테고리 (동적 관리 — 생성/수정/삭제/순서변경)
-- 기존엔 코드에 하드코딩(recipe/story/farm/health)이었던 것을 테이블로 이관.
-- lounge_posts.filter = lounge_categories.slug 로 연결.

create table if not exists public.lounge_categories (
  id         bigint generated always as identity primary key,
  slug       text not null unique,          -- lounge_posts.filter 와 매칭되는 값
  label      text not null,                 -- 화면 표기명
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

-- RLS + policy + GRANT 세트
alter table public.lounge_categories enable row level security;

drop policy if exists lounge_categories_read  on public.lounge_categories;
create policy lounge_categories_read  on public.lounge_categories
  for select using (true);

drop policy if exists lounge_categories_write on public.lounge_categories;
create policy lounge_categories_write on public.lounge_categories
  for all to authenticated using (true) with check (true);

grant select on public.lounge_categories to anon, authenticated;
grant insert, update, delete on public.lounge_categories to authenticated;

-- 기존 4개 카테고리 시드 (이미 있으면 무시)
insert into public.lounge_categories (slug, label, sort_order) values
  ('recipe', '레시피',     0),
  ('story',  '과일이야기', 1),
  ('farm',   '산지소식',   2),
  ('health', '건강팁',     3)
on conflict (slug) do nothing;
