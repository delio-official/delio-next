-- 원산지 상세(국내산: 시도/시군구, 수입산: 국가) 컬럼 추가
-- origin은 기존대로 domestic/import, origin_region은 "경기도 고양시" 같은 상세 문자열.
alter table public.products
  add column if not exists origin_region text;
