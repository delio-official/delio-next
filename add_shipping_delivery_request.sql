-- 배송지별 기본 배송 요청사항 컬럼 추가
-- Supabase SQL Editor에서 실행해주세요.
ALTER TABLE shipping_addresses ADD COLUMN IF NOT EXISTS delivery_request text;
