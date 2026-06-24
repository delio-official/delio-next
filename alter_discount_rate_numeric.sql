-- 원 단위 할인을 정확히 반영하기 위해 discount_rate를 정수 → 소수(numeric)로 변경
-- 예) 정상가 24,900 · 원할인 4,000 → discount_rate 16.0643% 저장 → 판매가 round(24900*0.839357)=20,900원
--
-- discounted_price는 GENERATED(생성) 컬럼이라 직접 타입 변경이 막히므로,
-- 동일 표현식으로 drop 후 재생성한다. (기존 정수 할인율 데이터는 값이 동일하게 유지됨)

BEGIN;

ALTER TABLE products DROP COLUMN discounted_price;

ALTER TABLE products
  ALTER COLUMN discount_rate TYPE numeric(7,4) USING discount_rate::numeric;

ALTER TABLE products
  ADD COLUMN discounted_price integer
  GENERATED ALWAYS AS (round(price * (1 - discount_rate / 100))::integer) STORED;

COMMIT;

-- 확인용:
-- SELECT name, price, discount_rate, discounted_price FROM products WHERE discount_rate > 0 LIMIT 5;
