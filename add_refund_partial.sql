-- 부분환불(전액취소+재송금) 관리용 컬럼 추가
-- 실행 위치: Supabase SQL Editor
-- 신선식품 부분환불: 카드 전액취소 후 소비자가 정상분(재송금액)을 재입금하는 방식.
--   refund_amount  : 실제 하자분 순환불액(= 상품금액 × 하자수량/전체수량 합)
--   resend_amount  : 소비자가 재송금할 금액(= 주문총액 - refund_amount)
--   resend_status  : 재송금 상태 none(해당없음/전액환불) / waiting(재송금 대기) / received(입금확인)
--   refund_items   : 상품별 [{name,total,defective,refund}] 스냅샷(jsonb)
--   memo           : 관리자 메모(작업상태·특이사항)

alter table public.refund_requests
  add column if not exists refund_amount integer,
  add column if not exists resend_amount integer,
  add column if not exists resend_status text default 'none',
  add column if not exists refund_items  jsonb,
  add column if not exists memo          text;
