-- ============================================================
-- 상단 메뉴 CRUD 구성 (메가메뉴 컬럼 + 상단 nav + 모바일 단축)
--   parent = NULL → 메가 컬럼(또는 단독 nav) / parent 있으면 그 컬럼의 하위 링크
-- ============================================================

-- 1) 컬럼 보강
alter table public.menu_items add column if not exists parent uuid references public.menu_items(id) on delete cascade;
alter table public.menu_items add column if not exists show_in_mega boolean not null default false;

-- 2) 시드 (이미 있으면 건너뜀 — label 기준)
-- 메가 컬럼 그룹
insert into public.menu_items (label, href, sort_order, is_active, show_in_mega, show_in_header, show_in_shortcut, parent)
select '브랜드 소개관', '/brand-intro', 10, true, true, true, true, null
where not exists (select 1 from public.menu_items where label='브랜드 소개관' and parent is null);
insert into public.menu_items (label, href, sort_order, is_active, show_in_mega, show_in_header, show_in_shortcut, parent)
select '서비스', '/service', 20, true, true, false, false, null
where not exists (select 1 from public.menu_items where label='서비스' and parent is null);

-- 브랜드 소개관 하위
insert into public.menu_items (label, href, sort_order, is_active, parent)
select '브랜드 소개', '/brand', 1, true, (select id from public.menu_items where label='브랜드 소개관' and parent is null limit 1)
where not exists (select 1 from public.menu_items where label='브랜드 소개' );
insert into public.menu_items (label, href, sort_order, is_active, parent)
select '파트너 농가', '/farms', 2, true, (select id from public.menu_items where label='브랜드 소개관' and parent is null limit 1)
where not exists (select 1 from public.menu_items where label='파트너 농가');

-- 서비스 하위
insert into public.menu_items (label, href, sort_order, is_active, parent)
select '배송안내', '/shipping', 1, true, (select id from public.menu_items where label='서비스' and parent is null limit 1)
where not exists (select 1 from public.menu_items where label='배송안내');
insert into public.menu_items (label, href, sort_order, is_active, parent)
select '입점/협업문의', '/inquiry', 2, true, (select id from public.menu_items where label='서비스' and parent is null limit 1)
where not exists (select 1 from public.menu_items where label='입점/협업문의');
insert into public.menu_items (label, href, sort_order, is_active, parent)
select '고객센터', '/faq', 3, true, (select id from public.menu_items where label='서비스' and parent is null limit 1)
where not exists (select 1 from public.menu_items where label='고객센터');

-- 상단 nav 단독 링크 (메가 컬럼 아님)
insert into public.menu_items (label, href, sort_order, is_active, show_in_mega, show_in_header, show_in_shortcut, parent)
select '신상품', '/category?new=true', 5, true, false, true, false, null
where not exists (select 1 from public.menu_items where label='신상품' and parent is null);
insert into public.menu_items (label, href, sort_order, is_active, show_in_mega, show_in_header, show_in_shortcut, parent)
select '이벤트', '/event', 30, true, false, true, true, null
where not exists (select 1 from public.menu_items where label='이벤트' and parent is null);
insert into public.menu_items (label, href, sort_order, is_active, show_in_mega, show_in_header, show_in_shortcut, parent)
select '라운지', '/lounge', 40, true, false, true, true, null
where not exists (select 1 from public.menu_items where label='라운지' and parent is null);
insert into public.menu_items (label, href, sort_order, is_active, show_in_mega, show_in_header, show_in_shortcut, parent)
select '취향진단', '/survey', 50, true, false, true, false, null
where not exists (select 1 from public.menu_items where label='취향진단' and parent is null);
