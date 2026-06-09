-- ============================================================
-- 카테고리 대분류/소분류 구성 (한 번 실행 — 멱등)
--   대분류: 국산과일(domestic) / 수입과일(import) / 선물세트(gift, 기존)
--   소분류: 기존 품목들을 대분류 밑으로 연결
-- ============================================================

-- 1) 대분류 생성 (없을 때만)
insert into public.filter_tabs (tab_type, tab_value, label, emoji, bg, sort_order, is_active, show_in_home, show_in_category, show_in_shortcut, parent)
select 'category','domestic','국산과일','🇰🇷','#FFE8E8', 5, true, false, true, false, null
where not exists (select 1 from public.filter_tabs where tab_type='category' and tab_value='domestic');

insert into public.filter_tabs (tab_type, tab_value, label, emoji, bg, sort_order, is_active, show_in_home, show_in_category, show_in_shortcut, parent)
select 'category','import','수입과일','🌍','#E8F5E9', 6, true, false, true, false, null
where not exists (select 1 from public.filter_tabs where tab_type='category' and tab_value='import');

-- 2) 소분류 → 대분류 연결
update public.filter_tabs set parent='domestic'
  where tab_type='category' and tab_value in ('apple','citrus','berry','melon','grape');

update public.filter_tabs set parent='import'
  where tab_type='category' and tab_value in ('kiwi','mango');

-- gift(선물세트), etc(기타)는 대분류(parent=null)로 유지 — 그대로 둠

-- 3) 테스트 데이터 정리 (원치 않으면 이 두 줄은 빼고 실행)
delete from public.filter_tabs where tab_type='category' and tab_value in ('tesst','testtest');
