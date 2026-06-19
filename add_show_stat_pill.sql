-- 상품 상세 "만족/재구매 필(pill)" 표시 토글
-- 기본값 true (기존 상품은 모두 표시 유지). 어드민 상품관리에서 상품별로 끄고 켤 수 있음.
-- ⚠️ Supabase SQL Editor 에서 1회 실행

alter table public.products
  add column if not exists show_stat_pill boolean not null default true;
