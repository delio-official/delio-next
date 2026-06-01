-- ══════════════════════════════════════════
--  refund_requests.status CHECK 제약을 코드 값에 맞게 재설정
-- ══════════════════════════════════════════
-- 어드민 처리 시 사용하는 상태값: pending | processing | completed | rejected
-- 기존 제약이 이 값들을 허용하지 않아 "check constraint" 위반 발생 → 재정의

ALTER TABLE public.refund_requests DROP CONSTRAINT IF EXISTS refund_requests_status_check;

ALTER TABLE public.refund_requests
  ADD CONSTRAINT refund_requests_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'rejected'));
