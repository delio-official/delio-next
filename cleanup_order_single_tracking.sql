-- 농가별(order_items) 송장이 있는 주문의 '주문 단위' 송장(orders.courier/tracking_number)을 비움.
-- 옛 단일 송장 잔재가 남아 고객 배송조회가 엉뚱한 택배사로 조회되는 문제 정리.
-- order_items 의 농가별 송장은 그대로 유지됨. 구버전(주문 1송장) 주문은 건드리지 않음.
-- Supabase SQL Editor에서 실행해주세요.

UPDATE public.orders o
   SET courier = NULL,
       tracking_number = NULL
 WHERE EXISTS (
   SELECT 1 FROM public.order_items i
    WHERE i.order_id = o.id
      AND i.tracking_number IS NOT NULL
 );
