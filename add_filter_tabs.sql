-- ============================================================
-- 필탭/카테고리 통합 관리 테이블
--  · 카테고리형(category): 상품 products.category 값으로 필터 (추가/삭제 자유)
--  · 태그형(flag):        products.is_best / is_dawn / is_new 플래그
--  · 정렬형(sort):        /category?sort=... 로 이동
--  · 링크형(link):        임의 경로로 이동
-- 노출 위치 3곳을 각각 토글: 퀵가이드(home) / 카테고리상단(category) / 하단바(shortcut)
-- ============================================================

create table if not exists filter_tabs (
  id           uuid primary key default gen_random_uuid(),
  tab_type     text not null default 'category',   -- 'category' | 'flag' | 'sort' | 'link'
  tab_value    text not null,                       -- category: 'apple' / flag: 'is_best' / sort: 'brix' / link: '/brand'
  label        text not null,                       -- '사과/배'
  emoji        text default '',                     -- '🍎'
  bg           text default '#F5F5F5',              -- 하단바 아이콘 배경색
  sort_order   int  not null default 0,
  is_active    boolean not null default true,       -- 전체 사용 여부
  show_in_home     boolean not null default false,  -- 메인 퀵 가이드 노출
  show_in_category boolean not null default false,  -- 카테고리 페이지 상단 필탭 노출
  show_in_shortcut boolean not null default false,  -- 모바일 하단바 바로가기 노출
  created_at   timestamptz not null default now()
);

-- RLS + policy + GRANT (3종 세트)
alter table filter_tabs enable row level security;

drop policy if exists "filter_tabs read"  on filter_tabs;
drop policy if exists "filter_tabs admin" on filter_tabs;

-- 누구나 읽기 (활성 필탭은 비로그인 사용자도 봐야 함)
create policy "filter_tabs read" on filter_tabs
  for select using (true);

-- 관리자만 쓰기
create policy "filter_tabs admin" on filter_tabs
  for all using (is_current_user_admin()) with check (is_current_user_admin());

grant select on filter_tabs to anon, authenticated;
grant insert, update, delete on filter_tabs to authenticated;

-- 중복 시드 방지용 유니크 인덱스 (재실행 안전)
create unique index if not exists filter_tabs_type_value_uq on filter_tabs(tab_type, tab_value);

-- ============================================================
-- 시드: 현재 하드코딩된 필탭들을 그대로 이식 (이미 있으면 건너뜀)
-- ============================================================
insert into filter_tabs (tab_type, tab_value, label, emoji, bg, sort_order, is_active, show_in_home, show_in_category, show_in_shortcut)
values
  -- 카테고리형
  ('category','apple', '사과/배',  '🍎','#FFF3EE', 10, true, true,  true,  false),
  ('category','citrus','감귤류',   '🍊','#FFF7E8', 20, true, true,  true,  false),
  ('category','berry', '베리류',   '🫐','#F0EEFF', 30, true, true,  true,  false),
  ('category','melon', '멜론/참외','🍈','#EFFBEF', 40, true, true,  true,  false),
  ('category','kiwi',  '키위',     '🥝','#EDFFF0', 50, true, true,  true,  true ),
  ('category','mango', '망고',     '🥭','#FFF6E8', 60, true, true,  true,  false),
  ('category','grape', '포도',     '🍇','#F3EEFF', 70, true, true,  true,  true ),
  ('category','gift',  '선물세트', '🎁','#FFEEF0', 80, true, true,  true,  true ),
  ('category','etc',   '기타',     '📦','#F1F5F9', 999,true, false, false, false),
  -- 태그형 (플래그)
  ('flag','is_new',  '신상품',  '✨','#F5F0FF', 110, true, false, false, true ),
  ('flag','is_best', '베스트',  '🌟','#FFF3EE', 120, true, true,  false, true ),
  ('flag','is_dawn', '새벽배송','🚚','#EEF4FF', 130, true, true,  false, true ),
  -- 정렬형
  ('sort','brix',      '당도순',  '⭐','#FFF9EE', 210, true, false, false, true ),
  ('sort','price_asc', '할인특가','💰','#FFFAEE', 220, true, false, false, true ),
  -- 링크형
  ('link','/brand',  '브랜드소개관','🏪','#E8EAF6', 310, true, false, false, true ),
  ('link','/event',  '이벤트',     '🎉','#FFF0F5', 320, true, false, false, true ),
  ('link','/lounge', '라운지',     '📖','#EEF4FF', 330, true, false, false, true ),
  ('link','/survey', '취향진단',   '🔍','#F0FFF4', 340, true, false, false, true )
on conflict (tab_type, tab_value) do nothing;
