-- 환불신청 상태에 'hold'(보류) 추가 — 관리자가 [보류] 누를 때 CHECK 제약 위반 방지
-- (기존 제약: pending/processing/completed/rejected 만 허용 → hold 누락)

alter table public.refund_requests drop constraint if exists refund_requests_status_check;
alter table public.refund_requests
  add constraint refund_requests_status_check
  check (status in ('pending', 'processing', 'completed', 'rejected', 'hold'));
