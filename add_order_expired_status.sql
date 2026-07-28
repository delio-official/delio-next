-- 무통장 입금기한 만료 상태('expired') 추가
-- orders.status CHECK 제약에 'expired'가 없으면 만료 크론이 실패하므로 재정의.
-- 실행 위치: Supabase SQL Editor

alter table orders drop constraint if exists orders_status_check;

alter table orders add constraint orders_status_check
  check (status in (
    'pending',      -- 입금대기(무통장 입금 전)
    'paid',         -- 결제완료
    'preparing',    -- 상품준비중
    'shipped',      -- 배송중
    'delivered',    -- 배송완료
    'confirmed',    -- 구매확정
    'cancelled',    -- 취소완료
    'refunding',    -- 환불처리중
    'refunded',     -- 환불완료
    'exchanging',   -- 교환처리중
    'exchanged',    -- 교환완료
    'expired'       -- 입금기한 만료(무통장 미입금)  ← 추가
  ));
