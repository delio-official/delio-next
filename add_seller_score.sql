-- =====================================================
-- seller_score 컬럼 추가 + products.json 정확한 값 적용
-- Supabase SQL Editor에서 실행하세요
--
-- ※ 컬럼이 이미 존재하면 첫 번째 줄에서 오류가 나도
--    나머지 UPDATE 문은 계속 실행됩니다.
-- =====================================================

-- Step 1: 컬럼 추가
ALTER TABLE products ADD COLUMN seller_score JSON;

-- Step 2: products.json sellerScore 정확한 값으로 업데이트
UPDATE products SET seller_score = '{"sweet":4.5,"sour":2.0,"texture":4.8,"fresh":4.9}' WHERE sku = 'P001';
UPDATE products SET seller_score = '{"sweet":4.0,"sour":2.5,"texture":3.5,"fresh":4.2}' WHERE sku = 'P002';
UPDATE products SET seller_score = '{"sweet":4.8,"sour":2.0,"texture":3.5,"fresh":4.7}' WHERE sku = 'P003';
UPDATE products SET seller_score = '{"sweet":4.5,"sour":1.5,"texture":4.2,"fresh":4.5}' WHERE sku = 'P004';
UPDATE products SET seller_score = '{"sweet":4.3,"sour":1.0,"texture":3.8,"fresh":4.9}' WHERE sku = 'P005';
UPDATE products SET seller_score = '{"sweet":4.2,"sour":3.0,"texture":2.5,"fresh":3.8}' WHERE sku = 'P006';
UPDATE products SET seller_score = '{"sweet":4.9,"sour":1.5,"texture":2.0,"fresh":4.8}' WHERE sku = 'P007';
UPDATE products SET seller_score = '{"sweet":4.0,"sour":3.5,"texture":3.0,"fresh":4.2}' WHERE sku = 'P008';
UPDATE products SET seller_score = '{"sweet":2.5,"sour":3.5,"texture":4.0,"fresh":4.5}' WHERE sku = 'P009';
UPDATE products SET seller_score = '{"sweet":4.3,"sour":2.5,"texture":2.8,"fresh":4.2}' WHERE sku = 'P010';
UPDATE products SET seller_score = '{"sweet":3.2,"sour":4.2,"texture":2.5,"fresh":4.3}' WHERE sku = 'P011';
UPDATE products SET seller_score = '{"sweet":4.8,"sour":1.8,"texture":2.2,"fresh":4.7}' WHERE sku = 'P012';

-- Step 3: 카테고리별 기본값 (P013 이후 미지정 상품)
UPDATE products SET seller_score = '{"sweet":4,"sour":2,"texture":4,"fresh":4}' WHERE category = 'apple'  AND seller_score IS NULL;
UPDATE products SET seller_score = '{"sweet":4,"sour":3,"texture":3,"fresh":4}' WHERE category = 'citrus' AND seller_score IS NULL;
UPDATE products SET seller_score = '{"sweet":3,"sour":3,"texture":3,"fresh":4}' WHERE category = 'berry'  AND seller_score IS NULL;
UPDATE products SET seller_score = '{"sweet":5,"sour":1,"texture":4,"fresh":5}' WHERE category = 'melon'  AND seller_score IS NULL;
UPDATE products SET seller_score = '{"sweet":4,"sour":3,"texture":4,"fresh":4}' WHERE category = 'kiwi'   AND seller_score IS NULL;
UPDATE products SET seller_score = '{"sweet":5,"sour":1,"texture":2,"fresh":5}' WHERE category = 'mango'  AND seller_score IS NULL;
UPDATE products SET seller_score = '{"sweet":4,"sour":1,"texture":4,"fresh":4}' WHERE category = 'grape'  AND seller_score IS NULL;
UPDATE products SET seller_score = '{"sweet":4,"sour":2,"texture":3,"fresh":4}' WHERE category = 'gift'   AND seller_score IS NULL;
UPDATE products SET seller_score = '{"sweet":4,"sour":2,"texture":3,"fresh":4}' WHERE seller_score IS NULL;
