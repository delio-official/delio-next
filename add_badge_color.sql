-- 상품 뱃지 색상 컬럼 추가 (뱃지 텍스트별 색상 지정)
alter table public.products
  add column if not exists badge_color text;
