-- ════════════════════════════════════════════════════════════════
-- 취소/환불 구분: refund_requests.type
--   'cancel' = 주문취소(배송 전) · 'refund' = 환불(배송완료 후)
--   기존 행은 모두 환불로 간주(default 'refund')
-- ════════════════════════════════════════════════════════════════
alter table public.refund_requests
  add column if not exists type text not null default 'refund';
