-- FAQ 카테고리 동적화: faq_categories 테이블 + 기존 하드코딩 6종 이관
-- 실행 위치: Supabase SQL Editor
-- 주의: faq_items.category 를 '키(delivery)' → '이름(배송)'으로 통일합니다.

-- 1) 카테고리 테이블
create table if not exists public.faq_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

alter table public.faq_categories enable row level security;
drop policy if exists faq_categories_read  on public.faq_categories;
drop policy if exists faq_categories_write on public.faq_categories;
create policy faq_categories_read  on public.faq_categories for select using (true);
create policy faq_categories_write on public.faq_categories for all to authenticated using (true) with check (true);
grant select on public.faq_categories to anon, authenticated;
grant insert, update, delete on public.faq_categories to authenticated;

-- 2) 기존 6개 카테고리 시드 (이미 있으면 무시)
insert into public.faq_categories (name, sort_order) values
  ('배송', 0), ('취소/교환/반품', 1), ('결제/주문', 2),
  ('상품', 3), ('회원관련', 4), ('기타', 5)
on conflict (name) do nothing;

-- 2-1) 기존 category CHECK 제약 제거 (옛 키값만 허용하던 제약 → 자유 이름 허용)
alter table public.faq_items drop constraint if exists faq_items_category_check;

-- 3) 기존 faq_items.category 키 → 이름으로 이관
update public.faq_items set category = '배송'          where category = 'delivery';
update public.faq_items set category = '취소/교환/반품' where category = 'return';
update public.faq_items set category = '결제/주문'      where category = 'order';
update public.faq_items set category = '상품'          where category = 'product';
update public.faq_items set category = '회원관련'       where category = 'member';
update public.faq_items set category = '기타'          where category = 'etc';

-- 4) 매핑 안 된 잔여 값은 '기타'로 (안전장치)
update public.faq_items f set category = '기타'
  where not exists (select 1 from public.faq_categories c where c.name = f.category);
