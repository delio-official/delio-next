-- 주문 단위 송장을 상품별 송장으로 채워넣기 (기존 데이터 보정)
--
-- 배경
--   송장 저장 위치가 두 군데다.
--     orders.tracking_number       ← 주문관리 '목록'에서 입력
--     order_items.tracking_number  ← 주문 상세의 '브랜드별 송장'에서 입력
--   목록에서만 입력하면 order_items 가 비어 있어 상세의 배송추적 칸이 비어 보였다.
--   (코드는 양방향 동기화하도록 수정 완료 — 앞으로 생기는 주문은 자동으로 맞는다)
--
--   조사 결과 송장이 있는 주문 51건 중 48건이 어긋나 있었다.
--
-- 이 스크립트는 order_items 의 송장이 '비어 있는 경우에만' 주문 송장을 복사한다.
-- 이미 값이 있는 항목(브랜드별로 따로 입력한 것)은 건드리지 않는다.

update public.order_items oi
set    courier         = o.courier,
       tracking_number = o.tracking_number,
       ship_status     = case when oi.ship_status is null or oi.ship_status = 'preparing'
                              then 'shipped' else oi.ship_status end,
       shipped_at      = coalesce(oi.shipped_at, o.shipped_at, o.updated_at)
from   public.orders o
where  oi.order_id = o.id
  and  o.tracking_number is not null
  and  o.tracking_number <> ''
  and  (oi.tracking_number is null or oi.tracking_number = '');

------------------------------------------------------------------
-- 확인 1) 아직 어긋난 주문 (0건이면 정상. 단, 아래 '번호 불일치' 건은 남는다)
------------------------------------------------------------------
select o.order_no,
       o.tracking_number  as 주문송장,
       oi.tracking_number as 상품송장,
       oi.product_name
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
 where o.tracking_number is not null
   and coalesce(oi.tracking_number, '') <> o.tracking_number
 order by o.created_at desc;

------------------------------------------------------------------
-- 확인 2) 번호가 서로 다른 건 — 사람이 판단해야 함
------------------------------------------------------------------
-- ORD-20260720-98ea56 은 목록과 상세에 서로 다른 번호가 들어가 있다.
--   주문 단위 : 462886840216
--   상품 단위 : 462586840216   (상세에서 나중에 입력한 값)
-- 둘 중 하나가 오타다. 맞는 번호를 확인한 뒤 아래처럼 맞춰주세요.
--
-- update public.orders       set tracking_number = '맞는번호' where order_no = 'ORD-20260720-98ea56';
-- update public.order_items  set tracking_number = '맞는번호'
--   where order_id = (select id from public.orders where order_no = 'ORD-20260720-98ea56');
