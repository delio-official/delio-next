-- 상품(농가)별 송장 — order_items에 배송 정보 컬럼 추가
-- Supabase SQL Editor에서 실행해주세요.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS courier text;            -- 택배사 코드(예: kr.cjlogistics)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tracking_number text;    -- 송장번호
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS ship_status text;        -- preparing | shipped | delivered
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS shipped_at timestamptz;  -- 발송(송장 등록) 시각
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS delivered_at timestamptz;-- 배송완료 시각
