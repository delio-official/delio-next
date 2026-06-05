-- 환불 거부(불가) 사유 컬럼 추가
-- 관리자가 환불 불가 처리 시 사유를 저장하고, 고객 마이페이지 환불 내역에 노출한다.

alter table public.refund_requests
  add column if not exists reject_reason text;

-- 참고: status 값은 text라 'hold'(환불 보류) 추가에 별도 스키마 변경 불필요.
--   pending(환불요청) · hold(환불보류) · processing(진행중) · completed(환불완료) · rejected(환불불가)
