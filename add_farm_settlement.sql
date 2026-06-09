-- ============================================================
-- 농가 정산 (델리오 → 농가 공급가 정산)
--  · products.supply_price : 농가가 제공한 공급가(단가). 마진 = 판매가 - 공급가
--  · order_items.supply_price : 판매 시점 공급가 스냅샷(단가). 이후 공급가가 바뀌어도 정산은 판매 당시 기준
-- ============================================================

alter table products    add column if not exists supply_price numeric not null default 0;
alter table order_items add column if not exists supply_price numeric;   -- null = 구버전 주문(상품 현재 공급가로 폴백)
