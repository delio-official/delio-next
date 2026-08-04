-- 부분환불(진짜 부분취소) — 주문에 누적 부분환불액 컬럼 추가
-- 부분환불 시 주문은 confirmed(구매확정) 상태로 유지되고, 실제 환불된 하자분 금액을 여기에 누적한다.
-- 정산/매출에서 이 값을 순매출 차감에 사용.

alter table public.orders
  add column if not exists partial_refund_amount integer not null default 0;

comment on column public.orders.partial_refund_amount is
  '부분환불(하자분) 누적 실환불액(원). 주문은 confirmed 유지, 이 금액만큼 순매출/정산에서 차감';
