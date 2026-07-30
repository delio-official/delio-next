-- 구매확정 시각 기록 (브랜드 정산 1/2차 기준일용)
-- 기존 구매확정 주문은 배송완료일로 백필(시각 미기록분) → 정산에서 날짜 기준 사용 가능
-- 실행 위치: Supabase SQL Editor

alter table public.orders
  add column if not exists confirmed_at timestamptz;

-- 백필: 이미 구매확정(confirmed)인데 확정시각 없는 건 → 배송완료일로 대체
update public.orders
  set confirmed_at = delivered_at
  where status = 'confirmed' and confirmed_at is null and delivered_at is not null;
