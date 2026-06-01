-- ══════════════════════════════════════════
--  주문 배송완료 시각 (환불 유효기간 계산용)
-- ══════════════════════════════════════════
-- 주문 상태가 'delivered'로 바뀐 시각을 기록 → "배송완료 후 N일 이내 환불" 판정에 사용
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
