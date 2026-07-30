-- 브랜드 정산 v2: 세금계산서 수령 확인 컬럼
-- period 는 기존 'YYYY-MM'에서 1/2차 구분 위해 'YYYY-MM-1' / 'YYYY-MM-2' 형식도 저장됨(text라 스키마 변경 불필요)
-- 실행 위치: Supabase SQL Editor

alter table public.farm_settlements
  add column if not exists invoice_received     boolean default false,
  add column if not exists invoice_received_at  timestamptz;
