-- =====================================================
-- products.json 기반 product_options 전체 시드
-- Supabase SQL Editor에서 실행 (중복 안전)
-- =====================================================

-- ──────────────────────────────────────────
-- P001: 고당도 청송 부사사과 (기존 삭제 후 재삽입)
-- ──────────────────────────────────────────
DELETE FROM product_options WHERE product_id = (SELECT id FROM products WHERE sku = 'P001');
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '2kg',  0,     100, TRUE,  1 FROM products WHERE sku = 'P001';
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '4kg',  14000, 60,  FALSE, 2 FROM products WHERE sku = 'P001';

-- ──────────────────────────────────────────
-- P002: 프리미엄 과일선물세트 에메랄드3호
-- ──────────────────────────────────────────
DELETE FROM product_options WHERE product_id = (SELECT id FROM products WHERE sku = 'P002');
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '에메랄드3호', 0, 40, TRUE, 1 FROM products WHERE sku = 'P002';

-- ──────────────────────────────────────────
-- P003: 제스프리 코끼리 점보 썬 골드키위
-- ──────────────────────────────────────────
DELETE FROM product_options WHERE product_id = (SELECT id FROM products WHERE sku = 'P003');
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '1.5kg', 0,     120, TRUE,  1 FROM products WHERE sku = 'P003';
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '3kg',   14000, 80,  FALSE, 2 FROM products WHERE sku = 'P003';
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '4.5kg', 24000, 50,  FALSE, 3 FROM products WHERE sku = 'P003';

-- ──────────────────────────────────────────
-- P004: 고당도 성주 참외
-- ──────────────────────────────────────────
DELETE FROM product_options WHERE product_id = (SELECT id FROM products WHERE sku = 'P004');
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '1.4kg', 0,     90,  TRUE,  1 FROM products WHERE sku = 'P004';
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '2kg',   5000,  70,  FALSE, 2 FROM products WHERE sku = 'P004';
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '4kg',   14000, 40,  FALSE, 3 FROM products WHERE sku = 'P004';

-- ──────────────────────────────────────────
-- P005: 고령 수박 (기존 삭제 후 재삽입)
-- ──────────────────────────────────────────
DELETE FROM product_options WHERE product_id = (SELECT id FROM products WHERE sku = 'P005');
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '5kg',  0,     80,  TRUE,  1 FROM products WHERE sku = 'P005';
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '6kg',  6000,  60,  FALSE, 2 FROM products WHERE sku = 'P005';
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '7kg',  13000, 40,  FALSE, 3 FROM products WHERE sku = 'P005';

-- ──────────────────────────────────────────
-- P006: 유기농 신틸라 블루베리
-- ──────────────────────────────────────────
DELETE FROM product_options WHERE product_id = (SELECT id FROM products WHERE sku = 'P006');
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '로열과',  0,    100, TRUE,  1 FROM products WHERE sku = 'P006';
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '특대과',  3000, 60,  FALSE, 2 FROM products WHERE sku = 'P006';

-- ──────────────────────────────────────────
-- P007: 프리미엄 마하차녹 무지개망고
-- ──────────────────────────────────────────
DELETE FROM product_options WHERE product_id = (SELECT id FROM products WHERE sku = 'P007');
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '1.4kg', 0,     90,  TRUE,  1 FROM products WHERE sku = 'P007';
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '2kg',   5000,  60,  FALSE, 2 FROM products WHERE sku = 'P007';
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '4kg',   15000, 30,  FALSE, 3 FROM products WHERE sku = 'P007';

-- ──────────────────────────────────────────
-- P008: 제스프리 루비레드 키위 (기존 삭제 후 재삽입)
-- ──────────────────────────────────────────
DELETE FROM product_options WHERE product_id = (SELECT id FROM products WHERE sku = 'P008');
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '1kg',   0,     100, TRUE,  1 FROM products WHERE sku = 'P008';
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '1.5kg', 7000,  70,  FALSE, 2 FROM products WHERE sku = 'P008';
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '2.5kg', 20000, 40,  FALSE, 3 FROM products WHERE sku = 'P008';

-- ──────────────────────────────────────────
-- P009: 짭짤이 토마토 1kg
-- ──────────────────────────────────────────
DELETE FROM product_options WHERE product_id = (SELECT id FROM products WHERE sku = 'P009');
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '1kg (500g×2팩)', 0, 80, TRUE, 1 FROM products WHERE sku = 'P009';

-- ──────────────────────────────────────────
-- P010: 씨 없는 스윗 사파이어 포도
-- ──────────────────────────────────────────
DELETE FROM product_options WHERE product_id = (SELECT id FROM products WHERE sku = 'P010');
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '1.4kg (700g×2팩)', 0, 70, TRUE, 1 FROM products WHERE sku = 'P010';

-- ──────────────────────────────────────────
-- P011: 블러드 오렌지
-- ──────────────────────────────────────────
DELETE FROM product_options WHERE product_id = (SELECT id FROM products WHERE sku = 'P011');
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '1.5kg', 0,     90,  TRUE,  1 FROM products WHERE sku = 'P011';
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '2.5kg', 8000,  60,  FALSE, 2 FROM products WHERE sku = 'P011';
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '4kg',   18000, 35,  FALSE, 3 FROM products WHERE sku = 'P011';

-- ──────────────────────────────────────────
-- P012: 프리미엄 애플망고
-- ──────────────────────────────────────────
DELETE FROM product_options WHERE product_id = (SELECT id FROM products WHERE sku = 'P012');
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '1.5kg', 0,     80,  TRUE,  1 FROM products WHERE sku = 'P012';
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '2kg',   8000,  55,  FALSE, 2 FROM products WHERE sku = 'P012';
INSERT INTO product_options (product_id, label, add_price, stock, is_default, sort_order)
SELECT id, '3.8kg', 22000, 30,  FALSE, 3 FROM products WHERE sku = 'P012';
