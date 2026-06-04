-- 상품 옵션에 "그룹(큰 분류)" 추가 — 덧셈식 다중 옵션 지원
-- 같은 group_name끼리 한 드롭다운, 고른 값들의 add_price 합산
-- Supabase SQL Editor에서 실행

ALTER TABLE product_options ADD COLUMN IF NOT EXISTS group_name text;

-- 기존 옵션은 전부 '옵션' 그룹으로 묶음 (상품상세 드롭다운 1개로 정상화)
UPDATE product_options SET group_name = '옵션' WHERE group_name IS NULL;
