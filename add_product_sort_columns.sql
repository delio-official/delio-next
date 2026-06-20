-- ============================================================
-- 상품 정렬용 집계 컬럼 + 자동유지 트리거
--   sales_count : 인기순(실판매 수량 누적)
--   sweet_sort  : 당도 정렬값 (리뷰<10 → 판매자입력 / 리뷰>=10 → 리뷰평균)
--   sour_sort   : 산도 정렬값 (동일)
-- Supabase SQL Editor에서 1회 실행
-- ============================================================

-- 1) 컬럼 추가 --------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS sales_count int NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sweet_sort  numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sour_sort   numeric;

-- 2) 판매량 재계산 함수 ---------------------------------------
CREATE OR REPLACE FUNCTION recompute_product_sales(p_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE products p
     SET sales_count = COALESCE((
       SELECT SUM(oi.quantity)
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
        WHERE oi.product_id = p.id
          AND o.status IN ('paid','shipped','delivered')
     ), 0)
   WHERE p.id = p_id;
$$;

-- 3) 당도/산도 정렬값 재계산 함수 ------------------------------
CREATE OR REPLACE FUNCTION recompute_product_taste(p_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_seller jsonb;
  v_sweet_n int; v_sweet_avg numeric;
  v_sour_n  int; v_sour_avg  numeric;
BEGIN
  SELECT seller_score INTO v_seller FROM products WHERE id = p_id;

  SELECT count(*), avg((taste->>'sweet')::numeric)
    INTO v_sweet_n, v_sweet_avg
    FROM reviews
   WHERE product_id = p_id
     AND (taste->>'sweet') ~ '^[0-9]+(\.[0-9]+)?$';

  SELECT count(*), avg((taste->>'sour')::numeric)
    INTO v_sour_n, v_sour_avg
    FROM reviews
   WHERE product_id = p_id
     AND (taste->>'sour') ~ '^[0-9]+(\.[0-9]+)?$';

  UPDATE products SET
    sweet_sort = CASE WHEN v_sweet_n >= 10 THEN v_sweet_avg
                      ELSE NULLIF(v_seller->>'sweet','')::numeric END,
    sour_sort  = CASE WHEN v_sour_n  >= 10 THEN v_sour_avg
                      ELSE NULLIF(v_seller->>'sour','')::numeric END
  WHERE id = p_id;
END;
$$;

-- 4) 트리거: order_items 변경 → 해당 상품 판매량 갱신 ----------
CREATE OR REPLACE FUNCTION trg_order_items_sales()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM recompute_product_sales(OLD.product_id);
    RETURN OLD;
  END IF;
  PERFORM recompute_product_sales(NEW.product_id);
  IF (TG_OP = 'UPDATE' AND NEW.product_id IS DISTINCT FROM OLD.product_id) THEN
    PERFORM recompute_product_sales(OLD.product_id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS order_items_sales ON order_items;
CREATE TRIGGER order_items_sales
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION trg_order_items_sales();

-- 5) 트리거: orders.status 변경 → 해당 주문 상품들 판매량 갱신 --
CREATE OR REPLACE FUNCTION trg_orders_status_sales()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    FOR r IN SELECT DISTINCT product_id FROM order_items WHERE order_id = NEW.id LOOP
      PERFORM recompute_product_sales(r.product_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS orders_status_sales ON orders;
CREATE TRIGGER orders_status_sales
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION trg_orders_status_sales();

-- 6) 트리거: reviews 변경 → 해당 상품 당도/산도 정렬값 갱신 ----
CREATE OR REPLACE FUNCTION trg_reviews_taste()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM recompute_product_taste(OLD.product_id);
    RETURN OLD;
  END IF;
  PERFORM recompute_product_taste(NEW.product_id);
  IF (TG_OP = 'UPDATE' AND NEW.product_id IS DISTINCT FROM OLD.product_id) THEN
    PERFORM recompute_product_taste(OLD.product_id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS reviews_taste ON reviews;
CREATE TRIGGER reviews_taste
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION trg_reviews_taste();

-- 7) 트리거: products.seller_score 변경 → 당도/산도 재계산 -----
--    (recompute_product_taste 는 sweet_sort/sour_sort 만 수정하므로
--     OF seller_score 트리거가 재귀호출되지 않음)
CREATE OR REPLACE FUNCTION trg_products_seller_taste()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM recompute_product_taste(NEW.id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS products_seller_taste ON products;
CREATE TRIGGER products_seller_taste
  AFTER UPDATE OF seller_score ON products
  FOR EACH ROW EXECUTE FUNCTION trg_products_seller_taste();

-- 8) 인덱스 ----------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_sales ON products(sales_count DESC);
CREATE INDEX IF NOT EXISTS idx_products_sweet ON products(sweet_sort DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_products_sour  ON products(sour_sort  DESC NULLS LAST);

-- 9) 기존 데이터 백필 -----------------------------------------
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM products LOOP
    PERFORM recompute_product_sales(r.id);
    PERFORM recompute_product_taste(r.id);
  END LOOP;
END $$;
