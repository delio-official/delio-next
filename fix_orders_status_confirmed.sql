-- orders.status 제약에 'confirmed'(구매확정)가 빠져 있어 주문이 구매확정 상태가 될 수 없음.
-- 코드가 쓰는 모든 상태를 포함하도록 제약 재정의.

alter table orders drop constraint if exists orders_status_check;

alter table orders add constraint orders_status_check
  check (status in (
    'pending',      -- 결제대기(무통장 입금 전)
    'paid',         -- 결제완료
    'preparing',    -- 상품준비중
    'shipped',      -- 배송중
    'delivered',    -- 배송완료
    'confirmed',    -- 구매확정  ← 이게 빠져 있었음
    'cancelled',    -- 취소완료
    'refunding',    -- 환불처리중
    'refunded',     -- 환불완료
    'exchanging',   -- 교환처리중
    'exchanged'     -- 교환완료
  ));
